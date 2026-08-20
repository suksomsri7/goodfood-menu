/**
 * ประกอบ input จริงให้ตารางสัญญาณ (WO-BP-3 §B3 ท้ายหัวข้อ)
 *
 * ไฟล์นี้คือชั้นเดียวที่แตะ DB — ตัวตัดสินใจทั้งหมดอยู่ใน bodySignals.ts ที่เทสได้โดยไม่ต้องมีข้อมูลจริง
 *
 * 🔴 กติกาเดียวที่ต้องท่องไว้: คิดไม่ได้ = null ห้ามเดา
 *    ค่า default ที่ดู "ปลอดภัย" (เช่น trend = flat เมื่อไม่มีสแกน) จะไปจุดชนวนแถว check_adherence
 *    แล้วโค้ชจะไปถามลูกค้าเรื่องบันทึกอาหารทั้งที่ระบบไม่เคยเห็นเอวเขาเลย
 *
 * วิธีคิดเทรนด์ 28 วัน: เฉลี่ยครึ่งแรก (วันที่ 1-14) เทียบเฉลี่ยครึ่งหลัง (15-28) แล้วผ่าน trendLabel
 * — ค่าเฉลี่ยของครึ่งช่วงทนต่อวันที่วัดเพี้ยนหนึ่งวันได้ดีกว่าการหยิบจุดแรก-จุดสุดท้ายมาลบกัน
 */
import { prisma } from "@/lib/prisma";
import { trendLabel, TREND_FLOOR_CM, type Estimate } from "@/lib/bodyMeasure";
import { estimateEnergy } from "@/lib/energyModel";
import { computeBodySignals, type BodySignal, type BodySignalInput, type BodyTrend } from "@/lib/bodySignals";

const DAY_MS = 24 * 3600 * 1000;
/** หน้าต่างของทุกสัญญาณในระบบนี้ = 4 สัปดาห์ (ตรงกับรายงานและตาราง §7) */
export const SIGNAL_WINDOW_DAYS = 28;
/**
 * พื้นสัญญาณรบกวนของ e1RM คิดเป็นสัดส่วน (2.5%)
 * แรงคนแกว่งตามการนอน/ความเครียดได้ระดับนี้อยู่แล้ว และ e1RM เป็นค่าประมาณจากสูตร Epley
 * ใช้เปอร์เซ็นต์ไม่ใช่กิโลกรัม เพราะ 2.5 กก. บนเบนช์ 40 กก. กับบนสควอท 120 กก. คนละความหมายกัน
 */
export const E1RM_TREND_FLOOR_PCT = 0.025;
/** เทียบน้ำหนักตัวจากค่าเฉลี่ยครึ่งช่วง → จุดกึ่งกลางห่างกัน 2 สัปดาห์ */
const HALF_GAP_WEEKS = 2;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** อ่าน Estimate จากก้อน Json ของ BodyScan แบบไม่เชื่ออะไรเลย (แถวยุค BP-1 เป็น {}) */
export function readEstimate(estimates: unknown, key: string): Estimate | null {
  if (!estimates || typeof estimates !== "object") return null;
  const v = (estimates as Record<string, unknown>)[key];
  if (!v || typeof v !== "object") return null;
  const e = v as Partial<Estimate>;
  if (!isNum(e.lo) || !isNum(e.mid) || !isNum(e.hi)) return null;
  return {
    lo: e.lo,
    mid: e.mid,
    hi: e.hi,
    conf: e.conf === "high" || e.conf === "med" ? e.conf : "low",
    method: (e.method ?? "2view") as Estimate["method"],
    ...(e.calibrated ? { calibrated: true } : {}),
  };
}

/** posture flags จากก้อน estimates (ไม่มี = null ไม่ใช่ false) */
function readPosture(estimates: unknown): { headForward: boolean | null; shoulderTilt: boolean | null } {
  const p =
    estimates && typeof estimates === "object"
      ? ((estimates as Record<string, unknown>).posture as Record<string, unknown> | undefined)
      : undefined;
  return {
    headForward: typeof p?.headForward === "boolean" ? p.headForward : null,
    shoulderTilt: typeof p?.shoulderTilt === "boolean" ? p.shoulderTilt : null,
  };
}

function readSymmetry(estimates: unknown): { thighDiffCm: number | null; calfDiffCm: number | null } {
  const s =
    estimates && typeof estimates === "object"
      ? ((estimates as Record<string, unknown>).symmetry as Record<string, unknown> | undefined)
      : undefined;
  return {
    thighDiffCm: isNum(s?.thighDiffCm) ? (s!.thighDiffCm as number) : null,
    calfDiffCm: isNum(s?.calfDiffCm) ? (s!.calfDiffCm as number) : null,
  };
}

