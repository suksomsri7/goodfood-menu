/**
 * พยากรณ์ "อีกนานแค่ไหนถึงเป้าหมาย" จากน้ำหนักที่ชั่งจริง
 *
 * 🔴 deterministic ล้วน ไม่เรียก AI · และ **ห้ามแต่งวันที่**
 *    ถ้าเทรนด์ไม่ได้เดินเข้าหาเป้า จะไม่คืน targetDate เด็ดขาด (คืน stalled แทน)
 *    ตัวเลขปลอมในเรื่องน้ำหนักทำให้ user วางแผนชีวิตผิด และพอไม่เป็นจริงก็เลิกใช้แอป
 */

const DAY_MS = 86400_000;
const BKK_OFFSET_MS = 7 * 3600 * 1000;
/** เดือนเฉลี่ย (สัปดาห์) — ใช้แปลงสัปดาห์เป็นเดือนแบบไม่เพี้ยน */
const WEEKS_PER_MONTH = 4.345;

/** ต้องมีอย่างน้อยกี่ "วันที่ชั่ง" (ไม่ใช่จำนวนแถว — ชั่ง 5 ครั้งในวันเดียวไม่ถือว่ากระจาย) */
export const MIN_POINTS = 4;
/** ข้อมูลต้องกินช่วงอย่างน้อยกี่วัน */
export const MIN_SPAN_DAYS = 14;
/** ใช้ข้อมูลย้อนหลังไม่เกินกี่วัน (เก่ากว่านี้ไม่สะท้อนพฤติกรรมตอนนี้) */
export const WINDOW_DAYS = 28;
/** ชั่งครั้งล่าสุดเก่ากว่านี้ = เทรนด์ค้าง ใช้ทำนายวันนี้ไม่ได้ */
export const STALE_DAYS = 7;
/** ถือว่า "นิ่ง" เมื่อเข้าหาเป้าช้ากว่านี้ (กก./สัปดาห์) */
const STALL_THRESHOLD = 0.05;
/** ลดเร็วเกินปลอดภัย: เกินกี่ % ของน้ำหนักตัวต่อสัปดาห์ */
const TOO_FAST_RATIO = 0.01;
/** ไกลเกินกว่าจะบอกวันที่ได้อย่างมีความหมาย */
const MAX_MONTHS = 12;

export type WeightPoint = { date: Date; weight: number };

/**
 * ความชันแบบ least squares ต่อ 1 หน่วยแกน t — ใช้ร่วมกับการ์ดสถิติอื่น (เช่นเทรนด์ชีพจรพัก)
 * คืน null เมื่อจุดน้อยกว่า 2 หรือทุกจุดอยู่ที่ t เดียวกัน (ไม่มีความชันให้คำนวณ)
 */
export function slopePerUnit(points: Array<{ t: number; v: number }>): number | null {
  const n = points.length;
  if (n < 2) return null;
  const meanT = points.reduce((s, p) => s + p.t, 0) / n;
  const meanV = points.reduce((s, p) => s + p.v, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - meanT) * (p.v - meanV);
    den += (p.t - meanT) ** 2;
  }
  return den === 0 ? null : num / den;
}

export type GoalDirection = "lose" | "gain";

