/**
 * การ์ดสถิติของหน้า "สถิติ" — คำนวณจาก log จริงล้วน
 *
 * 🔴 deterministic ทั้งไฟล์ ไม่เรียก AI
 * 🔴 ทุกก้อนมี `ready` — ข้อมูลไม่พอต้องบอกตรง ๆ ห้ามสรุปจาก sample เล็ก ๆ
 *    (ตัวเลขมั่วเรื่องสุขภาพอันตรายกว่าไม่มีตัวเลข)
 */
import { normaliseFoodName } from "@/lib/foodName";
import { slopePerUnit } from "@/lib/weightForecast";

const BKK_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 86400_000;
const KCAL_PER_KG_FAT = 7700;

export const bkkKey = (d: Date) => new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
export const bkkHour = (d: Date) => new Date(d.getTime() + BKK_OFFSET_MS).getUTCHours();

export type MealRow = { date: Date; name: string; calories: number; protein: number; via: string };
export type ExerciseRow = { date: Date; calories: number };
export type MetricRow = { date: Date; activeKcal: number | null; restingHR: number | null };
export type SleepRow = { date: Date; minutesAsleep: number };

// ── #2 สมดุลพลังงาน ─────────────────────────────────────────────────────
/**
 * in  = แคลอรี่ที่กินจริงวันนั้น
 * out = **พลังงานที่ใช้จริง** = baseTdee (พลังงานของวันที่ไม่ได้ออกกำลังกาย)
 *       + max(activeKcal จากนาฬิกา, Σ ExerciseLog)
 *
 * ⚠️ ตั้งใจใช้ baseTdee ไม่ใช่ `energy.base` ของ /api/cal/initial-data
 *    เพราะ energy.base คือ "เป้าที่ควรกิน" (หักส่วนขาดไปแล้ว) ไม่ใช่พลังงานที่ร่างกายใช้
 *    เอามาเป็น out จะทำให้กราฟสมดุลอ่านผิดทั้งใบ (ดูเหมือนสมดุลทั้งที่กำลังลด)
 *    ใช้ max ไม่ใช่บวก เพราะ workout จากนาฬิกาถูกนับใน activeKcal อยู่แล้ว (กันนับซ้ำ)
 */
export function buildEnergyBalance(opts: {
  dayKeys: string[];
  meals: MealRow[];
  exercises: ExerciseRow[];
  metrics: MetricRow[];
  baseTdee: number;
}): { ready: boolean; baseTdee: number; days: Array<{ date: string; in: number; out: number }> } {
  const { dayKeys, meals, exercises, metrics, baseTdee } = opts;
  const eaten = new Map<string, number>();
  const burnedEx = new Map<string, number>();
  const active = new Map<string, number>();

  for (const m of meals) eaten.set(bkkKey(m.date), (eaten.get(bkkKey(m.date)) || 0) + (m.calories || 0));
  for (const e of exercises) burnedEx.set(bkkKey(e.date), (burnedEx.get(bkkKey(e.date)) || 0) + (e.calories || 0));
  for (const m of metrics) {
    const k = bkkKey(m.date);
    active.set(k, Math.max(active.get(k) || 0, m.activeKcal || 0));
  }

  const days = dayKeys.map((date) => ({
    date,
    in: Math.round(eaten.get(date) || 0),
    out: Math.round(baseTdee + Math.max(active.get(date) || 0, burnedEx.get(date) || 0)),
  }));
  return { ready: meals.length > 0, baseTdee, days };
}

// ── #4 เมนูที่กินบ่อย ────────────────────────────────────────────────────
export const TOP_FOODS_MIN_COUNT = 3;

export function buildTopFoods(meals: MealRow[]): {
  ready: boolean;
  items: Array<{ name: string; count: number; totalKcal: number; estKgFat: number }>;
} {
  const g = new Map<string, { name: string; count: number; totalKcal: number }>();
  for (const m of meals) {
    const key = normaliseFoodName(m.name);
    if (!key) continue;
    const cur = g.get(key) ?? { name: (m.name || "").trim(), count: 0, totalKcal: 0 };
    cur.count++;
    cur.totalKcal += m.calories || 0;
    g.set(key, cur);
  }
  const items = [...g.values()]
    .filter((x) => x.count >= TOP_FOODS_MIN_COUNT)
    .sort((a, b) => b.count - a.count || b.totalKcal - a.totalKcal)
    .slice(0, 5)
    .map((x) => ({
      name: x.name,
      count: x.count,
      totalKcal: Math.round(x.totalKcal),
      // "เมนูนี้กินไปแล้วเท่ากับไขมันกี่ กก." — 7,700 kcal ≈ ไขมัน 1 กก.
      estKgFat: Math.round((x.totalKcal / KCAL_PER_KG_FAT) * 100) / 100,
    }));
  return { ready: items.length > 0, items };
}

