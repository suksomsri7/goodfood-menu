import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { sanitizeLogInstant, clampToDayWindow } from "@/lib/coachLogTime";
import { normalizeSets, rollupSets } from "@/lib/setRollup";
import {
  planDayWindow,
  bkkDayWindow,
  mergeExerciseItemsDone,
  deriveExerciseDone,
  derivePlanStatus,
  findPlanItem,
  type PlanExerciseItem,
} from "@/lib/planTick";

export const dynamic = "force-dynamic";

/**
 * Workout Player ยิงเข้ามาตอนเล่นจบ "ท่า" หนึ่ง
 * POST { planId?, exerciseKey, exerciseName?, sets:[{setNo,target*,actual*,feel?,rpe?}], logAt? }
 *   → { ok, exerciseLogId, tickedPlan, rollup }
 *
 * ทำ 3 อย่างในครั้งเดียว:
 *   1. เก็บรายเซ็ตดิบ (SetLog) — อาหารของ engine progression เฟส B
 *   2. รวมยอดเป็น ExerciseLog 1 แถวต่อท่าต่อวัน (source="player") — ไทม์ไลน์/วงแหวนเดิมอ่านจากตารางนี้
 *   3. ติ๊กท่านั้นในแผน ถ้าท่าอยู่ในแผนของวันนั้น
 *
 * 🔴 ยิงซ้ำ/ยิงทีละเซ็ตได้ — ยอดใน ExerciseLog คิดใหม่จาก SetLog ทั้งวันเสมอ ไม่ใช่บวกทับ (กันแคลอรี่บวม)
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const exerciseKey = String(body?.exerciseKey ?? "").trim().slice(0, 60);
    if (!exerciseKey) return NextResponse.json({ error: "ไม่ทราบว่าเป็นท่าไหน — ลองเริ่มท่าใหม่อีกครั้งนะ" }, { status: 400 });

    const sets = normalizeSets(body?.sets);
    if (sets.length === 0) return NextResponse.json({ error: "ยังไม่มีเซ็ตที่บันทึกได้" }, { status: 400 });

    // ชื่อท่า: ใช้ของ DB ก่อน (ชื่อมาตรฐาน) แล้วค่อยใช้ที่แอปส่งมา — บันทึกต้องอ่านออกแม้ท่าถูกลบทีหลัง
    const exercise = await prisma.exercise.findUnique({ where: { key: exerciseKey } });
    const exerciseName =
      (exercise?.name || String(body?.exerciseName ?? "").trim() || exerciseKey).slice(0, 120);

    // ── เวลา: กติกาเดียวกับติ๊กแผน (อนาคต = ไม่เชื่อ · เปิดแผนย้อนหลัง = บีบเข้าวันของแผน) ──
    const planId = typeof body?.planId === "string" && body.planId ? body.planId : null;
    const plan = planId ? await prisma.dailyPlan.findUnique({ where: { id: planId } }) : null;
    if (plan && plan.memberId !== member.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const raw = sanitizeLogInstant(body?.logAt);
    const { dayStart, dayEnd } = plan ? planDayWindow(plan.date) : bkkDayWindow(raw);
    const logDate = clampToDayWindow(raw, dayStart, dayEnd);

    await prisma.setLog.createMany({
      data: sets.map((s) => ({
        memberId: member.id,
        planId: plan?.id ?? null,
        exerciseKey,
        exerciseName,
        setNo: s.setNo,
        targetWeightKg: s.targetWeightKg,
        targetReps: s.targetReps,
        targetSec: s.targetSec,
        actualWeightKg: s.actualWeightKg,
        actualReps: s.actualReps,
        actualSec: s.actualSec,
        feel: s.feel,
        rpe: s.rpe,
        date: logDate,
      })),
    });

    // ── รวมยอดใหม่จากทุกเซ็ตของท่านี้ในวันนั้น ──
    const dayRows = await prisma.setLog.findMany({
      where: { memberId: member.id, exerciseKey, date: { gte: dayStart, lt: dayEnd } },
      orderBy: { date: "asc" },
    });
    // น้ำหนักตัวใช้คิด kcal: ค่าในโปรไฟล์ก่อน ไม่มีก็ใช้ครั้งที่ชั่งล่าสุด
    let bodyWeightKg = member.weight ?? null;
    if (bodyWeightKg == null) {
      const last = await prisma.weightLog.findFirst({
        where: { memberId: member.id },
        orderBy: { date: "desc" },
        select: { weight: true },
      });
      bodyWeightKg = last?.weight ?? null;
    }
    const rollup = rollupSets(
      dayRows.map((r) => ({
        setNo: r.setNo,
        targetWeightKg: r.targetWeightKg,
        targetReps: r.targetReps,
        targetSec: r.targetSec,
        actualWeightKg: r.actualWeightKg,
        actualReps: r.actualReps,
        actualSec: r.actualSec,
        feel: r.feel,
        rpe: r.rpe,
      })),
      { met: exercise?.met ?? null, bodyWeightKg }
    );

    /* 1 ท่า = 1 แถวสรุปต่อวัน — ผูกด้วย sourceId ไม่ใช่ชื่อ (แอดมินเปลี่ยนชื่อท่ากลางวันได้)
       dayKey เอาจาก dayStart+7h = เที่ยงคืนไทยของวันนั้นเสมอ */
    const dayKey = new Date(dayStart.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const sourceId = `player:${exerciseKey}:${dayKey}`;
    const existing = await prisma.exerciseLog.findFirst({
      where: { memberId: member.id, source: "player", sourceId },
    });
    const logData = {
      name: exerciseName,
      duration: rollup.durationMin,
      calories: rollup.calories,
      source: "player",
      sourceId,
      date: logDate,
    };
    const exerciseLog = existing
      ? await prisma.exerciseLog.update({ where: { id: existing.id }, data: logData })
      : await prisma.exerciseLog.create({ data: { memberId: member.id, ...logData } });

    /* เคยติ๊กท่านี้ด้วยมือไว้ก่อน (log source="plan" ของวันเดียวกัน) → ลบทิ้ง
       ไม่งั้นวันนั้นจะมีทั้งค่าประมาณจากการติ๊กและค่าจริงจาก Player = แคลอรี่นับซ้ำ */
    if (plan) {
      const planLogs = await prisma.exerciseLog.findMany({
        where: { memberId: member.id, source: "plan", name: exerciseName, date: { gte: dayStart, lt: dayEnd } },
        select: { id: true },
      });
      if (planLogs.length) await prisma.exerciseLog.deleteMany({ where: { id: { in: planLogs.map((l) => l.id) } } });
    }

    // ── ติ๊กแผน (ถ้าท่าอยู่ในแผนวันนั้น) — ใช้ตรรกะร่วมกับ PATCH /api/plan/[id] ──
    let tickedPlan = false;
    if (plan) {
      const ep = plan.exercisePlan as { items?: PlanExerciseItem[] } | null;
      const items = ep?.items ?? [];
      const hit = findPlanItem(items, exerciseKey, exerciseName);
      if (hit) {
        const itemsDone = mergeExerciseItemsDone(plan.exerciseItemsDone as Record<string, boolean> | null, {
          [hit.name]: true,
        });
        const exerciseDone = deriveExerciseDone({
          items,
          itemsDone,
          itemsPatched: true,
          current: plan.exerciseDone,
        });
        const mealPlan = plan.mealPlan as { meals?: { slot: string }[] } | null;
        await prisma.dailyPlan.update({
          where: { id: plan.id },
          data: {
            exerciseItemsDone: itemsDone ?? undefined,
            exerciseDone,
            status: derivePlanStatus(exerciseDone, plan.mealsDone as Record<string, boolean> | null, mealPlan?.meals?.length ?? 0),
          },
        });
        tickedPlan = true;
      }
    }

    const res = NextResponse.json({
      ok: true,
      exerciseLogId: exerciseLog.id,
      tickedPlan,
      savedSets: sets.length,
      rollup,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/sets]", e);
    return NextResponse.json({ error: "บันทึกเซ็ตไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
