import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { memberFromReq, unauthorizedIfBearer } from "@/lib/memberAuth";
import { frequentFoodsInWindow, mealWindowAt, mealWindowRange } from "@/lib/foodCache";

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

    const [plan, usual] = await Promise.all([
      locked
        ? Promise.resolve(null)
        : prisma.dailyPlan.findFirst({
            where: { memberId: member.id, date: { gte: dayStart, lt: dayEnd } },
            select: { id: true, mealsDone: true, mealPlan: true },
          }),
      // ของที่กินประจำช่วงนี้ไม่ใช่ฟีเจอร์คอร์ส (เป็นบันทึกของเจ้าตัวเอง) → ให้แม้ไม่มีสิทธิ์แผน
      frequentFoodsInWindow(member.id, window, 6).catch(() => []),
    ]);

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

    const res = NextResponse.json({
      planId: plan?.id ?? null,
      locked,
      meals,
      doneCount: meals.filter((m) => m.done).length,
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