// ── #5 ช่วงเวลาเสี่ยง ────────────────────────────────────────────────────
export const RISK_MIN_DAYS = 14;
export const RISK_WINDOW_HOURS = 2;
export const RISK_FIRST_HOUR = 15; // สนใจเฉพาะหลังบ่าย 3 (ช่วงของว่าง/มื้อดึก)
export const RISK_LAST_START = 22;
/** วันไหนถือว่า "โดน" ช่วงนั้น */
export const RISK_DAY_KCAL = 150;
export const RISK_MIN_DAYS_HIT = 3;

export type RiskWindow =
  | { ready: false; reason: "need_more_data" | "no_pattern"; spanDays: number }
  | {
      ready: true;
      startHour: number;
      endHour: number;
      avgKcal: number;
      daysHit: number;
      totalDays: number;
    };

/**
 * ช่วง 2 ชม. หลัง 15:00 ที่กิน "นอกแผน" (via != plan) รวมแล้วมากสุด
 * ใช้ค่าเฉลี่ยต่อวันของทั้งช่วงข้อมูล ไม่ใช่ผลรวมดิบ — ไม่งั้นช่วงข้อมูลยาวกว่าจะชนะเสมอ
 */
export function buildRiskWindow(meals: MealRow[], dayKeys: string[]): RiskWindow {
  const totalDays = dayKeys.length;
  const offPlan = meals.filter((m) => m.via !== "plan" && bkkHour(m.date) >= RISK_FIRST_HOUR);
  const loggedDays = new Set(meals.map((m) => bkkKey(m.date))).size;
  if (loggedDays < RISK_MIN_DAYS) return { ready: false, reason: "need_more_data", spanDays: loggedDays };

  let best: { startHour: number; total: number; daysHit: number } | null = null;
  for (let start = RISK_FIRST_HOUR; start <= RISK_LAST_START; start++) {
    const end = start + RISK_WINDOW_HOURS;
    const perDay = new Map<string, number>();
    for (const m of offPlan) {
      const h = bkkHour(m.date);
      if (h >= start && h < end) {
        const k = bkkKey(m.date);
        perDay.set(k, (perDay.get(k) || 0) + (m.calories || 0));
      }
    }
    const total = [...perDay.values()].reduce((s, v) => s + v, 0);
    const daysHit = [...perDay.values()].filter((v) => v >= RISK_DAY_KCAL).length;
    if (!best || total > best.total) best = { startHour: start, total, daysHit };
  }

  if (!best || best.daysHit < RISK_MIN_DAYS_HIT) {
    return { ready: false, reason: "no_pattern", spanDays: loggedDays };
  }
  return {
    ready: true,
    startHour: best.startHour,
    endHour: best.startHour + RISK_WINDOW_HOURS,
    // เฉลี่ย "เฉพาะวันที่โดนจริง" — หารด้วยทุกวันจะได้ตัวเลขต่ำจนไม่สะท้อนสิ่งที่ user เจอ
    avgKcal: Math.round(best.total / Math.max(1, best.daysHit)),
    daysHit: best.daysHit,
    totalDays,
  };
}

// ── #6 นอนน้อย → กินเพิ่ม ────────────────────────────────────────────────
export const SLEEP_SHORT_MIN = 360; // < 6 ชม.
export const SLEEP_EAT_MIN_SAMPLE = 3;

export type SleepEat =
  | { ready: false; reason: "need_more_data"; shortNights: number; normalNights: number }
  | {
      ready: true;
      shortNights: number;
      normalNights: number;
      avgKcalAfterShort: number;
      avgKcalAfterNormal: number;
      extraKcalOnShort: number;
    };

/**
 * SleepLog.date = "วันที่ตื่น" อยู่แล้ว → แคลอรี่ของวันเดียวกันคือ "วันถัดจากคืนนั้น"
 * นับเฉพาะวันที่มีบันทึกอาหารจริง (วันที่ไม่ได้บันทึก = 0 kcal จะลากค่าเฉลี่ยให้เพี้ยน)
 */
