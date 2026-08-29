import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { memberFromReq, unauthorizedIfBearer } from "@/lib/memberAuth";
import { frequentFoodsInWindow, mealWindowAt, mealWindowRange } from "@/lib/foodCache";
import { getTrainingProfile } from "@/lib/trainingProfileStore";
import { applyLoggedMeals } from "@/lib/watchMealDone";

export const dynamic = "force-dynamic";

/**
 * ข้อมูลฝั่ง "โภชนาการ" ของแอปนาฬิกา — คำขอเดียวจบ
 *
 * ทำไมต้องมีเส้นนี้: เดิมนาฬิกาดึง `/api/plan?month=` มาทั้งเดือน (~25 KB) เพื่อเอาแค่วันเดียว
 * ทุกครั้งที่ยกข้อมือ = เปลืองแบต/เน็ตของนาฬิกาฟรี ๆ · เส้นนี้คืนเฉพาะของวันนี้ (~1 KB)
 *
 * GET /api/coach/watch/today?date=YYYY-MM-DD&tzOffset=-420
 * →  { planId, meals:[{slot,menu,kcal,done}], usual:[{name,calories,...}], window:{label,range} }
 *
 * `usual` = เมนูที่เจ้าตัวกินประจำ "ช่วงเวลานี้" (จาก MealLog 60 วัน ไม่เรียก AI ไม่หักเครดิต)
 */

/**
 * ลำดับมื้อบนหน้าจอ — ต้องเรียงตามเวลาจริงของวัน ไม่ใช่ลำดับที่ AI เขียนมาใน mealPlan
 * ชื่อ slot ที่ planGenerator ใช้จริงตอนนี้มี 4 แบบ: เช้า / กลางวัน / ว่าง / เย็น
 * (เผื่อชื่อละเอียดกว่านี้ไว้ด้วย เผื่อแผนรุ่นหลังแยกว่างเช้า-ว่างดึก)
 */
const SLOT_ORDER = ["เช้า", "ว่างเช้า", "กลางวัน", "ว่าง", "ว่างบ่าย", "เย็น", "ว่างดึก"];


