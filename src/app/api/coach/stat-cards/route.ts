import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { estimateEnergy } from "@/lib/energyModel";
import { personalBurnGoal } from "@/lib/burnGoal";
import {
  buildEnergyBalance, buildTopFoods, buildRiskWindow, buildSleepEat,
  buildProteinSpread, buildRestingHR, dayKeyRange, bkkKey,
} from "@/lib/statCards";
import {
  buildEatingWindow, buildWaterRhythm, buildExerciseMix, buildPlanAdherence,
  buildLogChannels, buildWeightTrend, buildMacroSplit, buildSleepDetail,
  buildSleepConsistency, buildMovement, buildSodiumWeight, buildWorkoutVsRest,
  buildHealthScore, buildProjection, buildWeeklyCompare, summarizeVital,
} from "@/lib/statCardsDeep";

export const dynamic = "force-dynamic";

/**
 * การ์ดสถิติทั้งหน้าในคำขอเดียว (หน้า "สถิติ" ของแอปโค้ช)
 * GET /api/coach/stat-cards?days=30   (Bearer · default 30 · max 90)
 *
 * แบ่งผลลัพธ์ตามแท็บของหน้าแอป:
 *   overview  — คะแนนรวม · เทียบสัปดาห์ · สมดุลพลังงาน · น้ำหนัก+พยากรณ์
 *   food      — มาโคร · เมนูประจำ · ช่วงเสี่ยง · หน้าต่างการกิน · ช่องทางบันทึก · โปรตีน
 *   body      — การเคลื่อนไหว · ชนิดการออกกำลังกาย · น้ำ · แผน
 *   recovery  — การนอนละเอียด · ความสม่ำเสมอเวลานอน · HRV/VO2Max/ชีพจร/ออกซิเจน
 *   deep      — ความสัมพันธ์ข้ามข้อมูล (โซเดียม→น้ำหนัก · วันออกvsวันพัก · นอน×กิน)
 *
 * 🔴 ทุกก้อนมี `ready` — ข้อมูลไม่พอบอกตรง ๆ พร้อม needDays ไม่เดา
 * ประสิทธิภาพ: query ทั้งหมดยิงขนานชุดเดียว ไม่ไล่ query รายวัน
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = Number(new URL(req.url).searchParams.get("days"));
  // clamp ขั้นต่ำ 1 — days=0.4 เคยปัดเป็น 0 แล้ว dayKeys ว่าง → startUtc เป็น Invalid Date → 500
  const days = Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.min(90, Math.round(raw))) : 30;

  const dayKeys = dayKeyRange(days);
  // ต้นช่วง = เที่ยงคืนไทยของวันแรก แปลงกลับเป็น UTC จริงเพื่อใช้ query
  const startUtc = new Date(Date.parse(`${dayKeys[0]}T00:00:00.000Z`) - 7 * 3600 * 1000);
  const where = { memberId: member.id, date: { gte: startUtc } };
  // เทียบสัปดาห์ต่อสัปดาห์ต้องมองย้อนอย่างน้อย 14 วันเสมอ แม้ user เลือกช่วง 7 วัน
  const compareStart = new Date(Math.min(startUtc.getTime(), Date.now() - 14 * 86400_000));

  const [meals, exercises, metrics, sleeps, waters, weights, plans, compareMeals, compareWaters, compareSleeps, compareMetrics, compareEx, energy] =
    await Promise.all([
      prisma.mealLog.findMany({
        where,
        select: { date: true, name: true, calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true, via: true },
      }),
      prisma.exerciseLog.findMany({ where, select: { date: true, name: true, calories: true, duration: true, source: true } }),
      prisma.dailyMetric.findMany({
        where,
        select: {
          date: true, steps: true, activeKcal: true, restingHR: true, standHours: true, exerciseMin: true,
          hrvMs: true, vo2max: true, hrRecovery: true, respiratoryRate: true, spo2: true,
          wristTempDelta: true, breathDisturb: true, distanceM: true, flights: true,
          daylightMin: true, walkingSpeed: true, basalKcal: true, mindfulMin: true, audioDb: true,
        },
      }),
      prisma.sleepLog.findMany({
        where,
        select: { date: true, minutesAsleep: true, quality: true, stages: true, startAt: true, endAt: true, source: true },
      }),
      prisma.waterLog.findMany({ where, select: { date: true, amount: true } }),
      // น้ำหนักมองยาวกว่าช่วงที่เลือก — เส้นเฉลี่ย 7 วันต้องมีข้อมูลก่อนหน้ามาตั้งต้น
      prisma.weightLog.findMany({
        where: { memberId: member.id, date: { gte: new Date(Date.now() - 120 * 86400_000) } },
        orderBy: { date: "asc" },
        select: { date: true, weight: true },
      }),
      prisma.dailyPlan.findMany({
        where,
        select: { date: true, mealsDone: true, exerciseItemsDone: true, mealPlan: true, exercisePlan: true },
      }),
      // ชุดสำหรับ "เทียบสัปดาห์" — แยก query เพื่อให้ครอบ 14 วันเสมอ
      prisma.mealLog.findMany({
        where: { memberId: member.id, date: { gte: compareStart } },
        select: { date: true, calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true },
      }),
      prisma.waterLog.findMany({ where: { memberId: member.id, date: { gte: compareStart } }, select: { date: true, amount: true } }),
      prisma.sleepLog.findMany({
        where: { memberId: member.id, date: { gte: compareStart } },
        select: { date: true, minutesAsleep: true, quality: true, stages: true, startAt: true, endAt: true, source: true },
      }),
      prisma.dailyMetric.findMany({
        where: { memberId: member.id, date: { gte: compareStart } },
        select: {
          date: true, steps: true, activeKcal: true, distanceM: true, flights: true, daylightMin: true,
          walkingSpeed: true, basalKcal: true, mindfulMin: true, audioDb: true, standHours: true, exerciseMin: true,
        },
      }),
      prisma.exerciseLog.findMany({ where: { memberId: member.id, date: { gte: compareStart } }, select: { date: true, calories: true } }),
      estimateEnergy(member.id).catch(() => null),
    ]);

  // baseTdee = พลังงานของ "วันที่ไม่ได้ออกกำลังกาย" (ไม่ใช่เป้าที่ควรกิน — ดูคอมเมนต์ใน statCards.ts)
  const baseTdee = Math.round(energy?.baseTdee ?? member.tdee ?? (member.bmr ?? 1500) * 1.2);
  const burnGoal = await personalBurnGoal(member, { tdee: energy?.tdee }).catch(() => null);

  /**
   * พลังงานที่เผาต่อวัน — max(activeKcal จากนาฬิกา, Σ ExerciseLog) ไม่ใช่บวกกัน
   * เพราะ workout จากนาฬิกาถูกนับรวมใน activeKcal อยู่แล้ว (กติกาเดียวกับทั้งระบบ)
   */
  const burnByDay = new Map<string, number>();
  for (const e of compareEx) {
    const k = bkkKey(e.date);
    burnByDay.set(k, (burnByDay.get(k) ?? 0) + (e.calories || 0));
  }
  for (const m of compareMetrics) {
    const k = bkkKey(m.date);
    burnByDay.set(k, Math.max(burnByDay.get(k) ?? 0, m.activeKcal ?? 0));
  }

  const exerciseDays = new Set(exercises.map((e) => bkkKey(e.date)));
  const weightTrend = buildWeightTrend(weights, member.height ?? null);

  const targets = {
    kcal: member.dailyCalories ?? 0,
    protein: member.dailyProtein ?? 0,
    carbs: member.dailyCarbs ?? 0,
    fat: member.dailyFat ?? 0,
    sodium: member.dailySodium ?? 2300,
    sugar: member.dailySugar ?? 50,
  };

  const res = NextResponse.json({
    range: { from: dayKeys[0], to: dayKeys[dayKeys.length - 1], days },

    // ── ภาพรวม ──
    healthScore: buildHealthScore({
      dayKeys, meals, waters, sleeps, burnByDay,
      target: {
        kcal: targets.kcal, protein: targets.protein,
        water: member.dailyWater ?? 2000, sleepMin: 480, burn: burnGoal?.value ?? 300,
      },
    }),
    weeklyCompare: buildWeeklyCompare({
      meals: compareMeals, waters: compareWaters, sleeps: compareSleeps,
      metrics: compareMetrics, burnByDay,
    }),
    energyBalance: buildEnergyBalance({ dayKeys, meals, exercises, metrics, baseTdee }),
    weightTrend,
    projection: buildProjection(weightTrend, member.goalWeight ?? null),

    // ── อาหาร ──
    macroSplit: buildMacroSplit(meals, targets),
    topFoods: buildTopFoods(meals),
    riskWindow: buildRiskWindow(meals, dayKeys),
    eatingWindow: buildEatingWindow(meals),
    proteinSpread: buildProteinSpread(meals),
    logChannels: buildLogChannels(meals),

    // ── ร่างกาย/การขยับ ──
    movement: buildMovement(metrics),
    exerciseMix: buildExerciseMix(exercises),
    waterRhythm: buildWaterRhythm(waters),
    planAdherence: buildPlanAdherence(plans),

    // ── การนอน + หัวใจ ──
    sleepDetail: buildSleepDetail(sleeps),
    sleepConsistency: buildSleepConsistency(sleeps),
    restingHR: buildRestingHR(metrics),
    vitals: {
      hrv: summarizeVital(metrics, "hrvMs"),
      vo2max: summarizeVital(metrics, "vo2max"),
      hrRecovery: summarizeVital(metrics, "hrRecovery"),
      spo2: summarizeVital(metrics, "spo2"),
      respiratoryRate: summarizeVital(metrics, "respiratoryRate"),
      wristTempDelta: summarizeVital(metrics, "wristTempDelta"),
      breathDisturb: summarizeVital(metrics, "breathDisturb"),
    },

    // ── วิเคราะห์เชิงลึก ──
    sleepEat: buildSleepEat(sleeps, meals),
    sodiumWeight: buildSodiumWeight(meals, weights, targets.sodium),
    workoutVsRest: buildWorkoutVsRest(meals, exerciseDays, dayKeys),
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
