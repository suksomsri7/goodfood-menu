/**
 * สะพานระหว่าง engine progression (คณิตล้วน src/lib/progression.ts) กับฐานข้อมูล
 *
 * แยกออกจาก route เพราะตัวเลข "สัปดาห์หน้า" ถูกใช้ 3 ที่:
 *   1. POST /api/coach/sets → อัปเดต ProgressionState หลังบันทึกจริง
 *   2. GET  /api/coach/training-state → จอสรุปจบเซสชันโชว์ "สัปดาห์หน้าจะ..."
 *   3. planGenerator → เขียนตัวเลขลงแผนสัปดาห์ถัดไป
 * ถ้าแต่ละที่คิดเอง ลูกค้าจะเห็นเลขไม่ตรงกัน = ระบบดูเหมือนโกหก
 */
import { prisma } from "@/lib/prisma";
import {
  deriveState,
  splitWeeks,
  progressLoadable,
  progressBodyweight,
  progressTimed,
  progressReps,
  pickIncrementKg,
  weekVolume,
  EMPTY_STATE,
  WEEK_MS,
  REPS_ONLY_RANGE,
  type DatedSet,
  type LadderStep,
  type ProgressionMode,
  type ProgressionStateLike,
  type Rx,
  type WeekSet,
} from "@/lib/progression";

/** หน้าต่างที่ API อ่านเพื่อคิด next = 14 วัน (สัปดาห์ล่าสุด + สัปดาห์ก่อนหน้าไว้เทียบปริมาณ) */
export const NEXT_WINDOW_DAYS = 14;
/** หน้าต่างที่ใช้สรุป streak/stall = 6 สัปดาห์ (กติกา "นิ่ง 3 สัปดาห์" ต้องมองเห็นย้อนหลังพอ) */
export const STATE_WINDOW_WEEKS = 6;
/** ถามได้สูงสุดกี่ท่าต่อครั้ง */
export const MAX_KEYS = 30;

interface ExerciseMeta {
  key: string;
  name: string;
  unit: string;
  loadable: boolean;
  pattern: string | null;
  progressionGroup: string | null;
  difficulty: number;
  equipmentNeeded: string[];
}

const EXERCISE_SELECT = {
  key: true,
  name: true,
  unit: true,
  loadable: true,
  pattern: true,
  progressionGroup: true,
  difficulty: true,
  equipmentNeeded: true,
} as const;

interface RawSet {
  date: Date;
  setNo: number;
  targetWeightKg: number | null;
  targetReps: number | null;
  targetSec: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualSec: number | null;
  feel: string | null;
}

const toWeekSet = (r: RawSet): WeekSet => ({
  targetReps: r.targetReps,
  targetSec: r.targetSec,
  targetWeightKg: r.targetWeightKg,
  actualReps: r.actualReps,
  actualSec: r.actualSec,
  actualWeightKg: r.actualWeightKg,
  feel: r.feel,
});

const toDatedSet = (r: RawSet): DatedSet => ({ ...toWeekSet(r), at: r.date.getTime() });

const performedCount = (sets: WeekSet[]) =>
  sets.filter((s) => (s.actualReps ?? 0) > 0 || (s.actualSec ?? 0) > 0).length;

/** ค่าที่พบบ่อยที่สุดในลิสต์ (เท่ากัน = ค่ามากกว่า) */
function modeOf(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && v > 0);
  if (!nums.length) return null;
  const count = new Map<number, number>();
  for (const v of nums) count.set(v, (count.get(v) ?? 0) + 1);
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

/**
 * ท่านี้เดินหน้าด้วยอะไร — ดูจากสิ่งที่บันทึกจริงก่อน แล้วค่อยดู metadata ของท่า
 * (คนอาจจับเวลาแพลงก์แทนการนับครั้ง หรือบันทึกวิดพื้นเป็นครั้งทั้งที่ท่าตั้งเป็นนาที)
 */
export function progressionModeFor(
  ex: ExerciseMeta | undefined,
  sets: WeekSet[],
  ladderLength: number
): ProgressionMode {
  const hasReps = sets.some((s) => (s.actualReps ?? 0) > 0);
  const hasSec = sets.some((s) => (s.actualSec ?? 0) > 0);
  if (hasSec && !hasReps) return "timed";
  if (!hasReps && ex?.unit === "minutes") return "timed";
  if (ex?.loadable) return "loadable";
  if (ladderLength > 1) return "ladder";
  return "reps";
}

/** บันไดของกลุ่ม: ท่าที่ยังเปิดใช้งาน เรียงง่าย→ยาก (difficulty เท่ากันเรียงด้วย key ให้ผลนิ่ง) */
async function loadLadders(groups: string[]): Promise<Map<string, LadderStep[]>> {
  const map = new Map<string, LadderStep[]>();
  if (!groups.length) return map;
  const rows = await prisma.exercise.findMany({
    where: { progressionGroup: { in: groups }, isActive: true },
    select: { key: true, name: true, difficulty: true, progressionGroup: true },
    orderBy: [{ difficulty: "asc" }, { key: "asc" }],
  });
  for (const r of rows) {
    const g = r.progressionGroup as string;
    map.set(g, [...(map.get(g) ?? []), { key: r.key, name: r.name, difficulty: r.difficulty }]);
  }
  return map;
}

