/**
 * สะพานระหว่าง engine readiness (คณิตล้วน src/lib/readiness.ts) กับฐานข้อมูล
 *
 * หน้าที่เดียว: แปลง "ข้อมูลดิบที่ Watch ซิงก์ไว้แล้ว" ให้เป็นอินพุตของสูตร §4.1
 * แยกออกจาก route เพราะทั้ง GET (บอกว่ามีข้อมูลอะไรบ้าง) และ POST (คิดคะแนน) ต้องใช้ตัวเดียวกัน
 * ถ้าสองเส้นคิด baseline คนละแบบ user จะเห็น "มี HRV" แต่คะแนนกลับไม่ใช้ HRV
 *
 * 🔴 ห้ามดึงข้อมูลเกิน 60 วัน (WO-PT-C §C3) — baseline ใช้ 28 วัน ที่เหลือคือกันวันที่ Watch ไม่ได้ซิงก์
 */
import { prisma } from "@/lib/prisma";
import { bkkDayWindow } from "@/lib/planTick";
import {
  DEFAULT_SLEEP_GOAL_MIN,
  type HrvInput,
  type PatternOf,
  type ReadinessPlanItem,
  type RhrInput,
  type SleepInput,
} from "@/lib/readiness";

const DAY_MS = 24 * 60 * 60 * 1000;

/** หน้าต่าง baseline ตามสูตร §4.1 */
export const BASELINE_DAYS = 28;
/** ค่าเฉลี่ยระยะสั้นของ HRV (ตัวตั้งใน z_hrv) */
export const RECENT_DAYS = 7;
/** เพดานที่อนุญาตให้อ่านย้อนหลัง — กันคิวรีลากทั้งตาราง */
export const MAX_LOOKBACK_DAYS = 60;
/**
 * ต้องมีอย่างน้อยกี่วันถึงจะเชื่อ baseline
 * น้อยกว่านี้ = ยังไม่รู้ว่า "ปกติ" ของคนนี้แกว่งแค่ไหน → sd ที่ได้จะเล็กจนคะแนนเหวี่ยงสุดขอบทุกวัน
 * (ตัดส่วนนั้นทิ้งดีกว่าให้คะแนนที่ผิด — สูตรมี re-normalize รองรับอยู่แล้ว)
 */
export const MIN_BASELINE_DAYS = 7;
/** RHR ของ "วันนี้" ยอมย้อนได้กี่วัน — เป็นค่าสรุปรายวันที่ Apple เขียนช้า เช็คอินตอนเช้าอาจยังไม่มีของวันนี้ */
export const RHR_STALE_DAYS = 1;

/** วัน BKK ของเวลาหนึ่ง ๆ เป็น key (UTC midnight -7) — กติกาเดียวกับ DailyPlan.date/DailyMetric.date */
export function bkkDayKey(instant: Date): Date {
  return new Date(bkkDayWindow(instant).dayStart.getTime() + 7 * 3600 * 1000);
}

/** ค่าเฉลี่ย */
function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * ส่วนเบี่ยงเบนมาตรฐานของหน้าต่าง baseline
 * ใช้แบบประชากร (หาร n) เพราะเราถือว่า 28 วันนั้นคือ "ช่วงอ้างอิงทั้งก้อน" ไม่ได้สุ่มตัวอย่างมาจากอะไร
 */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

interface DayValue {
  key: number;
  value: number;
}

/** ค่ารายวันในหน้าต่าง [from, to] วัน (นับจาก dayKey ถอยหลัง) */
function within(rows: DayValue[], dayKey: Date, days: number): number[] {
  const from = dayKey.getTime() - (days - 1) * DAY_MS;
  return rows.filter((r) => r.key >= from && r.key <= dayKey.getTime()).map((r) => r.value);
}

export interface AutoParts {
  hrv: HrvInput | null;
  rhr: RhrInput | null;
  sleep: SleepInput | null;
  /** ค่าดิบที่เก็บลง ReadinessCheckin ไว้อธิบายคะแนนย้อนหลัง */
  snapshot: { hrvMs: number | null; rhr: number | null; sleepMin: number | null };
  /** "มี/ไม่มี" ต่อส่วน — GET ใช้ตอบก่อน user ตอบคำถาม (ยังไม่คิดคะแนน) */
  availability: { hrv: boolean; rhr: boolean; sleep: boolean };
}

/**
 * อ่าน HRV / RHR / การนอน ของวันนั้นพร้อม baseline 28 วัน
 *
 * DailyMetric มีได้หลายแถวต่อวัน (คนละ source) → ยุบเหลือวันละค่า โดยเอาแถวแรกที่มีค่าจริง
 * เรียงด้วย [date asc, source asc] เพื่อให้ผลนิ่ง (เปิดกี่ครั้งก็ได้ค่าเดิม)
 */
