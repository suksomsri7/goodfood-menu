import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

/**
 * ลบรายการจาก timeline (ปัดซ้ายลบ) — ownership check เสมอ
 * POST { type: "meal"|"exercise"|"water", id } (Bearer) → { ok, untick? }
 *
 * บันทึกที่เกิดจากการติ๊กแผน (meal via="plan" / exercise source="plan") ต้อง "ติ๊กออก" ให้ด้วย
 * ไม่งั้นลบจากไทม์ไลน์แล้วเครื่องหมายถูกในแผนยังค้าง (บั๊กที่ user เจอ 1 ส.ค.)
 */

/** วันของแผนที่ log นี้สังกัด (plan.date = UTC midnight ของวัน BKK) */
function planDateOf(logDate: Date) {
  const bkk = new Date(logDate.getTime() + 7 * 3600 * 1000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));
}

function recomputeStatus(
  plan: { mealPlan: unknown },
  mealsDone: Record<string, boolean>,
  exerciseDone: boolean
) {
  const totalMeals = (plan.mealPlan as { meals?: unknown[] } | null)?.meals?.length ?? 0;
  const doneMeals = Object.values(mealsDone).filter(Boolean).length;
  if (exerciseDone && totalMeals > 0 && doneMeals >= totalMeals) return "done";
  if (exerciseDone || doneMeals > 0) return "partial";
  return "planned";
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { type, id } = await req.json();
    if (!id || !["meal", "exercise", "water"].includes(type)) {
      return NextResponse.json({ error: "type meal|exercise|water + id required" }, { status: 400 });
    }

    let count = 0;
    let untick: string | null = null;

    if (type === "meal") {
      const log = await prisma.mealLog.findFirst({ where: { id, memberId: member.id } });
      if (!log) return NextResponse.json({ error: "not found" }, { status: 404 });
      count = (await prisma.mealLog.deleteMany({ where: { id, memberId: member.id } })).count;

      /* 🔴 บันทึกนี้ตัดมาจาก "คลังอาหารของฉัน" → ลบทิ้งต้องคืนของเข้าคลัง
         (กดผิดแล้วของที่ลูกค้าจ่ายเงินมาหายฟรีไม่ได้ · คืนไม่เกินยอดที่เคยให้ไป) */
      if (count > 0 && log.stockId) {
        const stock = await prisma.memberFoodStock.findFirst({
          where: { id: log.stockId, memberId: member.id },
          select: { id: true, quantity: true, remaining: true },
        });
        if (stock && stock.remaining < stock.quantity) {
          await prisma.memberFoodStock.update({
            where: { id: stock.id },
            data: { remaining: { increment: 1 } },
          });
        }
      }

      if (log.via === "plan") {
        const plan = await prisma.dailyPlan.findFirst({
          where: { memberId: member.id, date: planDateOf(log.date) },
        });
        const meals = (plan?.mealPlan as { meals?: { slot: string; menu: string }[] } | null)?.meals ?? [];
        const slot = meals.find((m) => m.menu === log.name)?.slot;
        if (plan && slot) {
          const mealsDone = { ...((plan.mealsDone as Record<string, boolean> | null) || {}), [slot]: false };
          await prisma.dailyPlan.update({
            where: { id: plan.id },
            data: { mealsDone, status: recomputeStatus(plan, mealsDone, plan.exerciseDone) },
          });
          untick = slot;
        }
      }
    } else if (type === "exercise") {
      const log = await prisma.exerciseLog.findFirst({ where: { id, memberId: member.id } });
      if (!log) return NextResponse.json({ error: "not found" }, { status: 404 });
      count = (await prisma.exerciseLog.deleteMany({ where: { id, memberId: member.id } })).count;

      /* log จาก Workout Player: ลบจากไทม์ไลน์ = ติ๊กท่านั้นออกด้วย (สัญญาเดียวกับ log จากติ๊กแผน)
         + ลบ SetLog รายเซ็ตของท่านั้นในวันเดียวกัน — ข้อมูลที่ user บอกว่าไม่จริง ห้ามเหลือให้ progression กิน */
      if (log.source === "player" && log.sourceId) {
        const key = log.sourceId.split(":")[1];
        if (key) {
          const d0 = new Date(planDateOf(log.date).getTime() - 7 * 3600 * 1000);
          const d1 = new Date(planDateOf(log.date).getTime() + 17 * 3600 * 1000);
          await prisma.setLog.deleteMany({
            where: { memberId: member.id, exerciseKey: key, date: { gte: d0, lt: d1 } },
          });
        }
      }

      if (log.source === "plan" || log.source === "player") {
        const plan = await prisma.dailyPlan.findFirst({
          where: { memberId: member.id, date: planDateOf(log.date) },
        });
        const ep = plan?.exercisePlan as { title?: string; items?: { name: string }[] } | null;
        if (plan && ep) {
          const items = ep.items ?? [];
          let itemsDone = (plan.exerciseItemsDone as Record<string, boolean> | null) || {};
          if (items.some((it) => it.name === log.name)) {
            itemsDone = { ...itemsDone, [log.name]: false }; // ลบ log รายท่า → ติ๊กท่านั้นออก
            untick = log.name;
          } else if (ep.title === log.name) {
            itemsDone = {}; // log ก้อนรวมแบบเก่า → ติ๊กออกทั้งเซสชัน
            untick = ep.title;
          }
          if (untick) {
            const exerciseDone = items.length > 0 ? items.every((it) => itemsDone[it.name]) : false;
            await prisma.dailyPlan.update({
              where: { id: plan.id },
              data: {
                exerciseItemsDone: itemsDone,
                exerciseDone,
                status: recomputeStatus(plan, (plan.mealsDone as Record<string, boolean> | null) || {}, exerciseDone),
              },
            });
          }
        }
      }
    } else {
      count = (await prisma.waterLog.deleteMany({ where: { id, memberId: member.id } })).count;
    }

    if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, untick });
  } catch (e: any) {
    console.error("[delete-entry]", e);
    return NextResponse.json({ error: e.message || "delete failed" }, { status: 500 });
  }
}
