/**
 * Engine #3 — Progression (WO-PT-ENGINE §4.2-4.3 · เฟส B)
 *
 * "สัปดาห์หน้ายกเท่าไร" คิดจากสิ่งที่ทำจริงเมื่อสัปดาห์ที่แล้ว — ไม่ใช่ให้ AI เดา
 * เหตุผลที่เป็นคณิตล้วน: ตัวเลขน้ำหนักที่สั่งลูกค้ายกต้องนิ่ง อธิบายได้ และเทสซ้ำได้ทุกครั้ง
 * (บทเรียนในโปรเจกต์นี้: prompt สั่งข้อห้ามไม่อยู่ · เครดิต AI หมดแล้วระบบโกหก)
 *
 * 🔴 กติกาของไฟล์นี้:
 *   - ห้าม import prisma / fetch / new Date() — รับทุกอย่างผ่านพารามิเตอร์
 *   - ทุกกติกามีเทสถาวรที่ scripts/test-progression.ts
 *   - ทุก Rx ต้องมี reason ภาษาไทยสั้น ๆ ให้ลูกค้าเห็นว่า "ทำไมสัปดาห์หน้าถึงเป็นเลขนี้"
 */

// ── ค่าคงที่ของกติกา (เฟส D จะส่ง repRange จาก TrainingProfile มาแทนค่าปริยาย) ──
/** ช่วงครั้งปริยาย v1 — ยังไม่มีตาราง TrainingProfile ให้เลือกสไตล์ (strength 4-6 / hypertrophy 8-12 / general 10-15) */
export const DEFAULT_REP_RANGE: [number, number] = [8, 12];
/** ยังไม่ได้ลงทะเบียนอุปกรณ์ = ไม่รู้ก้าวจริง → 2.5 กก. (ก้าวมาตรฐานของแผ่น/ดัมเบลทั่วไป) */
export const DEFAULT_INCREMENT_KG = 2.5;
/** ท่าตัวเปล่า: ทำได้ครบเท่านี้ทุกเซ็ต 2 สัปดาห์ติด = เลื่อนขึ้นบันได */
export const LADDER_PROMOTE_REPS = 15;
/** ต่ำกว่านี้เกินครึ่งของเซ็ต 2 สัปดาห์ติด = ท่ายากเกินไป ลดบันไดลง */
export const LADDER_FLOOR_REPS = 8;
/** สุดบันไดแล้วให้ไต่ครั้งต่อได้ถึงเท่านี้ ก่อนจะเพิ่มเซ็ต */
export const LADDER_TOP_MAX_REPS = 20;
/** ท่าที่ไม่มีบันไดและใส่น้ำหนักไม่ได้ — เดินด้วยครั้งในช่วงนี้ แล้วค่อยเพิ่มเซ็ต */
export const REPS_ONLY_RANGE: [number, number] = [8, 15];
/** เพดานจำนวนเซ็ต — เกินนี้เสียเวลามากกว่าได้ผล */
export const MAX_PROGRESSION_SETS = 5;
/** ไม่ขยับติดกันกี่สัปดาห์ถึงสั่งพักฟื้น */
export const DELOAD_STALL_WEEKS = 3;
/** ลดน้ำหนักกี่ % เมื่อหนักเกิน/ทำไม่ไหว (สเปกให้ช่วง 5-10% → ใช้ 7.5% กลางช่วง) */
export const WEIGHT_CUT_PCT = 0.075;
/** ท่าจับเวลา: ก้าวละ +10% เพดาน +20% ต่อสัปดาห์ ปัดเป็นช่วง 5 วินาที */
export const TIMED_STEP_PCT = 0.1;
export const TIMED_CAP_PCT = 0.2;
export const TIMED_ROUND_SEC = 5;
export const MIN_TIMED_SEC = 10;
/** ปริมาณรวมต่อสัปดาห์เพิ่มได้ไม่เกินเท่านี้ (เพดานความปลอดภัย §4.2) */
export const WEEKLY_VOLUME_CAP = 1.1;
/** สัปดาห์พักฟื้น: ตัดปริมาณลง 40% */
export const DELOAD_CUT_PCT = 0.4;

/** feel → RPE ภายใน (เก็บสถิติ/ดูแนวโน้ม — การตัดสินใจใช้กติกาด้านล่าง ไม่ได้ใช้ตัวเลขนี้) */
export const FEEL_RPE: Record<string, number> = {
  too_easy: 5,
  easy: 6,
  good: 7,
  hard: 8.5,
  too_hard: 9.5,
};

/**
 * ความรู้สึกที่ "ยังไปต่อได้"
 * 🔴 feel = null (ไม่ได้ตอบ) นับเป็น good — คนไม่กดตอบไม่ใช่ความผิดของเขา ห้ามลงโทษด้วยการไม่ให้ก้าวหน้า
 */
const OK_FEELS = new Set(["too_easy", "easy", "good"]);

export function feelToRpe(feel?: string | null): number | null {
  if (!feel) return null;
  return FEEL_RPE[feel] ?? null;
}

/** ความรู้สึกนี้ยังไปต่อได้ไหม (ไม่ตอบ = ไปต่อได้) */
export function feelIsOk(feel?: string | null): boolean {
  return !feel || OK_FEELS.has(feel);
}

