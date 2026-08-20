/**
 * ประกอบรายงานร่างกาย 4 สัปดาห์จากข้อมูลจริง + เรียก LLM เขียนย่อหน้า (WO-BP-3 §B5)
 *
 * ลำดับที่ห้ามสลับ: คิดตัวเลขให้เสร็จ → เขียน fallback ไว้ในมือ → ค่อยลอง LLM
 * ถ้า LLM ล่ม/ตอบผิดกติกา เรามีของส่งลูกค้าอยู่แล้ว ไม่ต้องตัดสินใจอะไรตอนนั้น
 */
import { prisma } from "@/lib/prisma";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { modelsFor, shouldFallback } from "@/lib/aiModels";
import { getSecret } from "@/lib/secrets/store";
import { EXERCISE_CATALOG } from "@/lib/exerciseCatalog";
import { readEstimate, gatherSignalInput } from "@/lib/bodySignalsStore";
import { buildBodyBundle } from "@/lib/bodyGoalStore";
import {
  buildReportUserPrompt,
  fallbackNarrative,
  narrativeLooksSane,
  REPORT_SYSTEM_PROMPT,
  type BodyReportStats,
  type ReportLift,
} from "@/lib/bodyReport";

const DAY_MS = 24 * 3600 * 1000;
export const REPORT_WINDOW_DAYS = 28;
/** ต้องมีอย่างน้อย 2 สแกนในช่วง ไม่งั้นไม่มี "ก่อน-หลัง" ให้เล่า */
export const MIN_SCANS_FOR_REPORT = 2;
/** ท่าที่เอาขึ้นรายงาน — มากกว่านี้กลายเป็นตารางที่ไม่มีใครอ่าน */
const MAX_LIFTS = 3;

const dayKey = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const r1 = (n: number) => Math.round(n * 10) / 10;

function epley(w: number | null, reps: number | null): number | null {
  if (!(typeof w === "number" && w > 0) || !(typeof reps === "number" && reps > 0 && reps <= 30)) return null;
  return w * (1 + reps / 30);
}

const exerciseName = (key: string): string => EXERCISE_CATALOG.find((e) => e.key === key)?.name ?? key;

export interface ReportBuild {
  stats: BodyReportStats;
  periodStart: Date;
  periodEnd: Date;
  /** พอจะออกรายงานไหม (สแกน ≥2 ในช่วง) */
  eligible: boolean;
}