/** ความต่างซ้าย-ขวาของสแกนนี้ "เชื่อได้" ไหม — ต้องมั่นใจสูงทั้งสองข้าง */
function diffConfHigh(estimates: unknown): boolean {
  const pairs: Array<[string, string]> = [
    ["thighLCm", "thighRCm"],
    ["calfLCm", "calfRCm"],
  ];
  return pairs.some(([l, r]) => {
    const a = readEstimate(estimates, l);
    const b = readEstimate(estimates, r);
    return a?.conf === "high" && b?.conf === "high";
  });
}

/** e1RM แบบ Epley จากเซ็ตเดียว — ท่าที่ไม่มีน้ำหนัก/ครั้ง คิดไม่ได้ */
function epley(weightKg: number | null, reps: number | null): number | null {
  if (!isNum(weightKg) || weightKg <= 0 || !isNum(reps) || reps <= 0 || reps > 30) return null;
  return weightKg * (1 + reps / 30);
}

/** เฉลี่ยครึ่งแรก/ครึ่งหลังของหน้าต่าง แล้วตีป้ายด้วย floor ที่ส่งมา */
function halfTrend(
  points: Array<{ t: number; v: number }>,
  midpoint: number,
  floor: number | ((first: number) => number)
): BodyTrend | null {
  const first = avg(points.filter((p) => p.t < midpoint).map((p) => p.v));
  const second = avg(points.filter((p) => p.t >= midpoint).map((p) => p.v));
  if (first === null || second === null) return null;
  const f = typeof floor === "function" ? floor(first) : floor;
  return trendLabel(first, second, f);
}

export interface SignalContext {
  input: BodySignalInput;
  signals: BodySignal[];
  /** ตัวเลขดิบที่ใช้ตัดสิน — ให้รายงาน/หน้าจออธิบายที่มาได้โดยไม่ต้องคิดซ้ำ */
  raw: {
    scanCount: number;
    waistFirstHalf: number | null;
    waistSecondHalf: number | null;
    e1rmRelDelta: number | null;
    weightFirstHalf: number | null;
    weightSecondHalf: number | null;
    targetCalories: number | null;
    tdee: number | null;
  };
}

/**
 * ประกอบ input ของตาราง §7 จากข้อมูลจริง 28 วัน
 * ล้มที่จุดไหน = ช่องนั้นเป็น null (ไม่ throw) — ระบบสัญญาณห้ามทำให้แผน/โค้ชล่มทั้งเส้น
 */
