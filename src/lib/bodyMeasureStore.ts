/**
 * ที่ต่อท่อของตัววัด (WO-BP-2 §B3) — จุดเดียวในระบบที่ "เอาสแกนหนึ่งไปวัดแล้วเขียนผลกลับ"
 *
 * แบ่งหน้าที่กับ src/lib/bodyMeasure.ts ให้ชัด:
 *   bodyMeasure.ts = คณิตล้วน ไม่รู้จัก DB/ไฟล์/เวลา (เทสได้ด้วยตัวเลขล้วน)
 *   ไฟล์นี้      = ไปเอารูป → เรียก worker → ส่งให้คณิต → เขียนกลับ DB (ไม่มีสูตรอยู่ในนี้เลย)
 *
 * 🔴 กติกาที่ห้ามลืม:
 *   1. วัดไม่ได้ ≠ สแกนพัง — worker ล่มตอน commit ต้องไม่ทำให้ commit ล้ม (รูปเก็บแล้วห้ามหาย · WO-BP-2 §B3)
 *   2. ต้องเรียก worker ใหม่ทุกครั้ง เพราะ landmark ที่เก็บไว้ตอน BP-1 ไม่มี maskGrid (เงาร่าง) ติดมาด้วย
 *   3. offset ของสายวัดคิดจาก rawMid เสมอ — ไม่งั้น calibrate รอบสองจะเลื่อนทับของเดิม
 */
import { prisma } from "@/lib/prisma";
import { analyzePaths } from "@/lib/bodyWorkerClient";
import { workerPath } from "@/lib/bodyStorage";
import type { WorkerImage } from "@/lib/bodyScanGate";
import {
  applyTapeOffset,
  decodeMaskGrid,
  measureBody,
  SITE_TO_ESTIMATE,
  TAPE_PAIR_DAYS,
  type Estimate,
  type Estimates,
  type TapePair,
  type ViewInput,
  type WidthsPx,
} from "@/lib/bodyMeasure";

/** จำนวนสแกนย้อนหลังที่เอามาหาคู่สายวัด — พอสำหรับ 1 ปีถ้าสแกนสัปดาห์ละครั้ง */
const CALIBRATION_SCAN_LIMIT = 60;
/** จำนวนสายวัดย้อนหลังที่เอามาหาคู่ */
const CALIBRATION_TAPE_LIMIT = 200;
/** วัดซ้ำหลังบันทึกสายวัด: กันเคสข้อมูลผิดปกติที่จะลากให้ยิง worker เป็นสิบครั้งในคำขอเดียว (VPS 2 core) */
export const REMEASURE_SCAN_LIMIT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MeasureScanResult =
  | {
      ok: true;
      scanId: string;
      estimates: Estimates;
      widthsPx: WidthsPx;
      heightCmUsed: number | null;
      /** true = มีสายวัดจริงมาเลื่อนค่าให้แล้ว */
      calibrated: boolean;
    }
  | { ok: false; reason: "not_found" | "worker_down" | "failed" };

/** worker image → input ของตัววัด (ถอดเงาร่างจาก base64 ตรงนี้ที่เดียว) */
export function viewFromWorkerImage(img: WorkerImage | null | undefined): ViewInput | null {
  if (!img || img.ok === false) return null;
  return {
    landmarks: Array.isArray(img.landmarks) ? img.landmarks : null,
    mask: decodeMaskGrid(img.maskGrid ?? null),
    maskBounds: img.maskBounds ?? null,
    width: typeof img.width === "number" ? img.width : null,
    height: typeof img.height === "number" ? img.height : null,
  };
}

/** อ่าน mid "ก่อน calibrate" ของ site หนึ่งจาก estimates ที่เก็บใน DB (ก้อน Json) */
export function rawMidForSite(estimates: unknown, site: string): number | null {
  const key = SITE_TO_ESTIMATE[site];
  if (!key || !estimates || typeof estimates !== "object") return null;
  const v = (estimates as Record<string, unknown>)[key];
  if (!v || typeof v !== "object") return null;
  const e = v as Partial<Estimate>;
  const raw = typeof e.rawMid === "number" ? e.rawMid : typeof e.mid === "number" ? e.mid : null;
  return Number.isFinite(raw) ? (raw as number) : null;
}

const dayDiff = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / DAY_MS;

/**
 * รวบรวมคู่ "สายวัดจริง ↔ ค่าที่ระบบประมาณ" ของสมาชิกคนนี้ทั้งหมด
 * คู่กันได้เมื่อวันห่างกันไม่เกิน ±3 วัน (WO-BP-2 §B2) — ร่างกายไม่เปลี่ยนใน 3 วัน แต่กล้องเปลี่ยนทุกวัน
 * สแกนที่กำลังวัดอยู่ใช้ค่าที่เพิ่งคิดได้ ไม่ใช่ค่าที่ค้างใน DB (ซึ่งยังเป็นของรอบก่อน)
 */
