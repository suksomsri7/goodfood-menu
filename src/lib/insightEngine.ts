/**
 * Insight extractor (WO-P.2 / สาย P) — วิเคราะห์ log จริงเป็น:
 *  - BehaviorInsight รายสัปดาห์ (sodium/protein/sleep/adherence/weight trend + byWeekday)
 *  - CoachMemory เชิงพฤติกรรม (เมนูที่กินบ่อย, โซเดียมเกินประจำ, นอนน้อยประจำ) — source=log_pattern
 * ทั้งหมดมาจากข้อมูลจริง ไม่แต่ง · ป้อนกลับเข้าโค้ช/แผนผ่าน getMemories + BehaviorInsight
 */
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { upsertMemory, decayStale } from "@/lib/coachMemory";

function isoWeekKey(d: Date): string {
  // ISO week ของเวลาไทย
  const b = new Date(d.getTime() + 7 * 3600 * 1000);
  const day = (b.getUTCDay() + 6) % 7;
  const thu = new Date(b);
  thu.setUTCDate(b.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thu.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const WEEKDAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

export async function runInsights(now = new Date()) {
  const periodKey = isoWeekKey(now);
  const since7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const since14 = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
  const since30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const members = await prisma.member.findMany({
    where: { isActive: true, isOnboarded: true },
    include: { memberType: true },
  });

  let processed = 0;
  const details: Array<{ memberId: string; insights: number; memories: number }> = [];

  for (const m of members) {
    if (!isAiCoachActive(m)) continue;

    const [meals30, sleeps7, plans7, weights14] = await Promise.all([
      prisma.mealLog.findMany({ where: { memberId: m.id, date: { gte: since30 } }, select: { name: true, sodium: true, protein: true, date: true } }),
      prisma.sleepLog.findMany({ where: { memberId: m.id, date: { gte: since7 } }, select: { minutesAsleep: true } }),
      prisma.dailyPlan.findMany({ where: { memberId: m.id, date: { gte: since7 } }, select: { status: true } }),
      prisma.weightLog.findMany({ where: { memberId: m.id, date: { gte: since14 } }, orderBy: { date: "asc" }, select: { weight: true, date: true } }),
    ]);

    const meals7 = meals30.filter((x) => x.date >= since7);
    const upserts: Array<Promise<any>> = [];
    let insightCount = 0;
    const putInsight = (metric: string, value: any) => {
      insightCount++;
      upserts.push(
        prisma.behaviorInsight.upsert({
          where: { memberId_periodType_periodKey_metric: { memberId: m.id, periodType: "weekly", periodKey, metric } },
          update: { value },
          create: { memberId: m.id, periodType: "weekly", periodKey, metric, value },
        })
      );
    };

    // ── sodium (avg 7d + วันที่หนักสุด) ──
    if (meals7.length) {
      const byDay: Record<string, number> = {};
      const wd: number[] = [0, 0, 0, 0, 0, 0, 0];
      const wdCount: number[] = [0, 0, 0, 0, 0, 0, 0];
      meals7.forEach((x) => {
        const k = x.date.toISOString().slice(0, 10);
        byDay[k] = (byDay[k] || 0) + (x.sodium || 0);
      });
      Object.entries(byDay).forEach(([k, v]) => { const d = new Date(k).getUTCDay(); wd[d] += v; wdCount[d]++; });
      const days = Object.values(byDay);
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      const target = m.dailySodium || 2300;
      const overDays = days.filter((v) => v > target).length;
      let worst = 0; for (let i = 1; i < 7; i++) if (wd[i] > wd[worst]) worst = i;
      putInsight("sodium_trend", { avg: Math.round(avg), target, overDays, worstWeekday: WEEKDAY_TH[worst] });

      const proteinAvg = meals7.reduce((a, b) => a + (b.protein || 0), 0) / days.length;
      const pTarget = m.dailyProtein || 100;
      putInsight("protein_gap", { avg: Math.round(proteinAvg), target: pTarget, gap: Math.max(0, Math.round(pTarget - proteinAvg)) });

      // memory: โซเดียมเกินประจำ
      if (overDays >= 4) upserts.push(upsertMemory(m.id, { kind: "pattern", fact: `มักได้โซเดียมเกินเป้า (สูงสุดวัน${WEEKDAY_TH[worst]})`, source: "log_pattern", confidence: 0.7 }));
    }

    // ── sleep ──
    if (sleeps7.length) {
      const avgMin = Math.round(sleeps7.reduce((a, b) => a + b.minutesAsleep, 0) / sleeps7.length);
      putInsight("sleep_avg", { avgMin, nights: sleeps7.length });
      if (avgMin < 360 && sleeps7.length >= 3) upserts.push(upsertMemory(m.id, { kind: "pattern", fact: "นอนเฉลี่ยน้อยกว่า 6 ชม./คืน", source: "log_pattern", confidence: 0.7 }));
    }

    // ── adherence (แผน 7 วัน) ──
    if (plans7.length) {
      const score = plans7.reduce((a, p) => a + (p.status === "done" ? 1 : p.status === "partial" ? 0.5 : 0), 0) / plans7.length;
      putInsight("adherence", { score: Math.round(score * 100) / 100, plans: plans7.length });
    }

    // ── weight trend (14d) ──
    if (weights14.length >= 2) {
      const delta = Math.round((weights14[weights14.length - 1].weight - weights14[0].weight) * 10) / 10;
      putInsight("weight_trend", { deltaKg: delta, from: weights14[0].weight, to: weights14[weights14.length - 1].weight });
    }

    // ── memory: เมนูที่กินบ่อย (>=3 ครั้งใน 30 วัน) ──
    const freq: Record<string, number> = {};
    meals30.forEach((x) => { const n = (x.name || "").trim(); if (n) freq[n] = (freq[n] || 0) + 1; });
    const top = Object.entries(freq).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [name] of top) upserts.push(upsertMemory(m.id, { kind: "preference", fact: `กิน "${name}" บ่อย`, source: "log_pattern", confidence: 0.65 }));

    upserts.push(decayStale(m.id));
    const results = await Promise.allSettled(upserts);
    const memCount = top.length; // ประมาณ
    processed++;
    details.push({ memberId: m.id, insights: insightCount, memories: memCount });
  }

  return { processed, checked: members.length, details };
}
