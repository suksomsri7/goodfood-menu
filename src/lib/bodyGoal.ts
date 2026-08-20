/**
 * เป้าหมายรูปร่าง: เวลาที่ปลอดภัย + ความคืบหน้า (WO-BP-3 §B1 · WO-BODY §2 ข้อ 22)
 *
 * ทำไมต้อง pure ทั้งไฟล์ (ห้าม prisma / fetch / new Date()):
 *   ตัวเลขจากไฟล์นี้คือ "กี่สัปดาห์ถึงเป้า" และ "ตามแผนอยู่ไหม" ที่ user เห็นทุกวัน
 *   ถ้าคิดผิดแบบดูสมเหตุผล จะไม่มีใครจับได้ — จึงต้องเทสได้ทุกกติกาโดยไม่ต้องมี DB (เหมือน progression.ts)
 *
 * 🔴 หลักที่ห้ามเบี่ยง
 *   1) ไม่มีข้อมูลปัจจุบันของเป้าที่ตั้ง = ตอบ null (ห้ามเดาแทนลูกค้า)
 *   2) เดลต้าที่เล็กกว่าพื้นสัญญาณรบกวน = "คงที่" ไม่ใช่ "ตามหลัง"
 *      2 สัปดาห์แรกของทุกคนจะขยับน้อยกว่า noise floor เป็นปกติ ถ้าเราขึ้นว่า "ตามหลัง"
 *      เท่ากับทำให้คนที่ทำถูกทุกอย่างรู้สึกว่าตัวเองล้มเหลวเพราะสัญญาณรบกวนของเครื่องมือเราเอง
 */
import { TREND_FLOOR_BF, TREND_FLOOR_CM, type Estimate } from "@/lib/bodyMeasure";

// ── อัตราที่ปลอดภัย (WO-BODY §2 ข้อ 22) ──
/** ช้าสุดที่ยังนับว่าคืบ — ใช้บอกช่วงเวลาแบบอนุรักษ์นิยม */
export const RATE_WEIGHT_KG_SLOW = 0.5;
/** เร็วสุดที่ยังปลอดภัย (กก./สัปดาห์) — ตัวนี้คือตัวกำหนด "สัปดาห์ขั้นต่ำ" ของเป้าน้ำหนัก */
export const RATE_WEIGHT_KG_FAST = 0.75;
/** เอว ~0.5 ซม./สัปดาห์ */
export const RATE_WAIST_CM = 0.5;
/** ไขมัน ~0.5 จุด/สัปดาห์ */
export const RATE_BF_PCT = 0.5;

/**
 * พื้นสัญญาณรบกวนของน้ำหนักตัว (กก.)
 * BP-2 มี floor ของเส้นรอบวง/ไขมันแล้ว แต่ไม่มีของน้ำหนัก — น้ำหนักแกว่งจากน้ำ/เกลือ/รอบเดือน
 * ได้ระดับครึ่งกิโลภายในวันเดียว การตัดสิน "ตามหลัง" จากเลขที่เล็กกว่านี้คือการอ่านสัญญาณรบกวน
 */
export const GOAL_FLOOR_WEIGHT_KG = 0.5;

/** เพดานสัปดาห์ที่ยอมให้ตั้งเป้า — ไกลกว่า 2 ปีไม่ใช่เป้า แต่คือความหวังลอย ๆ */
export const MAX_TARGET_WEEKS = 104;

// ── ช่วงค่าที่เป็นไปได้ (กันพิมพ์ผิดหน่วย/นิ้วลั่น — ค่าเพี้ยนหนึ่งตัวบิดทั้งเป้าและกราฟ) ──
export const RANGE_WEIGHT_KG: [number, number] = [30, 300];
export const RANGE_WAIST_CM: [number, number] = [40, 200];
export const RANGE_BF_PCT: [number, number] = [3, 60];

export type GoalKey = "weight" | "waist" | "bf";
export type OnTrack = "ahead" | "on" | "behind" | "flat";

export const GOAL_LABEL_TH: Record<GoalKey, string> = {
  weight: "น้ำหนัก",
  waist: "เอว",
  bf: "% ไขมัน",
};

export const GOAL_UNIT_TH: Record<GoalKey, string> = {
  weight: "กก.",
  waist: "ซม.",
  bf: "%",
};