export function buildSleepEat(sleeps: SleepRow[], meals: MealRow[]): SleepEat {
  const kcalByDay = new Map<string, number>();
  for (const m of meals) kcalByDay.set(bkkKey(m.date), (kcalByDay.get(bkkKey(m.date)) || 0) + (m.calories || 0));

  // คืนเดียวอาจมีหลาย source (นาฬิกา + ที่ user บอกเอง) → เอาค่ามากสุดของวันนั้น
  const minutesByDay = new Map<string, number>();
  for (const s of sleeps) {
    const k = bkkKey(s.date);
    minutesByDay.set(k, Math.max(minutesByDay.get(k) || 0, s.minutesAsleep || 0));
  }

  const short: number[] = [];
  const normal: number[] = [];
  for (const [day, min] of minutesByDay) {
    const kcal = kcalByDay.get(day);
    if (kcal === undefined || kcal <= 0) continue; // ไม่ได้บันทึกอาหารวันนั้น = ไม่นับ
    (min < SLEEP_SHORT_MIN ? short : normal).push(kcal);
  }

  if (short.length < SLEEP_EAT_MIN_SAMPLE || normal.length < SLEEP_EAT_MIN_SAMPLE) {
    return { ready: false, reason: "need_more_data", shortNights: short.length, normalNights: normal.length };
  }
  const avg = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0) / a.length);
  const s = avg(short);
  const n = avg(normal);
  return {
    ready: true,
    shortNights: short.length,
    normalNights: normal.length,
    avgKcalAfterShort: s,
    avgKcalAfterNormal: n,
    extraKcalOnShort: s - n,
  };
}

// ── #7 การกระจายโปรตีน ──────────────────────────────────────────────────
export const PROTEIN_SPREAD_MIN_MEALS = 5;

export type ProteinSpread =
  | { ready: false; reason: "need_more_data"; meals: number }
  | {
      ready: true;
      morningPct: number;
      noonPct: number;
      eveningPct: number;
      avgPerMeal: number;
      totalProtein: number;
      meals: number;
    };

/** เช้า < 11:00 · กลางวัน 11:00-15:59 · เย็น ≥ 16:00 (เวลาไทย) */
export function buildProteinSpread(meals: MealRow[]): ProteinSpread {
  const withProtein = meals.filter((m) => (m.protein || 0) > 0);
  if (withProtein.length < PROTEIN_SPREAD_MIN_MEALS) {
    return { ready: false, reason: "need_more_data", meals: withProtein.length };
  }
  let morning = 0;
  let noon = 0;
  let evening = 0;
  for (const m of withProtein) {
    const h = bkkHour(m.date);
    if (h < 11) morning += m.protein;
    else if (h < 16) noon += m.protein;
    else evening += m.protein;
  }
  const total = morning + noon + evening;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  return {
    ready: true,
    morningPct: pct(morning),
    noonPct: pct(noon),
    eveningPct: pct(evening),
    avgPerMeal: Math.round((total / withProtein.length) * 10) / 10,
    totalProtein: Math.round(total),
    meals: withProtein.length,
  };
}

// ── #8 ชีพจรขณะพัก ──────────────────────────────────────────────────────
export const HR_TREND_MIN_POINTS = 4;
export const HR_TREND_MIN_SPAN_DAYS = 14;

export type RestingHR =
  | { ready: false; reason: "no_data" }
  | {
      ready: true;
      points: Array<{ date: string; bpm: number }>;
      /** bpm ที่เปลี่ยนต่อ 30 วัน (ลบ = ฟิตขึ้น) · null = ข้อมูลยังไม่พอหาเทรนด์ */
      trend30d: number | null;
      spanDays: number;
    };

export function buildRestingHR(metrics: MetricRow[]): RestingHR {
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const m of metrics) {
    if (m.restingHR == null || m.restingHR <= 0) continue;
    const k = bkkKey(m.date);
    // วันเดียวมีได้หลาย source → ค่าเฉลี่ยจริง (sum/count)
    // ห้ามใช้ running average (prev+new)/2 — ค่ามาทีหลังจะถ่วงน้ำหนักมากกว่าค่าแรก
    const cur = byDay.get(k) ?? { sum: 0, n: 0 };
    byDay.set(k, { sum: cur.sum + m.restingHR, n: cur.n + 1 });
  }
  if (byDay.size === 0) return { ready: false, reason: "no_data" };

  const points = [...byDay.entries()]
    .map(([date, v]) => ({ date, bpm: Math.round(v.sum / v.n) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ts = points.map((p) => ({ t: Date.parse(`${p.date}T00:00:00.000Z`) / DAY_MS, v: p.bpm }));
  const spanDays = points.length >= 2 ? Math.round(ts[ts.length - 1].t - ts[0].t) : 0;
  const enough = points.length >= HR_TREND_MIN_POINTS && spanDays >= HR_TREND_MIN_SPAN_DAYS;
  const slope = enough ? slopePerUnit(ts) : null;

  return {
    ready: true,
    points,
    trend30d: slope == null ? null : Math.round(slope * 30 * 10) / 10,
    spanDays,
  };
}

/** รายการวัน (BKK) ย้อนหลัง n วันจนถึงวันนี้ */
export function dayKeyRange(days: number, now = new Date()): string[] {
  const todayMs = Date.parse(`${bkkKey(now)}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, i) =>
    new Date(todayMs - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10)
  );
}