export async function autoParts(memberId: string, dayKey: Date): Promise<AutoParts> {
  const since = new Date(dayKey.getTime() - (MAX_LOOKBACK_DAYS - 1) * DAY_MS);
  const until = new Date(dayKey.getTime() + DAY_MS);

  const [metrics, sleeps] = await Promise.all([
    prisma.dailyMetric.findMany({
      where: { memberId, date: { gte: since, lt: until } },
      orderBy: [{ date: "asc" }, { source: "asc" }],
      select: { date: true, hrvMs: true, restingHR: true },
    }),
    prisma.sleepLog.findMany({
      where: { memberId, date: { gte: since, lt: until } },
      orderBy: [{ date: "asc" }, { source: "asc" }],
      select: { date: true, minutesAsleep: true },
    }),
  ]);

  const hrvByDay = new Map<number, number>();
  const rhrByDay = new Map<number, number>();
  for (const m of metrics) {
    const k = m.date.getTime();
    if (m.hrvMs != null && m.hrvMs > 0 && !hrvByDay.has(k)) hrvByDay.set(k, m.hrvMs);
    if (m.restingHR != null && m.restingHR > 0 && !rhrByDay.has(k)) rhrByDay.set(k, m.restingHR);
  }
  const hrvRows: DayValue[] = [...hrvByDay].map(([key, value]) => ({ key, value }));
  const rhrRows: DayValue[] = [...rhrByDay].map(([key, value]) => ({ key, value }));

  // ── HRV: เฉลี่ย 7 วันล่าสุด เทียบ baseline 28 วัน ──
  let hrv: HrvInput | null = null;
  const hrvBase = within(hrvRows, dayKey, BASELINE_DAYS);
  const hrvRecent = within(hrvRows, dayKey, RECENT_DAYS);
  if (hrvBase.length >= MIN_BASELINE_DAYS && hrvRecent.length > 0) {
    const sd = stdev(hrvBase);
    // sd = 0 (ค่าเท่ากันเป๊ะทุกวัน = ข้อมูลจำลอง/อุปกรณ์ค้าง) → สูตรหารไม่ได้ ให้ถือว่าไม่มีส่วนนี้
    if (sd > 0) hrv = { today7dAvg: mean(hrvRecent), base28dAvg: mean(hrvBase), sd28d: sd };
  }

  // ── RHR: ค่าของวันนี้ (ย้อนได้ 1 วันถ้า Watch ยังไม่เขียนของวันนี้) เทียบ baseline 28 วัน ──
  let rhr: RhrInput | null = null;
  const rhrBase = within(rhrRows, dayKey, BASELINE_DAYS);
  const rhrToday = within(rhrRows, dayKey, 1 + RHR_STALE_DAYS).slice(-1)[0];
  if (rhrBase.length >= MIN_BASELINE_DAYS && rhrToday != null) {
    const sd = stdev(rhrBase);
    if (sd > 0) rhr = { today: rhrToday, base28dAvg: mean(rhrBase), sd28d: sd };
  }

  // ── การนอน: คืนที่ตื่นเช้าวันนี้ (SleepLog.date = วันที่ตื่น) · หลาย source เอาค่ามากสุด ──
  let sleepMin: number | null = null;
  for (const s of sleeps) {
    if (s.date.getTime() !== dayKey.getTime()) continue;
    if (s.minutesAsleep > 0) sleepMin = Math.max(sleepMin ?? 0, s.minutesAsleep);
  }
  const sleep: SleepInput | null =
    sleepMin != null ? { minutes: sleepMin, goalMinutes: DEFAULT_SLEEP_GOAL_MIN } : null;

  return {
    hrv,
    rhr,
    sleep,
    snapshot: {
      hrvMs: hrv ? Math.round(hrv.today7dAvg * 10) / 10 : null,
      rhr: rhr ? Math.round(rhr.today) : null,
      sleepMin,
    },
    availability: { hrv: !!hrv, rhr: !!rhr, sleep: !!sleep },
  };
}

/**
 * "ท่านี้เป็น pattern อะไร" จากตาราง exercises — ให้ adjustPlanForReadiness ใช้ตัดท่าที่กวนจุดที่ปวด
 * ผูกด้วย key ก่อนเสมอ แล้วค่อย fallback ที่ชื่อ (แอดมินเปลี่ยนชื่อท่าได้ แต่แผนเก่าเก็บชื่อไว้)
 * ไม่รู้จักท่า = null → ถือว่า "ไม่ใช่ท่าที่กวนจุดที่ปวด" (ไม่เดา ไม่ตัดมั่ว)
 */
export async function buildPatternOf(items: ReadinessPlanItem[]): Promise<PatternOf> {
  const keys = [...new Set(items.map((it) => (it.key ? String(it.key) : "")).filter(Boolean))];
  const names = [...new Set(items.map((it) => String(it.name ?? "").trim()).filter(Boolean))];
  if (!keys.length && !names.length) return () => null;

  const rows = await prisma.exercise.findMany({
    where: { OR: [{ key: { in: keys } }, { name: { in: names } }] },
    select: { key: true, name: true, pattern: true },
  });

  const byKey = new Map<string, string | null>();
  const byName = new Map<string, string | null>();
  for (const r of rows) {
    byKey.set(r.key, r.pattern);
    if (!byName.has(r.name)) byName.set(r.name, r.pattern);
  }

  return (item: ReadinessPlanItem) => {
    const k = item.key ? String(item.key) : "";
    if (k && byKey.has(k)) return byKey.get(k) ?? null;
    const n = String(item.name ?? "").trim();
    return (n && byName.get(n)) ?? null;
  };
}