export async function GET(req: NextRequest) {
  try {
    const dateStr = req.nextUrl.searchParams.get("date");
    const tzOffset = parseInt(req.nextUrl.searchParams.get("tzOffset") || "-420", 10);

    const member = await memberFromReq(req);
    if (!member) {
      return unauthorizedIfBearer(req) ?? NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // เวลาไทยตอนนี้ (นาทีจากเที่ยงคืน) — ใช้เลือกช่วงมื้อ
    // tzOffset มาจากนาฬิกาแบบเดียวกับ JS getTimezoneOffset() (ไทย = -420)
    const nowMinutes = (() => {
      const utc = new Date();
      const local = new Date(utc.getTime() - tzOffset * 60_000);
      return local.getUTCHours() * 60 + local.getUTCMinutes();
    })();
    const window = mealWindowAt(nowMinutes);

    // แผนของ "วันนี้" — DailyPlan.date เก็บเป็น UTC-midnight ของวันที่แบบ BKK
    const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")
      ? (dateStr as string)
      : new Date(Date.now() - tzOffset * 60_000).toISOString().slice(0, 10);
    const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const locked = !isAiCoachActive(member);

    const [plan, usual, trainProfile, todayLogs] = await Promise.all([
      locked
        ? Promise.resolve(null)
        : prisma.dailyPlan.findFirst({
            where: { memberId: member.id, date: { gte: dayStart, lt: dayEnd } },
            select: { id: true, mealsDone: true, mealPlan: true, exercisePlan: true, exerciseItemsDone: true },
          }),
      // ของที่กินประจำช่วงนี้ไม่ใช่ฟีเจอร์คอร์ส (เป็นบันทึกของเจ้าตัวเอง) → ให้แม้ไม่มีสิทธิ์แผน
      frequentFoodsInWindow(member.id, window, 6).catch(() => []),
      /* 🔴 29 ส.ค. 69 เจ้าของเคาะ: ยังไม่ตั้งโปรไฟล์การเทรน = ห้ามโชว์ชุดท่าทั้ง 3 จอ
         เดิม /workout ซ่อนไว้ (เจ้าของสั่งเองว่า "แผนที่ระบบเดาให้เองโดยไม่รู้เป้าหมาย/อุปกรณ์
         ไม่ควรเอามาให้ทำตาม") แต่นาฬิกาไม่รู้จักเงื่อนไขนี้เลยโชว์ครบ — สองจอสอนคนละอย่าง */
      locked ? Promise.resolve(null) : getTrainingProfile(member.id, new Date()).catch(() => null),
      /* 🔴 29 ส.ค. 69 เจ้าของเคาะ "ข้อ ก": บันทึกจริงคือความจริงเดียว แผนเป็นแค่คำแนะนำ
         ต้องดึงบันทึกอาหารของวันนี้มาด้วย เพื่อตัดสินว่ามื้อไหน "กินไปแล้ว"
         (วันของ MealLog ใช้กรอบเดียวกับ /api/cal/initial-data คือ 00:00–24:00 ตามเขตเวลาเครื่อง) */
      locked
        ? Promise.resolve([] as Array<{ date: Date }>)
        : prisma.mealLog.findMany({
            where: {
              memberId: member.id,
              date: {
                gte: new Date(dayStart.getTime() + tzOffset * 60_000),
                lt: new Date(dayEnd.getTime() + tzOffset * 60_000),
              },
            },
            select: { date: true },
          }),
    ]);

    /*
     * แผนออกกำลังกายวันนี้ (หน้า 3 ของนาฬิกา)
     * ⚠️ exerciseItemsDone ใช้ "ชื่อท่า" เป็นคีย์ (ไม่ใช่ index) — ต้องตรงกับ PATCH /api/plan/[id]
     *    ที่ derive exerciseDone = ครบทุกท่า จากชื่อเดียวกันนี้
     */
    const exDone = (plan?.exerciseItemsDone as Record<string, unknown> | null) || {};
    const exPlan = (plan?.exercisePlan as any) || null;
    const exercises = (((exPlan?.items as any[]) || [])
      .map((it) => {
        const name = String(it?.name ?? "").trim();
        if (!name) return null;
        // รูปแบบเดียวกับ exAmount() ในแอปมือถือ — "3 เซ็ต × 12 ครั้ง" / "20 นาที"
        const per = it?.reps ? `${it.reps} ครั้ง` : it?.minutes ? `${it.minutes} นาที` : "";
        const detail = it?.sets ? (per ? `${it.sets} เซ็ต × ${per}` : `${it.sets} เซ็ต`) : per;
        /* 🔴 29 ส.ค. 69 เพิ่ม note — ของเดิมส่งแค่ {name, detail, done}
           วันที่คะแนนความพร้อมต่ำ ระบบเปลี่ยนท่าทั้งวันเป็นเดินเร็ว+ยืดเหยียด แล้วนาฬิกาโชว์
           หัวข้อเดิม "คาร์ดิโอ + เวทเทรนนิ่ง" กับท่าเดินเล่น โดยไม่บอกสักคำว่าทำไม
           ผิดหลักที่เขียนไว้เองใน readiness.ts/workoutAdjust.ts ว่า "ระบบต้องไม่เงียบ"
           แอปมือถือโชว์บรรทัดนี้อยู่แล้ว (workout.tsx) นาฬิกาแค่ไม่เคยได้รับ */
        const note = [it?.readinessNote, it?.adjustNote]
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .find((t) => t.length > 0) ?? "";
        return { name, detail, done: exDone[name] === true, note };
      })
      .filter(Boolean) as Array<{ name: string; detail: string; done: boolean; note: string }>);

    const done = (plan?.mealsDone as Record<string, unknown> | null) || {};
    const rawMeals = ((plan?.mealPlan as any)?.meals as any[]) || [];
    const meals = rawMeals
      .map((m) => ({
        slot: String(m?.slot ?? ""),
        menu: String(m?.menu ?? ""),
        kcal: Math.round(Number(m?.kcal) || 0),
        done: done[String(m?.slot ?? "")] === true,
      }))
      .filter((m) => m.slot && m.menu)
      .sort((a, b) => {
        const ia = SLOT_ORDER.indexOf(a.slot);
        const ib = SLOT_ORDER.indexOf(b.slot);
        // มื้อที่ไม่รู้จักไปท้ายสุด แต่ยังคงลำดับเดิมระหว่างกัน
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

    /* 🔴 "ข้อ ก" (เจ้าของเคาะ 29 ส.ค. 69) — ปิดมื้อจากบันทึกจริง ไม่ใช่แค่จากปุ่มติ๊กบนนาฬิกา
       กติกาจับคู่อยู่ใน src/lib/watchMealDone.ts พร้อมข้อสอบที่ scripts/test-watch-meals.ts */
    applyLoggedMeals(
      meals,
      todayLogs.map((l) => {
        const local = new Date(l.date.getTime() - tzOffset * 60_000);
        return local.getUTCHours() * 60 + local.getUTCMinutes();
      }),
    );

    const res = NextResponse.json({
      planId: plan?.id ?? null,
      locked,
      meals,
      doneCount: meals.filter((m) => m.done).length,
      exercises,
      exerciseTitle: typeof exPlan?.title === "string" ? exPlan.title : null,
      // true = นาฬิกาต้องซ่อนชุดท่าแล้วชวนไปตั้งค่าที่มือถือ (เหมือนหน้า /workout)
      needTrainProfile: !locked && !trainProfile,
      exerciseDoneCount: exercises.filter((e) => e.done).length,
      usual: usual.map((u) => ({
        name: u.name,
        calories: u.calories,
        protein: u.protein,
        carbs: u.carbs,
        fat: u.fat,
        sodium: u.sodium,
        sugar: u.sugar,
      })),
      window: { key: window.key, label: window.label, range: mealWindowRange(window) },
    });
    // ข้อมูลสดรายบุคคล — ห้ามแคช (บทเรียนเดิม: ติ๊กแล้วตัวเลขไม่ขยับเพราะ OS คืนสำเนาเก่า)
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: any) {
    console.error("[coach/watch/today]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
