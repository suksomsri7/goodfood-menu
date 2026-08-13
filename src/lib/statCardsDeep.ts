/**
 * การ์ดสถิติชุดลึก (13 ส.ค. 2026) — ต่อจาก statCards.ts
 *
 * 🔴 กติกาเดียวกับไฟล์เดิมทั้งหมด:
 *    - deterministic ล้วน ไม่เรียก AI
 *    - ทุกก้อนมี `ready` + `needDays` — ข้อมูลไม่พอบอกตรง ๆ ว่าต้องบันทึกอีกกี่วัน
 *      (ตัวเลขสุขภาพที่มั่วอันตรายกว่าการไม่มีตัวเลข)
 *    - "วัน" คิดแบบเวลาไทยเสมอ (bkkKey)
 */
import { bkkKey, bkkHour, type MealRow } from "@/lib/statCards";

const DAY_MS = 86400_000;

// ── helper ที่ใช้ร่วมกันทั้งไฟล์ ──────────────────────────────────────────
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** นาทีนับจากเที่ยงคืน (เวลาไทย) — ใช้กับเวลาเข้านอน/ตื่น */
const bkkMinuteOfDay = (d: Date) => {
  const b = new Date(d.getTime() + 7 * 3600 * 1000);
  return b.getUTCHours() * 60 + b.getUTCMinutes();
};
const hhmm = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

export type Ready<T> = ({ ready: true } & T) | { ready: false; needDays: number; have: number };
const notReady = (have: number, need: number) => ({ ready: false as const, needDays: Math.max(1, need - have), have });

// ── #9 หน้าต่างการกิน ────────────────────────────────────────────────────
/**
 * มื้อแรก/มื้อสุดท้ายของแต่ละวัน → "หน้าต่างการกิน"
 * กินดึก = มื้อสุดท้ายหลัง 21:00 (งานวิจัยผูกกับคุณภาพการนอนและน้ำหนัก)
 * ใช้ median ไม่ใช่ mean — วันที่ลืมบันทึกมื้อเช้าจะดึงค่าเฉลี่ยเพี้ยนหนัก
 */
export type EatingWindow = Ready<{
  firstMedian: string;
  lastMedian: string;
  windowHours: number;
  lateNightDays: number;
  daysCounted: number;
}>;

export function buildEatingWindow(meals: MealRow[], minDays = 5): EatingWindow {
  const byDay = new Map<string, number[]>();
  for (const m of meals) {
    const k = bkkKey(m.date);
    const arr = byDay.get(k) ?? [];
    arr.push(bkkMinuteOfDay(m.date));
    byDay.set(k, arr);
  }
  // ต้องมีอย่างน้อย 2 มื้อในวันนั้นถึงจะพูดเรื่อง "หน้าต่าง" ได้
  const days = [...byDay.values()].filter((v) => v.length >= 2);
  if (days.length < minDays) return notReady(days.length, minDays);

  const firsts = days.map((v) => Math.min(...v));
  const lasts = days.map((v) => Math.max(...v));
  const fm = median(firsts);
  const lm = median(lasts);
  return {
    ready: true,
    firstMedian: hhmm(fm),
    lastMedian: hhmm(lm),
    windowHours: r1(Math.max(0, lm - fm) / 60),
    lateNightDays: lasts.filter((x) => x >= 21 * 60).length,
    daysCounted: days.length,
  };
}

// ── #10 จังหวะการดื่มน้ำ ─────────────────────────────────────────────────
export type WaterRow = { date: Date; amount: number };
export type WaterRhythm = Ready<{
  blocks: Array<{ label: string; ml: number; pct: number }>;
  beforeNoonPct: number;
  daysCounted: number;
}>;

/**
 * แบ่งวันเป็น 4 ช่วง ดูว่าดื่มกระจายหรือกระจุก
 * คนที่ดื่มกระจุกตอนเย็นมักตื่นกลางดึกเข้าห้องน้ำ → กระทบการนอน
 */
export function buildWaterRhythm(waters: WaterRow[], minDays = 3): WaterRhythm {
  const days = new Set(waters.map((w) => bkkKey(w.date)));
  if (days.size < minDays) return notReady(days.size, minDays);

  const defs = [
    { label: "เช้า (05-11)", from: 5, to: 10 },
    { label: "กลางวัน (11-15)", from: 11, to: 14 },
    { label: "บ่าย-เย็น (15-19)", from: 15, to: 18 },
    { label: "ค่ำ (19-05)", from: 19, to: 4 },
  ];
  const sums = defs.map(() => 0);
  for (const w of waters) {
    const h = bkkHour(w.date);
    const i = defs.findIndex((d) => (d.from <= d.to ? h >= d.from && h <= d.to : h >= d.from || h <= d.to));
    if (i >= 0) sums[i] += w.amount || 0;
  }
  const total = sums.reduce((a, b) => a + b, 0);
  return {
    ready: true,
    blocks: defs.map((d, i) => ({ label: d.label, ml: Math.round(sums[i]), pct: pct(sums[i], total) })),
    beforeNoonPct: pct(sums[0] + sums[1], total),
    daysCounted: days.size,
  };
}

