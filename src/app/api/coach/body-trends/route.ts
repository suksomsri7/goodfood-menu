import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { bkkDayKey } from "@/lib/readinessStore";
import {
  trendLabel,
  SITE_LABELS_TH,
  TREND_FLOOR_CM,
  TREND_FLOOR_BF,
  type Estimate,
  type TrendLabel,
} from "@/lib/bodyMeasure";
import { GOAL_FLOOR_WEIGHT_KG } from "@/lib/bodyGoal";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

/**
 * เส้นเทรนด์ของร่างกาย (WO-BP-2 §B3)
 *
 * GET /api/coach/body-trends?limit=60&_ts=...
 *   → ทุกสแกนเรียง "เก่า → ใหม่" พร้อมค่าประมาณเป็นช่วง + ทิศทางเทียบสแกนก่อนหน้า + สายวัดจริงทับเส้น
 *
 * 🔴 ทิศทาง (up/down/flat) คิดที่นี่ด้วย trendLabel เท่านั้น — ฝั่งจอห้ามเทียบตัวเลขเอง
 *    ระบบวัดจากภาพแกว่ง ±1 ซม.อยู่แล้ว ถ้าจอชี้ลูกศรทุกครั้งที่ตัวเลขขยับ เราจะเล่านิทานให้ user ฟังทุกสัปดาห์
 *    (WO-BODY §1 noise floor — เหตุผลเต็มอยู่ในหัวฟังก์ชัน trendLabel)
 *
 * เรียงเก่า→ใหม่ เพราะ "ก่อนหน้า" ต้องมีความหมายเดียวกันทั้งฝั่ง API และฝั่งกราฟ
 */

/** ค่าที่เอาขึ้นกราฟ — เก็บให้น้อยที่สุดเท่าที่จอใช้จริง (estimates ก้อนเต็มอยู่ที่ body-scan/[id]) */
const TREND_KEYS = [
  { key: "waist", estimate: "waistCm", floor: TREND_FLOOR_CM, unit: "cm" },
  { key: "hip", estimate: "hipCm", floor: TREND_FLOOR_CM, unit: "cm" },
  { key: "chest", estimate: "chestCm", floor: TREND_FLOOR_CM, unit: "cm" },
  { key: "bfPct", estimate: "bfPct", floor: TREND_FLOOR_BF, unit: "pct" },
] as const;

type TrendKey = (typeof TREND_KEYS)[number]["key"];

/** อ่าน estimate จากก้อน Json แบบไม่เชื่ออะไรเลย — แถวเก่าจาก BP-1 เป็น {} และแถวที่วัดไม่ได้เป็น null */
function pickEstimate(estimates: unknown, key: string): Estimate | null {
  if (!estimates || typeof estimates !== "object") return null;
  const v = (estimates as Record<string, unknown>)[key];
  if (!v || typeof v !== "object") return null;
  const e = v as Partial<Estimate>;
  if (typeof e.lo !== "number" || typeof e.mid !== "number" || typeof e.hi !== "number") return null;
  return {
    lo: e.lo,
    mid: e.mid,
    hi: e.hi,
    conf: e.conf === "high" || e.conf === "med" ? e.conf : "low",
    method: (e.method ?? "2view") as Estimate["method"],
    ...(e.calibrated ? { calibrated: true } : {}),
  };
}

