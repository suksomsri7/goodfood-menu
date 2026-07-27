import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { bkkTodayKey, addDays } from "@/lib/planGenerator";

/**
 * รายการซื้อของ (WO-5.5) — รวมวัตถุดิบจากแผน 7 วัน
 * GET ?start=today|nextWeek (Bearer) → { items:[{name, count}] }
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const start = new URL(req.url).searchParams.get("start") === "nextWeek" ? addDays(bkkTodayKey(), 7) : bkkTodayKey();
  const end = addDays(start, 6);
  const plans = await prisma.dailyPlan.findMany({ where: { memberId: member.id, date: { gte: start, lte: end } } });

  // รวม ingredients จากทุกมื้อ (นับความถี่)
  const counts: Record<string, number> = {};
  for (const p of plans) {
    const mp = p.mealPlan as { meals?: { ingredients?: string }[] } | null;
    for (const m of mp?.meals || []) {
      const ing = (m.ingredients || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      for (const it of ing) counts[it] = (counts[it] || 0) + 1;
    }
  }
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  return NextResponse.json({ items, days: plans.length });
}
