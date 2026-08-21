/**
 * สะพานระหว่าง engine ปรับแผนวันนี้ (คณิตล้วน src/lib/workoutAdjust.ts) กับฐานข้อมูล
 *
 * ใช้ร่วมกัน 2 ทาง: ปุ่มในแอป (/api/coach/workout-adjust) และคำสั่งเสียงผ่านโค้ช (/api/coach/execute)
 * ถ้าสองทางคิดคนละแบบ user จะเจอผลไม่เหมือนกันทั้งที่พูดเรื่องเดียวกัน
 *
 * 🔴 เก็บ adjustBackup = ท่าชุดเดิมของวันนั้น "ครั้งแรกครั้งเดียว" → ย้อนกลับได้เป๊ะเสมอ
 *    ปรับซ้ำหลายรอบไม่ทับ backup ไม่งั้น "ย้อนกลับ" จะคืนไปได้แค่รอบก่อนหน้า ไม่ใช่แผนจริงของวันนั้น
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bkkDayKey } from "@/lib/readinessStore";
import { patternsForSoreAreas, soreAreaLabel } from "@/lib/readiness";
import {
  adjustForSoreArea,
  estimateSessionMinutes,
  scaleToMinutes,
  type AdjustPlanItem,
  type ExerciseMeta,
  type MetaOf,
} from "@/lib/workoutAdjust";

const TIER_ORDER: Record<string, number> = { none: 0, home: 1, gym: 2 };

export interface ExercisePlanJson {
  title?: string;
  durationMin?: number;
  items?: AdjustPlanItem[];
  caloriesTarget?: number;
  /** ท่าชุดเดิมของวันนี้ ก่อนโดนปรับครั้งแรก (มี = ปรับไปแล้ว ย้อนกลับได้) */
  adjustBackup?: AdjustPlanItem[];
  /** เวลารวมเดิมของวันนั้น — ย้อนกลับต้องคืนเลขที่ user เคยเห็น ไม่ใช่เลขที่เราประมาณเอาเอง */
  adjustBackupMin?: number;
  /** สรุประดับวันว่าวันนี้ถูกปรับเพราะอะไร */
  adjustNote?: string;
  [k: string]: unknown;
}

/**
 * metadata ของท่า จากตาราง exercises
 * ผูกด้วย key ก่อน แล้ว fallback ที่ชื่อ (แอดมินเปลี่ยนชื่อได้ แต่แผนเก่าเก็บชื่อไว้ — กติกาเดียวกับ buildPatternOf)
 */
export async function buildMetaOf(items: AdjustPlanItem[]): Promise<MetaOf> {
  const keys = [...new Set(items.map((it) => String(it.key ?? "")).filter(Boolean))];
  const names = [...new Set(items.map((it) => String(it.name ?? "").trim()).filter(Boolean))];
  if (!keys.length && !names.length) return () => null;

  const rows = await prisma.exercise.findMany({
    where: { OR: [{ key: { in: keys } }, { name: { in: names } }] },
    select: { key: true, name: true, pattern: true, kind: true, unit: true, equipment: true, cue: true, difficulty: true },
  });

  const byKey = new Map<string, ExerciseMeta>();
  const byName = new Map<string, ExerciseMeta>();
  for (const r of rows) {
    const meta: ExerciseMeta = {
      key: r.key,
      name: r.name,
      pattern: r.pattern,
      kind: r.kind,
      unit: r.unit,
      equipment: r.equipment,
      cue: r.cue ?? undefined,
      difficulty: r.difficulty,
    };
    byKey.set(r.key, meta);
    if (!byName.has(r.name)) byName.set(r.name, meta);
  }

  return (item) => {
    const k = String(item?.key ?? "");
    if (k && byKey.has(k)) return byKey.get(k)!;
    const n = String(item?.name ?? "").trim();
    return (n ? byName.get(n) : null) ?? null;
  };
}