// ── #11 ชนิดการออกกำลังกาย ───────────────────────────────────────────────
export type ExerciseFullRow = {
  date: Date; name: string; calories: number; duration: number | null; source: string | null;
};
export type ExerciseMix = Ready<{
  items: Array<{ name: string; count: number; minutes: number; kcal: number }>;
  totalMinutes: number;
  totalKcal: number;
  fromWatchPct: number;
  sessions: number;
}>;

export function buildExerciseMix(rows: ExerciseFullRow[], minSessions = 3): ExerciseMix {
  if (rows.length < minSessions) return notReady(rows.length, minSessions);

  const byName = new Map<string, { count: number; minutes: number; kcal: number }>();
  for (const r of rows) {
    const key = (r.name || "ออกกำลังกาย").trim();
    const cur = byName.get(key) ?? { count: 0, minutes: 0, kcal: 0 };
    cur.count += 1;
    cur.minutes += Math.round(r.duration ?? 0);
    cur.kcal += Math.round(r.calories || 0);
    byName.set(key, cur);
  }
  const items = [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.minutes - a.minutes || b.count - a.count)
    .slice(0, 8);
  const fromWatch = rows.filter((r) => r.source === "healthkit" || r.source === "watch").length;
  return {
    ready: true,
    items,
    totalMinutes: rows.reduce((a, r) => a + Math.round(r.duration ?? 0), 0),
    totalKcal: rows.reduce((a, r) => a + Math.round(r.calories || 0), 0),
    fromWatchPct: pct(fromWatch, rows.length),
    sessions: rows.length,
  };
}

// ── #12 ความแม่นของแผน ───────────────────────────────────────────────────
export type PlanRow = {
  date: Date;
  mealsDone: unknown;
  exerciseItemsDone: unknown;
  mealPlan: unknown;
  exercisePlan: unknown;
};
export type PlanAdherence = Ready<{
  mealPct: number;
  exercisePct: number;
  daysWithPlan: number;
  perWeek: Array<{ week: string; mealPct: number; exercisePct: number }>;
}>;

/** นับจากของที่ติ๊กจริงเทียบกับจำนวนรายการในแผนวันนั้น (ไม่ใช่นับวันที่ "ทำครบ") */
export function buildPlanAdherence(plans: PlanRow[], minDays = 5): PlanAdherence {
  const rows = plans.filter((p) => p.mealPlan || p.exercisePlan);
  if (rows.length < minDays) return notReady(rows.length, minDays);

  const countTrue = (v: unknown) =>
    v && typeof v === "object" ? Object.values(v as Record<string, unknown>).filter((x) => x === true).length : 0;
  const mealTotal = (p: PlanRow) => ((p.mealPlan as any)?.meals?.length as number) || 0;
  const exTotal = (p: PlanRow) => ((p.exercisePlan as any)?.items?.length as number) || 0;

  let mDone = 0, mAll = 0, eDone = 0, eAll = 0;
  const weeks = new Map<string, { mDone: number; mAll: number; eDone: number; eAll: number }>();
  for (const p of rows) {
    const key = isoWeekKey(p.date);
    const w = weeks.get(key) ?? { mDone: 0, mAll: 0, eDone: 0, eAll: 0 };
    const md = Math.min(countTrue(p.mealsDone), mealTotal(p));
    const ed = Math.min(countTrue(p.exerciseItemsDone), exTotal(p));
    mDone += md; mAll += mealTotal(p); eDone += ed; eAll += exTotal(p);
    w.mDone += md; w.mAll += mealTotal(p); w.eDone += ed; w.eAll += exTotal(p);
    weeks.set(key, w);
  }
  return {
    ready: true,
    mealPct: pct(mDone, mAll),
    exercisePct: pct(eDone, eAll),
    daysWithPlan: rows.length,
    perWeek: [...weeks.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([week, v]) => ({ week, mealPct: pct(v.mDone, v.mAll), exercisePct: pct(v.eDone, v.eAll) })),
  };
}

