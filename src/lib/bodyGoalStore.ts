/**
 * ชั้นข้อมูลของเป้าหมายรูปร่าง (WO-BP-3 §B4) — ประกอบของจริงป้อนเอนจิน pure ใน bodyGoal.ts
 *
 * 🔴 ค่าตั้งต้นของเป้า (start) ไม่ได้เก็บเป็นคอลัมน์
 *    schema ของ BodyGoal (BP-1) มีแค่ startScanId + startedAt ตามที่ WO กำหนดว่าห้ามขยาย
 *    เราจึง "คิดย้อน" จากข้อมูล ณ วันที่ตั้งเป้าทุกครั้งที่อ่าน (สแกนตั้งต้น + ชั่ง/สายวัดที่ใกล้ startedAt ที่สุด)
 *    ข้อดีที่ตามมา: ถ้าภายหลังสูตร BP-2 แม่นขึ้นแล้ว remeasure สแกนเก่า จุดตั้งต้นจะแม่นขึ้นตามไปด้วย
 *    ข้อควรระวัง: ผู้ใช้ที่ตั้งเป้าโดยไม่เคยชั่ง/สแกนเลย จะไม่มี start ของเป้านั้น → เป้านั้นถูกข้ามใน progress
 *    (ถูกต้องกว่าการเดาค่าให้เขาแล้วโชว์ความคืบหน้าปลอม)
 */
import { prisma } from "@/lib/prisma";
import type { Estimate } from "@/lib/bodyMeasure";
import { gatherSignalInput, readEstimate } from "@/lib/bodySignalsStore";
import {
  goalProgress,
  milestones,
  type BodyCurrent,
  type GoalProgressResult,
  type GoalStart,
} from "@/lib/bodyGoal";
import { computeBodyScore, type BodyScoreResult, type ScoreOnTrack } from "@/lib/bodyScore";

const DAY_MS = 24 * 3600 * 1000;
/** ค่าที่ห่างจากวันตั้งเป้าเกินนี้ ไม่ใช่ "ค่าตอนตั้งเป้า" อีกต่อไป */
export const START_WINDOW_DAYS = 14;
/** หน้าต่างของ Body Score = 4 สัปดาห์ (ชุดเดียวกับสัญญาณ/รายงาน) */
export const SCORE_WINDOW_DAYS = 28;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const dayKey = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export interface CurrentSnapshot {
  weightKg: number | null;
  waist: Estimate | null;
  bfPct: Estimate | null;
  tapeWaistCm: number | null;
  latestScanId: string | null;
  latestScanDate: Date | null;
}

/** ค่าล่าสุดของร่างกาย — เอวใช้สายวัดจริงก่อนเสมอ (ตัดสินที่ bodyGoal.goalProgress) */
export async function currentSnapshot(memberId: string): Promise<CurrentSnapshot> {
  const [scan, weight, tape] = await Promise.all([
    prisma.bodyScan.findFirst({
      where: { memberId },
      orderBy: { date: "desc" },
      select: { id: true, date: true, estimates: true },
    }),
    prisma.weightLog.findFirst({ where: { memberId }, orderBy: { date: "desc" }, select: { weight: true } }),
    prisma.bodyMeasurement.findFirst({
      where: { memberId, site: "waist", source: "tape" },
      orderBy: { date: "desc" },
      select: { valueCm: true },
    }),
  ]);
  return {
    weightKg: isNum(weight?.weight) ? (weight!.weight as number) : null,
    waist: scan ? readEstimate(scan.estimates, "waistCm") : null,
    bfPct: scan ? readEstimate(scan.estimates, "bfPct") : null,
    tapeWaistCm: isNum(tape?.valueCm) ? (tape!.valueCm as number) : null,
    latestScanId: scan?.id ?? null,
    latestScanDate: scan?.date ?? null,
  };
}