// ── โครงข้อมูล ──
export interface WeekSet {
  targetReps?: number | null;
  actualReps?: number | null;
  targetSec?: number | null;
  actualSec?: number | null;
  targetWeightKg?: number | null;
  actualWeightKg?: number | null;
  feel?: string | null;
}

export interface WeekResult {
  sets: WeekSet[];
}

/** ใบสั่งของสัปดาห์หน้า — ตัวเลขที่แผน/Workout Player เอาไปโชว์ */
export interface Rx {
  weightKg?: number;
  reps?: number;
  sets: number;
  seconds?: number;
  deload?: boolean;
  /** ท่าถัดไปในบันได (เลื่อนขั้นแล้ว) — ข้อมูลให้จอโชว์เท่านั้น แผนไม่สลับท่าเองเพื่อไม่ข้ามด่านความปลอดภัย */
  nextKey?: string;
  nextName?: string;
  reason: string;
}

/** สถานะที่จำข้ามสัปดาห์ (= ตาราง ProgressionState) */
export interface ProgressionStateLike {
  e1rmKg?: number | null;
  ladderLevel?: number | null;
  lastWeightKg?: number | null;
  lastReps?: number | null;
  lastSets?: number | null;
  successStreak: number;
  stallCount: number;
}

export interface LadderStep {
  key: string;
  difficulty: number;
  name: string;
}

export interface CurrentRx {
  weightKg?: number | null;
  reps?: number | null;
  sets?: number | null;
  seconds?: number | null;
}

export type ProgressionResult = { next: Rx | null; state: ProgressionStateLike };

export const EMPTY_STATE: ProgressionStateLike = {
  e1rmKg: null,
  ladderLevel: null,
  lastWeightKg: null,
  lastReps: null,
  lastSets: null,
  successStreak: 0,
  stallCount: 0,
};

// ── ตัวช่วยคณิต ──
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** e1RM สูตร Epley — ใช้เป็นกราฟ "แข็งแรงขึ้นกี่ %" ในหน้าสถิติ */
export function epley(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  return round1(weightKg * (1 + reps / 30));
}

/**
 * ปัดน้ำหนักให้ลงตัวกับก้าวจริงของอุปกรณ์ — ดัมเบลชุดก้าว 2 กก. สั่ง 17.5 ไปก็ยกไม่ได้
 * ต่ำสุดคือ 1 ก้าว (ไม่มีดัมเบล 0 กก.)
 */
export function roundToIncrement(kg: number, incrementKg: number, dir: "near" | "up" | "down" = "near"): number {
  const inc = incrementKg > 0 ? incrementKg : DEFAULT_INCREMENT_KG;
  const steps = kg / inc;
  const n =
    dir === "down" ? Math.floor(steps + 1e-9) : dir === "up" ? Math.ceil(steps - 1e-9) : Math.round(steps);
  return round2(Math.max(1, n) * inc);
}

/** ก้าวน้ำหนักที่ใช้จริง — ไม่ได้ลงทะเบียนอุปกรณ์/ค่าพัง = 2.5 กก. */
export function normalizeIncrement(incrementKg?: number | null): number {
  return incrementKg != null && Number.isFinite(incrementKg) && incrementKg > 0
    ? incrementKg
    : DEFAULT_INCREMENT_KG;
}

/**
 * เลือกก้าวน้ำหนักจากคลังอุปกรณ์ของสมาชิก
 * ท่านี้ต้องใช้ดัมเบล → เอาก้าวของดัมเบล · ไม่มีชิ้นที่ตรง → ก้าวที่เล็กที่สุดที่มี (ปลอดภัยกว่ากระโดดไกล)
 * ไม่มีคลังอุปกรณ์เลย → 2.5 กก.
 */
export function pickIncrementKg(
  equipment: { type: string; incrementKg?: number | null }[] | null | undefined,
  equipmentNeeded?: string[] | null
): number {
  const usable = (equipment ?? []).filter((e) => e.incrementKg != null && e.incrementKg > 0);
  if (!usable.length) return DEFAULT_INCREMENT_KG;
  const need = new Set(equipmentNeeded ?? []);
  const matched = usable.filter((e) => need.has(e.type));
  const pool = matched.length ? matched : usable;
  return Math.min(...pool.map((e) => e.incrementKg as number));
}

/** ปัดวินาทีเป็นช่วง 5 วิ (นาฬิกาจับเวลาจริงคนตั้งทีละ 5) */
function roundSec(sec: number, dir: "near" | "up" = "near"): number {
  const n = dir === "up" ? Math.ceil(sec / TIMED_ROUND_SEC - 1e-9) : Math.round(sec / TIMED_ROUND_SEC);
  return Math.max(MIN_TIMED_SEC, n * TIMED_ROUND_SEC);
}

/**
 * สัปดาห์พักฟื้น: ตัดปริมาณลง 40% (ตัดที่จำนวนเซ็ต)
 * 3 เซ็ต → 2 · 5 → 3 · 4 → 2 · 2 → 1 — เหลืออย่างน้อย 1 เซ็ตเสมอ (พักฟื้น ≠ เลิกเล่น)
 */