export type Forecast =
  | { ready: false; reason: "no_goal" }
  | {
      ready: false;
      reason: "need_more_data";
      needDays: number;
      points: number;
      spanDays: number;
    }
  | {
      // ชั่งครั้งล่าสุดนานเกินไป — เทรนด์เก่าใช้ทำนายวันนี้ไม่ได้
      ready: false;
      reason: "stale";
      needDays: number;
      points: number;
      spanDays: number;
      lastLoggedDate: string;
      daysSinceLast: number;
    }
  | {
      // ถึงเป้าแล้ว — คนละเรื่องกับ "ทำไม่คืบ" ข้อความที่ควรขึ้นตรงข้ามกันเลย
      ready: true;
      reason: "reached";
      reached: true;
      direction: GoalDirection;
      ratePerWeek: number;
      points: number;
      spanDays: number;
      currentWeight: number;
      goalWeight: number;
    }
  | {
      ready: true;
      stalled: true;
      direction: GoalDirection;
      ratePerWeek: number;
      points: number;
      spanDays: number;
      currentWeight: number;
      goalWeight: number;
    }
  | {
      ready: true;
      stalled: false;
      direction: GoalDirection;
      ratePerWeek: number;
      targetDate: string | null; // null เมื่อ over1y (ไกลเกินกว่าจะระบุวันได้อย่างซื่อสัตย์)
      monthsAway: number;
      over1y: boolean;
      /** เปลี่ยนเร็วเกินคำแนะนำ "ในทิศที่ตั้งใจ" — มีเฉพาะตอนกำลังคืบหน้าจริง */
      tooFast: boolean;
      points: number;
      spanDays: number;
      currentWeight: number;
      goalWeight: number;
    };

/** วันตามเวลาไทยของ timestamp (YYYY-MM-DD) */
function bkkKey(d: Date): string {
  return new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * ยุบเป็น "ค่าเฉลี่ยต่อวัน" ก่อนคำนวณ
 * ชั่งวันละหลายครั้ง (ก่อน/หลังเข้าห้องน้ำ) ไม่ควรทำให้วันนั้นมีน้ำหนักในสมการมากกว่าวันอื่น
 */
export function dailyAverages(logs: WeightPoint[]): Array<{ key: string; t: number; weight: number }> {
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const l of logs) {
    const k = bkkKey(l.date);
    const cur = byDay.get(k) ?? { sum: 0, n: 0 };
    byDay.set(k, { sum: cur.sum + l.weight, n: cur.n + 1 });
  }
  return [...byDay.entries()]
    .map(([key, v]) => ({
      key,
      t: Date.parse(`${key}T00:00:00.000Z`) / DAY_MS,
      weight: v.sum / v.n,
    }))
    .sort((a, b) => a.t - b.t);
}

/**
 * คำนวณพยากรณ์
 * @param logs WeightLog ทั้งหมด (ฟังก์ชันตัดหน้าต่าง WINDOW_DAYS ให้เอง)
 * @param member goalType/goalWeight ของสมาชิก
 * @param now เวลาอ้างอิง (เทสได้)
 */