// ── B3: อัปเดต state หลังบันทึกเซ็ตจริง ──
/**
 * คิดใหม่ทั้งก้อนจาก SetLog ย้อนหลัง 6 สัปดาห์ แล้ว upsert
 * 🔴 ไม่คิด "สัปดาห์หน้ายกเท่าไร" ที่นี่ — ตอนบันทึกเพิ่งเล่นได้ครึ่งสัปดาห์ ข้อมูลยังไม่ครบ
 * 🔴 idempotent: ยิงซ้ำ/ยิงทีละเซ็ต ผลลัพธ์เท่าเดิมเสมอ (derive ไม่ใช่บวกสะสม)
 */
export async function updateProgressionState(memberId: string, exerciseKey: string, now = new Date()) {
  const since = new Date(now.getTime() - STATE_WINDOW_WEEKS * WEEK_MS);
  const rows = (await prisma.setLog.findMany({
    where: { memberId, exerciseKey, date: { gte: since } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      setNo: true,
      targetWeightKg: true,
      targetReps: true,
      targetSec: true,
      actualWeightKg: true,
      actualReps: true,
      actualSec: true,
      feel: true,
    },
  })) as RawSet[];
  if (!rows.length) return null;

  const ex = (await prisma.exercise.findUnique({
    where: { key: exerciseKey },
    select: EXERCISE_SELECT,
  })) as ExerciseMeta | null;

  const ladder = ex?.progressionGroup ? (await loadLadders([ex.progressionGroup])).get(ex.progressionGroup) ?? [] : [];
  const weeks = splitWeeks(rows.map(toDatedSet), STATE_WINDOW_WEEKS);
  const mode = progressionModeFor(ex ?? undefined, weeks[0]?.sets ?? [], ladder.length);

  const prev = await prisma.progressionState.findUnique({
    where: { memberId_exerciseKey: { memberId, exerciseKey } },
  });
  // ตำแหน่งบันได = "ตอนนี้เล่นท่าไหนอยู่" ตรง ๆ (ไม่ต้องเดา) · ไม่มีบันได = null
  const ladderIdx = ladder.findIndex((l) => l.key === exerciseKey);
  const next = deriveState(prev, weeks, { mode, ladderLevel: ladderIdx >= 0 ? ladderIdx : null });

  const data = {
    e1rmKg: next.e1rmKg ?? null,
    ladderLevel: next.ladderLevel ?? null,
    lastWeightKg: next.lastWeightKg ?? null,
    lastReps: next.lastReps ?? null,
    lastSets: next.lastSets ?? null,
    successStreak: next.successStreak,
    stallCount: next.stallCount,
  };
  return prisma.progressionState.upsert({
    where: { memberId_exerciseKey: { memberId, exerciseKey } },
    create: { memberId, exerciseKey, ...data },
    update: data,
  });
}

// ── B4/B5: คิด "สัปดาห์หน้า" ต่อท่า ──
export interface NextForKey {
  next: Rx | null;
  mode: ProgressionMode;
  /** ปริมาณจริงของสัปดาห์ที่เพิ่งจบ (Σ kg×ครั้ง) — ฐานของเพดาน "เพิ่มได้ ≤ +10%/สัปดาห์" */
  lastWeekVolume: number;
  /** ปริมาณของสัปดาห์ก่อนหน้านั้นอีกที — ไว้ดูแนวโน้ม */
  prevWeekVolume: number;
  pattern: string | null;
}

/**
 * คิดใบสั่งสัปดาห์หน้าของแต่ละท่าจาก SetLog 14 วันล่าสุด + ProgressionState + คลังอุปกรณ์ + บันไดในตาราง exercises
 * 🔴 ไม่มีข้อมูล = null ไม่ใช่เดาให้ (ตัวเลขนี้คือสิ่งที่ลูกค้าจะยกจริง)
 *
 * แบ่งหน้าต่าง 14 วันเป็น 2 สัปดาห์โดยยึด "เซ็ตล่าสุด" เป็นหมุด (ไม่ยึด "วันนี้" — เปิดดูวันไหนก็ได้เลขเดิม):
 *   สัปดาห์ล่าสุด = ตัวตัดสินใบสั่ง + ฐานของเพดานปริมาณ +10% · สัปดาห์ก่อนหน้า = ไว้ดูแนวโน้ม
 */