/** แปลง snapshot เป็นตัวเลขล้วนสำหรับ suggestWeeks/validateGoal */
export function toCurrentNumbers(s: CurrentSnapshot): BodyCurrent {
  return {
    weightKg: s.weightKg,
    waistCm: s.tapeWaistCm ?? s.waist?.mid ?? null,
    bfMid: s.bfPct?.mid ?? null,
  };
}

export interface GoalRow {
  id: string;
  label: string;
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetBfLo: number | null;
  targetBfHi: number | null;
  startScanId: string | null;
  startedAt: Date;
  targetWeeks: number | null;
  status: string;
}

/**
 * ค่าตั้งต้น ณ วันที่ตั้งเป้า — สแกนตั้งต้นก่อน แล้วค่อยไล่หาค่าที่ใกล้ startedAt ที่สุดใน ±14 วัน
 * ไม่มีข้อมูลในหน้าต่างนั้น = null (เป้านั้นจะไม่มีแถบความคืบหน้า ซึ่งซื่อสัตย์กว่าการเดา)
 */
export async function resolveGoalStart(goal: GoalRow, memberId: string): Promise<GoalStart> {
  const t0 = goal.startedAt.getTime();
  const lo = new Date(t0 - START_WINDOW_DAYS * DAY_MS);
  const hi = new Date(t0 + START_WINDOW_DAYS * DAY_MS);

  const [startScan, nearScans, nearWeights, nearTapes] = await Promise.all([
    goal.startScanId
      ? prisma.bodyScan.findFirst({
          where: { id: goal.startScanId, memberId },
          select: { estimates: true, date: true },
        })
      : Promise.resolve(null),
    prisma.bodyScan.findMany({
      where: { memberId, date: { gte: lo, lte: hi } },
      select: { date: true, estimates: true },
    }),
    prisma.weightLog.findMany({
      where: { memberId, date: { gte: lo, lte: hi } },
      select: { date: true, weight: true },
    }),
    prisma.bodyMeasurement.findMany({
      where: { memberId, site: "waist", source: "tape", date: { gte: lo, lte: hi } },
      select: { date: true, valueCm: true },
    }),
  ]);

  const nearest = <T extends { date: Date }>(rows: T[]): T | null =>
    rows.length
      ? rows.reduce((best, r) =>
          Math.abs(r.date.getTime() - t0) < Math.abs(best.date.getTime() - t0) ? r : best
        )
      : null;

  const scanForStart = startScan ?? nearest(nearScans);
  const waistEst = scanForStart ? readEstimate(scanForStart.estimates, "waistCm") : null;
  const bfEst = scanForStart ? readEstimate(scanForStart.estimates, "bfPct") : null;
  const tape = nearest(nearTapes);
  const weight = nearest(nearWeights);

  return {
    weightKg: weight ? weight.weight : null,
    // สายวัดจริงชนะค่าประมาณตรงนี้ด้วย — ไม่งั้นจุดตั้งต้นกับจุดปัจจุบันจะมาจากคนละเครื่องมือ
    waistCm: tape ? tape.valueCm : (waistEst?.mid ?? null),
    bfMid: bfEst?.mid ?? null,
  };
}

export async function activeGoal(memberId: string): Promise<GoalRow | null> {
  return prisma.bodyGoal.findFirst({
    where: { memberId, status: "active" },
    orderBy: { startedAt: "desc" },
  });
}

/** สัปดาห์ที่ผ่านไปตั้งแต่ตั้งเป้า (ทศนิยม — เส้นคาดหวังจะได้ไม่กระโดดทีละสัปดาห์) */
export function weeksSince(from: Date, now = new Date()): number {
  return Math.max(0, (now.getTime() - from.getTime()) / (7 * DAY_MS));
}

export interface ScoreFacts {
  scanDates: string[];
  weighDays: number;
  scanCount: number;
  hasHeight: boolean;
  hasTapeCalib: boolean;
  hasDeviceLink: boolean;
}