export function buildForecast(
  logs: WeightPoint[],
  member: { goalType: string | null; goalWeight: number | null },
  now = new Date()
): Forecast {
  const goalWeight = member.goalWeight;
  const goal = (member.goalType || "").toLowerCase();
  const wantsLose = goal.includes("lose") || goal.includes("ลด");
  const wantsGain = goal.includes("gain") || goal.includes("เพิ่ม") || goal.includes("กล้าม");
  // ไม่มีเป้าหมายตัวเลข หรือตั้งใจรักษาน้ำหนัก → ไม่มี "วันถึงเป้า" ให้พยากรณ์
  if (!goalWeight || (!wantsLose && !wantsGain)) return { ready: false, reason: "no_goal" };
  const direction: GoalDirection = wantsLose ? "lose" : "gain";

  const cutoff = now.getTime() - WINDOW_DAYS * DAY_MS;
  const pts = dailyAverages(logs.filter((l) => l.date.getTime() >= cutoff));

  const spanDays = pts.length >= 2 ? Math.round(pts[pts.length - 1].t - pts[0].t) : 0;
  if (pts.length < MIN_POINTS || spanDays < MIN_SPAN_DAYS) {
    return {
      ready: false,
      reason: "need_more_data",
      // อีกกี่วันถึงจะพยากรณ์ได้ (ถ้าชั่งต่อเนื่อง) — บอกตรง ๆ ดีกว่าปล่อยให้เดา
      needDays: Math.max(1, MIN_SPAN_DAYS - spanDays),
      points: pts.length,
      spanDays,
    };
  }

  // ── linear regression (least squares) บนแกนวัน ──
  const n = pts.length;
  const meanT = pts.reduce((s, p) => s + p.t, 0) / n;
  const meanW = pts.reduce((s, p) => s + p.weight, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.t - meanT) * (p.weight - meanW);
    den += (p.t - meanT) ** 2;
  }
  // ชั่งล่าสุดนานแล้ว = ตัวเลขค้าง ถ้าเอามาทำนายจะได้วันที่ผิดโดยที่ user ไม่รู้ตัว
  const lastKey = pts[pts.length - 1].key;
  const daysSinceLast = Math.floor((now.getTime() - Date.parse(`${lastKey}T00:00:00.000Z`)) / DAY_MS);
  if (daysSinceLast > STALE_DAYS) {
    return {
      ready: false,
      reason: "stale",
      needDays: 1, // ชั่งใหม่ 1 ครั้งก็กลับมาพยากรณ์ได้
      points: pts.length,
      spanDays,
      lastLoggedDate: lastKey,
      daysSinceLast,
    };
  }

  const slopePerDay = den === 0 ? 0 : num / den;
  const ratePerWeek = Math.round(slopePerDay * 7 * 100) / 100;

  // น้ำหนักปัจจุบันใช้ "ค่าบนเส้นเทรนด์ ณ วันล่าสุด" — นิ่งกว่าค่าชั่งดิบที่แกว่งวันต่อวัน
  const tLast = pts[pts.length - 1].t;
  const currentWeight = Math.round((meanW + slopePerDay * (tLast - meanT)) * 10) / 10;

  const remaining = goalWeight - currentWeight; // ลบ = ต้องลด · บวก = ต้องเพิ่ม
  const progressPerWeek = remaining < 0 ? -ratePerWeek : ratePerWeek; // เข้าหาเป้า = บวก
  const base = { direction, ratePerWeek, points: n, spanDays, currentWeight, goalWeight } as const;

  // ถึงเป้าแล้ว — ต้องแยกจาก "ทำไม่คืบ" เพราะข้อความที่ควรขึ้นตรงข้ามกันคนละขั้ว
  if (Math.abs(remaining) < 0.1) {
    return { ready: true, reason: "reached", reached: true, ...base };
  }

  // ไม่คืบ/ถอยห่าง — ไม่ส่ง tooFast มาด้วย: "เร็วเกินไป" ขัดกับ "ไม่ขยับ" ในการ์ดใบเดียวกัน
  if (progressPerWeek <= STALL_THRESHOLD) {
    return { ready: true, stalled: true, ...base };
  }

  const weeksAway = Math.abs(remaining) / progressPerWeek;
  const monthsAway = Math.round((weeksAway / WEEKS_PER_MONTH) * 10) / 10;
  const over1y = monthsAway > MAX_MONTHS;

  // เร็วเกินคำแนะนำ "ในทิศที่ตั้งใจ" — มาถึงตรงนี้แปลว่ากำลังคืบหน้าจริงแล้ว
  // (ทิศตรงข้ามไม่เข้าเงื่อนไขนี้ เพราะถูกดักที่ stalled ไปก่อน)
  const tooFast = Math.abs(ratePerWeek) > currentWeight * TOO_FAST_RATIO;

  return {
    ready: true,
    stalled: false,
    direction,
    ratePerWeek,
    // ไกลเกิน 1 ปี = ไม่ระบุวัน (ข้อมูล 2-4 สัปดาห์ทำนายข้ามปีไม่ได้อย่างซื่อสัตย์)
    targetDate: over1y
      ? null
      : new Date(now.getTime() + weeksAway * 7 * DAY_MS).toISOString().slice(0, 10),
    monthsAway,
    over1y,
    tooFast,
    points: n,
    spanDays,
    currentWeight,
    goalWeight,
  };
}
