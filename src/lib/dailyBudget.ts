/**
 * งบแคลอรี่รายวัน/รายสัปดาห์แบบ "ฐาน + คืนบางส่วน" (user เคาะ 1 ส.ค. 2026)
 *
 * ปัญหาของเป้าคงที่: TDEE รวมค่าเฉลี่ยการออกกำลังกายไว้แล้ว → วันไหนไม่ได้ออก กินเกินจริง 600-700 kcal
 * ทั้งที่ทำตามแอปเป๊ะ (user จับได้เอง)
 *
 * วิธีใหม่:
 *   ฐาน (base)   = พลังงานของ "วันที่ไม่ได้ออกกำลังกาย" − ส่วนขาด → เป้าของวันธรรมดา
 *   คืน (earned) = 60% ของแคลอรี่ที่ออกกำลังกายจริงวันนั้น (cap 600) → วันออกหนักได้กินเพิ่ม
 *   เป้าวันนี้    = ฐาน + คืน  (ไม่ต่ำกว่า BMR)
 *   งบสัปดาห์    = ฐาน × 7 + คืนสะสมของสัปดาห์ (จันทร์–อาทิตย์ เวลาไทย) → วันพลาดชดใช้วันอื่นได้
 *
 * ⚠️ ห้ามนับซ้ำ: Apple activeKcal รวมทั้ง NEAT (เดิน/ทำงาน) และ workout อยู่ด้วยกัน
 *    แต่ NEAT ถูกนับใน "ฐาน" ไปแล้ว → คืนจากแคลอรี่ workout ที่บันทึกเป็นหลัก
 *    ถ้าไม่มี workout แต่ activeKcal สูงผิดปกติ ค่อยคืนส่วนที่เกิน NEAT พื้นฐาน
 */
import { prisma } from "@/lib/prisma";

/** ตัวคูณ NEAT ของวันที่ไม่ได้ออกกำลังกาย (นั่งทำงาน + เดินใช้ชีวิตปกติ) */
export const NEAT_FACTOR = 1.35;
/** คืนแคลอรี่ที่ออกกำลังกายให้กินเพิ่มกี่ % — ไม่คืน 100% เพราะนาฬิกาประเมินสูงเกินจริง 10-20% */
export const EARN_RATE = 0.6;
/** เพดานการคืนต่อวัน กันเคสวิ่งมาราธอนแล้วกินคืนทั้งวัน */
export const EARN_CAP = 600;
/** ส่วนขาดต่อวันสำหรับลดน้ำหนัก (~0.5 กก./สัปดาห์) */
const DEFICIT = 500;
/** สัดส่วน NEAT ที่ถือว่ารวมอยู่ในฐานแล้ว (ใช้หักออกจาก activeKcal กันนับซ้ำ) */
const NEAT_IN_BASE = 0.35;

export interface DailyBudget {
  base: number; // เป้าของวันที่ไม่ได้ออกกำลังกาย
  earned: number; // ที่ได้เพิ่มจากการออกกำลังกายวันนี้
  target: number; // เป้าวันนี้ = base + earned
  exerciseKcal: number; // แคลอรี่ที่ออกกำลังกายจริงวันนี้ (ก่อนคูณ 60%)
  eaten: number; // กินไปแล้ววันนี้
  remaining: number;
  week: {
    budget: number; // ฐาน × 7 + คืนสะสมทั้งสัปดาห์
    used: number; // กินไปแล้วทั้งสัปดาห์
    remaining: number;
    daysLeft: number; // รวมวันนี้
    perDayLeft: number; // เฉลี่ยที่เหลือกินได้ต่อวันจนจบสัปดาห์
    startLabel: string;
  };
  explain: string;
}

const BKK = 7 * 3600 * 1000;
const bkkNow = () => new Date(Date.now() + BKK);

/** ต้นสัปดาห์ (จันทร์ 00:00 เวลาไทย) เป็นเวลา UTC จริง */
export function weekStartUtc(now = new Date()): Date {
  const b = new Date(now.getTime() + BKK);
  const dow = (b.getUTCDay() + 6) % 7; // จันทร์ = 0
  const monday = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() - dow);
  return new Date(monday - BKK);
}

/** ขอบเขตวันปัจจุบันตามเวลาไทย (เป็น UTC) */
export function dayBoundsUtc(now = new Date()): { start: Date; end: Date } {
  const b = new Date(now.getTime() + BKK);
  const startBkk = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return { start: new Date(startBkk - BKK), end: new Date(startBkk - BKK + 24 * 3600 * 1000) };
}

/** คืนแคลอรี่จากการออกกำลังกาย — คูณ 60% แล้ว cap */
export function earnedFrom(exerciseKcal: number): number {
  return Math.min(EARN_CAP, Math.round(Math.max(0, exerciseKcal) * EARN_RATE));
}

