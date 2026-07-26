import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { generateWeekPlan, bkkTodayKey, addDays } from "@/lib/planGenerator";

const MAX_STEP = 0.1; // ปรับได้ไม่เกิน ±10% ต่อรอบ
const STEP = 0.08; // ก้าวปรับจริง 8%

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** adherence 7 วันล่าสุดจาก DailyPlan (done=1, partial=0.5) */
async function computeAdherence(memberId: string): Promise<{ score: number; count: number }> {
  const today = bkkTodayKey();
  const start = addDays(today, -7);
  const plans = await prisma.dailyPlan.findMany({
    where: { memberId, date: { gte: start, lt: today } },
    select: { status: true },
  });
  if (plans.length === 0) return { score: 0, count: 0 };
  const sum = plans.reduce((s, p) => s + (p.status === "done" ? 1 : p.status === "partial" ? 0.5 : 0), 0);
  return { score: sum / plans.length, count: plans.length };
}

export interface AdjustDetail {
  memberId: string;
  name: string | null;
  status: string; // adjusted | kept | skipped-new | skipped-nodata | no-access
  prevCalories?: number;
  newCalories?: number;
  reason?: string;
}

export interface WeeklyAdjustResult {
  processed: number;
  adjusted: number;
  details: AdjustDetail[];
}

export async function runWeeklyAdjust(opts?: {
  onlyMemberId?: string;
}): Promise<WeeklyAdjustResult> {
  const now = new Date();
  const members = await prisma.member.findMany({
    where: { ...(opts?.onlyMemberId ? { id: opts.onlyMemberId } : {}) },
    include: { memberType: true },
  });

  const details: AdjustDetail[] = [];
  let adjusted = 0;
  let processed = 0;

  for (const m of members) {
    if (!isAiCoachActive(m)) {
      details.push({ memberId: m.id, name: m.name, status: "no-access" });
      continue;
    }
    processed++;

    // ต้องมีข้อมูล ≥ 7 วัน
    const ageMs = now.getTime() - new Date(m.createdAt).getTime();
    if (ageMs < 7 * 24 * 3600 * 1000) {
      details.push({ memberId: m.id, name: m.name, status: "skipped-new" });
      continue;
    }

    // เทรนด์น้ำหนัก 14 วัน
    const since = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    const weights = await prisma.weightLog.findMany({
      where: { memberId: m.id, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    });
    if (weights.length < 2) {
      details.push({ memberId: m.id, name: m.name, status: "skipped-nodata" });
      continue;
    }
    const trend = weights[weights.length - 1].weight - weights[0].weight; // + = ขึ้น, - = ลง

    const adherence = await computeAdherence(m.id);
    const goalType = m.goalType || "ลดน้ำหนัก";
    const bmr = Math.round(m.bmr ?? 1200);
    const prevCal = Math.max(Math.round(m.dailyCalories ?? Math.round(m.tdee ?? bmr * 1.2)), bmr);

    // ── ตัดสินใจ (rule-based + clamp ปลอดภัย) ──
    let deltaPct = 0;
    let reason = "";
    const losing = goalType.includes("ลด");
    const gaining = goalType.includes("เพิ่ม") || goalType.includes("กล้าม");
    const onTrackAdherence = adherence.count >= 3 ? adherence.score >= 0.6 : true;

    if (losing) {
      // plateau: น้ำหนักไม่ลง (trend >= -0.1 kg) ทั้งที่ทำตามแผน
      if (trend >= -0.1 && onTrackAdherence) {
        deltaPct = -STEP;
        reason = `น้ำหนักนิ่ง (${trend >= 0 ? "+" : ""}${trend.toFixed(1)} kg ใน 2 สัปดาห์) แต่คุณทำตามแผนได้ดี โค้ชลดแคลอรี่เป้าลงเล็กน้อยเพื่อให้ไปต่อได้`;
      } else if (trend < -0.1) {
        reason = `กำลังลดได้ดี (${trend.toFixed(1)} kg) คงแผนเดิมไว้ ทำต่อเลยครับ 💪`;
      } else {
        reason = `ผลยังไม่ชัด ลองทำตามแผนให้สม่ำเสมออีกสัปดาห์แล้วค่อยประเมินใหม่นะครับ`;
      }
    } else if (gaining) {
      if (trend <= 0.1 && onTrackAdherence) {
        deltaPct = STEP;
        reason = `น้ำหนัก/กล้ามยังไม่ขึ้นตามเป้า โค้ชเพิ่มแคลอรี่เป้าขึ้นเล็กน้อยเพื่อสร้างมวลกล้ามเนื้อ`;
      } else {
        reason = `กำลังเพิ่มได้ดี (${trend >= 0 ? "+" : ""}${trend.toFixed(1)} kg) คงแผนเดิมไว้ครับ`;
      }
    } else {
      reason = `รักษาน้ำหนักได้ดี (${trend >= 0 ? "+" : ""}${trend.toFixed(1)} kg) คงแผนเดิมครับ`;
    }

    // clamp ±10% และไม่ต่ำกว่า BMR
    let newCal = prevCal;
    if (deltaPct !== 0) {
      newCal = Math.round(clamp(prevCal * (1 + deltaPct), prevCal * (1 - MAX_STEP), prevCal * (1 + MAX_STEP)));
      newCal = Math.max(newCal, bmr);
    }

    if (newCal !== prevCal) {
      // scale macro ตามสัดส่วนแคลอรี่
      const ratio = newCal / prevCal;
      await prisma.member.update({
        where: { id: m.id },
        data: {
          dailyCalories: newCal,
          dailyProtein: m.dailyProtein ? Math.round(m.dailyProtein * ratio) : m.dailyProtein,
          dailyCarbs: m.dailyCarbs ? Math.round(m.dailyCarbs * ratio) : m.dailyCarbs,
          dailyFat: m.dailyFat ? Math.round(m.dailyFat * ratio) : m.dailyFat,
        },
      });

      // regenerate สัปดาห์หน้า (เริ่มพรุ่งนี้ ไม่แตะแผนวันนี้)
      const start = addDays(bkkTodayKey(), 1);
      await prisma.dailyPlan.deleteMany({
        where: { memberId: m.id, date: { gte: start, lte: addDays(start, 6) } },
      });
      await generateWeekPlan(m.id, start);

      await prisma.planAdjustment.create({
        data: {
          memberId: m.id,
          reason,
          prevCalories: prevCal,
          newCalories: newCal,
          detail: { weightTrend: trend, adherence: adherence.score, adherenceCount: adherence.count },
        },
      });

      adjusted++;
      details.push({ memberId: m.id, name: m.name, status: "adjusted", prevCalories: prevCal, newCalories: newCal, reason });
    } else {
      // คงแผน — บันทึกเหตุผลไว้ให้โค้ชเช้าพูด (ไม่ปรับตัวเลข)
      await prisma.planAdjustment.create({
        data: {
          memberId: m.id,
          reason,
          prevCalories: prevCal,
          newCalories: prevCal,
          detail: { weightTrend: trend, adherence: adherence.score, adherenceCount: adherence.count, kept: true },
        },
      });
      details.push({ memberId: m.id, name: m.name, status: "kept", prevCalories: prevCal, reason });
    }
  }

  return { processed, adjusted, details };
}