async function collectTapePairs(
  memberId: string,
  currentScanId: string,
  currentScanDate: Date,
  currentEstimates: Estimates
): Promise<TapePair[]> {
  const [tapes, scans] = await Promise.all([
    prisma.bodyMeasurement.findMany({
      where: { memberId, source: "tape" },
      orderBy: { date: "desc" },
      take: CALIBRATION_TAPE_LIMIT,
      select: { site: true, valueCm: true, date: true },
    }),
    prisma.bodyScan.findMany({
      where: { memberId },
      orderBy: { date: "desc" },
      take: CALIBRATION_SCAN_LIMIT,
      select: { id: true, date: true, estimates: true },
    }),
  ]);

  const rows = scans.map((s) =>
    s.id === currentScanId
      ? { id: s.id, date: currentScanDate, estimates: currentEstimates as unknown }
      : { id: s.id, date: s.date, estimates: s.estimates as unknown }
  );
  if (!rows.some((r) => r.id === currentScanId)) {
    rows.push({ id: currentScanId, date: currentScanDate, estimates: currentEstimates as unknown });
  }

  const pairs: TapePair[] = [];
  for (const t of tapes) {
    if (!SITE_TO_ESTIMATE[t.site]) continue;
    for (const s of rows) {
      if (dayDiff(t.date, s.date) > TAPE_PAIR_DAYS) continue;
      const cvMid = rawMidForSite(s.estimates, t.site);
      if (cvMid == null || cvMid <= 0) continue;
      pairs.push({ site: t.site, tapeCm: t.valueCm, cvMid });
    }
  }
  return pairs;
}

/**
 * วัดสแกนหนึ่ง แล้วเขียน widthsPx + estimates กลับลงแถว
 *
 * heightCmUsed: ใช้ของสแกนก่อน (สเกลตอนคิดครั้งแรก) · ไม่มีก็ดึงส่วนสูงโปรไฟล์ปัจจุบันแล้วเขียนลงไปด้วย
 * ไม่มีส่วนสูงเลย → ยังวัดและเก็บ widthsPx (พิกเซล) ไว้ แต่ estimates จะเป็น null ทั้งชุดจากฝั่งคณิตเอง
 * (เก็บพิกเซลไว้มีค่า: วันที่ user กรอกส่วนสูง เราคิดย้อนหลังให้ได้ทันทีโดยไม่ต้องขอรูปใหม่)
 */
export async function measureScan(scanId: string, memberId?: string): Promise<MeasureScanResult> {
  const scan = await prisma.bodyScan.findFirst({
    where: { id: scanId, ...(memberId ? { memberId } : {}) },
    select: { id: true, memberId: true, date: true, frontPath: true, sidePath: true, heightCmUsed: true },
  });
  if (!scan) return { ok: false, reason: "not_found" };

  const member = await prisma.member.findUnique({
    where: { id: scan.memberId },
    select: { height: true, gender: true },
  });

  const heightCm = scan.heightCmUsed ?? member?.height ?? null;

  const analyzed = await analyzePaths([workerPath(scan.frontPath), workerPath(scan.sidePath)]);
  if (!analyzed.ok) return { ok: false, reason: "worker_down" };

  const front = viewFromWorkerImage(analyzed.images[0]);
  const side = viewFromWorkerImage(analyzed.images[1]);

  const { widthsPx, estimates } = measureBody({
    front,
    side,
    heightCm,
    gender: member?.gender ?? null,
  });

  const pairs = await collectTapePairs(scan.memberId, scan.id, scan.date, estimates);
  const finalEstimates = pairs.length
    ? applyTapeOffset(estimates, pairs, { heightCm, gender: member?.gender ?? null })
    : estimates;

  await prisma.bodyScan.update({
    where: { id: scan.id },
    data: {
      widthsPx: widthsPx as never,
      estimates: finalEstimates as never,
      ...(scan.heightCmUsed == null && heightCm != null ? { heightCmUsed: heightCm } : {}),
    },
  });

  return {
    ok: true,
    scanId: scan.id,
    estimates: finalEstimates,
    widthsPx,
    heightCmUsed: heightCm,
    calibrated: pairs.length > 0,
  };
}

/**
 * แบบที่ "ล้มไม่ได้" — ใช้ในเส้นทางที่ผู้ใช้กำลังรออยู่ (commit สแกน / บันทึกสายวัด)
 * ทุกความผิดพลาดถูกกลืนเป็น ok:false เพราะงานหลักของเส้นทางนั้นสำเร็จไปแล้ว
 * (รูปถูกเก็บ/สายวัดถูกบันทึกแล้ว — ตอบ error ตรงนี้คือทำให้ user คิดว่าของหาย ทั้งที่ไม่หาย)
 */
export async function measureScanSafe(scanId: string, memberId?: string): Promise<MeasureScanResult> {
  try {
    return await measureScan(scanId, memberId);
  } catch (e) {
    console.error("[bodyMeasureStore] วัดสแกนไม่สำเร็จ", e);
    return { ok: false, reason: "failed" };
  }
}

/**
 * วัดสแกนทุกอันที่อยู่ในระยะ ±3 วันของวันนั้นใหม่ (WO-BP-2 §B3 — บันทึกสายวัดแล้ว calibration เข้าเส้นทันที)
 * เรียงตามลำดับทีละอัน ไม่ขนาน: VPS 2 core และ worker เป็นคิวเดียวอยู่แล้ว
 */
export async function remeasureScansNear(memberId: string, date: Date): Promise<number> {
  try {
    const from = new Date(date.getTime() - TAPE_PAIR_DAYS * DAY_MS);
    const to = new Date(date.getTime() + TAPE_PAIR_DAYS * DAY_MS);
    const scans = await prisma.bodyScan.findMany({
      where: { memberId, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
      take: REMEASURE_SCAN_LIMIT,
      select: { id: true },
    });
    let done = 0;
    for (const s of scans) {
      const r = await measureScanSafe(s.id, memberId);
      if (r.ok) done++;
    }
    return done;
  } catch (e) {
    console.error("[bodyMeasureStore] วัดซ้ำหลังบันทึกสายวัดไม่สำเร็จ", e);
    return 0;
  }
}