/** ท่าทั้งหมดที่คนนี้ทำได้จริงตามอุปกรณ์ที่มี (ท่าที่แอดมินปิดใช้งานไม่นับ) */
export async function poolForTier(tier: string | null | undefined): Promise<ExerciseMeta[]> {
  const max = TIER_ORDER[tier || "none"] ?? 0;
  const rows = await prisma.exercise.findMany({
    where: { isActive: true },
    select: { key: true, name: true, pattern: true, kind: true, unit: true, equipment: true, cue: true, difficulty: true },
    orderBy: [{ difficulty: "asc" }, { key: "asc" }],
  });
  return rows
    .filter((r) => (TIER_ORDER[r.equipment] ?? 0) <= max)
    .map((r) => ({
      key: r.key,
      name: r.name,
      pattern: r.pattern,
      kind: r.kind,
      unit: r.unit,
      equipment: r.equipment,
      cue: r.cue ?? undefined,
      difficulty: r.difficulty,
    }));
}

export type AdjustMode = "time" | "sore";

export interface AdjustRequest {
  mode: AdjustMode;
  /** mode=time: เหลือเวลากี่นาที */
  minutes?: number;
  /** mode=sore: ปวดตรงไหน (รับคำไทยหรือ key อังกฤษก็ได้) */
  area?: string;
  /** false = แค่ดูว่าจะเปลี่ยนอะไร ยังไม่บันทึก */
  apply?: boolean;
}

export interface AdjustOutcome {
  ok: boolean;
  applied: boolean;
  changed: boolean;
  message: string;
  items?: AdjustPlanItem[];
  beforeMin?: number;
  afterMin?: number;
  dropped?: string[];
  /** ตัดจนสุดแล้วยังเกินเวลาที่ขอ */
  shortfall?: boolean;
  canUndo?: boolean;
  status?: number;
}

/**
 * ปรับแผนของ "วันนี้" ตามสิ่งที่ผู้ใช้เพิ่งบอก
 * apply=false → คำนวณให้ดูอย่างเดียว (ใช้ตอนโค้ชเสนอก่อนให้ยืนยัน)
 */