/** ค่าปัจจุบันแบบตัวเลขล้วน (ผู้เรียกเป็นคนเลือกแล้วว่าจะใช้สายวัดหรือค่าประมาณ) */
export interface BodyCurrent {
  weightKg?: number | null;
  waistCm?: number | null;
  /** กึ่งกลางของช่วง % ไขมัน — เป้าเป็นช่วงเสมอ แต่การคิดเวลาต้องใช้จุดเดียว */
  bfMid?: number | null;
}

export interface BodyTarget {
  weightKg?: number | null;
  waistCm?: number | null;
  bfMid?: number | null;
}

export interface SuggestPerGoal {
  key: GoalKey;
  current: number;
  target: number;
  /** ระยะที่ต้องเดิน (บวกเสมอ) */
  deltaAbs: number;
  direction: "down" | "up" | "none";
  /** อัตราปลอดภัยที่ใช้หาร (หน่วยของเป้านั้น ต่อสัปดาห์) */
  ratePerWeek: number;
  /** สัปดาห์ขั้นต่ำที่ปลอดภัยของเป้านี้ */
  weeks: number;
}

export interface SuggestWeeksResult {
  /** สัปดาห์ขั้นต่ำของทั้งชุด = เป้าที่ไกลที่สุด */
  weeks: number;
  limitedBy: GoalKey;
  perGoal: SuggestPerGoal[];
  /** ช่วงเวลาแบบอนุรักษ์นิยม (อัตราช้า) — ไว้บอก user ว่า "ประมาณ X-Y สัปดาห์" */
  weeksSlow: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** ลำดับความสำคัญเวลาผลเสมอกัน — น้ำหนักคือเลขที่ user เชื่อที่สุด จึงเป็นตัวแทนของทั้งชุด */
const KEY_ORDER: GoalKey[] = ["weight", "waist", "bf"];

const rateFast: Record<GoalKey, number> = {
  weight: RATE_WEIGHT_KG_FAST,
  waist: RATE_WAIST_CM,
  bf: RATE_BF_PCT,
};
const rateSlow: Record<GoalKey, number> = {
  weight: RATE_WEIGHT_KG_SLOW,
  waist: RATE_WAIST_CM,
  bf: RATE_BF_PCT,
};

/** พื้นสัญญาณรบกวนต่อเป้า — ใช้ชุดเดียวกับ BP-2 (เอว/ไขมัน) + ของน้ำหนักที่นิยามในไฟล์นี้ */
export const GOAL_FLOOR: Record<GoalKey, number> = {
  weight: GOAL_FLOOR_WEIGHT_KG,
  waist: TREND_FLOOR_CM,
  bf: TREND_FLOOR_BF,
};

function pairsOf(current: BodyCurrent, target: BodyTarget): Array<{ key: GoalKey; cur: number | null; tgt: number | null }> {
  return [
    { key: "weight" as GoalKey, cur: isNum(current.weightKg) ? current.weightKg : null, tgt: isNum(target.weightKg) ? target.weightKg : null },
    { key: "waist" as GoalKey, cur: isNum(current.waistCm) ? current.waistCm : null, tgt: isNum(target.waistCm) ? target.waistCm : null },
    { key: "bf" as GoalKey, cur: isNum(current.bfMid) ? current.bfMid : null, tgt: isNum(target.bfMid) ? target.bfMid : null },
  ];
}

/**
 * กี่สัปดาห์ถึงเป้าอย่างปลอดภัย — เดลต้าที่ไกลที่สุด ÷ อัตราปลอดภัย ปัดขึ้น
 *
 * ใช้ "อัตราเร็วสุดที่ยังปลอดภัย" เป็นตัวหารโดยตั้งใจ: ตัวเลขที่ได้จึงเป็น "เร็วที่สุดเท่าที่ยอมให้ตั้ง"
 * ซึ่งเป็นตัวเดียวกับที่ validateGoal ใช้ดัน targetWeeks ที่สั้นเกินไปขึ้นมา (นิยามเดียว ไม่มีสองมาตรฐาน)
 * weeksSlow = อัตราช้า ไว้พูดกับ user เป็นช่วง
 *
 * ตอบ null เมื่อ: ไม่ได้ตั้งเป้าอะไรเลย · หรือมีเป้าที่ไม่มีค่าปัจจุบันให้เทียบ (ห้ามเดาจุดตั้งต้น)
 */
export function suggestWeeks(current: BodyCurrent, target: BodyTarget): SuggestWeeksResult | null {
  const pairs = pairsOf(current, target).filter((p) => p.tgt !== null);
  if (pairs.length === 0) return null;
  if (pairs.some((p) => p.cur === null)) return null;

  const perGoal: SuggestPerGoal[] = pairs.map((p) => {
    const cur = p.cur as number;
    const tgt = p.tgt as number;
    const deltaAbs = Math.abs(tgt - cur);
    return {
      key: p.key,
      current: cur,
      target: tgt,
      deltaAbs: round1(deltaAbs),
      direction: deltaAbs === 0 ? "none" : tgt < cur ? "down" : "up",
      ratePerWeek: rateFast[p.key],
      weeks: Math.ceil(deltaAbs / rateFast[p.key]),
    };
  });

  let limited = perGoal[0];
  for (const g of perGoal) {
    if (g.weeks > limited.weeks) limited = g;
    else if (g.weeks === limited.weeks && KEY_ORDER.indexOf(g.key) < KEY_ORDER.indexOf(limited.key)) limited = g;
  }

  const weeksSlow = Math.max(
    ...perGoal.map((g) => Math.ceil(Math.abs(g.target - g.current) / rateSlow[g.key]))
  );

  return { weeks: limited.weeks, limitedBy: limited.key, perGoal, weeksSlow };
}

// ────────────────────────────────────────────────────────────────
// ตรวจเป้าก่อนบันทึก
// ────────────────────────────────────────────────────────────────

export interface GoalInputRaw {
  targetWeightKg?: number | null;
  targetWaistCm?: number | null;
  targetBfLo?: number | null;
  targetBfHi?: number | null;
  targetWeeks?: number | null;
}

export interface ValidateGoalResult {
  ok: boolean;
  /** ค่าที่ระบบขยับให้ (มีเฉพาะเมื่อแก้จริง) — ผู้เรียกต้องบันทึกตัวนี้แทนที่ input */
  fixed?: GoalInputRaw;
  reasons: string[];
  /** "gain" = ตั้งเป้าเพิ่ม (ยอมรับได้ แต่ต้องรู้ว่าไม่ใช่เคสลด) */
  flags: string[];
  /** สัปดาห์ขั้นต่ำที่ปลอดภัย (null = คิดไม่ได้เพราะไม่มีค่าปัจจุบัน) */
  minWeeks: number | null;
}

function bfMidOf(lo: unknown, hi: unknown): number | null {
  const l = isNum(lo) ? lo : null;
  const h = isNum(hi) ? hi : null;
  if (l !== null && h !== null) return (l + h) / 2;
  return l ?? h;
}

function outOfRange(v: number, [lo, hi]: [number, number]): boolean {
  return v < lo || v > hi;
}

/**
 * ตรวจเป้าที่ user กรอก — คืน ok:false เฉพาะที่บันทึกไปแล้วจะพัง (ค่าเพี้ยน/ไม่ได้ตั้งอะไรเลย)
 * ส่วนที่ "ตั้งได้แต่ต้องขยับ" (สัปดาห์สั้นเกินไป) จะคืน ok:true + fixed + เหตุผลไทยให้บอก user ตรง ๆ
 *
 * 🔴 เป้าที่ทิศตรงข้ามกับความจริง (เป้าหนักกว่าปัจจุบัน) ไม่ใช่ความผิด — คนตั้งใจเพิ่มน้ำหนักมีจริง
 *    ระบบแค่ติดธง "gain" ไว้ให้ปลายทางพูดให้ถูกเรื่อง ห้ามปฏิเสธหรือแก้เป้าให้เขาเงียบ ๆ
 */
export function validateGoal(input: GoalInputRaw, current: BodyCurrent): ValidateGoalResult {
  const reasons: string[] = [];
  const flags: string[] = [];

  const tWeight = isNum(input.targetWeightKg) ? input.targetWeightKg : null;
  const tWaist = isNum(input.targetWaistCm) ? input.targetWaistCm : null;
  const tBfLo = isNum(input.targetBfLo) ? input.targetBfLo : null;
  const tBfHi = isNum(input.targetBfHi) ? input.targetBfHi : null;

  if (tWeight === null && tWaist === null && tBfLo === null && tBfHi === null) {
    return {
      ok: false,
      reasons: ["ยังไม่ได้ตั้งเป้าอะไรเลย — เลือกอย่างน้อย 1 อย่าง (น้ำหนัก เอว หรือ % ไขมัน) นะครับ"],
      flags,
      minWeeks: null,
    };
  }

  let ok = true;
  if (tWeight !== null && outOfRange(tWeight, RANGE_WEIGHT_KG)) {
    ok = false;
    reasons.push(`เป้าน้ำหนักต้องอยู่ระหว่าง ${RANGE_WEIGHT_KG[0]}-${RANGE_WEIGHT_KG[1]} กก. — ลองตรวจตัวเลขอีกครั้งนะครับ`);
  }
  if (tWaist !== null && outOfRange(tWaist, RANGE_WAIST_CM)) {
    ok = false;
    reasons.push(`เป้าเอวต้องอยู่ระหว่าง ${RANGE_WAIST_CM[0]}-${RANGE_WAIST_CM[1]} ซม. — ลองตรวจหน่วยอีกครั้งนะครับ`);
  }
  for (const v of [tBfLo, tBfHi]) {
    if (v !== null && outOfRange(v, RANGE_BF_PCT)) {
      ok = false;
      reasons.push(`เป้า % ไขมันต้องอยู่ระหว่าง ${RANGE_BF_PCT[0]}-${RANGE_BF_PCT[1]}% — ลองตรวจตัวเลขอีกครั้งนะครับ`);
      break;
    }
  }
  if (tBfLo !== null && tBfHi !== null && tBfLo > tBfHi) {
    ok = false;
    reasons.push("ช่วง % ไขมันสลับกันอยู่ (ค่าต่ำมากกว่าค่าสูง) — สลับกลับให้ถูกก่อนนะครับ");
  }
  if (isNum(input.targetWeeks) && (input.targetWeeks < 1 || input.targetWeeks > MAX_TARGET_WEEKS)) {
    ok = false;
    reasons.push(`จำนวนสัปดาห์ต้องอยู่ระหว่าง 1-${MAX_TARGET_WEEKS} สัปดาห์ครับ`);
  }

  if (!ok) return { ok: false, reasons, flags, minWeeks: null };

  // ทิศของเป้าเทียบความจริง (มีค่าปัจจุบันถึงจะบอกได้)
  if (tWeight !== null && isNum(current.weightKg) && tWeight > current.weightKg) {
    flags.push("gain");
    reasons.push("เป้าน้ำหนักสูงกว่าตอนนี้ — ระบบเข้าใจว่าคุณตั้งใจเพิ่มน้ำหนัก/มวลกล้ามนะครับ");
  }
  if (tWaist !== null && isNum(current.waistCm) && tWaist > current.waistCm) {
    flags.push("gain");
    reasons.push("เป้าเอวใหญ่กว่าตอนนี้ — ระบบจะนับว่านี่คือเป้าเพิ่มรอบเอวนะครับ");
  }

  const target: BodyTarget = { weightKg: tWeight, waistCm: tWaist, bfMid: bfMidOf(tBfLo, tBfHi) };
  const suggestion = suggestWeeks(current, target);
  const minWeeks = suggestion?.weeks ?? null;

  let fixed: GoalInputRaw | undefined;
  if (isNum(input.targetWeeks) && minWeeks !== null && input.targetWeeks < minWeeks) {
    fixed = { ...input, targetWeeks: minWeeks };
    reasons.push(
      `ไปเร็วกว่านี้ไม่ปลอดภัยกับร่างกาย ระบบขยับเป็น ${minWeeks} สัปดาห์ให้แล้ว (คิดจาก${GOAL_LABEL_TH[suggestion!.limitedBy]}ที่ต้องเปลี่ยน ${suggestion!.perGoal.find((g) => g.key === suggestion!.limitedBy)?.deltaAbs} ${GOAL_UNIT_TH[suggestion!.limitedBy]})`
    );
  }
  if (!isNum(input.targetWeeks) && minWeeks !== null) {
    fixed = { ...input, targetWeeks: minWeeks };
    reasons.push(`ยังไม่ได้กำหนดเวลา ระบบตั้งให้ ${minWeeks} สัปดาห์ตามอัตราที่ปลอดภัยครับ`);
  }

  return { ok: true, ...(fixed ? { fixed } : {}), reasons, flags, minWeeks };
}

// ────────────────────────────────────────────────────────────────
// ความคืบหน้า
// ────────────────────────────────────────────────────────────────

/** ค่าตั้งต้นตอนตั้งเป้า — ผู้เรียกอ่านจากข้อมูล ณ startedAt (ดู bodyGoalStore.resolveGoalStart) */
export interface GoalStart {
  weightKg?: number | null;
  waistCm?: number | null;
  bfMid?: number | null;
}

export interface GoalForProgress {
  targetWeightKg?: number | null;
  targetWaistCm?: number | null;
  targetBfLo?: number | null;
  targetBfHi?: number | null;
  targetWeeks?: number | null;
  start: GoalStart;
}

export interface GoalSnapshot {
  weightKg?: number | null;
  /** ค่าประมาณจากกล้อง (BP-2) */
  waist?: Estimate | null;
  bfPct?: Estimate | null;
  /** สายวัดจริง — ถ้ามีต้องชนะค่าประมาณเสมอ (ground truth) */
  tapeWaistCm?: number | null;
}

export interface GoalProgressItem {
  key: GoalKey;
  start: number;
  now: number;
  target: number;
  /** ที่มาของค่า "ตอนนี้" — จอต้องบอก user ได้ว่าเลขนี้มาจากสายวัดหรือกล้อง */
  source: "scale" | "tape" | "estimate";
  /** 0-100 (ตัดที่ 0 และ 100 — ถอยหลังไม่ติดลบ เพราะจอไม่มีที่แสดงและไม่ช่วยใคร) */
  pctDone: number;
  /** ควรอยู่ตรงไหนถ้าเดินเป็นเส้นตรงตาม targetWeeks (null = เป้านี้ไม่ได้กำหนดเวลา) */
  expectedByNow: number | null;
  onTrack: OnTrack;
  /** เดินมาแล้วเท่าไหร่ (บวก = เข้าใกล้เป้า) */
  moved: number;
  /** เหลืออีกเท่าไหร่ถึงเป้า */
  remaining: number;
}

export interface GoalProgressResult {
  perGoal: GoalProgressItem[];
  overall: {
    pctDone: number;
    onTrack: OnTrack | null;
    weeksElapsed: number;
    weeksLeft: number | null;
  };
}

const RANK: Record<OnTrack, number> = { behind: 0, flat: 1, on: 2, ahead: 3 };

/**
 * ความคืบหน้าเทียบเป้า
 *
 * 🔴 กติกา flat มาก่อน: ถ้าขยับจากจุดตั้งต้นน้อยกว่าพื้นสัญญาณรบกวน = "คงที่"
 *    ห้ามตัดสินว่า "ตามหลัง" จากตัวเลขที่เครื่องมือเราเองแยกไม่ออกจาก noise
 *    (สองสัปดาห์แรกของแทบทุกคนจะตกในกรณีนี้ และนั่นคือเรื่องปกติ ไม่ใช่ความล้มเหลว)
 *
 * เป้าที่ไม่มีค่าตั้งต้น/ค่าปัจจุบัน = ข้ามเงียบ ๆ (ไม่ใส่ใน perGoal) ไม่ใช่เดาค่าให้
 */
export function goalProgress(
  goal: GoalForProgress,
  snapshot: GoalSnapshot,
  weeksElapsed: number
): GoalProgressResult {
  const elapsed = isNum(weeksElapsed) && weeksElapsed > 0 ? weeksElapsed : 0;
  const targetWeeks = isNum(goal.targetWeeks) && goal.targetWeeks > 0 ? goal.targetWeeks : null;

  // เอวใช้สายวัดจริงก่อนเสมอ — กล้องประมาณได้ ±2-3 ซม. สายวัดคือความจริง
  const waistNow: { v: number; source: "tape" | "estimate" } | null = isNum(snapshot.tapeWaistCm)
    ? { v: snapshot.tapeWaistCm, source: "tape" }
    : isNum(snapshot.waist?.mid)
      ? { v: snapshot.waist!.mid, source: "estimate" }
      : null;

  const rows: Array<{ key: GoalKey; start: number | null; now: number | null; target: number | null; source: GoalProgressItem["source"] }> = [
    {
      key: "weight",
      start: isNum(goal.start.weightKg) ? goal.start.weightKg : null,
      now: isNum(snapshot.weightKg) ? snapshot.weightKg : null,
      target: isNum(goal.targetWeightKg) ? goal.targetWeightKg : null,
      source: "scale",
    },
    {
      key: "waist",
      start: isNum(goal.start.waistCm) ? goal.start.waistCm : null,
      now: waistNow?.v ?? null,
      target: isNum(goal.targetWaistCm) ? goal.targetWaistCm : null,
      source: waistNow?.source ?? "estimate",
    },
    {
      key: "bf",
      start: isNum(goal.start.bfMid) ? goal.start.bfMid : null,
      now: isNum(snapshot.bfPct?.mid) ? snapshot.bfPct!.mid : null,
      target: bfMidOf(goal.targetBfLo, goal.targetBfHi),
      source: "estimate",
    },
  ];

  const perGoal: GoalProgressItem[] = [];
  for (const r of rows) {
    if (r.start === null || r.now === null || r.target === null) continue;

    const floor = GOAL_FLOOR[r.key];
    const total = r.target - r.start; // ระยะทั้งหมดแบบมีเครื่องหมาย
    const dir = total === 0 ? 0 : total > 0 ? 1 : -1;
    const moved = (r.now - r.start) * (dir === 0 ? 1 : dir); // บวก = เข้าใกล้เป้า
    const totalAbs = Math.abs(total);
    const pctDone = totalAbs === 0 ? 100 : Math.round(clamp(moved / totalAbs, 0, 1) * 100);

    const expectedAbs = targetWeeks ? totalAbs * Math.min(elapsed / targetWeeks, 1) : null;
    const expectedByNow = targetWeeks && dir !== 0 ? round1(r.start + total * Math.min(elapsed / targetWeeks, 1)) : targetWeeks ? round1(r.start) : null;

    let onTrack: OnTrack;
    if (Math.abs(r.now - r.start) < floor) {
      onTrack = "flat"; // ขยับน้อยกว่าที่เครื่องมือแยกออกจาก noise ได้
    } else if (expectedAbs === null) {
      // ไม่ได้กำหนดเวลา → ตัดสินได้แค่ทิศ (เดินเข้าหาเป้า = on)
      onTrack = moved > 0 ? "on" : "behind";
    } else if (moved >= expectedAbs + floor) {
      onTrack = "ahead";
    } else if (moved <= expectedAbs - floor) {
      onTrack = "behind";
    } else {
      onTrack = "on";
    }

    perGoal.push({
      key: r.key,
      start: round1(r.start),
      now: round1(r.now),
      target: round1(r.target),
      source: r.source,
      pctDone,
      expectedByNow,
      onTrack,
      moved: round1(moved),
      remaining: round1(Math.max(0, totalAbs - Math.max(0, moved))),
    });
  }

  const overallPct = perGoal.length
    ? Math.round(perGoal.reduce((s, g) => s + g.pctDone, 0) / perGoal.length)
    : 0;
  // เอาตัวที่ตามหลังที่สุดเป็นภาพรวม — เพื่อให้โค้ชโฟกัสถูกจุด (ข้อความปลายทางต้องไม่โทษ user)
  const overallTrack = perGoal.length
    ? perGoal.reduce<OnTrack>((worst, g) => (RANK[g.onTrack] < RANK[worst] ? g.onTrack : worst), "ahead")
    : null;

  return {
    perGoal,
    overall: {
      pctDone: overallPct,
      onTrack: overallTrack,
      weeksElapsed: round1(elapsed),
      weeksLeft: targetWeeks ? Math.max(0, round1(targetWeeks - elapsed)) : null,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// หมุดระหว่างทาง
// ────────────────────────────────────────────────────────────────

/** ขั้นที่ถือว่า "ข้ามหมุด" — ต่ำกว่า 25% ยังไม่พูดถึง เพราะคำชมที่ไม่มีของจริงรองรับจะเฟ้อ */
const MILESTONE_BANDS: Array<{ pct: number; text: (label: string) => string }> = [
  { pct: 100, text: (l) => `ถึงเป้า${l}แล้ว 🎉` },
  { pct: 75, text: (l) => `เป้า${l}เดินมา 3 ใน 4 แล้ว เหลืออีกนิดเดียว` },
  { pct: 50, text: (l) => `ผ่านครึ่งทางเป้า${l}แล้ว` },
  { pct: 25, text: (l) => `เป้า${l}เดินมาได้ 1 ใน 4 แล้ว` },
];

/** หมุดที่ข้ามจริงเท่านั้น (เป้าละ 1 ข้อความ = ขั้นสูงสุดที่ข้าม) — ไทยสั้น โทนบวก */
export function milestones(perGoal: GoalProgressItem[]): string[] {
  const out: string[] = [];
  for (const g of perGoal) {
    const band = MILESTONE_BANDS.find((b) => g.pctDone >= b.pct);
    if (band) out.push(band.text(GOAL_LABEL_TH[g.key]));
  }
  return out;
}