/** ข้อเท็จจริงที่ Body Score ต้องใช้ (28 วันล่าสุด) */
export async function scoreFacts(memberId: string, now = new Date()): Promise<ScoreFacts> {
  const since = new Date(now.getTime() - SCORE_WINDOW_DAYS * DAY_MS);
  const [scans, weights, member, tapeCount, deviceRow] = await Promise.all([
    prisma.bodyScan.findMany({ where: { memberId, date: { gte: since } }, select: { date: true } }),
    prisma.weightLog.findMany({ where: { memberId, date: { gte: since } }, select: { date: true } }),
    prisma.member.findUnique({ where: { id: memberId }, select: { height: true } }),
    prisma.bodyMeasurement.count({ where: { memberId, source: "tape" } }),
    // "เชื่อมนาฬิกา/เครื่องชั่ง" = มีข้อมูลที่มีแต่อุปกรณ์เท่านั้นที่ให้ได้ (ไม่ใช่แค่ติดตั้งแอป)
    prisma.dailyMetric.findFirst({
      where: {
        memberId,
        date: { gte: since },
        OR: [
          { bodyFatPct: { not: null } },
          { leanMassKg: { not: null } },
          { standHours: { not: null } },
          { restingHR: { not: null } },
        ],
      },
      select: { id: true },
    }),
  ]);

  return {
    scanDates: scans.map((s) => dayKey(s.date)),
    weighDays: new Set(weights.map((w) => dayKey(w.date))).size,
    scanCount: scans.length,
    hasHeight: isNum(member?.height) && (member!.height as number) > 0,
    hasTapeCalib: tapeCount > 0,
    hasDeviceLink: !!deviceRow,
  };
}

export interface BodyBundle {
  goal:
    | (GoalRow & {
        start: GoalStart;
        progress: GoalProgressResult;
        milestones: string[];
      })
    | null;
  score: BodyScoreResult | null;
  snapshot: CurrentSnapshot;
}

/**
 * ก้อนเดียวที่จอ Body ใช้ทั้งหน้า (เป้า + ความคืบหน้า + คะแนน + หมุด)
 * ไม่มีเป้า = ยังคืนคะแนนและ snapshot ตามปกติ — หน้าจอต้องใช้ได้ก่อนที่ user จะตั้งเป้า
 */
export async function buildBodyBundle(memberId: string, now = new Date()): Promise<BodyBundle> {
  const [goal, snapshot, facts] = await Promise.all([
    activeGoal(memberId),
    currentSnapshot(memberId),
    scoreFacts(memberId, now),
  ]);

  let goalBlock: BodyBundle["goal"] = null;
  let onTrack: ScoreOnTrack[] | null = null;

  if (goal) {
    const start = await resolveGoalStart(goal, memberId);
    const progress = goalProgress(
      {
        targetWeightKg: goal.targetWeightKg,
        targetWaistCm: goal.targetWaistCm,
        targetBfLo: goal.targetBfLo,
        targetBfHi: goal.targetBfHi,
        targetWeeks: goal.targetWeeks,
        start,
      },
      {
        weightKg: snapshot.weightKg,
        waist: snapshot.waist,
        bfPct: snapshot.bfPct,
        tapeWaistCm: snapshot.tapeWaistCm,
      },
      weeksSince(goal.startedAt, now)
    );
    goalBlock = { ...goal, start, progress, milestones: milestones(progress.perGoal) };
    onTrack = progress.perGoal.length ? progress.perGoal.map((g) => g.onTrack) : null;
  }

  const score = computeBodyScore({
    scanDates: facts.scanDates,
    last28d: { weighDays: facts.weighDays, scanCount: facts.scanCount },
    hasHeight: facts.hasHeight,
    hasTapeCalib: facts.hasTapeCalib,
    hasDeviceLink: facts.hasDeviceLink,
    goalOnTrack: onTrack,
    asOf: dayKey(now),
  });

  return { goal: goalBlock, score, snapshot };
}

// ────────────────────────────────────────────────────────────────
// ก้อนที่ป้อนให้ Coach AI (WO-BP-3 §B6)
// ────────────────────────────────────────────────────────────────