export async function adjustTodayWorkout(
  memberId: string,
  equipmentTier: string | null | undefined,
  req: AdjustRequest,
  now: Date
): Promise<AdjustOutcome> {
  const dayKey = bkkDayKey(now);
  const plan = await prisma.dailyPlan.findUnique({
    where: { memberId_date: { memberId, date: dayKey } },
  });
  if (!plan) {
    return { ok: false, applied: false, changed: false, status: 404, message: "วันนี้ยังไม่มีแผนออกกำลังกายให้ปรับ" };
  }

  const ep = (plan.exercisePlan as ExercisePlanJson | null) ?? {};
  const items = Array.isArray(ep.items) ? ep.items : [];
  if (!items.length) {
    return { ok: false, applied: false, changed: false, status: 400, message: "วันนี้เป็นวันพัก ไม่มีท่าให้ปรับ" };
  }

  const metaOf = await buildMetaOf(items);
  let nextItems: AdjustPlanItem[];
  let changed: boolean;
  let message: string;
  let beforeMin: number | undefined;
  let afterMin: number | undefined;
  let dropped: string[] | undefined;
  let shortfall: boolean | undefined;

  if (req.mode === "time") {
    const target = Math.round(Number(req.minutes));
    if (!Number.isFinite(target) || target <= 0) {
      return { ok: false, applied: false, changed: false, status: 400, message: "บอกเวลาที่เหลือเป็นนาทีด้วยนะ" };
    }
    const r = scaleToMinutes(items, target, metaOf);
    nextItems = r.items;
    changed = r.changed;
    message = r.summary;
    beforeMin = r.beforeMin;
    afterMin = r.afterMin;
    dropped = r.dropped;
    shortfall = r.shortfall;
  } else {
    const raw = String(req.area ?? "").trim();
    const avoidPatterns = patternsForSoreAreas([raw]);
    if (!raw || !avoidPatterns.size) {
      return {
        ok: false,
        applied: false,
        changed: false,
        status: 400,
        message: "บอกจุดที่ปวดให้ชัดหน่อยนะ เช่น เข่า ไหล่ หลัง ข้อมือ",
      };
    }
    const pool = await poolForTier(equipmentTier);
    const r = adjustForSoreArea(items, soreAreaLabel(raw), { pool, avoidPatterns }, metaOf);
    nextItems = r.items;
    changed = r.changed;
    message = r.summary;
    beforeMin = estimateSessionMinutes(items);
    afterMin = estimateSessionMinutes(r.items);
  }

  const canUndoAfter = Array.isArray(ep.adjustBackup) || changed;

  if (!req.apply || !changed) {
    return {
      ok: true,
      applied: false,
      changed,
      message,
      items: nextItems,
      beforeMin,
      afterMin,
      dropped,
      shortfall,
      canUndo: Array.isArray(ep.adjustBackup),
    };
  }

  const nextEp: ExercisePlanJson = {
    ...ep,
    items: nextItems,
    // ครั้งแรกเท่านั้น — ปรับซ้ำต้องไม่ทับแผนจริงของวันนั้น
    adjustBackup: Array.isArray(ep.adjustBackup) ? ep.adjustBackup : items,
    adjustBackupMin: Array.isArray(ep.adjustBackup) ? ep.adjustBackupMin : ep.durationMin,
    adjustNote: message,
  };
  // การ์ดหน้าหลักโชว์ durationMin — ไม่อัปเดตแล้วจะขึ้น 45 นาทีทั้งที่เหลือ 20
  if (afterMin != null && afterMin > 0) nextEp.durationMin = afterMin;

  await prisma.dailyPlan.update({
    where: { id: plan.id },
    data: { exercisePlan: nextEp as unknown as Prisma.InputJsonValue },
  });

  return {
    ok: true,
    applied: true,
    changed: true,
    message,
    items: nextItems,
    beforeMin,
    afterMin,
    dropped,
    shortfall,
    canUndo: canUndoAfter,
  };
}

/** คืนแผนเดิมของวันนี้ (จาก adjustBackup) — คืนตรง ๆ ไม่ใช่คิดย้อนกลับ */
export async function undoTodayAdjust(memberId: string, now: Date): Promise<AdjustOutcome> {
  const dayKey = bkkDayKey(now);
  const plan = await prisma.dailyPlan.findUnique({
    where: { memberId_date: { memberId, date: dayKey } },
  });
  if (!plan) return { ok: false, applied: false, changed: false, status: 404, message: "วันนี้ยังไม่มีแผน" };

  const ep = (plan.exercisePlan as ExercisePlanJson | null) ?? {};
  if (!Array.isArray(ep.adjustBackup)) {
    return { ok: true, applied: false, changed: false, message: "วันนี้ยังไม่ได้ปรับอะไร ไม่มีอะไรให้ย้อน", canUndo: false };
  }

  const restored = ep.adjustBackup;
  const nextEp: ExercisePlanJson = {
    ...ep,
    items: restored,
    // คืนเลขเดิมที่ user เคยเห็น · ไม่มีเก็บไว้ (แผนที่ปรับก่อนมีฟิลด์นี้) ค่อยประมาณให้
    durationMin: Number(ep.adjustBackupMin) > 0 ? Number(ep.adjustBackupMin) : estimateSessionMinutes(restored),
  };
  delete nextEp.adjustBackup;
  delete nextEp.adjustBackupMin;
  delete nextEp.adjustNote;

  await prisma.dailyPlan.update({
    where: { id: plan.id },
    data: { exercisePlan: nextEp as unknown as Prisma.InputJsonValue },
  });

  return {
    ok: true,
    applied: true,
    changed: true,
    message: "คืนแผนเดิมของวันนี้ให้แล้ว",
    items: restored,
    afterMin: nextEp.durationMin,
    canUndo: false,
  };
}