/** คีย์สัปดาห์แบบ ISO ตามวันไทย (ใช้ร่วมกับ BehaviorInsight ที่ใช้ ISO week เหมือนกัน) */
export function isoWeekKey(d: Date): string {
  const b = new Date(d.getTime() + 7 * 3600 * 1000);
  const t = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── #13 ช่องทางที่ใช้บันทึก ──────────────────────────────────────────────
const VIA_LABEL: Record<string, string> = {
  photo: "ถ่ายรูป", voice: "พูดกับโค้ช", manual: "กรอกเอง", plan: "ติ๊กจากแผน", barcode: "สแกนบาร์โค้ด",
};
export type LogChannels = Ready<{ items: Array<{ via: string; label: string; count: number; pct: number }>; total: number }>;

export function buildLogChannels(meals: MealRow[], minLogs = 5): LogChannels {
  if (meals.length < minLogs) return notReady(meals.length, minLogs);
  const byVia = new Map<string, number>();
  for (const m of meals) byVia.set(m.via || "manual", (byVia.get(m.via || "manual") ?? 0) + 1);
  const total = meals.length;
  return {
    ready: true,
    total,
    items: [...byVia.entries()]
      .map(([via, count]) => ({ via, label: VIA_LABEL[via] ?? via, count, pct: pct(count, total) }))
      .sort((a, b) => b.count - a.count),
  };
}

// ── #14 น้ำหนัก: เฉลี่ยเคลื่อนที่ 7 วัน + อัตราลด + BMI ──────────────────
export type WeightRow = { date: Date; weight: number };
export type WeightTrend = Ready<{
  points: Array<{ date: string; weight: number; ma7: number | null }>;
  perWeekKg: number;
  perWeekPct: number;
  bmi: number | null;
  bmiLabel: string | null;
  healthyRange: { min: number; max: number } | null;
  tooFast: boolean;
}>;

/**
 * เส้นเฉลี่ยเคลื่อนที่ 7 วัน = ตัวจริงของการลดน้ำหนัก
 * น้ำหนักดิบเด้งวันละ 0.5-1.5 กก. จากน้ำ/อาหารในท้อง ทำให้คนท้อทั้งที่กำลังลงจริง
 * tooFast = ลดเกิน 1% ของน้ำหนักตัวต่อสัปดาห์ (เสี่ยงเสียมวลกล้ามเนื้อ) — เกณฑ์เดียวกับ weightForecast
 */
export function buildWeightTrend(weights: WeightRow[], heightCm: number | null, minPoints = 3): WeightTrend {
  if (weights.length < minPoints) return notReady(weights.length, minPoints);

  const byDay = new Map<string, number[]>();
  for (const w of weights) {
    const k = bkkKey(w.date);
    byDay.set(k, [...(byDay.get(k) ?? []), w.weight]);
  }
  const daily = [...byDay.entries()]
    .map(([date, xs]) => ({ date, weight: r1(avg(xs)) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const points = daily.map((p, i) => {
    const from = Date.parse(`${p.date}T00:00:00Z`) - 6 * DAY_MS;
    const win = daily.filter((x, j) => j <= i && Date.parse(`${x.date}T00:00:00Z`) >= from);
    // ต้องมีอย่างน้อย 3 จุดในหน้าต่าง 7 วันถึงจะเรียกว่าค่าเฉลี่ยได้
    return { ...p, ma7: win.length >= 3 ? r1(avg(win.map((x) => x.weight))) : null };
  });

  /*
   * อัตราเปลี่ยนแปลงต้องคิดจาก "ช่วงล่าสุด" ไม่ใช่ทั้งกราฟ
   * ถ้าใช้จุดแรกสุดของ 120 วันมาคิด คนที่เพิ่งเริ่มเร่งลด/หยุดลดจะได้ตัวเลขที่ไม่ตรงกับตอนนี้
   * ใช้หน้าต่าง 28 วันเท่ากับ weightForecast — ตัวเลขสองที่จะได้ตรงกัน
   */
  const RATE_WINDOW_DAYS = 28;
  const lastMs = Date.parse(`${daily[daily.length - 1].date}T00:00:00Z`);
  const inWindow = daily.filter((p) => Date.parse(`${p.date}T00:00:00Z`) >= lastMs - RATE_WINDOW_DAYS * DAY_MS);
  const rateSet = inWindow.length >= 3 ? inWindow : daily;
  const first = rateSet[0];
  const last = rateSet[rateSet.length - 1];
  const spanDays = Math.max(1, (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / DAY_MS);
  const perWeekKg = r1(((last.weight - first.weight) / spanDays) * 7);
  const perWeekPct = daily[daily.length - 1].weight > 0
    ? r1((perWeekKg / daily[daily.length - 1].weight) * 100) : 0;

  const newest = daily[daily.length - 1];
  const h = heightCm && heightCm > 80 ? heightCm / 100 : null;
  const bmi = h ? r1(newest.weight / (h * h)) : null;
  const label =
    bmi === null ? null
      : bmi < 18.5 ? "ผอมกว่าเกณฑ์"
        : bmi < 23 ? "สมส่วน"
          : bmi < 25 ? "ท้วม"
            : bmi < 30 ? "อ้วนระดับ 1" : "อ้วนระดับ 2";

  return {
    ready: true,
    points,
    perWeekKg,
    perWeekPct,
    bmi,
    bmiLabel: label,
    // เกณฑ์เอเชีย (18.5-22.9) — ต่างจากเกณฑ์สากลที่ใช้ 25
    healthyRange: h ? { min: r1(18.5 * h * h), max: r1(22.9 * h * h) } : null,
    tooFast: Math.abs(perWeekPct) > 1,
  };
}

// ── #15 มาโครเทียบเป้า + วันที่เกินโซเดียม/น้ำตาล ────────────────────────
export type MacroMealRow = {
  date: Date; calories: number; protein: number; carbs: number; fat: number;
  sodium: number | null; sugar: number | null;
};
export type MacroSplit = Ready<{
  avg: { kcal: number; protein: number; carbs: number; fat: number; sodium: number; sugar: number };
  target: { kcal: number; protein: number; carbs: number; fat: number; sodium: number; sugar: number };
  energyPct: { protein: number; carbs: number; fat: number };
  overDays: { sodium: number; sugar: number };
  daysCounted: number;
}>;

export function buildMacroSplit(
  meals: MacroMealRow[],
  target: { kcal: number; protein: number; carbs: number; fat: number; sodium: number; sugar: number },
  minDays = 3
): MacroSplit {
  const byDay = new Map<string, { kcal: number; p: number; c: number; f: number; na: number; su: number }>();
  for (const m of meals) {
    const k = bkkKey(m.date);
    const cur = byDay.get(k) ?? { kcal: 0, p: 0, c: 0, f: 0, na: 0, su: 0 };
    cur.kcal += m.calories || 0;
    cur.p += m.protein || 0;
    cur.c += m.carbs || 0;
    cur.f += m.fat || 0;
    cur.na += m.sodium ?? 0;
    cur.su += m.sugar ?? 0;
    byDay.set(k, cur);
  }
  const days = [...byDay.values()];
  if (days.length < minDays) return notReady(days.length, minDays);

  const a = {
    kcal: Math.round(avg(days.map((d) => d.kcal))),
    protein: Math.round(avg(days.map((d) => d.p))),
    carbs: Math.round(avg(days.map((d) => d.c))),
    fat: Math.round(avg(days.map((d) => d.f))),
    sodium: Math.round(avg(days.map((d) => d.na))),
    sugar: Math.round(avg(days.map((d) => d.su))),
  };
  // สัดส่วนพลังงานจริง (โปรตีน/คาร์บ 4 kcal ต่อกรัม · ไขมัน 9)
  const kcalFromMacro = a.protein * 4 + a.carbs * 4 + a.fat * 9;
  return {
    ready: true,
    avg: a,
    target,
    energyPct: {
      protein: pct(a.protein * 4, kcalFromMacro),
      carbs: pct(a.carbs * 4, kcalFromMacro),
      fat: pct(a.fat * 9, kcalFromMacro),
    },
    overDays: {
      sodium: days.filter((d) => d.na > target.sodium).length,
      sugar: days.filter((d) => d.su > target.sugar).length,
    },
    daysCounted: days.length,
  };
}

// ── #16/#17 การนอน: stage + ความสม่ำเสมอของเวลา ──────────────────────────
export type SleepFullRow = {
  date: Date; minutesAsleep: number; quality: number | null; stages: unknown;
  startAt: Date | null; endAt: Date | null; source: string;
};
export type SleepDetail = Ready<{
  avgMinutes: number;
  avgDeep: number | null;
  avgRem: number | null;
  avgCore: number | null;
  avgAwake: number | null;
  avgEfficiency: number | null;
  nights: number;
  nightsWithStages: number;
}>;

export function buildSleepDetail(sleeps: SleepFullRow[], minNights = 3): SleepDetail {
  // คืนเดียวกันอาจมีหลาย source → เอาคืนที่นอนมากสุด (กันนับซ้ำ กติกาเดียวกับทั้งระบบ)
  const nights = pickBestPerNight(sleeps);
  if (nights.length < minNights) return notReady(nights.length, minNights);

  const st = (n: SleepFullRow, k: "deep" | "rem" | "core" | "awake") => {
    const s = n.stages as Record<string, number> | null;
    return s && typeof s[k] === "number" ? s[k] : null;
  };
  const withStages = nights.filter((n) => st(n, "deep") !== null || st(n, "rem") !== null);
  const pick = (k: "deep" | "rem" | "core" | "awake") => {
    const xs = withStages.map((n) => st(n, k)).filter((v): v is number => v !== null);
    return xs.length ? Math.round(avg(xs)) : null;
  };
  const effs = nights.map((n) => n.quality).filter((v): v is number => typeof v === "number");

  return {
    ready: true,
    avgMinutes: Math.round(avg(nights.map((n) => n.minutesAsleep))),
    avgDeep: pick("deep"),
    avgRem: pick("rem"),
    avgCore: pick("core"),
    avgAwake: pick("awake"),
    avgEfficiency: effs.length ? Math.round(avg(effs) * 100) : null,
    nights: nights.length,
    nightsWithStages: withStages.length,
  };
}

export type SleepConsistency = Ready<{
  bedMedian: string;
  wakeMedian: string;
  bedSwingMin: number;
  wakeSwingMin: number;
  label: string;
  nights: number;
}>;

/**
 * ความสม่ำเสมอของเวลานอน — งานวิจัยชี้ว่าเวลา "เข้านอนไม่ตรง" สัมพันธ์กับน้ำหนักขึ้น
 * แม้ชั่วโมงนอนรวมจะพอ · วัดด้วยส่วนเบี่ยงเบนมาตรฐานของเวลาเข้านอน/ตื่น
 * ⚠️ เวลาเข้านอนคร่อมเที่ยงคืน (23:30 กับ 00:30 ต่างกันแค่ 1 ชม. ไม่ใช่ 23)
 *    → เลื่อนแกนไปที่เที่ยงวันก่อนคำนวณ
 */
export function buildSleepConsistency(sleeps: SleepFullRow[], minNights = 5): SleepConsistency {
  const nights = pickBestPerNight(sleeps).filter((n) => n.startAt && n.endAt);
  if (nights.length < minNights) return notReady(nights.length, minNights);

  // แกนใหม่: 12:00 = 0 นาที → เที่ยงคืนอยู่ที่ 720 ไม่กระโดดข้ามขอบ
  const shift = (m: number) => (m + 1440 - 720) % 1440;
  const unshift = (m: number) => (m + 720) % 1440;
  const beds = nights.map((n) => shift(bkkMinuteOfDay(n.startAt as Date)));
  const wakes = nights.map((n) => shift(bkkMinuteOfDay(n.endAt as Date)));

  const bedSwing = Math.round(sd(beds));
  const wakeSwing = Math.round(sd(wakes));
  const worst = Math.max(bedSwing, wakeSwing);
  const label = worst <= 30 ? "สม่ำเสมอมาก" : worst <= 60 ? "ค่อนข้างสม่ำเสมอ" : worst <= 90 ? "เหวี่ยงพอควร" : "เหวี่ยงมาก";

  return {
    ready: true,
    bedMedian: hhmm(unshift(median(beds))),
    wakeMedian: hhmm(unshift(median(wakes))),
    bedSwingMin: bedSwing,
    wakeSwingMin: wakeSwing,
    label,
    nights: nights.length,
  };
}

function pickBestPerNight(sleeps: SleepFullRow[]): SleepFullRow[] {
  const byNight = new Map<string, SleepFullRow>();
  for (const s of sleeps) {
    const k = bkkKey(s.date);
    const prev = byNight.get(k);
    if (!prev || s.minutesAsleep > prev.minutesAsleep) byNight.set(k, s);
  }
  return [...byNight.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

// ── #B ตัวชี้วัดจาก Watch (HRV / VO2Max / ฟื้นตัว / ออกซิเจน / หายใจ / อุณหภูมิ) ──
export type VitalRow = {
  date: Date;
  hrvMs: number | null; vo2max: number | null; hrRecovery: number | null;
  respiratoryRate: number | null; spo2: number | null; wristTempDelta: number | null;
  breathDisturb: number | null; restingHR: number | null;
};
export type Vital = {
  ready: boolean;
  latest: number | null;
  avg7: number | null;
  avg28: number | null;
  /** ทิศทางเทียบ baseline: up | down | flat (ตีความต่างกันแต่ละตัว จึงไม่ตัดสินดี/แย่ตรงนี้) */
  dir: "up" | "down" | "flat" | null;
  points: Array<{ date: string; v: number }>;
  days: number;
};

/** สรุปตัวชี้วัด 1 ตัวให้พร้อมวาดกราฟ + เทียบค่าปกติของตัวเอง */
export function summarizeVital(rows: VitalRow[], key: keyof Omit<VitalRow, "date">, minDays = 3): Vital {
  const points = rows
    .map((r) => ({ date: bkkKey(r.date), v: r[key] }))
    .filter((p): p is { date: string; v: number } => typeof p.v === "number" && Number.isFinite(p.v))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (points.length === 0) return { ready: false, latest: null, avg7: null, avg28: null, dir: null, points: [], days: 0 };

  const vals = points.map((p) => p.v);
  const last7 = vals.slice(-7);
  const a7 = avg(last7);
  const a28 = avg(vals);
  // ต่างกัน <3% ถือว่าเท่าเดิม — ตัวชี้วัดพวกนี้แกว่งเองอยู่แล้ว
  const dir = a28 === 0 ? null : Math.abs(a7 - a28) / a28 < 0.03 ? "flat" : a7 > a28 ? "up" : "down";
  return {
    ready: points.length >= minDays,
    latest: r1(vals[vals.length - 1]),
    avg7: r1(a7),
    avg28: r1(a28),
    dir,
    points,
    days: points.length,
  };
}

// ── #B การเคลื่อนไหว/สิ่งแวดล้อม ─────────────────────────────────────────
export type MovementRow = {
  date: Date; steps: number | null; distanceM: number | null; flights: number | null;
  daylightMin: number | null; walkingSpeed: number | null; basalKcal: number | null;
  mindfulMin: number | null; audioDb: number | null; standHours: number | null; exerciseMin: number | null;
};
export type MovementSummary = Ready<{
  avgSteps: number; avgDistanceKm: number; avgFlights: number; avgDaylightMin: number;
  avgWalkingSpeed: number | null; avgBasalKcal: number | null; totalMindfulMin: number;
  avgAudioDb: number | null; avgStandHours: number; avgExerciseMin: number;
  bestStepsDay: { date: string; steps: number } | null; daysCounted: number;
}>;

export function buildMovement(rows: MovementRow[], minDays = 3): MovementSummary {
  const days = rows.filter((r) => (r.steps ?? 0) > 0 || (r.distanceM ?? 0) > 0);
  if (days.length < minDays) return notReady(days.length, minDays);

  const nums = (k: keyof MovementRow) =>
    rows.map((r) => r[k]).filter((v): v is number => typeof v === "number" && v > 0);
  const optAvg = (k: keyof MovementRow) => {
    const xs = nums(k);
    return xs.length ? r1(avg(xs)) : null;
  };
  const best = days.reduce<{ date: string; steps: number } | null>((acc, r) => {
    const s = r.steps ?? 0;
    return !acc || s > acc.steps ? { date: bkkKey(r.date), steps: s } : acc;
  }, null);

  return {
    ready: true,
    avgSteps: Math.round(avg(nums("steps"))),
    avgDistanceKm: r1(avg(nums("distanceM")) / 1000),
    avgFlights: r1(avg(nums("flights"))),
    avgDaylightMin: Math.round(avg(nums("daylightMin"))),
    avgWalkingSpeed: optAvg("walkingSpeed"),
    avgBasalKcal: optAvg("basalKcal") === null ? null : Math.round(optAvg("basalKcal") as number),
    totalMindfulMin: Math.round(nums("mindfulMin").reduce((a, b) => a + b, 0)),
    avgAudioDb: optAvg("audioDb"),
    avgStandHours: r1(avg(nums("standHours"))),
    avgExerciseMin: Math.round(avg(nums("exerciseMin"))),
    bestStepsDay: best,
    daysCounted: days.length,
  };
}

// ── #C โซเดียม → น้ำหนักวันถัดไป ─────────────────────────────────────────
export type SodiumWeight = Ready<{
  highAvgDelta: number;
  lowAvgDelta: number;
  diff: number;
  highDays: number;
  lowDays: number;
  threshold: number;
}>;

/**
 * วันที่กินเค็มมาก → น้ำหนักเช้าวันถัดไปมักขึ้น เพราะร่างกายกักน้ำ (ไม่ใช่ไขมัน)
 * เทียบ "ส่วนต่างน้ำหนักเช้าวันถัดไป" ระหว่างวันโซเดียมสูงกับวันโซเดียมต่ำ
 * ต้องมีน้ำหนักของทั้งวันนั้นและวันถัดไปถึงจะนับได้ → คนชั่งไม่ทุกวันจะ ready ช้า
 */
export function buildSodiumWeight(
  meals: MacroMealRow[], weights: WeightRow[], target: number, minPairs = 6
): SodiumWeight {
  const sodiumByDay = new Map<string, number>();
  for (const m of meals) {
    const k = bkkKey(m.date);
    sodiumByDay.set(k, (sodiumByDay.get(k) ?? 0) + (m.sodium ?? 0));
  }
  const weightByDay = new Map<string, number>();
  for (const w of weights) {
    const k = bkkKey(w.date);
    // ชั่งหลายครั้งต่อวัน → ใช้ค่าเฉลี่ยกันค่าโดด
    const prev = weightByDay.get(k);
    weightByDay.set(k, prev === undefined ? w.weight : (prev + w.weight) / 2);
  }

  const highs: number[] = [];
  const lows: number[] = [];
  for (const [day, na] of sodiumByDay) {
    const today = weightByDay.get(day);
    const nextKey = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
    const next = weightByDay.get(nextKey);
    if (today === undefined || next === undefined) continue;
    (na > target ? highs : lows).push(next - today);
  }
  const pairs = highs.length + lows.length;
  if (highs.length < 2 || lows.length < 2 || pairs < minPairs) return notReady(pairs, minPairs);

  return {
    ready: true,
    highAvgDelta: r1(avg(highs) * 10) / 10,
    lowAvgDelta: r1(avg(lows) * 10) / 10,
    diff: r1((avg(highs) - avg(lows)) * 10) / 10,
    highDays: highs.length,
    lowDays: lows.length,
    threshold: target,
  };
}

// ── #C วันออกกำลังกาย vs วันพัก ──────────────────────────────────────────
export type WorkoutVsRest = Ready<{
  workoutDays: number; restDays: number;
  kcalWorkout: number; kcalRest: number; diff: number;
  proteinWorkout: number; proteinRest: number;
}>;

/** คนส่วนใหญ่กินเกินในวันพักมากกว่าที่คิด — การ์ดนี้ทำให้เห็นตัวเลขจริง */
export function buildWorkoutVsRest(
  meals: MacroMealRow[], exerciseDays: Set<string>, dayKeys: string[], minEach = 3
): WorkoutVsRest {
  const byDay = new Map<string, { kcal: number; p: number }>();
  for (const m of meals) {
    const k = bkkKey(m.date);
    const cur = byDay.get(k) ?? { kcal: 0, p: 0 };
    cur.kcal += m.calories || 0;
    cur.p += m.protein || 0;
    byDay.set(k, cur);
  }
  const logged = dayKeys.filter((k) => byDay.has(k));
  const wo = logged.filter((k) => exerciseDays.has(k));
  const rest = logged.filter((k) => !exerciseDays.has(k));
  if (wo.length < minEach || rest.length < minEach) return notReady(Math.min(wo.length, rest.length), minEach);

  const kc = (ks: string[]) => Math.round(avg(ks.map((k) => byDay.get(k)!.kcal)));
  const pr = (ks: string[]) => Math.round(avg(ks.map((k) => byDay.get(k)!.p)));
  return {
    ready: true,
    workoutDays: wo.length,
    restDays: rest.length,
    kcalWorkout: kc(wo),
    kcalRest: kc(rest),
    diff: kc(wo) - kc(rest),
    proteinWorkout: pr(wo),
    proteinRest: pr(rest),
  };
}

// ── #C คะแนนสุขภาพรายวัน ─────────────────────────────────────────────────
export type ScoreDay = { date: string; score: number; parts: Record<string, number | null> };
export type HealthScore = Ready<{
  days: ScoreDay[];
  avg: number;
  best: ScoreDay | null;
  worst: ScoreDay | null;
}>;

/**
 * คะแนนรวม 0-100 จาก 5 ด้าน (ด้านละ 20)
 *   กิน (ใกล้เป้าแคลอรี่แค่ไหน) · โปรตีน · ขยับ (เผาผลาญเทียบเป้า) · นอน · น้ำ
 *
 * 🔴 ด้านที่ "ไม่มีข้อมูลวันนั้น" = ไม่คิดคะแนน แล้วหารด้วยด้านที่มีจริง
 *    ไม่ใช่ให้ 0 — ไม่งั้นคนที่ไม่มีนาฬิกาจะได้คะแนนต่ำตลอดทั้งที่ทำดี
 *    วันที่มีข้อมูลน้อยกว่า 2 ด้าน = ไม่ให้คะแนนเลย (สุ่มเกินไป)
 */
export function buildHealthScore(opts: {
  dayKeys: string[];
  meals: MacroMealRow[];
  waters: WaterRow[];
  sleeps: SleepFullRow[];
  burnByDay: Map<string, number>;
  target: { kcal: number; protein: number; water: number; sleepMin: number; burn: number };
}, minDays = 3): HealthScore {
  const { dayKeys, meals, waters, sleeps, burnByDay, target } = opts;

  const kcalByDay = new Map<string, number>();
  const proteinByDay = new Map<string, number>();
  for (const m of meals) {
    const k = bkkKey(m.date);
    kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + (m.calories || 0));
    proteinByDay.set(k, (proteinByDay.get(k) ?? 0) + (m.protein || 0));
  }
  const waterByDay = new Map<string, number>();
  for (const w of waters) {
    const k = bkkKey(w.date);
    waterByDay.set(k, (waterByDay.get(k) ?? 0) + (w.amount || 0));
  }
  const sleepByDay = new Map<string, number>();
  for (const s of sleeps) {
    const k = bkkKey(s.date);
    sleepByDay.set(k, Math.max(sleepByDay.get(k) ?? 0, s.minutesAsleep));
  }

  /** ใกล้เป้าเท่าไหร่ = 20 คะแนน · เกิน/ขาด 50% = 0 */
  const closeness = (actual: number, goal: number) => {
    if (goal <= 0) return null;
    const off = Math.abs(actual - goal) / goal;
    return Math.max(0, Math.round((1 - Math.min(1, off / 0.5)) * 20));
  };
  /** ยิ่งมากยิ่งดี แต่ไม่เกิน 20 */
  const upTo = (actual: number, goal: number) => (goal <= 0 ? null : Math.min(20, Math.round((actual / goal) * 20)));

  const days: ScoreDay[] = [];
  for (const date of dayKeys) {
    const parts: Record<string, number | null> = {
      กิน: kcalByDay.has(date) ? closeness(kcalByDay.get(date)!, target.kcal) : null,
      โปรตีน: proteinByDay.has(date) ? upTo(proteinByDay.get(date)!, target.protein) : null,
      ขยับ: burnByDay.has(date) ? upTo(burnByDay.get(date)!, target.burn) : null,
      นอน: sleepByDay.has(date) ? upTo(sleepByDay.get(date)!, target.sleepMin) : null,
      น้ำ: waterByDay.has(date) ? upTo(waterByDay.get(date)!, target.water) : null,
    };
    const have = Object.values(parts).filter((v): v is number => v !== null);
    if (have.length < 2) continue;
    days.push({ date, score: Math.round((have.reduce((a, b) => a + b, 0) / (have.length * 20)) * 100), parts });
  }
  if (days.length < minDays) return notReady(days.length, minDays);

  const sorted = [...days].sort((a, b) => a.score - b.score);
  return {
    ready: true,
    days,
    avg: Math.round(avg(days.map((d) => d.score))),
    worst: sorted[0] ?? null,
    best: sorted[sorted.length - 1] ?? null,
  };
}

// ── #C พยากรณ์ 4 / 8 / 12 สัปดาห์ ────────────────────────────────────────
export type Projection = Ready<{
  perWeekKg: number;
  points: Array<{ weeks: number; weight: number; reachGoal: boolean }>;
  goalWeight: number | null;
  note: string;
}>;

/**
 * ต่อยอดจาก buildWeightTrend — ยิงเส้นตรงไปข้างหน้าตามอัตราปัจจุบัน
 * 🔴 ไม่ใช่คำทำนาย เป็นการ "ฉายภาพถ้าทำเท่าเดิม" · หยุดเส้นที่เป้าหมาย ไม่ลากเลยไป
 *    และถ้าอัตราแทบไม่ขยับ (<0.05 กก./สัปดาห์) = ไม่ฉายภาพ เพราะจะได้เลขไร้สาระ
 */
export function buildProjection(trend: WeightTrend, goalWeight: number | null): Projection {
  if (!trend.ready) return notReady(0, 3);
  const last = trend.points[trend.points.length - 1];
  const current = last.ma7 ?? last.weight;
  const rate = trend.perWeekKg;
  if (Math.abs(rate) < 0.05) {
    return { ready: true, perWeekKg: rate, points: [], goalWeight, note: "น้ำหนักนิ่ง — ยังฉายภาพล่วงหน้าไม่ได้" };
  }

  const points = [4, 8, 12].map((weeks) => {
    let w = current + rate * weeks;
    let reach = false;
    if (goalWeight !== null) {
      const passed = rate < 0 ? w <= goalWeight : w >= goalWeight;
      if (passed) { w = goalWeight; reach = true; }
    }
    return { weeks, weight: r1(w), reachGoal: reach };
  });
  return {
    ready: true,
    perWeekKg: rate,
    points,
    goalWeight,
    note: rate < 0 ? "ถ้ารักษาจังหวะนี้ต่อไป" : "ตอนนี้น้ำหนักกำลังขึ้น — ตัวเลขนี้คือถ้าทำเท่าเดิม",
  };
}

// ── #C เทียบสัปดาห์นี้ กับ สัปดาห์ที่แล้ว ────────────────────────────────
export type CompareRow = {
  key: string; label: string; unit: string;
  thisWeek: number | null; prevWeek: number | null; deltaPct: number | null;
  /** ทิศที่ "ดี" ของตัวชี้วัดนี้ — ให้ UI ระบายสีถูก (โซเดียมลดลง = ดี) */
  goodWhen: "up" | "down";
};
export type WeeklyCompare = Ready<{ rows: CompareRow[]; thisWeekDays: number; prevWeekDays: number }>;

export function buildWeeklyCompare(opts: {
  meals: MacroMealRow[];
  waters: WaterRow[];
  sleeps: SleepFullRow[];
  metrics: MovementRow[];
  burnByDay: Map<string, number>;
  now?: Date;
}): WeeklyCompare {
  const now = opts.now ?? new Date();
  const todayKey = bkkKey(now);
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  const inRange = (k: string, fromDaysAgo: number, toDaysAgo: number) => {
    const t = Date.parse(`${k}T00:00:00Z`);
    return t >= todayMs - fromDaysAgo * DAY_MS && t <= todayMs - toDaysAgo * DAY_MS;
  };
  const thisWeek = (k: string) => inRange(k, 6, 0);
  const prevWeek = (k: string) => inRange(k, 13, 7);

  const dayAgg = <T>(rows: T[], keyOf: (r: T) => string, valOf: (r: T) => number, mode: "sum" | "max" = "sum") => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = keyOf(r);
      const v = valOf(r);
      m.set(k, mode === "sum" ? (m.get(k) ?? 0) + v : Math.max(m.get(k) ?? 0, v));
    }
    return m;
  };
  const avgIn = (m: Map<string, number>, pick: (k: string) => boolean) => {
    const xs = [...m.entries()].filter(([k]) => pick(k)).map(([, v]) => v);
    return xs.length ? avg(xs) : null;
  };

  const kcal = dayAgg(opts.meals, (m) => bkkKey(m.date), (m) => m.calories || 0);
  const protein = dayAgg(opts.meals, (m) => bkkKey(m.date), (m) => m.protein || 0);
  const sodium = dayAgg(opts.meals, (m) => bkkKey(m.date), (m) => m.sodium ?? 0);
  const sugar = dayAgg(opts.meals, (m) => bkkKey(m.date), (m) => m.sugar ?? 0);
  const water = dayAgg(opts.waters, (w) => bkkKey(w.date), (w) => w.amount || 0);
  const sleep = dayAgg(opts.sleeps, (s) => bkkKey(s.date), (s) => s.minutesAsleep, "max");
  const steps = dayAgg(opts.metrics, (m) => bkkKey(m.date), (m) => m.steps ?? 0, "max");

  const defs: Array<{ key: string; label: string; unit: string; map: Map<string, number>; goodWhen: "up" | "down" }> = [
    { key: "kcal", label: "แคลอรี่ที่กิน", unit: "kcal", map: kcal, goodWhen: "down" },
    { key: "protein", label: "โปรตีน", unit: "g", map: protein, goodWhen: "up" },
    { key: "sodium", label: "โซเดียม", unit: "mg", map: sodium, goodWhen: "down" },
    { key: "sugar", label: "น้ำตาล", unit: "g", map: sugar, goodWhen: "down" },
    { key: "water", label: "น้ำดื่ม", unit: "มล.", map: water, goodWhen: "up" },
    { key: "sleep", label: "การนอน", unit: "นาที", map: sleep, goodWhen: "up" },
    { key: "burn", label: "เผาผลาญ", unit: "kcal", map: opts.burnByDay, goodWhen: "up" },
    { key: "steps", label: "ก้าว", unit: "ก้าว", map: steps, goodWhen: "up" },
  ];

  const rows: CompareRow[] = defs.map((d) => {
    const a = avgIn(d.map, thisWeek);
    const b = avgIn(d.map, prevWeek);
    return {
      key: d.key,
      label: d.label,
      unit: d.unit,
      thisWeek: a === null ? null : Math.round(a),
      prevWeek: b === null ? null : Math.round(b),
      deltaPct: a === null || b === null || b === 0 ? null : Math.round(((a - b) / b) * 100),
      goodWhen: d.goodWhen,
    };
  });

  const countDays = (m: Map<string, number>, pick: (k: string) => boolean) =>
    [...m.keys()].filter(pick).length;
  const thisDays = Math.max(countDays(kcal, thisWeek), countDays(steps, thisWeek), countDays(sleep, thisWeek));
  const prevDays = Math.max(countDays(kcal, prevWeek), countDays(steps, prevWeek), countDays(sleep, prevWeek));
  if (thisDays < 2 || prevDays < 2) return notReady(Math.min(thisDays, prevDays), 2);

  return { ready: true, rows, thisWeekDays: thisDays, prevWeekDays: prevDays };
}