/**
 * งบของวันนี้ + สัปดาห์นี้
 * @param baseTdeeNoExercise พลังงานวันที่ไม่ออกกำลังกาย (ถ้าไม่ส่ง = BMR × NEAT_FACTOR)
 */
export async function getDailyBudget(memberId: string, opts?: { baseTdee?: number }): Promise<DailyBudget | null> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  const bmr = Math.round(member.bmr ?? (member.weight ?? 70) * 22);
  const goalType = member.goalType ?? "maintain";
  const losing = goalType.includes("lose") || goalType.includes("ลด");
  const gaining = goalType.includes("gain") || goalType.includes("เพิ่ม") || goalType.includes("กล้าม");

  const baseTdee = Math.round(opts?.baseTdee ?? bmr * NEAT_FACTOR);
  let base = baseTdee;
  if (losing) base = Math.max(1200, bmr, baseTdee - DEFICIT);
  else if (gaining) base = baseTdee + DEFICIT;

  const { start, end } = dayBoundsUtc();
  const wStart = weekStartUtc();

  const [exAgg, mealAgg, weekMealAgg, weekEx, metricsToday] = await Promise.all([
    prisma.exerciseLog.aggregate({ where: { memberId, date: { gte: start, lt: end } }, _sum: { calories: true } }),
    prisma.mealLog.aggregate({ where: { memberId, date: { gte: start, lt: end } }, _sum: { calories: true } }),
    prisma.mealLog.aggregate({ where: { memberId, date: { gte: wStart } }, _sum: { calories: true } }),
    prisma.exerciseLog.groupBy({
      by: ["date"],
      where: { memberId, date: { gte: wStart } },
      _sum: { calories: true },
    }),
    prisma.dailyMetric.findMany({ where: { memberId, date: { gte: start, lt: end } }, select: { activeKcal: true } }),
  ]);

  // แคลอรี่ออกกำลังกายวันนี้ — ใช้ workout ที่บันทึกเป็นหลัก
  // ถ้าไม่มี workout เลยแต่ Apple บอกว่าเคลื่อนไหวเยอะกว่า NEAT พื้นฐาน ค่อยนับส่วนที่เกิน (กันนับซ้ำ)
  const loggedKcal = exAgg._sum.calories ?? 0;
  const activeKcal = metricsToday.reduce((s, m) => Math.max(s, m.activeKcal ?? 0), 0);
  const neatInBase = bmr * NEAT_IN_BASE;
  const exerciseKcal = Math.max(loggedKcal, activeKcal - neatInBase > 0 ? activeKcal - neatInBase : 0);

  const earned = earnedFrom(exerciseKcal);
  const target = Math.max(bmr, base + earned);
  const eaten = Math.round(mealAgg._sum.calories ?? 0);

  // งบสัปดาห์: ฐาน×7 + ที่คืนไปแล้วทุกวันในสัปดาห์
  const earnedWeek = weekEx.reduce((s, r) => s + earnedFrom(r._sum.calories ?? 0), 0);
  const weekUsed = Math.round(weekMealAgg._sum.calories ?? 0);
  const weekBudget = base * 7 + earnedWeek;
  const dowIdx = (bkkNow().getUTCDay() + 6) % 7; // จันทร์=0
  const daysLeft = 7 - dowIdx;
  const weekRemaining = weekBudget - weekUsed;

  return {
    base,
    earned,
    target,
    exerciseKcal: Math.round(exerciseKcal),
    eaten,
    remaining: target - eaten,
    week: {
      budget: weekBudget,
      used: weekUsed,
      remaining: weekRemaining,
      daysLeft,
      // ไม่ชวนกินเกินตัว: ต่อให้งบสัปดาห์เหลือเยอะ (เพราะบันทึกไม่ครบ) ก็แนะนำไม่เกินเป้าวัน + เพดานคืน
      perDayLeft: Math.min(
        Math.round(weekRemaining / Math.max(daysLeft, 1)),
        base + EARN_CAP
      ),
      startLabel: new Date(wStart.getTime() + BKK).toISOString().slice(0, 10),
    },
    explain:
      earned > 0
        ? `เป้าวันนี้ ${target.toLocaleString("th-TH")} kcal = ฐาน ${base.toLocaleString("th-TH")} + ${earned} จากที่ออกกำลังกาย ${Math.round(exerciseKcal)} kcal (คืนให้ 60%)`
        : `เป้าวันนี้ ${target.toLocaleString("th-TH")} kcal (วันที่ไม่ได้ออกกำลังกาย) — ออกกำลังกายแล้วโค้ชจะเพิ่มให้ 60% ของที่เผา`,
  };
}