export interface BodyContextBlock {
  /** ค่าประมาณเป็นช่วงเสมอ + บอกที่มา เพื่อให้โค้ชพูดว่า "ประมาณ" ไม่ใช่ "คือ" */
  waistCm?: { lo: number; hi: number; conf: string; source: "tape" | "estimate" };
  bfPct?: { lo: number; hi: number; conf: string };
  weightKg?: number;
  lastScanDaysAgo?: number;
  goal?: {
    label: string;
    pctDone: number;
    onTrack: string | null;
    weeksLeft: number | null;
    perGoal: Array<{ key: string; now: number; target: number; pctDone: number; onTrack: string }>;
  };
  scoreOf100?: number;
  signals?: Array<{ key: string; message: string }>;
  milestones?: string[];
}

/**
 * บริบทร่างกายสำหรับโค้ช — ตัวเลขล้วน ไม่มี path รูปเด็ดขาด (รูปร่างกายห้ามออกจากเส้นทางที่ authed)
 *
 * ไม่มีสแกนเลย = คืน null แล้วผู้เรียกไม่ใส่ key นี้ทั้งก้อน
 * (ประหยัด token ทุกข้อความ + ไม่ให้โค้ชพูดเรื่องรูปร่างกับคนที่ไม่เคยสแกน)
 * 🔴 เช็คสแกนล่าสุดด้วย query เดียวก่อนเสมอ — คนส่วนใหญ่ยังไม่ใช้ฟีเจอร์นี้ ต้องไม่จ่ายค่า query ชุดใหญ่ทุกครั้งที่แชท
 */
export async function buildBodyContextSafe(memberId: string, now = new Date()): Promise<BodyContextBlock | null> {
  try {
    const latest = await prisma.bodyScan.findFirst({
      where: { memberId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!latest) return null;

    const [bundle, signalCtx] = await Promise.all([
      buildBodyBundle(memberId, now),
      gatherSignalInput(memberId, now).catch(() => null),
    ]);

    const out: BodyContextBlock = {
      lastScanDaysAgo: Math.max(0, Math.round((now.getTime() - latest.date.getTime()) / DAY_MS)),
    };
    if (bundle.snapshot.tapeWaistCm != null) {
      out.waistCm = {
        lo: bundle.snapshot.tapeWaistCm,
        hi: bundle.snapshot.tapeWaistCm,
        conf: "tape",
        source: "tape",
      };
    } else if (bundle.snapshot.waist) {
      out.waistCm = {
        lo: bundle.snapshot.waist.lo,
        hi: bundle.snapshot.waist.hi,
        conf: bundle.snapshot.waist.conf,
        source: "estimate",
      };
    }
    if (bundle.snapshot.bfPct) {
      out.bfPct = { lo: bundle.snapshot.bfPct.lo, hi: bundle.snapshot.bfPct.hi, conf: bundle.snapshot.bfPct.conf };
    }
    if (bundle.snapshot.weightKg != null) out.weightKg = bundle.snapshot.weightKg;
    if (bundle.score) out.scoreOf100 = bundle.score.score;
    if (bundle.goal) {
      out.goal = {
        label: bundle.goal.label,
        pctDone: bundle.goal.progress.overall.pctDone,
        onTrack: bundle.goal.progress.overall.onTrack,
        weeksLeft: bundle.goal.progress.overall.weeksLeft,
        perGoal: bundle.goal.progress.perGoal.map((g) => ({
          key: g.key,
          now: g.now,
          target: g.target,
          pctDone: g.pctDone,
          onTrack: g.onTrack,
        })),
      };
      if (bundle.goal.milestones.length) out.milestones = bundle.goal.milestones;
    }
    if (signalCtx?.signals.length) {
      out.signals = signalCtx.signals.map((s) => ({ key: s.key, message: s.message }));
    }
    return out;
  } catch (e) {
    console.error("[bodyGoalStore] buildBodyContextSafe ล้ม — โค้ชคุยต่อโดยไม่มีก้อนร่างกาย:", e);
    return null;
  }
}