/** ตัวเลขทั้งหมดของรายงาน — deterministic ล้วน ไม่มี LLM แตะตรงนี้ */
export async function gatherReportStats(memberId: string, now = new Date()): Promise<ReportBuild> {
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - (REPORT_WINDOW_DAYS - 1) * DAY_MS);
  const midpoint = now.getTime() - (REPORT_WINDOW_DAYS / 2) * DAY_MS;

  const [scans, weights, tapes, sets, mealDays, exDays, bundle, signalCtx] = await Promise.all([
    prisma.bodyScan.findMany({
      where: { memberId, date: { gte: periodStart } },
      orderBy: { date: "asc" },
      select: { date: true, estimates: true },
    }),
    prisma.weightLog.findMany({
      where: { memberId, date: { gte: periodStart } },
      orderBy: { date: "asc" },
      select: { date: true, weight: true },
    }),
    prisma.bodyMeasurement.findMany({
      where: { memberId, site: "waist", source: "tape", date: { gte: periodStart } },
      orderBy: { date: "asc" },
      select: { date: true, valueCm: true },
    }),
    prisma.setLog.findMany({
      where: { memberId, date: { gte: periodStart }, actualWeightKg: { not: null }, actualReps: { not: null } },
      orderBy: { date: "asc" },
      select: { exerciseKey: true, actualWeightKg: true, actualReps: true, date: true },
      take: 2000,
    }),
    prisma.mealLog.findMany({ where: { memberId, date: { gte: periodStart } }, select: { date: true } }),
    prisma.exerciseLog.findMany({ where: { memberId, date: { gte: periodStart } }, select: { date: true } }),
    buildBodyBundle(memberId, now),
    gatherSignalInput(memberId, now).catch(() => null),
  ]);

  // ── น้ำหนัก: เฉลี่ยรายวันก่อน แล้วเทียบวันแรกกับวันสุดท้าย (ชั่งวันละหลายครั้งไม่ควรถ่วงผล) ──
  const byDay = new Map<string, number[]>();
  for (const w of weights) {
    const k = dayKey(w.date);
    byDay.set(k, [...(byDay.get(k) ?? []), w.weight]);
  }
  const weightDays = [...byDay.entries()]
    .map(([k, v]) => ({ day: k, kg: avg(v) as number }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  const weight =
    weightDays.length >= 2
      ? {
          startKg: r1(weightDays[0].kg),
          endKg: r1(weightDays[weightDays.length - 1].kg),
          deltaKg: r1(weightDays[weightDays.length - 1].kg - weightDays[0].kg),
        }
      : null;

  // ── เอว: สายวัดจริงก่อน (ต้องมี 2 จุดขึ้นไปในช่วงเดียวกัน) ไม่มีค่อยใช้ค่าประมาณจากกล้อง ──
  const waistScans = scans
    .map((s) => ({ date: s.date, e: readEstimate(s.estimates, "waistCm") }))
    .filter((x): x is { date: Date; e: NonNullable<ReturnType<typeof readEstimate>> } => x.e !== null);
  let waist: BodyReportStats["waist"] = null;
  if (tapes.length >= 2) {
    const a = tapes[0], b = tapes[tapes.length - 1];
    waist = { startCm: r1(a.valueCm), endCm: r1(b.valueCm), deltaCm: r1(b.valueCm - a.valueCm), source: "tape" };
  } else if (waistScans.length >= 2) {
    const a = waistScans[0].e, b = waistScans[waistScans.length - 1].e;
    waist = { startCm: r1(a.mid), endCm: r1(b.mid), deltaCm: r1(b.mid - a.mid), source: "estimate" };
  }

  // ── % ไขมัน: ช่วงเสมอ (ตัววัดให้ค่าเป็นช่วง — ห้ามยุบเป็นจุดเดียวในรายงาน) ──
  const bfScans = scans
    .map((s) => readEstimate(s.estimates, "bfPct"))
    .filter((e): e is NonNullable<typeof e> => e !== null);
  const bf =
    bfScans.length >= 2
      ? {
          startLo: r1(bfScans[0].lo),
          startHi: r1(bfScans[0].hi),
          endLo: r1(bfScans[bfScans.length - 1].lo),
          endHi: r1(bfScans[bfScans.length - 1].hi),
          deltaMid: r1(bfScans[bfScans.length - 1].mid - bfScans[0].mid),
        }
      : null;

  // ── แรง: e1RM เฉลี่ยครึ่งแรก vs ครึ่งหลัง ของท่าที่บันทึกบ่อยที่สุด ──
  const byKey = new Map<string, Array<{ t: number; v: number }>>();
  for (const s of sets) {
    const e = epley(s.actualWeightKg, s.actualReps);
    if (e === null) continue;
    byKey.set(s.exerciseKey, [...(byKey.get(s.exerciseKey) ?? []), { t: s.date.getTime(), v: e }]);
  }
  const lifts: ReportLift[] = [...byKey.entries()]
    .map(([key, list]) => {
      const first = avg(list.filter((p) => p.t < midpoint).map((p) => p.v));
      const second = avg(list.filter((p) => p.t >= midpoint).map((p) => p.v));
      if (first === null || second === null) return null;
      return {
        exerciseKey: key,
        name: exerciseName(key),
        startKg: r1(first),
        endKg: r1(second),
        deltaKg: r1(second - first),
        _n: list.length,
      };
    })
    .filter((x): x is ReportLift & { _n: number } => x !== null)
    .sort((a, b) => b._n - a._n)
    .slice(0, MAX_LIFTS)
    .map((l): ReportLift => ({
      exerciseKey: l.exerciseKey,
      name: l.name,
      startKg: l.startKg,
      endKg: l.endKg,
      deltaKg: l.deltaKg,
    }));

  const stats: BodyReportStats = {
    periodStart: dayKey(periodStart),
    periodEnd: dayKey(periodEnd),
    weight,
    waist,
    bf,
    lifts,
    counts: {
      scans: scans.length,
      workoutDays: new Set(exDays.map((e) => dayKey(e.date))).size,
      foodLogDays: new Set(mealDays.map((m) => dayKey(m.date))).size,
      weighDays: weightDays.length,
    },
    signals: (signalCtx?.signals ?? []).map((s) => ({ key: s.key, message: s.message })),
    goal: bundle.goal
      ? {
          label: bundle.goal.label,
          pctDone: bundle.goal.progress.overall.pctDone,
          onTrack: bundle.goal.progress.overall.onTrack,
          weeksLeft: bundle.goal.progress.overall.weeksLeft,
        }
      : null,
    score: bundle.score
      ? {
          score: bundle.score.score,
          consistency: bundle.score.parts.consistency,
          direction: bundle.score.parts.direction,
          data: bundle.score.parts.data,
        }
      : null,
  };

  return { stats, periodStart, periodEnd, eligible: scans.length >= MIN_SCANS_FOR_REPORT };
}

export interface NarrativeResult {
  narrative: string;
  source: "llm" | "fallback";
  reason?: string;
}

/**
 * ย่อหน้าของรายงาน — LLM 1 call ต่อคนต่อเดือน (ชั้นสำรองของ aiModels ถ้าชั้นแรกล้ม)
 * ผลที่ตรวจไม่ผ่าน narrativeLooksSane ถือว่าใช้ไม่ได้ = ตกไป fallback (เลขที่โมเดลแต่งเองอันตรายกว่าย่อหน้าจืด)
 */
export async function writeNarrative(stats: BodyReportStats): Promise<NarrativeResult> {
  const safe = fallbackNarrative(stats);
  const apiKey = await getSecret("OPENAI_API_KEY").catch(() => null);
  if (!apiKey) return { narrative: safe, source: "fallback", reason: "no-api-key" };

  const { primary, fallback } = await modelsFor("chat").catch(() => ({ primary: "gpt-4o-mini", fallback: "gpt-4o-mini" }));
  const openai = buildOpenAI(apiKey);
  const userPrompt = buildReportUserPrompt(stats);

  const ask = async (model: string): Promise<string> => {
    const resp = await openai.chat.completions.create({
      model: aiModel(apiKey, model),
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      // ต่ำ = เล่าตามตัวเลข ไม่ใช่แต่งเรื่อง
      temperature: 0.4,
      max_tokens: 500,
    });
    return String(resp.choices[0]?.message?.content ?? "").trim();
  };

  for (const [i, model] of [primary, fallback].entries()) {
    if (i === 1 && fallback === primary) break;
    try {
      const text = await ask(model);
      if (narrativeLooksSane(text, stats)) return { narrative: text, source: "llm" };
      console.warn(`[bodyReport] ย่อหน้าจาก ${model} ไม่ผ่านด่านตรวจตัวเลข — ใช้ฉบับ deterministic แทน`);
      if (i === 1 || fallback === primary) return { narrative: safe, source: "fallback", reason: "failed-check" };
    } catch (e) {
      console.error(`[bodyReport] เรียก ${model} ไม่สำเร็จ:`, e);
      if (!shouldFallback(e) || i === 1) return { narrative: safe, source: "fallback", reason: "llm-error" };
    }
  }
  return { narrative: safe, source: "fallback", reason: "llm-error" };
}

export interface BuildReportOutcome {
  status: "created" | "already" | "not-eligible";
  reportId?: string;
  source?: "llm" | "fallback";
  stats?: BodyReportStats;
}

/**
 * สร้างรายงาน 1 ฉบับ (ใช้ทั้งจาก cron และการยิงมือตอนทดสอบ)
 * dedup ด้วย periodEnd วันเดียวกัน — ยิง cron ซ้ำในวันเดียวต้องไม่ได้รายงานสองใบ
 */
export async function buildAndSaveReport(memberId: string, now = new Date()): Promise<BuildReportOutcome> {
  const built = await gatherReportStats(memberId, now);
  if (!built.eligible) return { status: "not-eligible" };

  const endKey = new Date(`${built.stats.periodEnd}T00:00:00.000Z`);
  const existing = await prisma.bodyReport.findUnique({
    where: { memberId_periodEnd: { memberId, periodEnd: endKey } },
    select: { id: true },
  });
  if (existing) return { status: "already", reportId: existing.id };

  const { narrative, source } = await writeNarrative(built.stats);
  const row = await prisma.bodyReport.create({
    data: {
      memberId,
      periodStart: new Date(`${built.stats.periodStart}T00:00:00.000Z`),
      periodEnd: endKey,
      stats: built.stats as unknown as object,
      narrative,
      source,
    },
    select: { id: true },
  });

  return { status: "created", reportId: row.id, source, stats: built.stats };
}