const dayOf = (d: Date) => bkkDayKey(d).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const raw = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), MAX_LIMIT) : DEFAULT_LIMIT;

    const [scanRows, tapeRows] = await Promise.all([
      prisma.bodyScan.findMany({
        where: { memberId: member.id },
        orderBy: { date: "desc" },
        take: limit,
        select: { id: true, date: true, quality: true, heightCmUsed: true, estimates: true },
      }),
      prisma.bodyMeasurement.findMany({
        where: { memberId: member.id },
        orderBy: { date: "asc" },
        take: MAX_LIMIT * 4,
        select: { site: true, valueCm: true, source: true, date: true },
      }),
    ]);

    const scansAsc = scanRows.slice().reverse(); // query เอาล่าสุดมาก่อน แต่เส้นกราฟต้องเดินไปข้างหน้า

    /* น้ำหนักรายวัน: 🔴 มาจาก WeightLog ไม่ใช่ DailyMetric
       (DailyMetric เก็บ bodyFatPct/leanMassKg จากเครื่องชั่ง แต่ไม่มีคอลัมน์น้ำหนักเลย — ดู schema)
       ดึงเฉพาะช่วงวันที่มีสแกนจริง ไม่ใช่ทั้งประวัติ */
    const oldest = scansAsc[0]?.date ?? null;
    const [weightRows, metricRows] = oldest
      ? await Promise.all([
          prisma.weightLog.findMany({
            where: { memberId: member.id, date: { gte: new Date(oldest.getTime() - 24 * 3600 * 1000) } },
            orderBy: { date: "asc" },
            select: { weight: true, date: true },
          }),
          prisma.dailyMetric.findMany({
            where: { memberId: member.id, date: { gte: new Date(oldest.getTime() - 24 * 3600 * 1000) } },
            orderBy: { date: "asc" },
            select: { bodyFatPct: true, leanMassKg: true, date: true },
          }),
        ])
      : [[], []];

    const weightByDay = new Map<string, number>();
    for (const w of weightRows) weightByDay.set(dayOf(w.date), w.weight); // วันเดียวกันหลายครั้ง = เอาครั้งหลังสุด
    const scaleByDay = new Map<string, { bodyFatPct: number | null; leanMassKg: number | null }>();
    for (const m of metricRows) {
      if (m.bodyFatPct == null && m.leanMassKg == null) continue;
      scaleByDay.set(dayOf(m.date), { bodyFatPct: m.bodyFatPct ?? null, leanMassKg: m.leanMassKg ?? null });
    }

    const prev: Partial<Record<TrendKey, number>> = {};
    const scans = scansAsc.map((s) => {
      const day = dayOf(s.date);
      const values: Record<string, Estimate | null> = {};
      const trend: Record<string, TrendLabel | null> = {};
      for (const t of TREND_KEYS) {
        const e = pickEstimate(s.estimates, t.estimate);
        values[t.key] = e;
        trend[t.key] = e ? trendLabel(prev[t.key] ?? null, e.mid, t.floor) : null;
        if (e) prev[t.key] = e.mid;
      }
      const scale = scaleByDay.get(day) ?? null;
      return {
        id: s.id,
        date: day,
        quality: s.quality,
        heightCmUsed: s.heightCmUsed,
        ...values,
        trend,
        /** น้ำหนักจริงของวันนั้น (ถ้าชั่ง) — ตัวเลขที่แม่นที่สุดในหน้านี้ ไม่ใช่ค่าประมาณ */
        weightKg: weightByDay.get(day) ?? null,
        /** จากเครื่องชั่งอัจฉริยะ — ต้องติดป้ายแยกจาก "AI ประเมิน" ที่จอ (WO-BODY §2 ข้อ 12) */
        scaleBodyFatPct: scale?.bodyFatPct ?? null,
        scaleLeanMassKg: scale?.leanMassKg ?? null,
      };
    });

    /** สายวัดจริงทับเส้น — ground truth ที่แม่นกว่ากล้องเสมอ จอต้องวาดคนละสัญลักษณ์กับค่าประมาณ */
    const tape: Record<string, { date: string; valueCm: number; source: string }[]> = {};
    for (const t of tapeRows) {
      (tape[t.site] ??= []).push({ date: dayOf(t.date), valueCm: t.valueCm, source: t.source });
    }

    const res = NextResponse.json({
      scans,
      count: scans.length,
      tape,
      tapeLabels: SITE_LABELS_TH,
      /** พื้นสัญญาณรบกวน — ส่งไปให้จออธิบายได้ว่าทำไมบางสัปดาห์ถึงขึ้นว่า "คงที่" */
      floors: { circumferenceCm: TREND_FLOOR_CM, bfPct: TREND_FLOOR_BF, weightKg: GOAL_FLOOR_WEIGHT_KG },
      keys: TREND_KEYS.map((t) => ({ key: t.key, unit: t.unit })),
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-trends] GET", e);
    return NextResponse.json({ error: "ดึงเทรนด์ร่างกายไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
