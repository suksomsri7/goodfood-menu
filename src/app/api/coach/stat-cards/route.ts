import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { estimateEnergy } from "@/lib/energyModel";
import {
  buildEnergyBalance, buildTopFoods, buildRiskWindow, buildSleepEat,
  buildProteinSpread, buildRestingHR, dayKeyRange,
} from "@/lib/statCards";

export const dynamic = "force-dynamic";

/**
 * การ์ดสถิติ 6 ใบในคำขอเดียว (หน้า "สถิติ" ของแอปโค้ช)
 * GET /api/coach/stat-cards?days=30   (Bearer · default 30 · max 90)
 *
 * → { range, energyBalance, topFoods, riskWindow, sleepEat, proteinSpread, restingHR }
 *
 * ทุกก้อนมี `ready` — ข้อมูลไม่พอบอกตรง ๆ ไม่เดา (ดูเกณฑ์ในแต่ละ builder)
 * ประสิทธิภาพ: 4 query ยิงขนานทีเดียว + estimateEnergy — ไม่ไล่ query รายวัน
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(90, Math.round(raw)) : 30;

  const dayKeys = dayKeyRange(days);
  // ต้นช่วง = เที่ยงคืนไทยของวันแรก แปลงกลับเป็น UTC จริงเพื่อใช้ query
  const startUtc = new Date(Date.parse(`${dayKeys[0]}T00:00:00.000Z`) - 7 * 3600 * 1000);
  const where = { memberId: member.id, date: { gte: startUtc } };

  const [meals, exercises, metrics, sleeps, energy] = await Promise.all([
    prisma.mealLog.findMany({ where, select: { date: true, name: true, calories: true, protein: true, via: true } }),
    prisma.exerciseLog.findMany({ where, select: { date: true, calories: true } }),
    prisma.dailyMetric.findMany({ where, select: { date: true, activeKcal: true, restingHR: true } }),
    prisma.sleepLog.findMany({ where, select: { date: true, minutesAsleep: true } }),
    estimateEnergy(member.id).catch(() => null),
  ]);

  // baseTdee = พลังงานของ "วันที่ไม่ได้ออกกำลังกาย" (ไม่ใช่เป้าที่ควรกิน — ดูคอมเมนต์ใน statCards.ts)
  const baseTdee = Math.round(energy?.baseTdee ?? member.tdee ?? (member.bmr ?? 1500) * 1.2);

  const res = NextResponse.json({
    range: { from: dayKeys[0], to: dayKeys[dayKeys.length - 1], days },
    energyBalance: buildEnergyBalance({ dayKeys, meals, exercises, metrics, baseTdee }),
    topFoods: buildTopFoods(meals),
    riskWindow: buildRiskWindow(meals, dayKeys),
    sleepEat: buildSleepEat(sleeps, meals),
    proteinSpread: buildProteinSpread(meals),
    restingHR: buildRestingHR(metrics),
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