export async function gatherSignalInput(memberId: string, now = new Date()): Promise<SignalContext> {
  const since = new Date(now.getTime() - SIGNAL_WINDOW_DAYS * DAY_MS);
  const midpoint = now.getTime() - (SIGNAL_WINDOW_DAYS / 2) * DAY_MS;

  const [scans, weights, sets, member] = await Promise.all([
    prisma.bodyScan.findMany({
      where: { memberId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, estimates: true },
    }),
    prisma.weightLog.findMany({
      where: { memberId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    }),
    prisma.setLog.findMany({
      where: { memberId, date: { gte: since }, actualWeightKg: { not: null }, actualReps: { not: null } },
      orderBy: { date: "asc" },
      select: { exerciseKey: true, actualWeightKg: true, actualReps: true, date: true },
      take: 2000,
    }),
    prisma.member.findUnique({ where: { id: memberId }, select: { dailyCalories: true } }),
  ]);

  // ── เอว: สายวัดจริงชนะค่าประมาณ แต่ในหน้าต่างเดียวกันต้องเทียบของชนิดเดียวกัน จึงใช้ค่าประมาณเป็นเส้นหลัก ──
  const waistPoints = scans
    .map((s) => ({ t: s.date.getTime(), e: readEstimate(s.estimates, "waistCm") }))
    .filter((p): p is { t: number; e: Estimate } => p.e !== null)
    .map((p) => ({ t: p.t, v: p.e.mid }));
  const waistTrend4w = halfTrend(waistPoints, midpoint, TREND_FLOOR_CM);

  // ── แรง: e1RM ต่อท่า เทียบครึ่งแรก/ครึ่งหลัง แล้วเฉลี่ย "การเปลี่ยนแปลงเชิงสัดส่วน" ข้ามท่า ──
  const byKey = new Map<string, Array<{ t: number; v: number }>>();
  for (const s of sets) {
    const e = epley(s.actualWeightKg, s.actualReps);
    if (e === null) continue;
    const list = byKey.get(s.exerciseKey) ?? [];
    list.push({ t: s.date.getTime(), v: e });
    byKey.set(s.exerciseKey, list);
  }
  const rels: number[] = [];
  for (const list of byKey.values()) {
    const first = avg(list.filter((p) => p.t < midpoint).map((p) => p.v));
    const second = avg(list.filter((p) => p.t >= midpoint).map((p) => p.v));
    if (first === null || second === null || first <= 0) continue;
    rels.push((second - first) / first);
  }
  const e1rmRelDelta = avg(rels);
  const e1rmTrend4w: BodyTrend | null =
    e1rmRelDelta === null
      ? null
      : Math.abs(e1rmRelDelta) < E1RM_TREND_FLOOR_PCT
        ? "flat"
        : e1rmRelDelta > 0
          ? "up"
          : "down";

  // ── น้ำหนัก: %/สัปดาห์ จากค่าเฉลี่ยครึ่งช่วง (จุดกึ่งกลางห่างกัน 2 สัปดาห์) ──
  const weightPoints = weights.map((w) => ({ t: w.date.getTime(), v: w.weight }));
  const wFirst = avg(weightPoints.filter((p) => p.t < midpoint).map((p) => p.v));
  const wSecond = avg(weightPoints.filter((p) => p.t >= midpoint).map((p) => p.v));
  const weightRatePctPerWk =
    wFirst !== null && wSecond !== null && wFirst > 0
      ? ((wSecond - wFirst) / wFirst) * 100 / HALF_GAP_WEEKS
      : null;

  // ── ขาดพลังงานจริงไหม: เทียบเป้าแคลอรี่กับพลังงานที่วัด/เรียนได้ · ไม่มีค่าที่วัดได้ = null ──
  let inDeficit: boolean | null = null;
  let tdee: number | null = null;
  const targetCalories = isNum(member?.dailyCalories) ? (member!.dailyCalories as number) : null;
  try {
    const est = await estimateEnergy(memberId);
    if (est && isNum(est.tdee)) {
      tdee = Math.round(est.tdee);
      if (targetCalories !== null) inDeficit = targetCalories < est.tdee - 50;
    }
  } catch {
    inDeficit = null; // พลังงานคิดไม่ได้ = ไม่รู้ ไม่ใช่ "ไม่ขาด"
  }

  // ── สมมาตร + posture: ใช้ 2 สแกนล่าสุด (สแกนเดียวยังเป็นเรื่องท่ายืน/แสงได้) ──
  const last2 = scans.slice(-2);
  const latest = last2[last2.length - 1];
  const prev = last2.length === 2 ? last2[0] : null;
  const sym = latest ? readSymmetry(latest.estimates) : { thighDiffCm: null, calfDiffCm: null };
  const diffConfHigh2x = !!latest && !!prev && diffConfHigh(latest.estimates) && diffConfHigh(prev.estimates);
  const pLatest = latest ? readPosture(latest.estimates) : { headForward: null, shoulderTilt: null };
  const pPrev = prev ? readPosture(prev.estimates) : { headForward: null, shoulderTilt: null };

  const input: BodySignalInput = {
    waistTrend4w,
    e1rmTrend4w,
    weightRatePctPerWk,
    inDeficit,
    thighDiffCm: sym.thighDiffCm,
    calfDiffCm: sym.calfDiffCm,
    diffConfHigh2x,
    postureFlag2x: {
      headForward: pLatest.headForward === true && pPrev.headForward === true,
      shoulderTilt: pLatest.shoulderTilt === true && pPrev.shoulderTilt === true,
    },
  };

  return {
    input,
    signals: computeBodySignals(input),
    raw: {
      scanCount: scans.length,
      waistFirstHalf: avg(waistPoints.filter((p) => p.t < midpoint).map((p) => p.v)),
      waistSecondHalf: avg(waistPoints.filter((p) => p.t >= midpoint).map((p) => p.v)),
      e1rmRelDelta,
      weightFirstHalf: wFirst,
      weightSecondHalf: wSecond,
      targetCalories,
      tdee,
    },
  };
}

/** เวอร์ชันที่ล้มแล้วเงียบ — จุดที่เรียกจาก Generator/weeklyAdjust ต้องเดินต่อได้เสมอ */
export async function gatherSignalsSafe(memberId: string): Promise<BodySignal[]> {
  try {
    const ctx = await gatherSignalInput(memberId);
    return ctx.signals;
  } catch (e) {
    console.error("[bodySignals] gatherSignalsSafe ล้ม — เดินต่อแบบไม่มีสัญญาณ:", e);
    return [];
  }
}
