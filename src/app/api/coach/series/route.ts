import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { buildForecast, WINDOW_DAYS } from "@/lib/weightForecast";

/**
 * ข้อมูลกราฟสถิติ (Coach native)
 * GET ?days=7|30|90 (Bearer) →
 * { days:[{date, kcal, burned, water, sleepMin, steps, standHours, exerciseMin}], weights:[{date,weight}],
 *   member:{...targets}, forecast:{...} }
 *
 * forecast = พยากรณ์ว่าอีกนานแค่ไหนถึงเป้าน้ำหนัก (ดู src/lib/weightForecast.ts)
 * คิดจาก WeightLog ย้อนหลังไม่เกิน 28 วัน — ไม่พอ/ไม่เข้าหาเป้า = ไม่คืนวันที่ (ห้ามแต่ง)
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const daysParam = parseInt(new URL(req.url).searchParams.get("days") || "7", 10);
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const [meals, exercises, waters, sleeps, weights, metrics] = await Promise.all([
    prisma.mealLog.findMany({
      where: { memberId: member.id, date: { gte: start } },
      select: { calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true, date: true },
    }),
    prisma.exerciseLog.findMany({ where: { memberId: member.id, date: { gte: start } }, select: { calories: true, date: true } }),
    prisma.waterLog.findMany({ where: { memberId: member.id, date: { gte: start } }, select: { amount: true, date: true } }),
    prisma.sleepLog.findMany({
      where: { memberId: member.id, date: { gte: start } },
      select: { minutesAsleep: true, quality: true, stages: true, date: true },
    }),
    prisma.weightLog.findMany({
      where: { memberId: member.id, date: { gte: new Date(Date.now() - 120 * 24 * 3600 * 1000) } },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    }),
    // ก้าว/ยืน/นาทีขยับ จาก Apple Health — แสดงเป็นบรรทัดสรุปในหน้าสถิติ (ไม่ใช่วงในหน้าหลัก)
    prisma.dailyMetric.findMany({
      where: { memberId: member.id, date: { gte: start } },
      select: {
        steps: true, standHours: true, exerciseMin: true, restingHR: true, activeKcal: true, date: true,
        // ตัวชี้วัดเชิงลึกจาก Watch — ให้หน้าสถิติวาดกราฟย้อนหลังได้ทุกตัว
        hrvMs: true, vo2max: true, hrRecovery: true, respiratoryRate: true, spo2: true,
        wristTempDelta: true, breathDisturb: true, distanceM: true, flights: true,
        daylightMin: true, walkingSpeed: true, basalKcal: true, mindfulMin: true, audioDb: true,
      },
    }),
  ]);

  // aggregate ต่อวัน (local server = UTC; ใช้ date key แบบ device-local ผ่าน toISOString ของวัน — ยอมรับได้สำหรับกราฟ)
  type DayRow = {
    kcal: number; protein: number; carbs: number; fat: number; sodium: number; sugar: number;
    burned: number; water: number; sleepMin: number; sleepDeep: number; sleepRem: number;
    sleepAwake: number; sleepEff: number | null; steps: number; standHours: number; exerciseMin: number;
    activeKcal: number; restingHR: number | null;
    // ตัวชี้วัดเชิงลึก — null = วันนั้นไม่มีข้อมูล (ต่างจาก 0 ที่แปลว่าวัดได้ว่าเป็นศูนย์)
    hrvMs: number | null; vo2max: number | null; hrRecovery: number | null;
    respiratoryRate: number | null; spo2: number | null; wristTempDelta: number | null;
    breathDisturb: number | null; distanceM: number | null; flights: number | null;
    daylightMin: number | null; walkingSpeed: number | null; basalKcal: number | null;
    mindfulMin: number | null; audioDb: number | null;
  };
  const emptyDay = (): DayRow => ({
    kcal: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, sugar: 0,
    burned: 0, water: 0, sleepMin: 0, sleepDeep: 0, sleepRem: 0, sleepAwake: 0, sleepEff: null,
    steps: 0, standHours: 0, exerciseMin: 0, activeKcal: 0, restingHR: null,
    hrvMs: null, vo2max: null, hrRecovery: null, respiratoryRate: null, spo2: null,
    wristTempDelta: null, breathDisturb: null, distanceM: null, flights: null,
    daylightMin: null, walkingSpeed: null, basalKcal: null, mindfulMin: null, audioDb: null,
  });
  const byDay: Record<string, DayRow> = {};
  const key = (d: Date) => {
    const b = new Date(d.getTime() + 7 * 3600 * 1000); // BKK
    return b.toISOString().slice(0, 10);
  };
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    byDay[key(d)] = emptyDay();
  }
  meals.forEach((m) => {
    const k = key(m.date);
    if (!byDay[k]) return;
    byDay[k].kcal += m.calories;
    byDay[k].protein += m.protein || 0;
    byDay[k].carbs += m.carbs || 0;
    byDay[k].fat += m.fat || 0;
    byDay[k].sodium += m.sodium ?? 0;
    byDay[k].sugar += m.sugar ?? 0;
  });
  exercises.forEach((e) => { const k = key(e.date); if (byDay[k]) byDay[k].burned += e.calories; });
  waters.forEach((w) => { const k = key(w.date); if (byDay[k]) byDay[k].water += w.amount; });
  // นับซ้ำไม่ได้: คืนเดียวอาจมีทั้ง healthkit และที่ user บอกโค้ช → เอาค่ามากสุดของวันนั้น
  sleeps.forEach((s) => {
    const k = key(s.date);
    if (!byDay[k]) return;
    // คืนเดียวอาจมีทั้ง healthkit และที่ user บอกโค้ช → เอาค่ามากสุด ไม่ใช่บวกกัน
    if (s.minutesAsleep <= byDay[k].sleepMin) return;
    byDay[k].sleepMin = s.minutesAsleep;
    const st = (s.stages as Record<string, number> | null) ?? null;
    byDay[k].sleepDeep = Math.round(st?.deep ?? 0);
    byDay[k].sleepRem = Math.round(st?.rem ?? 0);
    byDay[k].sleepAwake = Math.round(st?.awake ?? 0);
    byDay[k].sleepEff = typeof s.quality === "number" ? Math.round(s.quality * 100) : null;
  });
  const DEEP_FIELDS = [
    "hrvMs", "vo2max", "hrRecovery", "respiratoryRate", "spo2", "wristTempDelta",
    "breathDisturb", "distanceM", "flights", "daylightMin", "walkingSpeed",
    "basalKcal", "mindfulMin", "audioDb",
  ] as const;
  metrics.forEach((m) => {
    const k = key(m.date);
    if (!byDay[k]) return;
    byDay[k].steps = Math.max(byDay[k].steps, m.steps ?? 0);
    byDay[k].standHours = Math.max(byDay[k].standHours, m.standHours ?? 0);
    byDay[k].exerciseMin = Math.max(byDay[k].exerciseMin, m.exerciseMin ?? 0);
    byDay[k].activeKcal = Math.max(byDay[k].activeKcal, m.activeKcal ?? 0);
    if (typeof m.restingHR === "number" && byDay[k].restingHR === null) byDay[k].restingHR = m.restingHR;
    // หลาย source ต่อวันเป็นไปได้ (healthkit + watch) → เก็บค่าที่มีจริงค่าแรกที่เจอ
    for (const f of DEEP_FIELDS) {
      const v = m[f];
      if (typeof v === "number" && byDay[k][f] === null) byDay[k][f] = v;
    }
  });

  // พยากรณ์ใช้ weights ที่ query มาแล้ว (120 วัน) — ฟังก์ชันตัดหน้าต่าง 28 วันเอง ไม่ query เพิ่ม
  const forecast = buildForecast(
    weights.filter((w) => w.date.getTime() >= Date.now() - WINDOW_DAYS * 24 * 3600 * 1000),
    { goalType: member.goalType, goalWeight: member.goalWeight }
  );

  return NextResponse.json({
    days: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
    weights: weights.map((w) => ({ date: w.date, weight: w.weight })),
    forecast,
    member: {
      dailyCalories: member.dailyCalories, dailyWater: member.dailyWater,
      weight: member.weight, goalWeight: member.goalWeight, goalType: member.goalType,
    },
  });
}