export function deloadSets(sets: number): number {
  const s = Math.max(1, Math.round(sets));
  return Math.max(1, s - Math.round(s * DELOAD_CUT_PCT));
}

/** เซ็ตที่ "ทำจริง" — เซ็ตที่มีแต่เป้า (ยังไม่ได้ทำ) ไม่เอามาตัดสิน */
function performed(sets: WeekSet[]): WeekSet[] {
  return sets.filter((s) => (s.actualReps ?? 0) > 0 || (s.actualSec ?? 0) > 0);
}

/** ค่าที่พบบ่อยที่สุด (เท่ากัน = เอาค่ามากกว่า) — น้ำหนักที่ยกจริงของสัปดาห์นั้น */
function modeOf(values: number[]): number | null {
  if (!values.length) return null;
  const count = new Map<number, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [v, n] of count) {
    if (n > bestN || (n === bestN && best !== null && v > best)) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

// ── การตัดสิน "สัปดาห์ที่ผ่านมาเป็นยังไง" ──
export type Verdict = "good" | "hold" | "poor";

export interface WeekJudgement {
  verdict: Verdict;
  /** จำนวนเซ็ตที่ทำจริง */
  done: number;
  /** เซ็ตที่ทำไม่ถึงเป้า */
  missed: number;
  tooHard: boolean;
  /** มีเซ็ตที่ feel = hard (ยังไม่ถึงกับหนักเกิน แต่ยังไม่ควรเพิ่ม) */
  hard: boolean;
}

/**
 * กติกากลางที่ทุกโหมดใช้ร่วมกัน:
 *   ครบเป้าทุกเซ็ต + feel ทุกเซ็ต ≤ good  → good (ก้าวหน้าได้)
 *   feel = too_hard หรือพลาดเป้า ≥ 2 เซ็ต → poor (ต้องถอย)
 *   นอกนั้น (พลาด 1 เซ็ต หรือรู้สึก "หนัก")  → hold (คงที่ไว้ก่อน)
 * ไม่มีเป้าให้เทียบ = ทำแล้วถือว่าครบ (ห้ามตัดสินว่าพลาดทั้งที่ไม่เคยบอกเป้า)
 */
export function judgeWeek(
  week: WeekResult,
  opts: { targetReps?: number | null; targetSec?: number | null; timed?: boolean } = {}
): WeekJudgement {
  const done = performed(week.sets);
  let missed = 0;
  let tooHard = false;
  let hard = false;

  for (const s of done) {
    if (s.feel === "too_hard") tooHard = true;
    if (s.feel === "hard") hard = true;

    if (opts.timed) {
      const target = s.targetSec ?? opts.targetSec ?? null;
      if (target != null && target > 0 && (s.actualSec ?? 0) < target) missed++;
    } else {
      const target = s.targetReps ?? opts.targetReps ?? null;
      if (target != null && target > 0 && (s.actualReps ?? 0) < target) missed++;
    }
  }

  const verdict: Verdict =
    done.length === 0 ? "hold" : tooHard || missed >= 2 ? "poor" : missed === 0 && !hard ? "good" : "hold";

  return { verdict, done: done.length, missed, tooHard, hard };
}

/**
 * state ที่เก็บไว้ "นับสัปดาห์ปัจจุบันไปแล้ว" (progressionStore คิดใหม่ทุกครั้งที่บันทึกเซ็ต)
 * ตอนคิด next จึงต้องไม่บวกซ้ำ — แต่ถ้าเรียกฟังก์ชันตรง ๆ ด้วย state ว่าง (เทส/ท่าใหม่)
 * ให้ถือว่าสัปดาห์นี้คือครั้งที่ 1
 */
function countedStreak(stored: number, sign: 1 | -1): number {
  return sign > 0 ? Math.max(stored, 1) : Math.min(stored, -1);
}

function countedStall(stored: number): number {
  return Math.max(stored, 1);
}

/** e1RM ที่ดีที่สุดของชุดเซ็ต + น้ำหนัก/ครั้งของเซ็ตนั้น (ใช้เก็บสถิติ ไม่ได้ใช้ตัดสิน) */
export function bestEffort(sets: WeekSet[]): {
  weightKg: number | null;
  reps: number | null;
  e1rmKg: number | null;
} {
  let best: { weightKg: number; reps: number; e1rmKg: number } | null = null;
  for (const s of performed(sets)) {
    const w = s.actualWeightKg ?? null;
    const r = s.actualReps ?? null;
    if (!w || !r || w <= 0 || r <= 0) continue;
    const e = epley(w, r);
    if (!best || e > best.e1rmKg) best = { weightKg: w, reps: r, e1rmKg: e };
  }
  return best ?? { weightKg: null, reps: null, e1rmKg: null };
}

/** ปริมาณรวมของสัปดาห์ (Σ kg × ครั้ง) — ท่าตัวเปล่าไม่มีน้ำหนักจึงเป็น 0 (เพดาน +10% คุมเฉพาะงานที่มีโหลด) */
export function weekVolume(sets: WeekSet[]): number {
  let v = 0;
  for (const s of sets) {
    if ((s.actualWeightKg ?? 0) > 0 && (s.actualReps ?? 0) > 0) {
      v += (s.actualWeightKg as number) * (s.actualReps as number);
    }
  }
  return round1(v);
}

/** ปริมาณของใบสั่ง (ไว้เทียบกับเพดาน +10%) */
export function rxVolume(rx: Rx): number {
  if (!rx.weightKg || !rx.reps) return 0;
  return round1(rx.weightKg * rx.reps * rx.sets);
}

// ── B2.1 ท่าที่ใส่น้ำหนักได้ — double progression ──
export interface LoadableOpts {
  repRange?: [number, number];
  incrementKg?: number | null;
  currentRx?: CurrentRx;
}

export function progressLoadable(
  state: ProgressionStateLike,
  week: WeekResult,
  opts: LoadableOpts = {}
): ProgressionResult {
  const [lo, hi] = opts.repRange ?? DEFAULT_REP_RANGE;
  const inc = normalizeIncrement(opts.incrementKg);
  const done = performed(week.sets);
  if (!done.length) return { next: null, state };

  const curSets = Math.max(1, Math.round(opts.currentRx?.sets ?? done.length));
  const targetRepsSeen = done.map((s) => s.targetReps).find((r) => r != null && r > 0) ?? null;
  const repsDone = done.map((s) => s.actualReps ?? 0).filter((r) => r > 0);
  const actualRepsMin = repsDone.length ? Math.min(...repsDone) : null;
  const curReps = clamp(
    Math.round(opts.currentRx?.reps ?? targetRepsSeen ?? state.lastReps ?? actualRepsMin ?? lo),
    lo,
    hi
  );
  const curWeight =
    opts.currentRx?.weightKg ??
    modeOf(done.map((s) => s.actualWeightKg ?? 0).filter((w) => w > 0)) ??
    state.lastWeightKg ??
    null;

  const judge = judgeWeek(week, { targetReps: curReps });
  const best = bestEffort(week.sets);

  // ไม่รู้ว่ายกกี่กิโล (ไม่ได้กรอกน้ำหนักเลย) → ก้าวหน้าด้วยจำนวนครั้งแทน ห้ามเดาน้ำหนักให้
  if (curWeight == null || curWeight <= 0) {
    const r = progressReps(state, week, { repRange: [lo, hi], currentRx: { reps: curReps, sets: curSets } });
    return {
      next: r.next ? { ...r.next, reason: `ยังไม่ได้บันทึกน้ำหนัก — ${r.next.reason}` } : null,
      state: { ...r.state, e1rmKg: best.e1rmKg ?? state.e1rmKg ?? null },
    };
  }

  let next: Rx;
  let successStreak = 0;
  let stallCount = 0;

  if (judge.verdict === "poor") {
    // หนักเกิน/ทำไม่ไหว → ถอยน้ำหนักลง ~7.5% ปัดลงตามก้าวจริง และต้องถอยจริงอย่างน้อย 1 ก้าว
    let w = roundToIncrement(curWeight * (1 - WEIGHT_CUT_PCT), inc, "down");
    if (w >= curWeight) w = round2(Math.max(inc, curWeight - inc));
    next = {
      weightKg: w,
      reps: curReps,
      sets: curSets,
      reason: judge.tooHard
        ? `รู้สึกหนักเกินไป → ลดเหลือ ${w} กก.`
        : `ทำไม่ถึงเป้า ${judge.missed} เซ็ต → ลดเหลือ ${w} กก.`,
    };
    successStreak = countedStreak(state.successStreak, -1);
  } else if (judge.verdict === "good") {
    if (curReps < hi) {
      next = {
        weightKg: curWeight,
        reps: curReps + 1,
        sets: curSets,
        reason: `ครบ ${curReps} ครั้งทุกเซ็ต → เพิ่มเป็น ${curReps + 1} ครั้ง`,
      };
    } else {
      // ปัดเข้ากริดที่ยกได้จริง (น้ำหนักเดิมอาจไม่ลงตัวกับก้าว) แต่ต้องขึ้นจริงเสมอ ห้ามปัดลงมาเท่าเดิม
      let w = roundToIncrement(curWeight + inc, inc, "near");
      if (w <= curWeight) w = roundToIncrement(curWeight + inc, inc, "up");
      next = {
        weightKg: w,
        reps: lo,
        sets: curSets,
        reason: `ครบ ${hi} ครั้งทุกเซ็ต → ขึ้นน้ำหนักเป็น ${w} กก. เริ่มที่ ${lo} ครั้ง`,
      };
    }
    successStreak = countedStreak(state.successStreak, 1);
  } else {
    next = {
      weightKg: curWeight,
      reps: curReps,
      sets: curSets,
      reason: judge.hard
        ? `สัปดาห์นี้ยังหนักอยู่ → คงที่ ${curWeight} กก. × ${curReps} ครั้ง ให้ร่างกายคุ้นก่อน`
        : `ยังไม่ครบทุกเซ็ต → คงที่ ${curWeight} กก. × ${curReps} ครั้ง`,
    };
    stallCount = countedStall(state.stallCount);
  }

  const withDeload = applyStallDeload(next, stallCount);

  return {
    next: withDeload.next,
    state: {
      e1rmKg: best.e1rmKg ?? state.e1rmKg ?? null,
      ladderLevel: state.ladderLevel ?? null,
      lastWeightKg: withDeload.next.weightKg ?? curWeight,
      lastReps: withDeload.next.reps ?? curReps,
      lastSets: withDeload.next.sets,
      successStreak,
      stallCount: withDeload.stallCount,
    },
  };
}

/** นิ่งครบ 3 สัปดาห์ → สัปดาห์พักฟื้น (ตัดปริมาณ 40%) แล้วเริ่มนับใหม่ */
function applyStallDeload(next: Rx, stallCount: number): { next: Rx; stallCount: number } {
  if (stallCount < DELOAD_STALL_WEEKS) return { next, stallCount };
  const sets = deloadSets(next.sets);
  return {
    next: {
      ...next,
      sets,
      deload: true,
      reason: `ตัวเลขนิ่งมา ${stallCount} สัปดาห์ → สัปดาห์พักฟื้น ลดเหลือ ${sets} เซ็ต แล้วค่อยกลับมาลุยต่อ`,
    },
    stallCount: 0,
  };
}

// ── B2.2 ท่าตัวเปล่า — บันไดความยาก ──
export interface BodyweightOpts {
  /** บันไดจากตาราง exercises: ท่าในกลุ่มเดียวกัน เรียงตาม difficulty (ง่าย→ยาก) */
  ladder?: LadderStep[];
  /** ท่าที่ทำอยู่ตอนนี้ — ใช้หาตำแหน่งบนบันไดเมื่อ state ยังว่าง */
  currentKey?: string;
  currentRx?: CurrentRx;
}

export function progressBodyweight(
  state: ProgressionStateLike,
  week: WeekResult,
  opts: BodyweightOpts = {}
): ProgressionResult {
  const done = performed(week.sets);
  if (!done.length) return { next: null, state };

  const ladder = opts.ladder ?? [];
  const idxByKey = opts.currentKey ? ladder.findIndex((l) => l.key === opts.currentKey) : -1;
  const level = idxByKey >= 0 ? idxByKey : clamp(state.ladderLevel ?? 0, 0, Math.max(0, ladder.length - 1));

  const curSets = Math.max(1, Math.round(opts.currentRx?.sets ?? done.length));
  const curReps = Math.max(
    1,
    Math.round(
      opts.currentRx?.reps ??
        done.map((s) => s.targetReps).find((r) => r != null && r > 0) ??
        state.lastReps ??
        LADDER_FLOOR_REPS
    )
  );
  const reps = done.map((s) => s.actualReps ?? 0);

  // เกณฑ์ของบันได = จำนวนครั้งจริง ไม่ใช่ "ครบเป้าไหม" (เป้าอาจตั้งไว้ 10 แต่บันไดวัดที่ 15)
  const allAtPromote = reps.every((r) => r >= LADDER_PROMOTE_REPS);
  const belowFloor = reps.filter((r) => r < LADDER_FLOOR_REPS).length;
  const tooHard = done.some((s) => s.feel === "too_hard");
  const failing = belowFloor * 2 > done.length; // "เกินครึ่งของเซ็ต"

  const atTop = ladder.length === 0 || level >= ladder.length - 1;

  // เลื่อนขึ้น: ทำถึง 15 ครั้งทุกเซ็ต 2 สัปดาห์ติด (และไม่ได้รู้สึกว่าหนักเกิน)
  if (allAtPromote && !tooHard && !atTop) {
    const streak = countedStreak(state.successStreak, 1);
    if (streak >= 2) {
      const step = ladder[level + 1];
      return {
        next: {
          reps: LADDER_FLOOR_REPS,
          sets: curSets,
          nextKey: step.key,
          nextName: step.name,
          reason: `ทำ ${LADDER_PROMOTE_REPS} ครั้งครบ 2 สัปดาห์ติด → เลื่อนขึ้นเป็น "${step.name}" เริ่มที่ ${LADDER_FLOOR_REPS} ครั้ง`,
        },
        state: {
          ...state,
          ladderLevel: level + 1,
          lastReps: LADDER_FLOOR_REPS,
          lastSets: curSets,
          successStreak: 0,
          stallCount: 0,
        },
      };
    }
    return {
      next: {
        reps: Math.max(curReps, LADDER_PROMOTE_REPS),
        sets: curSets,
        reason: `ทำ ${LADDER_PROMOTE_REPS} ครั้งครบทุกเซ็ตแล้ว — อีก 1 สัปดาห์ได้เลื่อนขึ้นท่าถัดไป`,
      },
      state: {
        ...state,
        ladderLevel: level,
        lastReps: Math.max(curReps, LADDER_PROMOTE_REPS),
        lastSets: curSets,
        successStreak: streak,
        stallCount: 0,
      },
    };
  }

  // ลดลง: ทำไม่ถึง 8 ครั้งเกินครึ่งของเซ็ต 2 สัปดาห์ติด
  if (failing) {
    const streak = countedStreak(state.successStreak, -1);
    if (streak <= -2 && level > 0) {
      const step = ladder[level - 1];
      return {
        next: {
          reps: LADDER_FLOOR_REPS,
          sets: curSets,
          nextKey: step.key,
          nextName: step.name,
          reason: `ยังทำไม่ถึง ${LADDER_FLOOR_REPS} ครั้ง 2 สัปดาห์ติด → ถอยมาที่ "${step.name}" ให้ฟอร์มแน่นก่อน`,
        },
        state: {
          ...state,
          ladderLevel: level - 1,
          lastReps: LADDER_FLOOR_REPS,
          lastSets: curSets,
          successStreak: 0,
          stallCount: 0,
        },
      };
    }
    const target = Math.max(1, Math.min(curReps, Math.max(...reps, 1)));
    return {
      next: {
        reps: target,
        sets: curSets,
        reason: `สัปดาห์นี้ยังไม่ถึง ${LADDER_FLOOR_REPS} ครั้ง → ตั้งเป้าที่ ${target} ครั้งก่อน ค่อย ๆ ไต่`,
      },
      state: {
        ...state,
        ladderLevel: level,
        lastReps: target,
        lastSets: curSets,
        successStreak: streak,
        stallCount: 0,
      },
    };
  }

  // ยังไม่ถึงเกณฑ์ขึ้น/ลง → เดินด้วยครั้ง-เซ็ตตามปกติ
  // สุดบันไดแล้วไต่ครั้งได้ถึง 20 · ยังไม่สุดบันไดให้ไต่ถึง 15 (แตะแล้วรอครบ 2 สัปดาห์เพื่อเลื่อนขั้น)
  const hi = atTop ? LADDER_TOP_MAX_REPS : LADDER_PROMOTE_REPS;
  const r = progressReps(state, week, {
    repRange: [LADDER_FLOOR_REPS, hi],
    currentRx: { reps: curReps, sets: curSets },
    // ยังไม่สุดบันได = อย่าเพิ่งเพิ่มเซ็ต ให้ไปเลื่อนขั้นท่าแทน (เพิ่มเซ็ตที่ท่าง่าย = เสียเวลาเปล่า)
    maxSets: atTop ? MAX_PROGRESSION_SETS : curSets,
  });
  return { next: r.next, state: { ...r.state, ladderLevel: level } };
}

// ── B2.3 ท่าที่เดินด้วย "ครั้ง" อย่างเดียว (ไม่มีน้ำหนัก ไม่มีบันได) ──
export interface RepsOpts {
  repRange?: [number, number];
  maxSets?: number;
  currentRx?: CurrentRx;
}

/**
 * double progression แบบไม่มีน้ำหนัก: ไต่ครั้งจนแตะเพดานช่วง → เพิ่ม 1 เซ็ตแล้วกลับไปพื้นช่วง
 * (แกน "น้ำหนัก" ถูกแทนด้วยแกน "จำนวนเซ็ต")
 */
export function progressReps(
  state: ProgressionStateLike,
  week: WeekResult,
  opts: RepsOpts = {}
): ProgressionResult {
  const [lo, hi] = opts.repRange ?? REPS_ONLY_RANGE;
  const maxSets = opts.maxSets ?? MAX_PROGRESSION_SETS;
  const done = performed(week.sets);
  if (!done.length) return { next: null, state };

  const curSets = Math.max(1, Math.round(opts.currentRx?.sets ?? done.length));
  const curReps = clamp(
    Math.round(
      opts.currentRx?.reps ??
        done.map((s) => s.targetReps).find((r) => r != null && r > 0) ??
        state.lastReps ??
        lo
    ),
    lo,
    hi
  );
  const judge = judgeWeek(week, { targetReps: curReps });

  let next: Rx;
  let successStreak = 0;
  let stallCount = 0;

  if (judge.verdict === "poor") {
    if (curReps > lo) {
      const reps = Math.max(lo, curReps - 2);
      next = { reps, sets: curSets, reason: `หนักเกินไป → ลดเหลือ ${reps} ครั้ง` };
    } else if (curSets > 1) {
      next = { reps: lo, sets: curSets - 1, reason: `หนักเกินไป → ลดเหลือ ${curSets - 1} เซ็ต` };
    } else {
      next = { reps: lo, sets: 1, reason: `ค่อย ๆ ไปก่อน — คงที่ ${lo} ครั้ง 1 เซ็ต` };
    }
    successStreak = countedStreak(state.successStreak, -1);
  } else if (judge.verdict === "good") {
    if (curReps < hi) {
      next = { reps: curReps + 1, sets: curSets, reason: `ครบ ${curReps} ครั้งทุกเซ็ต → เพิ่มเป็น ${curReps + 1} ครั้ง` };
    } else if (curSets < maxSets) {
      next = {
        reps: lo,
        sets: curSets + 1,
        reason: `ครบ ${hi} ครั้งทุกเซ็ต → เพิ่มเป็น ${curSets + 1} เซ็ต เริ่มที่ ${lo} ครั้ง`,
      };
    } else {
      next = { reps: hi, sets: curSets, reason: `ทำได้เต็มเพดานของท่านี้แล้ว (${curSets} เซ็ต × ${hi} ครั้ง) — คงไว้` };
    }
    successStreak = countedStreak(state.successStreak, 1);
  } else {
    next = { reps: curReps, sets: curSets, reason: `ยังไม่ครบทุกเซ็ต → คงที่ ${curSets} เซ็ต × ${curReps} ครั้ง` };
    stallCount = countedStall(state.stallCount);
  }

  const withDeload = applyStallDeload(next, stallCount);
  return {
    next: withDeload.next,
    state: {
      ...state,
      lastWeightKg: state.lastWeightKg ?? null,
      lastReps: withDeload.next.reps ?? curReps,
      lastSets: withDeload.next.sets,
      successStreak,
      stallCount: withDeload.stallCount,
    },
  };
}

// ── B2.4 ท่าจับเวลา (แพลงก์ / คาร์ดิโอช่วง) ──
export interface TimedOpts {
  currentSec?: number | null;
  currentRx?: CurrentRx;
}

export function progressTimed(
  state: ProgressionStateLike,
  week: WeekResult,
  opts: TimedOpts = {}
): ProgressionResult {
  const done = performed(week.sets);
  if (!done.length) return { next: null, state };

  const curSets = Math.max(1, Math.round(opts.currentRx?.sets ?? done.length));
  const curSec = Math.round(
    opts.currentSec ??
      opts.currentRx?.seconds ??
      done.map((s) => s.targetSec).find((v) => v != null && v > 0) ??
      Math.max(...done.map((s) => s.actualSec ?? 0))
  );
  if (!(curSec > 0)) return { next: null, state };

  const judge = judgeWeek(week, { targetSec: curSec, timed: true });

  let next: Rx;
  let successStreak = 0;
  let stallCount = 0;

  if (judge.verdict === "poor") {
    let sec = roundSec(curSec * (1 - TIMED_STEP_PCT));
    if (sec >= curSec) sec = Math.max(MIN_TIMED_SEC, curSec - TIMED_ROUND_SEC);
    next = { seconds: sec, sets: curSets, reason: `หนักเกินไป → ลดเหลือ ${sec} วินาที` };
    successStreak = countedStreak(state.successStreak, -1);
  } else if (judge.verdict === "good") {
    /* +10% ปัดขึ้นทีละ 5 วิ แต่ห้ามเกินเพดาน +20% ต่อสัปดาห์
       ข้อยกเว้นเดียว: ก้าวเล็กสุดของนาฬิกาจับเวลาคือ 5 วินาที — แพลงก์ 20 วิ ถ้าคุม 20% เป๊ะจะขยับไม่ได้เลย
       (เพดานมีไว้กันกระโดดไกล ไม่ได้มีไว้ขังคนที่เพิ่งเริ่มให้อยู่ที่เดิมตลอดไป) */
    const cap = Math.max(roundSec(curSec * (1 + TIMED_CAP_PCT)), curSec + TIMED_ROUND_SEC);
    const sec = Math.min(roundSec(curSec * (1 + TIMED_STEP_PCT), "up"), cap);
    next =
      sec > curSec
        ? { seconds: sec, sets: curSets, reason: `ครบ ${curSec} วินาทีทุกเซ็ต → เพิ่มเป็น ${sec} วินาที` }
        : { seconds: curSec, sets: curSets, reason: `คงที่ ${curSec} วินาที` };
    successStreak = countedStreak(state.successStreak, 1);
  } else {
    next = { seconds: curSec, sets: curSets, reason: `ยังไม่ครบทุกเซ็ต → คงที่ ${curSec} วินาที` };
    stallCount = countedStall(state.stallCount);
  }

  const withDeload = applyStallDeload(next, stallCount);
  return {
    next: withDeload.next,
    state: {
      ...state,
      lastReps: null,
      lastSets: withDeload.next.sets,
      successStreak,
      stallCount: withDeload.stallCount,
    },
  };
}

// ── B2.5 เพดานความปลอดภัย: ปริมาณรวมเพิ่มได้ ≤ +10%/สัปดาห์ ──
/**
 * ใบสั่งชุดใหม่รวมกันแล้วต้องไม่เกินปริมาณสัปดาห์ก่อน +10%
 * เกิน → ตัดเซ็ตของท่าที่ปริมาณมากที่สุดก่อน (เซ็ตท้ายคือส่วนที่ให้ผลน้อยสุด) แล้วค่อยลดครั้ง
 * ไม่มีปริมาณสัปดาห์ก่อน (สัปดาห์แรก/ท่าตัวเปล่า) = ไม่มีฐานเทียบ → ไม่คุม
 */
export function capWeeklyVolume(
  prevWeekVol: number,
  nextRxList: Rx[]
): { rx: Rx[]; capped: boolean; volume: number; limit: number } {
  const limit = round1(prevWeekVol * WEEKLY_VOLUME_CAP);
  const rx = nextRxList.map((r) => ({ ...r }));
  const total = () => round1(rx.reduce((s, r) => s + rxVolume(r), 0));

  if (!(prevWeekVol > 0) || total() <= limit) {
    return { rx, capped: false, volume: total(), limit };
  }

  let capped = false;
  let guard = 0;
  while (total() > limit && guard++ < 200) {
    // เลือกท่าที่กินปริมาณมากสุดในตอนนี้
    let idx = -1;
    let best = 0;
    for (let i = 0; i < rx.length; i++) {
      const v = rxVolume(rx[i]);
      if (v > best) {
        best = v;
        idx = i;
      }
    }
    if (idx < 0) break;
    const r = rx[idx];
    if (r.sets > 1) r.sets -= 1;
    else if ((r.reps ?? 0) > 1) r.reps = (r.reps as number) - 1;
    else break;
    capped = true;
  }

  if (capped) {
    for (const r of rx) r.reason = `${r.reason} (คุมปริมาณให้เพิ่มไม่เกิน 10% ต่อสัปดาห์)`;
  }
  return { rx, capped, volume: total(), limit };
}

// ── B2.6 สรุปสถานะจากประวัติจริง (ให้ progressionStore เขียนลง ProgressionState) ──
export interface DatedSet extends WeekSet {
  /** เวลาเป็น ms (Date.getTime()) — ไฟล์นี้ไม่แตะ Date ปัจจุบัน รับมาจากผู้เรียกเท่านั้น */
  at: number;
}

export interface WeekBucket {
  /** 0 = สัปดาห์ล่าสุด */
  index: number;
  sets: WeekSet[];
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * แบ่งบันทึกเป็น "สัปดาห์" นับถอยหลังจากเซ็ตล่าสุด — สัปดาห์ที่ไม่ได้เล่นเลยจะไม่มีในผลลัพธ์
 * (ยึดจากเซ็ตล่าสุดไม่ใช่ "วันนี้" เพื่อให้ผลเหมือนเดิมไม่ว่าจะเปิดดูวันไหน)
 */
export function splitWeeks(sets: DatedSet[], maxWeeks = 6): WeekBucket[] {
  if (!sets.length) return [];
  const anchor = Math.max(...sets.map((s) => s.at));
  const buckets = new Map<number, WeekSet[]>();
  for (const s of sets) {
    const idx = Math.floor((anchor - s.at) / WEEK_MS);
    if (idx < 0 || idx >= maxWeeks) continue;
    buckets.set(idx, [...(buckets.get(idx) ?? []), s]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, weekSets]) => ({ index, sets: weekSets }));
}

export type ProgressionMode = "loadable" | "ladder" | "timed" | "reps";

/**
 * ตัดสินสัปดาห์หนึ่งตามโหมดของท่า — โหมดบันไดใช้เกณฑ์ครั้งจริง (15 ขึ้น / 8 ลง) ไม่ใช่ "ครบเป้า"
 * เพราะกติกาบันไดวัดที่ตัวเลขสัมบูรณ์ ไม่ได้วัดที่เป้าที่ตั้งไว้
 */
export function judgeWeekByMode(sets: WeekSet[], mode: ProgressionMode): Verdict {
  const done = performed(sets);
  if (!done.length) return "hold";
  if (mode === "ladder") {
    const reps = done.map((s) => s.actualReps ?? 0);
    const tooHard = done.some((s) => s.feel === "too_hard");
    if (reps.filter((r) => r < LADDER_FLOOR_REPS).length * 2 > done.length) return "poor";
    if (reps.every((r) => r >= LADDER_PROMOTE_REPS) && !tooHard) return "good";
    return "hold";
  }
  return judgeWeek({ sets }, { timed: mode === "timed" }).verdict;
}

/**
 * สรุปสถานะจากประวัติ (ใหม่→เก่า) — ค่าทุกตัว derive ได้จาก SetLog ล้วน
 * 🔴 idempotent: คิดกี่ครั้งก็ได้ค่าเดิม (ไม่ใช่การบวกสะสม) — POST ซ้ำ/ยิงทีละเซ็ตจึงไม่ทำให้ streak เพี้ยน
 */
export function deriveState(
  prev: ProgressionStateLike | null,
  weeks: WeekBucket[],
  opts: { mode: ProgressionMode; ladderLevel?: number | null } = { mode: "reps" }
): ProgressionStateLike {
  const base: ProgressionStateLike = { ...EMPTY_STATE, ...(prev ?? {}) };
  if (!weeks.length) return { ...base, ladderLevel: opts.ladderLevel ?? base.ladderLevel ?? null };

  const verdicts = weeks.map((w) => judgeWeekByMode(w.sets, opts.mode));

  let successStreak = 0;
  if (verdicts[0] === "good") {
    for (const v of verdicts) {
      if (v !== "good") break;
      successStreak++;
    }
  } else if (verdicts[0] === "poor") {
    for (const v of verdicts) {
      if (v !== "poor") break;
      successStreak--;
    }
  }

  let stallCount = 0;
  for (const v of verdicts) {
    if (v !== "hold") break;
    stallCount++;
  }

  const latest = weeks[0].sets;
  const done = performed(latest);
  const best = bestEffort(latest);
  const lastWeight = modeOf(done.map((s) => s.actualWeightKg ?? 0).filter((w) => w > 0));
  const lastReps = modeOf(done.map((s) => s.actualReps ?? 0).filter((r) => r > 0));

  return {
    // ท่าตัวเปล่าไม่มี e1RM — ห้ามล้างค่าเก่าทิ้งเพราะสัปดาห์นี้บังเอิญไม่ได้กรอกน้ำหนัก
    e1rmKg: best.e1rmKg ?? base.e1rmKg ?? null,
    ladderLevel: opts.ladderLevel ?? base.ladderLevel ?? null,
    lastWeightKg: lastWeight ?? base.lastWeightKg ?? null,
    lastReps: lastReps ?? base.lastReps ?? null,
    lastSets: done.length || base.lastSets || null,
    successStreak,
    stallCount,
  };
}
