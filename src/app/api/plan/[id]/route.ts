import { NextRequest, NextResponse } from "next/server";
import { sanitizeLogInstant, clampToDayWindow } from "@/lib/coachLogTime";
import { planDayWindow, mergeExerciseItemsDone, deriveExerciseDone, derivePlanStatus } from "@/lib/planTick";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { memberFromReq, unauthorizedIfBearer, unauthorizedIfNoIdentity } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

// PATCH /api/plan/[id] { lineUserId?, exerciseDone?, mealsDone? }  (+ Bearer native)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { lineUserId, exerciseDone, mealsDone, exerciseItemsDone, exerciseItemOverrides, logAt } = await request.json();
    const logAtRaw = sanitizeLogInstant(logAt);

    const member = await memberFromReq(request, lineUserId);
    if (!member) {
      return unauthorizedIfBearer(request) ?? (await unauthorizedIfNoIdentity(request)) ?? NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (!isAiCoachActive(member)) {
      return NextResponse.json({ error: "ฟีเจอร์นี้สำหรับสมาชิกคอร์ส", locked: true }, { status: 403 });
    }

    const plan = await prisma.dailyPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // B1: ขอบเขตวันของแผน (plan.date = UTC midnight ของวัน BKK → วัน BKK จริงใน UTC = [−7h, +17h))
    // ใช้กรองตอน "ติ๊กออก" — เดิมลบ log "ชื่อเดียวกัน แถวล่าสุด" โดยไม่ดูวัน
    // แผนใช้เมนู/ท่าซ้ำกันหลายวัน → ติ๊กออกวันนี้เคยเสี่ยงไปลบบันทึกของวันอื่นเงียบ ๆ
    // (ย้ายสูตรหน้าต่างวันไป lib/planTick แล้ว — Workout Player ใช้ตัวเดียวกัน)
    const { dayStart, dayEnd } = planDayWindow(plan.date);
    // แอปส่ง logAt = เวลาปัจจุบันของเครื่องเสมอ แม้เปิดดูแผนของวันย้อนหลัง
    // → ติ๊กแผนเมื่อวานแล้วบันทึกไปโผล่วันนี้ · บังคับให้อยู่ในวันของแผน
    const logDate = clampToDayWindow(logAtRaw, dayStart, dayEnd);
    // ownership
    if (plan.memberId !== member.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ติ๊กรายท่า (Coach native): merge แล้ว derive exerciseDone = ครบทุกท่า
    const nextItemsDone = mergeExerciseItemsDone(plan.exerciseItemsDone as Record<string, boolean> | null, exerciseItemsDone);
    const exItemsFull =
      (plan.exercisePlan as { items?: { name: string; minutes?: number; sets?: number; reps?: number }[] } | null)?.items ?? [];
    const nextExerciseDone = deriveExerciseDone({
      items: exItemsFull,
      itemsDone: nextItemsDone,
      itemsPatched: !!exerciseItemsDone,
      explicit: exerciseDone,
      current: plan.exerciseDone,
    });
    const nextMealsDone =
      mealsDone && typeof mealsDone === "object"
        ? { ...(plan.mealsDone as Record<string, boolean> | null), ...mealsDone }
        : (plan.mealsDone as Record<string, boolean> | null);

    // คำนวณ status จากความคืบหน้า
    const mealPlan = plan.mealPlan as { meals?: { slot: string }[] } | null;
    const status = derivePlanStatus(nextExerciseDone, nextMealsDone, mealPlan?.meals?.length ?? 0);

    // ── ติ๊ก = บันทึกจริงลง timeline (สร้าง/ลบ log ตาม transition) ──
    const mp = plan.mealPlan as { meals?: { slot: string; menu: string; kcal: number; protein: number; carbs: number; fat: number; sodium?: number; sugar?: number }[] } | null;
    if (mealsDone && typeof mealsDone === "object" && mp?.meals) {
      const prev = (plan.mealsDone as Record<string, boolean> | null) || {};
      for (const [slot, val] of Object.entries(mealsDone as Record<string, boolean>)) {
        const meal = mp.meals.find((m) => m.slot === slot);
        if (!meal) continue;
        if (val && !prev[slot]) {
          await prisma.mealLog.create({
            data: {
              memberId: member.id, name: meal.menu,
              calories: meal.kcal || 0, protein: meal.protein || 0, carbs: meal.carbs || 0, fat: meal.fat || 0,
              sodium: meal.sodium ?? null, sugar: meal.sugar ?? null,
              via: "plan", date: logDate,
            },
          });
        } else if (!val && prev[slot]) {
          const last = await prisma.mealLog.findFirst({
            where: { memberId: member.id, via: "plan", name: meal.menu, date: { gte: dayStart, lt: dayEnd } },
            orderBy: { createdAt: "desc" },
          });
          if (last) await prisma.mealLog.delete({ where: { id: last.id } });
        }
      }
    }
    /* ค่าที่ user ปรับเองจากชีต "ดูท่า" (เซ็ต/ครั้ง/นาที) — เขียนทับลงแผนก่อนคิด log
       ทำไมต้องลงแผน: หน้าจอทุกที่อ่านจาก exercisePlan.items ถ้าไม่อัปเดต ตัวเลขที่โชว์กับที่บันทึกจะไม่ตรงกัน
       clamp กันค่าหลุดโลก (เซ็ต ≤10 · ครั้ง ≤100 · นาที ≤240) */
    let itemsMutated = false;
    if (exerciseItemOverrides && typeof exerciseItemOverrides === "object") {
      const planObj = plan.exercisePlan as { items?: { name: string; minutes?: number; sets?: number; reps?: number }[] } | null;
      for (const [name, ov] of Object.entries(exerciseItemOverrides as Record<string, { sets?: number; reps?: number; minutes?: number }>)) {
        const it = planObj?.items?.find((x) => x.name === name);
        if (!it || !ov || typeof ov !== "object") continue;
        const clamp = (v: unknown, max: number) => {
          const n = Math.round(Number(v));
          return Number.isFinite(n) && n > 0 ? Math.min(max, n) : undefined;
        };
        const sets = clamp(ov.sets, 10);
        const reps = clamp(ov.reps, 100);
        const minutes = clamp(ov.minutes, 240);
        if (sets !== undefined) { it.sets = sets; itemsMutated = true; }
        if (reps !== undefined) { it.reps = reps; itemsMutated = true; }
        if (minutes !== undefined) { it.minutes = minutes; itemsMutated = true; }
      }
    }

    const ep = plan.exercisePlan as { title?: string; durationMin?: number; caloriesTarget?: number } | null;
    // ── ติ๊กรายท่า = บันทึกทีละท่าทันที (ไม่ต้องรอครบทุกท่า) ──
    // เดิมสร้าง log ก้อนเดียวตอนครบทุกท่า → user ติ๊ก 1/3 แล้วไม่มีอะไรเข้า timeline/แหวนเลย
    const itemLevel = !!(exerciseItemsDone && typeof exerciseItemsDone === "object" && exItemsFull.length > 0);
    if (itemLevel) {
      const prevItems = (plan.exerciseItemsDone as Record<string, boolean> | null) || {};
      // แบ่ง kcal เป้าตามน้ำหนักเวลาของแต่ละท่า (ท่านับครั้ง ≈ 1.5 นาที/เซ็ต)
      const weightOf = (it: { minutes?: number; sets?: number }) =>
        Number(it.minutes) > 0 ? Number(it.minutes) : Math.max(1, Number(it.sets) || 1) * 1.5;
      const totalW = exItemsFull.reduce((s, it) => s + weightOf(it), 0) || 1;
      for (const [name, val] of Object.entries(exerciseItemsDone as Record<string, boolean>)) {
        const it = exItemsFull.find((x) => x.name === name);
        if (!it) continue;
        const w = weightOf(it);
        if (val && !prevItems[name]) {
          await prisma.exerciseLog.create({
            data: {
              memberId: member.id, name,
              duration: Math.round(w),
              calories: Math.round(((ep?.caloriesTarget || 0) * w) / totalW),
              source: "plan", date: logDate,
            },
          });
        } else if (!val && prevItems[name]) {
          /* ติ๊กออก = "ที่บันทึกไปไม่จริง" — ต้องลบทั้ง log ที่มาจากติ๊กมือ (plan) และจาก Workout Player
             ไม่งั้นแคลอรี่ค้างในแหวน/ไทม์ไลน์ทั้งที่แผนบอกยังไม่ทำ (เจอจาก E2E เฟส A)
             log ของ player พ่วง SetLog รายเซ็ต — ข้อมูลเท็จห้ามเหลือไว้ให้ progression engine กิน
             (exerciseKey แกะจาก sourceId รูปแบบ player:<key>:<วัน> — ไม่เดาจากชื่อ) */
          const last = await prisma.exerciseLog.findFirst({
            where: { memberId: member.id, source: { in: ["plan", "player"] }, name, date: { gte: dayStart, lt: dayEnd } },
            orderBy: { createdAt: "desc" },
          });
          if (last) {
            await prisma.exerciseLog.delete({ where: { id: last.id } });
            const key = last.source === "player" ? last.sourceId?.split(":")[1] : null;
            if (key) {
              await prisma.setLog.deleteMany({
                where: { memberId: member.id, exerciseKey: key, date: { gte: dayStart, lt: dayEnd } },
              });
            }
          }
        }
      }
      // แผนที่เคยติ๊กครบด้วยเวอร์ชันเก่าจะมี log ก้อนรวม (ชื่อ = title) ค้างอยู่ → เก็บกวาดตอนติ๊กออก
      if (!nextExerciseDone && plan.exerciseDone && ep?.title) {
        const legacy = await prisma.exerciseLog.findFirst({
          where: { memberId: member.id, source: "plan", name: ep.title, date: { gte: dayStart, lt: dayEnd } },
          orderBy: { createdAt: "desc" },
        });
        if (legacy) await prisma.exerciseLog.delete({ where: { id: legacy.id } });
      }
    } else if (nextExerciseDone !== plan.exerciseDone && ep?.title) {
      // ทางเดิม (LIFF ส่ง exerciseDone มาตรง ๆ ไม่มีรายท่า) = log ก้อนเดียวทั้งเซสชัน
      if (nextExerciseDone) {
        await prisma.exerciseLog.create({
          data: {
            memberId: member.id, name: ep.title, duration: ep.durationMin || 0,
            calories: ep.caloriesTarget || 0, source: "plan", date: logDate,
          },
        });
      } else {
        const last = await prisma.exerciseLog.findFirst({
          where: { memberId: member.id, source: "plan", name: ep.title, date: { gte: dayStart, lt: dayEnd } },
          orderBy: { createdAt: "desc" },
        });
        if (last) await prisma.exerciseLog.delete({ where: { id: last.id } });
      }
    }

    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: {
        exerciseDone: nextExerciseDone,
        mealsDone: nextMealsDone ?? undefined,
        exerciseItemsDone: nextItemsDone ?? undefined,
        // ค่าเซ็ต/ครั้ง/นาทีที่ user ปรับ — mutate ลง object เดิมข้างบนแล้ว เขียนกลับเมื่อมีการแก้จริง
        ...(itemsMutated ? { exercisePlan: plan.exercisePlan as object } : {}),
        status,
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      status: updated.status,
      exerciseDone: updated.exerciseDone,
      mealsDone: updated.mealsDone,
      exerciseItemsDone: updated.exerciseItemsDone,
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