export async function computeNextForKeys(
  memberId: string,
  keys: string[],
  now = new Date(),
  /**
   * เฟส D: ช่วงครั้งจาก TrainingProfile (repRangeFor) — ไม่ส่งมา = ค่าปริยายเดิมของ progression.ts
   * ใช้กับโหมด loadable เท่านั้น (ท่าที่ใส่น้ำหนักได้) ตามที่ progression.ts เปิดช่องไว้ตั้งแต่เฟส B
   */
  opts: { repRange?: [number, number] | null } = {}
): Promise<Map<string, NextForKey>> {
  const out = new Map<string, NextForKey>();
  const wanted = [...new Set(keys.map((k) => String(k ?? "").trim()).filter(Boolean))].slice(0, MAX_KEYS);
  if (!wanted.length) return out;

  const since = new Date(now.getTime() - NEXT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [rows, exRows, states, equipment] = await Promise.all([
    prisma.setLog.findMany({
      where: { memberId, exerciseKey: { in: wanted }, date: { gte: since } },
      orderBy: { date: "asc" },
      select: {
        exerciseKey: true,
        date: true,
        setNo: true,
        targetWeightKg: true,
        targetReps: true,
        targetSec: true,
        actualWeightKg: true,
        actualReps: true,
        actualSec: true,
        feel: true,
      },
    }),
    prisma.exercise.findMany({ where: { key: { in: wanted } }, select: EXERCISE_SELECT }),
    prisma.progressionState.findMany({ where: { memberId, exerciseKey: { in: wanted } } }),
    prisma.memberEquipment.findMany({ where: { memberId }, select: { type: true, incrementKg: true } }),
  ]);

  const exByKey = new Map(exRows.map((e) => [e.key, e as ExerciseMeta]));
  const stateByKey = new Map(states.map((s) => [s.exerciseKey, s as unknown as ProgressionStateLike]));
  const ladders = await loadLadders([
    ...new Set(exRows.map((e) => e.progressionGroup).filter((g): g is string => !!g)),
  ]);

  const byKey = new Map<string, RawSet[]>();
  for (const r of rows) {
    byKey.set(r.exerciseKey, [...(byKey.get(r.exerciseKey) ?? []), r as RawSet]);
  }

  for (const key of wanted) {
    const ex = exByKey.get(key);
    const keyRows = byKey.get(key) ?? [];
    const pattern = ex?.pattern ?? null;
    const ladder = ex?.progressionGroup ? ladders.get(ex.progressionGroup) ?? [] : [];

    if (!keyRows.length) {
      out.set(key, { next: null, mode: "reps", lastWeekVolume: 0, prevWeekVolume: 0, pattern });
      continue;
    }

    // หมุด = เซ็ตล่าสุด → สัปดาห์ล่าสุดคือ 7 วันนับถอยหลังจากตรงนั้น
    const anchor = Math.max(...keyRows.map((r) => r.date.getTime()));
    const curRows = keyRows.filter((r) => anchor - r.date.getTime() < WEEK_MS);
    const prevRows = keyRows.filter((r) => {
      const d = anchor - r.date.getTime();
      return d >= WEEK_MS && d < 2 * WEEK_MS;
    });
    const curSets = curRows.map(toWeekSet);

    if (performedCount(curSets) === 0) {
      out.set(key, { next: null, mode: "reps", lastWeekVolume: 0, prevWeekVolume: 0, pattern });
      continue;
    }

    // เซสชันล่าสุด (วันเดียวกับเซ็ตล่าสุด) = โครงของใบสั่งปัจจุบัน (กี่เซ็ต เป้าเท่าไร)
    const lastDayStart = anchor - 12 * 60 * 60 * 1000; // เซ็ตในช่วง 12 ชม.ก่อนเซ็ตล่าสุด = เซสชันเดียวกัน
    const lastSession = curRows.filter((r) => r.date.getTime() >= lastDayStart);
    const sessionSets = lastSession.length || performedCount(curSets);
    const currentRx = {
      // เป้าเท่านั้น — ไม่มีเป้าให้ engine เดาจากสิ่งที่ทำได้จริงเอง (ห้ามตีว่า "พลาดเป้า" ทั้งที่ไม่เคยตั้งเป้า)
      reps: modeOf(lastSession.map((r) => r.targetReps)),
      seconds: modeOf(lastSession.map((r) => r.targetSec)),
      weightKg:
        modeOf(lastSession.map((r) => r.targetWeightKg)) ?? modeOf(lastSession.map((r) => r.actualWeightKg)),
      sets: sessionSets,
    };

    const state: ProgressionStateLike = stateByKey.get(key) ?? { ...EMPTY_STATE };
    const mode = progressionModeFor(ex, curSets, ladder.length);
    const week = { sets: curSets };

    let result;
    if (mode === "loadable") {
      result = progressLoadable(state, week, {
        incrementKg: pickIncrementKg(equipment, ex?.equipmentNeeded),
        currentRx,
        ...(opts.repRange ? { repRange: opts.repRange } : {}),
      });
    } else if (mode === "timed") {
      result = progressTimed(state, week, { currentSec: currentRx.seconds, currentRx });
    } else if (mode === "ladder") {
      result = progressBodyweight(state, week, { ladder, currentKey: key, currentRx });
    } else {
      result = progressReps(state, week, { repRange: REPS_ONLY_RANGE, currentRx });
    }

    out.set(key, {
      next: result.next,
      mode,
      lastWeekVolume: weekVolume(curSets),
      prevWeekVolume: weekVolume(prevRows.map(toWeekSet)),
      pattern,
    });
  }

  return out;
}
