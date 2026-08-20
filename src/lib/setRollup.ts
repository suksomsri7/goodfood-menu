/**
 * รวมยอดบันทึกรายเซ็ต (SetLog) → สรุปต่อท่า 1 แถว (ExerciseLog) ที่ไทม์ไลน์/วงแหวนใช้อยู่แล้ว
 *
 * ทำไมต้องรวมยอด: หน้าจอทุกที่ (ไทม์ไลน์ · วงแหวนเผาผลาญ · สถิติ) อ่านจาก ExerciseLog
 * ถ้า Workout Player เขียนแค่ SetLog ผู้ใช้จะเล่นเสร็จแล้วเห็นวงแหวนว่าง = ระบบดูเหมือนโกหก
 *
 * ตัวเลขทุกตัวในไฟล์นี้เป็นคณิตล้วน (ไม่แตะ DB/เวลา) → เทสถาวรได้ที่ scripts/test-set-rollup.ts
 */
import { kcalForExercise } from "@/lib/exerciseCatalog";

/** เพดานกันค่าเพี้ยน (พิมพ์พลาด/แอปส่งค่าขยะ) — เกินนี้ตัดเหลือเท่าเพดาน ไม่ทิ้งทั้งเซ็ต */
export const MAX_SETS = 20;
export const MAX_SET_NO = 20;
export const MAX_WEIGHT_KG = 500;
export const MAX_REPS = 200;
export const MAX_SEC = 7200;

/** ท่านับครั้ง 1 เซ็ต ≈ 1.5 นาที (ทำ + พัก) — ตัวเลขเดียวกับที่ PATCH /api/plan/[id] ใช้แบ่ง kcal */
export const REPS_SET_MINUTES = 1.5;

/** ไม่รู้น้ำหนักตัว (ยังไม่กรอก/ยังไม่เคยชั่ง) → ใช้ค่ากลางคนไทยแทน ดีกว่าโชว์ 0 kcal ให้คนที่เพิ่งเล่นเสร็จ */
export const DEFAULT_BODY_WEIGHT_KG = 60;

export const FEELS = ["too_easy", "easy", "good", "hard", "too_hard"];

export interface CleanSet {
  setNo: number;
  targetWeightKg: number | null;
  targetReps: number | null;
  targetSec: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualSec: number | null;
  feel: string | null;
  rpe: number | null;
}

const numOrNull = (v: unknown, max: number, round = false): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  const capped = Math.min(max, n);
  return round ? Math.round(capped) : Math.round(capped * 100) / 100;
};

/** ตรวจ+ตัดค่าเซ็ตที่แอปส่งมา — แถวที่ไม่ใช่ object ทิ้ง · setNo ที่ขาด/เพี้ยนใช้ลำดับในลิสต์แทน */
export function normalizeSets(raw: unknown): CleanSet[] {
  if (!Array.isArray(raw)) return [];
  const out: CleanSet[] = [];
  for (const [i, r] of raw.slice(0, MAX_SETS).entries()) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const setNoRaw = Number(o.setNo);
    const rpe = numOrNull(o.rpe, 10);
    out.push({
      setNo: Number.isFinite(setNoRaw) && setNoRaw >= 1 ? Math.min(MAX_SET_NO, Math.round(setNoRaw)) : i + 1,
      targetWeightKg: numOrNull(o.targetWeightKg, MAX_WEIGHT_KG),
      targetReps: numOrNull(o.targetReps, MAX_REPS, true),
      targetSec: numOrNull(o.targetSec, MAX_SEC, true),
      actualWeightKg: numOrNull(o.actualWeightKg, MAX_WEIGHT_KG),
      actualReps: numOrNull(o.actualReps, MAX_REPS, true),
      actualSec: numOrNull(o.actualSec, MAX_SEC, true),
      feel: FEELS.includes(String(o.feel)) ? String(o.feel) : null,
      // RPE ต่ำกว่า 1 = ไม่ใช่สเกลจริง (สเกล Borg CR10 เริ่มที่ 1) → ถือว่าไม่ได้กรอก
      rpe: rpe !== null && rpe >= 1 ? rpe : null,
    });
  }
  return out;
}

export interface Rollup {
  /** นาทีที่ใช้จริงของท่านี้ (ปัดขึ้นอย่างน้อย 1 นาทีถ้ามีการทำจริง — ExerciseLog.duration เป็นจำนวนเต็ม) */
  durationMin: number;
  calories: number;
  /** จำนวนเซ็ตที่ "ทำจริง" (มี reps หรือวินาที) — เซ็ตที่กรอกแต่เป้าไว้ยังไม่นับ */
  workedSets: number;
  /** ปริมาณรวม kg×ครั้ง — ตัวเลขที่จอสรุปเซสชันโชว์ และเฟส B ใช้ดูว่าเพิ่มเกิน +10%/สัปดาห์ไหม */
  volumeKg: number;
}

/**
 * นาทีของ 1 เซ็ต: ท่าจับเวลาใช้วินาทีจริง · ท่านับครั้งใช้ค่าประมาณ 1.5 นาที/เซ็ต
 * เซ็ตที่ไม่มีทั้งครั้งและวินาที = ยังไม่ได้ทำ → 0 นาที (ไม่งั้นแค่เปิดจอค้างไว้ก็ได้แคลอรี่)
 */
function setMinutes(s: CleanSet): number {
  if (s.actualSec && s.actualSec > 0) return s.actualSec / 60;
  if (s.actualReps && s.actualReps > 0) return REPS_SET_MINUTES;
  return 0;
}

/** รวมยอดทุกเซ็ตของท่าเดียวในวันเดียว → ค่าที่จะเขียนลง ExerciseLog */
export function rollupSets(
  sets: CleanSet[],
  opts: { met?: number | null; bodyWeightKg?: number | null }
): Rollup {
  const met = opts.met && opts.met > 0 ? opts.met : 4;
  const bodyWeightKg = opts.bodyWeightKg && opts.bodyWeightKg > 0 ? opts.bodyWeightKg : DEFAULT_BODY_WEIGHT_KG;

  let minutes = 0;
  let workedSets = 0;
  let volumeKg = 0;
  for (const s of sets) {
    const m = setMinutes(s);
    if (m > 0) workedSets++;
    minutes += m;
    if (s.actualWeightKg && s.actualReps) volumeKg += s.actualWeightKg * s.actualReps;
  }

  // ความรู้สึก (feel/RPE) ไม่มีผลกับแคลอรี่ — MET เป็นค่าของ "ท่า" ไม่ใช่ของ "วันที่รู้สึกหนัก"
  return {
    durationMin: minutes > 0 ? Math.max(1, Math.round(minutes)) : 0,
    calories: kcalForExercise(met, bodyWeightKg, minutes),
    workedSets,
    volumeKg: Math.round(volumeKg * 10) / 10,
  };
}
