/**
 * Engine — ตัววัดร่างกายจากภาพ (WO-BP-2 §B2 · WO-BODY §1)
 *
 * รับ "เงาร่าง + จุด landmark + ส่วนสูงจริง" → คืนความกว้าง/ลึกเป็นพิกเซล และค่าประมาณเป็นเซนติเมตร
 * ทุกตัวเลขในนี้เป็นคณิตล้วน deterministic: ภาพเดิม → เลขเดิมทุกครั้ง
 * (WO-BODY §1 🔴 ตัววัดห้ามเป็น LLM — LLM ให้ค่าไม่นิ่ง แล้วกราฟเทรนด์ทั้งเส้นจะเล่านิทาน)
 *
 * 🔴 กติกาของไฟล์นี้ (เหมือน progression.ts / readiness.ts / bodyScanGate.ts):
 *   - ห้าม import prisma / fetch / fs / new Date() / Date.now() — รับทุกอย่างผ่านพารามิเตอร์
 *   - ทุกสูตรมีเทสถาวรที่ scripts/test-body-measure.ts
 *   - 🔴 ข้อมูลไม่พอ = null เสมอ ห้ามเดา — ตัวเลขที่เดามาจะกลายเป็นจุดหนึ่งบนกราฟที่ user เชื่อไปตลอด
 *     และเทรนด์ที่คำนวณจากค่าที่เดา จะ "ขึ้น/ลง" ตามความมั่วไม่ใช่ตามร่างกายเขา
 *   - ทุกค่าที่คิดได้เป็นช่วง {lo,mid,hi} + confidence เสมอ — กล้องมือถือ 2 ภาพวัดรอบวงจริงไม่ได้ (WO-BODY §1)
 */

// ── ดัชนี landmark ของ MediaPipe Pose (33 จุด) เท่าที่ตัววัดใช้ ──
export const LM_EAR_L = 7;
export const LM_EAR_R = 8;
export const LM_SHOULDER_L = 11;
export const LM_SHOULDER_R = 12;
export const LM_HIP_L = 23;
export const LM_HIP_R = 24;
export const LM_KNEE_L = 25;
export const LM_KNEE_R = 26;
export const LM_ANKLE_L = 27;
export const LM_ANKLE_R = 28;

// ── ระดับกายวิภาค เป็นสัดส่วน t ของ Δ = (สะโพก − ไหล่) ──
// t=0 คือแนวไหล่ · t=1 คือแนวสะโพก · ค่ามาจาก WO-BP-2 §B2 ตรง ๆ ห้ามปรับโดยไม่แก้เทส
/** อก = ไหล่ + 0.30Δ (แถวเดียว ตามสเปก — ไม่เฉลี่ยแถวข้างเคียง เพื่อให้ผลนิ่งและอธิบายได้) */
export const T_CHEST = 0.3;
/** เอว = แคบสุดในช่วง 0.55Δ → สะโพก−0.08Δ */
export const T_WAIST_FROM = 0.55;
export const T_WAIST_TO = 0.92;
/** สะโพก = กว้างสุดในช่วง สะโพก−0.05Δ → สะโพก+0.18Δ */
export const T_HIP_FROM = 0.95;
export const T_HIP_TO = 1.18;
/** สะดือ (ภาพข้าง) = ไหล่ + 0.75Δ — เผื่อไว้ให้สูตร Navy หญิงถ้าต้องใช้ */
export const T_ABDOMEN = 0.75;

/**
 * อัตราส่วน "ลึก ÷ กว้าง" ตอนไม่มีภาพข้าง (WO-BP-2 §B2 fallback)
 * ใช้เมื่อ mask ของภาพข้างเสียเท่านั้น — ไม่ใช่ทางเดินปกติ และต้องลด confidence ลงหนึ่งขั้นเสมอ
 */
export const DEPTH_RATIO: Record<string, number> = {
  waist: 0.72,
  hip: 0.78,
  chest: 0.74,
  neck: 0.85,
};

// ── ช่วงความคลาดเคลื่อน ──
/** ครึ่งช่วงขั้นต่ำ (ซม.) — ต่อให้ mid แม่นแค่ไหน ระบบก็ไม่มีสิทธิ์บอกว่าแม่นกว่านี้ */
export const MIN_HALF_RANGE_CM = 1.5;
/** ครึ่งช่วงตามสัดส่วนของค่า */
export const HALF_RANGE_PCT = 0.04;
/** conf ต่ำ = ช่วงกว้างขึ้นอีกครึ่งเท่า */
export const LOW_CONF_RANGE_MULT = 1.5;

// ── noise floor (WO-BODY §1 🔴) — เล็กกว่านี้ห้ามโชว์ลูกศรขึ้น/ลง ──
/** เส้นรอบวง/ความกว้าง: ต่ำกว่า 1.0 ซม. = คงที่ */
export const TREND_FLOOR_CM = 1.0;
/** เปอร์เซ็นต์ไขมัน: ต่ำกว่า 1.5 จุด = คงที่ */
export const TREND_FLOOR_BF = 1.5;

// ── เกณฑ์ confidence ──
export const VIS_HIGH = 0.9;
export const VIS_MED = 0.7;
/** แถวที่วัดได้ต้องมีอย่างน้อยเท่านี้ของแถวที่ไล่ทั้งช่วง ไม่งั้นถือว่าเงาร่างขาด ๆ หาย ๆ */
export const MIN_BAND_COVERAGE = 0.6;
/** จำนวน run สูงสุดในแถวที่ยังถือว่า "อ่านง่าย" (ลำตัว + แขนสองข้าง) */
export const MAX_CLEAN_RUNS = 3;

// ── posture flags (ข้อสังเกต ไม่ใช่การวินิจฉัย — ป้ายกำกับอยู่ฝั่งจอ) ──
/** หู-ไหล่ (ภาพข้าง) ห่างเกินเท่านี้ของส่วนสูงพิกเซล = หัวยื่น */
export const HEAD_FORWARD_FRAC = 0.04;
/** ไหล่/สะโพกเอียงเกินกี่องศาถึงติดธง */
export const TILT_FLAG_DEG = 3;

// ── ขอบเขตความเป็นไปได้ของผล Navy ──
export const BF_MIN_PCT = 0;
export const BF_MAX_PCT = 60;

/** ระยะเวลาที่ถือว่าสายวัดกับสแกน "คู่กัน" ได้ (วัน) — WO-BP-2 §B2 calibration */
export const TAPE_PAIR_DAYS = 3;

// ── โครงข้อมูล ──
export type Conf = "high" | "med" | "low";
/** 2view = กว้าง(หน้า)+ลึก(ข้าง) · 1view = เดาความลึกจากอัตราส่วน · width = ความกว้างตรง ๆ · ratio = สัดส่วน */
export type EstimateMethod = "2view" | "1view" | "width" | "ratio" | "navy";

export interface Estimate {
  lo: number;
  mid: number;
  hi: number;
  conf: Conf;
  method: EstimateMethod;
  /** true = เลื่อนทั้งเส้นด้วยสายวัดจริงของคนนี้แล้ว (applyTapeOffset) */
  calibrated?: boolean;
  /** mid ก่อน calibrate — ต้องเก็บไว้ ไม่งั้นรอบหน้าจะเรียน offset ทับ offset เดิมจนเลื่อนสองเท่า */
  rawMid?: number;
}

export interface MeasureLandmark {
  x: number;
  y: number;
  visibility?: number;
}

export interface MaskBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** ตารางเงาร่างแบบ bit-packed ที่ worker คืนมา (WO-BP-2 §B1) */
export interface PackedMaskGrid {
  w: number;
  h: number;
  data: string;
}

export interface ViewInput {
  landmarks?: MeasureLandmark[] | null;
  /** ตารางเงาร่างถอดแล้ว — mask[row][col] · true = เป็นคน (ใช้ decodeMaskGrid แปลงจาก PackedMaskGrid) */
  mask?: boolean[][] | null;
  maskBounds?: MaskBounds | null;
  /** ขนาดภาพจริงเป็นพิกเซล */
  width?: number | null;
  height?: number | null;
}

export interface FrontWidths {
  cmPerPx: number | null;
  bodyHeightPx: number | null;
  shoulderW: number | null;
  neckW: number | null;
  chestW: number | null;
  waistW: number | null;
  hipW: number | null;
  thighLW: number | null;
  thighRW: number | null;
  calfLW: number | null;
  calfRW: number | null;
  /** ระดับ t ที่ "เจอ" ค่าจริง — ภาพข้างต้องวัดที่ระดับกายวิภาคเดียวกัน ไม่ใช่ y เดียวกัน */
  levels: { chest: number | null; waist: number | null; hip: number | null; neck: number | null };
}

export interface SideWidths {
  cmPerPx: number | null;
  bodyHeightPx: number | null;
  neckD: number | null;
  chestD: number | null;
  waistD: number | null;
  hipD: number | null;
  abdomenD: number | null;
}

export interface WidthsPx {
  front: FrontWidths | null;
  side: SideWidths | null;
}

export interface PostureFlags {
  headForward: boolean | null;
  headForwardFrac: number | null;
  shoulderTilt: boolean | null;
  shoulderTiltDeg: number | null;
  hipTilt: boolean | null;
  hipTiltDeg: number | null;
}

export interface Estimates {
  neckCm: Estimate | null;
  chestCm: Estimate | null;
  waistCm: Estimate | null;
  hipCm: Estimate | null;
  shoulderCm: Estimate | null;
  thighLCm: Estimate | null;
  thighRCm: Estimate | null;
  calfLCm: Estimate | null;
  calfRCm: Estimate | null;
  whr: Estimate | null;
  swr: Estimate | null;
  bfPct: Estimate | null;
  symmetry: { thighDiffCm: number | null; calfDiffCm: number | null };
  posture: PostureFlags;
  /** ภาพไหนถูกใช้คิดจริงบ้าง + สเกลที่ใช้ (ไว้ให้คนตรวจย้อนได้ว่าเลขนี้มาจากอะไร) */
  scale: { heightCm: number | null; cmPerPxFront: number | null; cmPerPxSide: number | null };
  /** true = ผล Navy หลุดช่วงที่เป็นไปได้ → ข้อมูลชุดนี้เพี้ยน conf ถูกกดเป็น low ทั้งชุด (WO-BP-2 §B2) */
  suspect: boolean;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ────────────────────────────────────────────────────────────────
// ถอดตารางเงาร่าง
// ────────────────────────────────────────────────────────────────

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_LOOKUP[B64_ALPHABET[i]] = i;

/**
 * base64 → ไบต์ (เขียนเอง ไม่ใช้ Buffer/atob)
 * เหตุผล: ไฟล์นี้ต้อง pure และรันได้ทั้งใน route, ในสคริปต์เทส และในอนาคตบน edge runtime
 * ข้อมูลผิดรูป = null (ไม่ใช่ throw) เพราะปลายทางต้องเดินต่อได้ด้วยการวัดไม่ได้ ไม่ใช่ 500
 */
export function base64ToBytes(raw: unknown): Uint8Array | null {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  if (!s || s.length % 4 !== 0) return null;
  let pad = 0;
  if (s.endsWith("==")) pad = 2;
  else if (s.endsWith("=")) pad = 1;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const chunk: number[] = [];
    for (let k = 0; k < 4; k++) {
      const ch = s[i + k];
      if (ch === "=") {
        chunk.push(0);
        continue;
      }
      const v = B64_LOOKUP[ch];
      if (v === undefined) return null;
      chunk.push(v);
    }
    const n = (chunk[0] << 18) | (chunk[1] << 12) | (chunk[2] << 6) | chunk[3];
    if (o < out.length) out[o++] = (n >> 16) & 0xff;
    if (o < out.length) out[o++] = (n >> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

/**
 * PackedMaskGrid → boolean[row][col]
 * รูปแบบต้องตรงกับ worker/body_worker.py: row-major · MSB ก่อน · แต่ละแถวเริ่มไบต์ใหม่ (ceil(w/8) ไบต์ต่อแถว)
 * ขนาดไม่ตรงตามที่ประกาศ = ข้อมูลเสีย → null (ยอมวัดไม่ได้ ดีกว่าอ่านบิตเหลื่อมแล้วได้เงาร่างของคนอื่นทั้งภาพ)
 */
export function decodeMaskGrid(packed: PackedMaskGrid | null | undefined): boolean[][] | null {
  if (!packed || !isNum(packed.w) || !isNum(packed.h)) return null;
  const w = Math.round(packed.w);
  const h = Math.round(packed.h);
  if (w <= 0 || h <= 0 || w > 4096 || h > 4096) return null;
  const bytes = base64ToBytes(packed.data);
  if (!bytes) return null;
  const perRow = Math.ceil(w / 8);
  if (bytes.length !== perRow * h) return null;

  const grid: boolean[][] = new Array(h);
  for (let r = 0; r < h; r++) {
    const row: boolean[] = new Array(w);
    const base = r * perRow;
    for (let c = 0; c < w; c++) {
      row[c] = ((bytes[base + (c >> 3)] >> (7 - (c & 7))) & 1) === 1;
    }
    grid[r] = row;
  }
  return grid;
}

// ────────────────────────────────────────────────────────────────
// run-analysis บนตารางเงาร่าง
// ────────────────────────────────────────────────────────────────

/** ช่วงต่อเนื่องของ true ในแถวหนึ่ง — [s, e) เป็นดัชนีคอลัมน์ */
export interface Run {
  s: number;
  e: number;
}

export function runsAt(mask: boolean[][], row: number): Run[] {
  const line = mask?.[row];
  if (!Array.isArray(line)) return [];
  const out: Run[] = [];
  let s = -1;
  for (let c = 0; c < line.length; c++) {
    if (line[c]) {
      if (s < 0) s = c;
    } else if (s >= 0) {
      out.push({ s, e: c });
      s = -1;
    }
  }
  if (s >= 0) out.push({ s, e: line.length });
  return out;
}

const runContains = (r: Run, col: number) => col >= r.s && col < r.e;
const runCenter = (r: Run) => (r.s + r.e - 1) / 2;

function gridW(mask: boolean[][]): number {
  return mask[0]?.length ?? 0;
}

/** สัดส่วน x (0-1) → ดัชนีคอลัมน์ · นอกภาพถูกหนีบเข้าขอบ (landmark หลุดเฟรมได้จริงตอนคนยืนชิดขอบ) */
function colOf(xNorm: number, w: number): number {
  return clamp(Math.floor(xNorm * w), 0, w - 1);
}
function rowOf(yNorm: number, h: number): number {
  return clamp(Math.floor(yNorm * h), 0, h - 1);
}

/** ความกว้างของ run เป็นพิกเซลของภาพจริง */
function runWidthPx(run: Run, gw: number, imgW: number): number {
  return ((run.e - run.s) / gw) * imgW;
}

interface RowPick {
  run: Run;
  runs: Run[];
  row: number;
  widthCells: number;
  /** อ่านง่ายไหม: ไม่ชนขอบภาพ และ run ในแถวไม่เยอะผิดปกติ */
  clean: boolean;
}

/**
 * หา "run ของลำตัว" ที่แถวหนึ่ง = run ที่ครอบ x กึ่งกลางสะโพก (WO-BP-2 §B2)
 * ไม่ใช่ run ที่กว้างที่สุด: ถ้าคนกางแขนจนแขนกลายเป็น run ยาว เราจะไปวัดแขนแทนลำตัวโดยไม่รู้ตัว
 */
function torsoRunAt(mask: boolean[][], row: number, centerCol: number): RowPick | null {
  const runs = runsAt(mask, row);
  if (!runs.length) return null;
  const run = runs.find((r) => runContains(r, centerCol));
  if (!run) return null;
  const w = gridW(mask);
  const clean = run.s > 0 && run.e < w && runs.length <= MAX_CLEAN_RUNS;
  return { run, runs, row, widthCells: run.e - run.s, clean };
}

interface BandResult extends RowPick {
  /** สัดส่วน y (0-1) ของแถวที่เลือก (กึ่งกลางแถว) */
  yNorm: number;
}

/**
 * ไล่ทุกแถวในช่วง y แล้วเลือกแถวที่แคบสุด/กว้างสุด (เอว = แคบสุด · สะโพก = กว้างสุด)
 * แถวที่หา run ลำตัวไม่เจอถูกข้าม — แต่ถ้าข้ามเกิน (1−MIN_BAND_COVERAGE) ของช่วง แปลว่าเงาร่างแหว่ง → conf ต่ำลง
 */
function scanBand(
  mask: boolean[][],
  yFrom: number,
  yTo: number,
  centerCol: number,
  pick: "min" | "max"
): BandResult | null {
  const gh = mask.length;
  if (!gh) return null;
  const r0 = rowOf(Math.min(yFrom, yTo), gh);
  const r1 = rowOf(Math.max(yFrom, yTo), gh);
  let best: RowPick | null = null;
  let seen = 0;
  for (let r = r0; r <= r1; r++) {
    const got = torsoRunAt(mask, r, centerCol);
    if (!got) continue;
    seen++;
    if (!best) best = got;
    else if (pick === "min" ? got.widthCells < best.widthCells : got.widthCells > best.widthCells) best = got;
  }
  if (!best) return null;
  const total = r1 - r0 + 1;
  const coverage = seen / total;
  return {
    ...best,
    clean: best.clean && coverage >= MIN_BAND_COVERAGE,
    yNorm: (best.row + 0.5) / gh,
  };
}

// ────────────────────────────────────────────────────────────────
// landmark helper
// ────────────────────────────────────────────────────────────────

function lm(list: MeasureLandmark[] | null | undefined, i: number): MeasureLandmark | null {
  const p = list?.[i];
  if (!p || !isNum(p.x) || !isNum(p.y)) return null;
  return { x: p.x, y: p.y, visibility: isNum(p.visibility) ? p.visibility : 0 };
}

/** จุดที่ "เห็นชัดกว่า" ระหว่างซ้าย-ขวา — ภาพด้านข้างมีข้างหนึ่งถูกบังเสมอ */
function betterOf(a: MeasureLandmark | null, b: MeasureLandmark | null): MeasureLandmark | null {
  if (!a) return b;
  if (!b) return a;
  return (a.visibility ?? 0) >= (b.visibility ?? 0) ? a : b;
}

function midPoint(a: MeasureLandmark | null, b: MeasureLandmark | null): MeasureLandmark | null {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0),
  };
}

/** visibility ต่ำสุดของจุดที่เกี่ยวข้อง → ขั้น confidence (WO-BP-2 §B2) */
export function visConf(points: (MeasureLandmark | null)[]): Conf {
  let min = 1;
  for (const p of points) {
    if (!p) return "low";
    min = Math.min(min, p.visibility ?? 0);
  }
  if (min >= VIS_HIGH) return "high";
  if (min >= VIS_MED) return "med";
  return "low";
}

const CONF_ORDER: Conf[] = ["high", "med", "low"];
export function stepDownConf(c: Conf): Conf {
  const i = CONF_ORDER.indexOf(c);
  return CONF_ORDER[Math.min(CONF_ORDER.length - 1, i + 1)];
}
export function worstConf(...cs: Conf[]): Conf {
  let out: Conf = "high";
  for (const c of cs) if (CONF_ORDER.indexOf(c) > CONF_ORDER.indexOf(out)) out = c;
  return out;
}

/**
 * มุมเอียงของเส้นสองจุดเทียบแนวนอน (องศา)
 * 🔴 ต้องคูณกลับด้วยขนาดภาพก่อน — x เป็นสัดส่วนของความกว้าง แต่ y เป็นสัดส่วนของความสูง
 *    (บทเรียนเดียวกับ bodyScanGate.tiltDeg: ลืมแปลงแล้วคนยืนตรงจะถูกหาว่าเอียง)
 */
export function tiltDegrees(
  a: MeasureLandmark | null,
  b: MeasureLandmark | null,
  width?: number | null,
  height?: number | null
): number | null {
  if (!a || !b) return null;
  const w = isNum(width) && width > 0 ? width : 1;
  const h = isNum(height) && height > 0 ? height : 1;
  const dx = Math.abs(a.x - b.x) * w;
  const dy = Math.abs(a.y - b.y) * h;
  if (dx === 0 && dy === 0) return null;
  return round((Math.atan2(dy, dx) * 180) / Math.PI, 2);
}

// ────────────────────────────────────────────────────────────────
// สเกล
// ────────────────────────────────────────────────────────────────

/**
 * เซนติเมตรต่อพิกเซล = ส่วนสูงจริง ÷ ความสูงของเงาร่างในภาพ (WO-BP-2 §B2)
 * ใช้ maskBounds top→bottom (หัวจรดเท้าจริง) ไม่ใช่ landmark จมูก→ข้อเท้า
 * ไม่มีส่วนสูง หรือไม่มีกรอบ mask = คิดสเกลไม่ได้ → null แล้วทุก estimate จะเป็น null ตามไปทั้งชุด
 */
export function cmPerPixel(
  heightCm: number | null | undefined,
  bounds: MaskBounds | null | undefined,
  imgHeightPx: number | null | undefined
): { cmPerPx: number | null; bodyHeightPx: number | null } {
  if (!bounds || !isNum(bounds.top) || !isNum(bounds.bottom)) return { cmPerPx: null, bodyHeightPx: null };
  if (!isNum(imgHeightPx) || imgHeightPx <= 0) return { cmPerPx: null, bodyHeightPx: null };
  const bodyHeightPx = (bounds.bottom - bounds.top) * imgHeightPx;
  if (!(bodyHeightPx > 0)) return { cmPerPx: null, bodyHeightPx: null };
  // ความสูงร่างเป็นพิกเซลคิดได้เสมอแม้ไม่รู้ส่วนสูงจริง — posture ใช้แค่ตัวนี้ (เป็นสัดส่วน ไม่ใช่เซนติเมตร)
  if (!isNum(heightCm) || heightCm <= 0) return { cmPerPx: null, bodyHeightPx };
  return { cmPerPx: heightCm / bodyHeightPx, bodyHeightPx };
}

// ────────────────────────────────────────────────────────────────
// วัดภาพหน้า
// ────────────────────────────────────────────────────────────────

interface FrontResult {
  widths: FrontWidths;
  /** คุณภาพ run ต่อระดับ — ใช้กดหรือไม่กด confidence */
  clean: Record<string, boolean>;
  /** ขนาดภาพจริง — เก็บไว้เพราะมุมเอียงต้องแปลงสัดส่วนกลับเป็นพิกเซลก่อนคิด */
  imgW: number | null;
  imgH: number | null;
  points: {
    shoulderL: MeasureLandmark | null;
    shoulderR: MeasureLandmark | null;
    hipL: MeasureLandmark | null;
    hipR: MeasureLandmark | null;
    kneeL: MeasureLandmark | null;
    kneeR: MeasureLandmark | null;
    ankleL: MeasureLandmark | null;
    ankleR: MeasureLandmark | null;
    ear: MeasureLandmark | null;
  };
}

const EMPTY_FRONT_WIDTHS: FrontWidths = {
  cmPerPx: null,
  bodyHeightPx: null,
  shoulderW: null,
  neckW: null,
  chestW: null,
  waistW: null,
  hipW: null,
  thighLW: null,
  thighRW: null,
  calfLW: null,
  calfRW: null,
  levels: { chest: null, waist: null, hip: null, neck: null },
};

/** x ของขาข้างหนึ่งที่ระดับ y ใด ๆ (เส้นตรงจากสะโพกไปเข่า/ข้อเท้า) */
function legXAt(top: MeasureLandmark, bottom: MeasureLandmark, y: number): number {
  const dy = bottom.y - top.y;
  if (Math.abs(dy) < 1e-9) return (top.x + bottom.x) / 2;
  const u = clamp((y - top.y) / dy, 0, 1);
  return top.x + u * (bottom.x - top.x);
}

/**
 * ความกว้างของแขนขาข้างเดียว ที่ระดับกึ่งกลางของท่อน
 * 🔴 แถวนั้นต้องมี ≥2 run และ run ที่เลือกต้องไม่กินขาอีกข้างด้วย
 *    ขาชิดกัน = วัดข้างเดียวไม่ได้ → null (WO-BP-2 §B2 "ไม่ใช่หารสอง")
 *    หารสองจะให้ตัวเลขที่ดูสมเหตุผลแต่ผิด แล้วกราฟสมมาตรซ้าย-ขวาจะบอกว่า "เท่ากันเป๊ะ" ทุกครั้งที่ขาชิด
 */
function limbWidthPx(
  mask: boolean[][],
  imgW: number,
  top: MeasureLandmark | null,
  bottom: MeasureLandmark | null,
  otherTop: MeasureLandmark | null,
  otherBottom: MeasureLandmark | null
): { px: number; clean: boolean } | null {
  if (!top || !bottom) return null;
  const gh = mask.length;
  const gw = gridW(mask);
  if (!gh || !gw) return null;
  const y = (top.y + bottom.y) / 2;
  const row = rowOf(y, gh);
  const runs = runsAt(mask, row);
  if (runs.length < 2) return null;

  const legCol = colOf(legXAt(top, bottom, y), gw);
  let run = runs.find((r) => runContains(r, legCol));
  if (!run) {
    // landmark หลุดออกนอกเงาร่างเล็กน้อย (ขอบ mask หยาบ) → หยิบ run ที่ใกล้ที่สุดแทน
    run = runs.reduce((a, b) => (Math.abs(runCenter(a) - legCol) <= Math.abs(runCenter(b) - legCol) ? a : b));
  }
  if (otherTop && otherBottom) {
    const otherCol = colOf(legXAt(otherTop, otherBottom, y), gw);
    if (runContains(run, otherCol)) return null; // สอง run รวมกันแล้ว = แยกข้างไม่ได้
  }
  return {
    px: runWidthPx(run, gw, imgW),
    clean: run.s > 0 && run.e < gw,
  };
}

function measureFront(view: ViewInput | null | undefined, heightCm: number | null): FrontResult {
  const points = {
    shoulderL: lm(view?.landmarks, LM_SHOULDER_L),
    shoulderR: lm(view?.landmarks, LM_SHOULDER_R),
    hipL: lm(view?.landmarks, LM_HIP_L),
    hipR: lm(view?.landmarks, LM_HIP_R),
    kneeL: lm(view?.landmarks, LM_KNEE_L),
    kneeR: lm(view?.landmarks, LM_KNEE_R),
    ankleL: lm(view?.landmarks, LM_ANKLE_L),
    ankleR: lm(view?.landmarks, LM_ANKLE_R),
    ear: betterOf(lm(view?.landmarks, LM_EAR_L), lm(view?.landmarks, LM_EAR_R)),
  };
  const clean: Record<string, boolean> = {};
  const imgW = isNum(view?.width) ? view!.width! : null;
  const imgH = isNum(view?.height) ? view!.height! : null;
  const { cmPerPx, bodyHeightPx } = cmPerPixel(heightCm, view?.maskBounds, imgH);
  const widths: FrontWidths = { ...EMPTY_FRONT_WIDTHS, levels: { ...EMPTY_FRONT_WIDTHS.levels }, cmPerPx, bodyHeightPx };

  // ไหล่วัดจาก landmark ตรง ๆ (ไม่ใช่เงาร่าง) — ปลายไหล่คือกระดูก ไม่ใช่ขอบเสื้อ
  if (points.shoulderL && points.shoulderR && imgW) {
    widths.shoulderW = Math.abs(points.shoulderL.x - points.shoulderR.x) * imgW;
  }

  const mask = Array.isArray(view?.mask) && view!.mask!.length ? view!.mask! : null;
  const shoulderMid = midPoint(points.shoulderL, points.shoulderR);
  const hipMid = midPoint(points.hipL, points.hipR);
  const bail = (): FrontResult => ({ widths, clean, imgW, imgH, points });
  if (!mask || !imgW || !shoulderMid || !hipMid) return bail();

  const gw = gridW(mask);
  const delta = hipMid.y - shoulderMid.y;
  if (!(delta > 0) || !gw) return bail();

  const yAt = (t: number) => shoulderMid.y + t * delta;
  const torsoCol = colOf(hipMid.x, gw);

  // อก — แถวเดียวตามสเปก (ไม่เฉลี่ยแถวข้างเคียง เพื่อให้เลขนี้อธิบายกลับไปที่ภาพได้ตรง ๆ)
  const chestRow = torsoRunAt(mask, rowOf(yAt(T_CHEST), mask.length), torsoCol);
  if (chestRow) {
    widths.chestW = runWidthPx(chestRow.run, gw, imgW);
    widths.levels.chest = T_CHEST;
    clean.chest = chestRow.clean;
  }

  // เอว = แคบสุดในช่วงซี่โครงล่าง→เหนือสะโพก
  const waist = scanBand(mask, yAt(T_WAIST_FROM), yAt(T_WAIST_TO), torsoCol, "min");
  if (waist) {
    widths.waistW = runWidthPx(waist.run, gw, imgW);
    widths.levels.waist = (waist.yNorm - shoulderMid.y) / delta;
    clean.waist = waist.clean;
  }

  // สะโพก = กว้างสุดรอบแนวสะโพก
  const hip = scanBand(mask, yAt(T_HIP_FROM), yAt(T_HIP_TO), torsoCol, "max");
  if (hip) {
    widths.hipW = runWidthPx(hip.run, gw, imgW);
    widths.levels.hip = (hip.yNorm - shoulderMid.y) / delta;
    clean.hip = hip.clean;
  }

  // คอ = แคบสุดระหว่างหูกับไหล่ (ใช้ x กึ่งกลางไหล่เป็นแกน — สะโพกอยู่ไกลเกินไปที่ระดับนี้)
  if (points.ear && points.ear.y < shoulderMid.y) {
    const neck = scanBand(mask, points.ear.y, shoulderMid.y, colOf(shoulderMid.x, gw), "min");
    if (neck) {
      widths.neckW = runWidthPx(neck.run, gw, imgW);
      widths.levels.neck = (neck.yNorm - shoulderMid.y) / delta;
      clean.neck = neck.clean;
    }
  }

  // ต้นขา/น่อง ซ้าย-ขวา
  const thighL = limbWidthPx(mask, imgW, points.hipL, points.kneeL, points.hipR, points.kneeR);
  if (thighL) {
    widths.thighLW = thighL.px;
    clean.thighL = thighL.clean;
  }
  const thighR = limbWidthPx(mask, imgW, points.hipR, points.kneeR, points.hipL, points.kneeL);
  if (thighR) {
    widths.thighRW = thighR.px;
    clean.thighR = thighR.clean;
  }
  const calfL = limbWidthPx(mask, imgW, points.kneeL, points.ankleL, points.kneeR, points.ankleR);
  if (calfL) {
    widths.calfLW = calfL.px;
    clean.calfL = calfL.clean;
  }
  const calfR = limbWidthPx(mask, imgW, points.kneeR, points.ankleR, points.kneeL, points.ankleL);
  if (calfR) {
    widths.calfRW = calfR.px;
    clean.calfR = calfR.clean;
  }

  return { widths, clean, imgW, imgH, points };
}

// ────────────────────────────────────────────────────────────────
// วัดภาพข้าง
// ────────────────────────────────────────────────────────────────

interface SideResult {
  widths: SideWidths;
  clean: Record<string, boolean>;
  imgW: number | null;
  imgH: number | null;
  points: {
    shoulder: MeasureLandmark | null;
    hip: MeasureLandmark | null;
    ear: MeasureLandmark | null;
  };
}

const EMPTY_SIDE_WIDTHS: SideWidths = {
  cmPerPx: null,
  bodyHeightPx: null,
  neckD: null,
  chestD: null,
  waistD: null,
  hipD: null,
  abdomenD: null,
};

/**
 * ความลึกที่ระดับ t เดียวกับภาพหน้า
 * 🔴 แปลง t ผ่านไหล่/สะโพก "ของภาพข้างเอง" ห้ามใช้ y ของภาพหน้าตรง ๆ
 *    สองภาพคนละเฟรม คนละระยะยืน — y เดียวกันอาจเป็นคนละส่วนของร่างกาย
 */
function measureSide(
  view: ViewInput | null | undefined,
  heightCm: number | null,
  levels: FrontWidths["levels"]
): SideResult {
  const shoulder = midPoint(lm(view?.landmarks, LM_SHOULDER_L), lm(view?.landmarks, LM_SHOULDER_R));
  const hip = midPoint(lm(view?.landmarks, LM_HIP_L), lm(view?.landmarks, LM_HIP_R));
  const points = { shoulder, hip, ear: betterOf(lm(view?.landmarks, LM_EAR_L), lm(view?.landmarks, LM_EAR_R)) };
  const clean: Record<string, boolean> = {};
  const imgW = isNum(view?.width) ? view!.width! : null;
  const imgH = isNum(view?.height) ? view!.height! : null;
  const { cmPerPx, bodyHeightPx } = cmPerPixel(heightCm, view?.maskBounds, imgH);
  const widths: SideWidths = { ...EMPTY_SIDE_WIDTHS, cmPerPx, bodyHeightPx };

  const mask = Array.isArray(view?.mask) && view!.mask!.length ? view!.mask! : null;
  const bail = (): SideResult => ({ widths, clean, imgW, imgH, points });
  if (!mask || !imgW || !shoulder || !hip) return bail();
  const gw = gridW(mask);
  const delta = hip.y - shoulder.y;
  if (!(delta > 0) || !gw) return bail();

  const centerCol = colOf(hip.x, gw);
  const depthAt = (t: number | null, key: string) => {
    if (t == null) return null;
    const got = torsoRunAt(mask, rowOf(shoulder.y + t * delta, mask.length), centerCol);
    if (!got) return null;
    clean[key] = got.clean;
    return runWidthPx(got.run, gw, imgW);
  };

  widths.neckD = depthAt(levels.neck, "neck");
  widths.chestD = depthAt(levels.chest, "chest");
  widths.waistD = depthAt(levels.waist, "waist");
  widths.hipD = depthAt(levels.hip, "hip");
  widths.abdomenD = depthAt(T_ABDOMEN, "abdomen");

  return { widths, clean, imgW, imgH, points };
}

// ────────────────────────────────────────────────────────────────
// เส้นรอบวง + ช่วง
// ────────────────────────────────────────────────────────────────

/**
 * เส้นรอบวงวงรีแบบ Ramanujan: C = π[3(a+b) − √((3a+b)(a+3b))]
 * a = ครึ่งความกว้าง · b = ครึ่งความลึก (ทั้งคู่เป็นเซนติเมตรแล้ว)
 * นี่คือวิธีมาตรฐานของ 2-view anthropometry (WO-BODY §1 ข้อ 2) — คลาดเคลื่อนสัมบูรณ์ ±2-3 ซม.
 * แต่ delta สัปดาห์ต่อสัปดาห์เชื่อได้ ถ้าคุมท่า/ระยะ/แสงเหมือนเดิม (นั่นคือหน้าที่ของ quality gate)
 */
export function ellipseCircumference(a: number, b: number): number | null {
  if (!isNum(a) || !isNum(b) || a <= 0 || b <= 0) return null;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** สร้างช่วงรอบค่ากลาง: ครึ่งช่วง = max(1.5ซม., 4% ของ mid) และกว้างขึ้น 1.5 เท่าเมื่อ conf ต่ำ */
export function buildEstimate(mid: number, conf: Conf, method: EstimateMethod): Estimate | null {
  if (!isNum(mid) || mid <= 0) return null;
  const half = Math.max(MIN_HALF_RANGE_CM, HALF_RANGE_PCT * mid) * (conf === "low" ? LOW_CONF_RANGE_MULT : 1);
  return {
    lo: round(mid - half, 1),
    mid: round(mid, 1),
    hi: round(mid + half, 1),
    conf,
    method,
  };
}

interface GirthArgs {
  widthPx: number | null;
  depthPx: number | null;
  cmPerPxFront: number | null;
  cmPerPxSide: number | null;
  /** อัตราส่วน ลึก/กว้าง ตอนไม่มีภาพข้าง */
  fallbackK: number;
  conf: Conf;
  cleanFront?: boolean;
  cleanSide?: boolean;
}

/**
 * กว้าง(+ลึก) → เส้นรอบวงเป็นเซนติเมตร
 * มีภาพข้าง = 2view · ไม่มี = เดา b = a×k แล้วลด conf ลงหนึ่งขั้น (ยังบอกตรง ๆ ผ่าน method ว่าเดามา)
 */
function girthEstimate(args: GirthArgs): Estimate | null {
  const { widthPx, depthPx, cmPerPxFront, cmPerPxSide, fallbackK } = args;
  if (!isNum(widthPx) || widthPx <= 0 || !isNum(cmPerPxFront)) return null;
  const widthCm = widthPx * cmPerPxFront;
  let conf = args.conf;
  if (args.cleanFront === false) conf = stepDownConf(conf);

  let depthCm: number;
  let method: EstimateMethod;
  if (isNum(depthPx) && depthPx > 0 && isNum(cmPerPxSide)) {
    depthCm = depthPx * cmPerPxSide;
    method = "2view";
    if (args.cleanSide === false) conf = stepDownConf(conf);
  } else {
    depthCm = widthCm * fallbackK;
    method = "1view";
    conf = stepDownConf(conf);
  }

  const c = ellipseCircumference(widthCm / 2, depthCm / 2);
  if (c == null) return null;
  return buildEstimate(c, conf, method);
}

// ────────────────────────────────────────────────────────────────
// US Navy Body Fat
// ────────────────────────────────────────────────────────────────

export type NavySex = "male" | "female";

/** เพศจากโปรไฟล์ — ค่าอื่น/ว่าง = ไม่คิด BF (WO-BP-2 §B2: ไม่มีเพศ = null ห้ามเดา) */
export function normalizeSex(raw: unknown): NavySex | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "male" || s === "m" || s === "ชาย") return "male";
  if (s === "female" || s === "f" || s === "หญิง") return "female";
  return null;
}

/**
 * US Navy (หน่วยเซนติเมตร)
 *   ชาย   495/(1.0324 − 0.19077·log10(เอว−คอ) + 0.15456·log10(สูง)) − 450
 *   หญิง  495/(1.29579 − 0.35004·log10(เอว+สะโพก−คอ) + 0.22100·log10(สูง)) − 450
 * สูตรเปิด อธิบายได้ ไม่ใช่กล่องดำ (WO-BODY §1 ข้อ 3)
 * ค่าที่ใส่ต้องทำให้ log มีความหมาย (ผลต่างต้องเป็นบวก) ไม่งั้น = null
 */
export function navyBodyFat(
  sex: NavySex,
  waistCm: number,
  neckCm: number,
  heightCm: number,
  hipCm?: number | null
): number | null {
  if (!isNum(waistCm) || !isNum(neckCm) || !isNum(heightCm) || heightCm <= 0) return null;
  const log10 = (v: number) => Math.log10(v);
  let denom: number;
  if (sex === "male") {
    const d = waistCm - neckCm;
    if (d <= 0) return null;
    denom = 1.0324 - 0.19077 * log10(d) + 0.15456 * log10(heightCm);
  } else {
    if (!isNum(hipCm)) return null;
    const d = waistCm + hipCm - neckCm;
    if (d <= 0) return null;
    denom = 1.29579 - 0.35004 * log10(d) + 0.221 * log10(heightCm);
  }
  if (!(denom > 0)) return null;
  const bf = 495 / denom - 450;
  return isNum(bf) ? bf : null;
}

// ────────────────────────────────────────────────────────────────
// ตัวหลัก
// ────────────────────────────────────────────────────────────────

export interface MeasureInput {
  front?: ViewInput | null;
  side?: ViewInput | null;
  heightCm?: number | null;
  /** เพศจากโปรไฟล์ — ไม่มี = ไม่คิด BF */
  gender?: string | null;
}

export interface MeasureOutput {
  widthsPx: WidthsPx;
  estimates: Estimates;
}

function emptyEstimates(heightCm: number | null, cmF: number | null, cmS: number | null): Estimates {
  return {
    neckCm: null,
    chestCm: null,
    waistCm: null,
    hipCm: null,
    shoulderCm: null,
    thighLCm: null,
    thighRCm: null,
    calfLCm: null,
    calfRCm: null,
    whr: null,
    swr: null,
    bfPct: null,
    symmetry: { thighDiffCm: null, calfDiffCm: null },
    posture: {
      headForward: null,
      headForwardFrac: null,
      shoulderTilt: null,
      shoulderTiltDeg: null,
      hipTilt: null,
      hipTiltDeg: null,
    },
    scale: { heightCm, cmPerPxFront: cmF, cmPerPxSide: cmS },
    suspect: false,
  };
}

export function measureBody(input: MeasureInput): MeasureOutput {
  const heightCm = isNum(input.heightCm) && input.heightCm > 0 ? input.heightCm : null;
  const front = measureFront(input.front, heightCm);
  const side = measureSide(input.side, heightCm, front.widths.levels);

  const widthsPx: WidthsPx = {
    front: input.front ? front.widths : null,
    side: input.side ? side.widths : null,
  };

  const cmF = front.widths.cmPerPx;
  const cmS = side.widths.cmPerPx;
  const est = emptyEstimates(heightCm, cmF, cmS);

  // posture คิดได้แม้ไม่มีส่วนสูง (เป็นมุม/สัดส่วน ไม่ใช่เซนติเมตร) — แต่ headForward ต้องมีความสูงร่างพิกเซล
  est.posture = posture(front, side);

  // 🔴 ไม่มีส่วนสูง = ไม่มีสเกล = คิดเป็นเซนติเมตรไม่ได้เลย → ทุก estimate เป็น null (ห้ามเดา)
  if (!heightCm || !isNum(cmF)) return { widthsPx, estimates: est };

  const p = front.points;
  const sp = side.points;
  const torsoPts = [p.shoulderL, p.shoulderR, p.hipL, p.hipR];
  const sideTorsoPts = [sp.shoulder, sp.hip];

  const confFor = (pts: (MeasureLandmark | null)[], usedSide: boolean): Conf =>
    usedSide ? worstConf(visConf(pts), visConf(sideTorsoPts)) : visConf(pts);

  est.waistCm = girthEstimate({
    widthPx: front.widths.waistW,
    depthPx: side.widths.waistD,
    cmPerPxFront: cmF,
    cmPerPxSide: cmS,
    fallbackK: DEPTH_RATIO.waist,
    conf: confFor(torsoPts, side.widths.waistD != null),
    cleanFront: front.clean.waist,
    cleanSide: side.clean.waist,
  });
  est.hipCm = girthEstimate({
    widthPx: front.widths.hipW,
    depthPx: side.widths.hipD,
    cmPerPxFront: cmF,
    cmPerPxSide: cmS,
    fallbackK: DEPTH_RATIO.hip,
    conf: confFor([p.hipL, p.hipR], side.widths.hipD != null),
    cleanFront: front.clean.hip,
    cleanSide: side.clean.hip,
  });
  est.chestCm = girthEstimate({
    widthPx: front.widths.chestW,
    depthPx: side.widths.chestD,
    cmPerPxFront: cmF,
    cmPerPxSide: cmS,
    fallbackK: DEPTH_RATIO.chest,
    conf: confFor(torsoPts, side.widths.chestD != null),
    cleanFront: front.clean.chest,
    cleanSide: side.clean.chest,
  });
  est.neckCm = girthEstimate({
    widthPx: front.widths.neckW,
    depthPx: side.widths.neckD,
    cmPerPxFront: cmF,
    cmPerPxSide: cmS,
    fallbackK: DEPTH_RATIO.neck,
    conf: confFor([p.ear, p.shoulderL, p.shoulderR], side.widths.neckD != null),
    cleanFront: front.clean.neck,
    cleanSide: side.clean.neck,
  });

  /* ไหล่/ต้นขา/น่อง = "ความกว้าง" เป็นเซนติเมตร ไม่ใช่เส้นรอบวง
     WO ให้อัตราส่วนความลึกไว้เฉพาะ เอว/สะโพก/อก/คอ — แขนขาไม่มีตัวเลขให้ จึงไม่แปลงเป็นรอบวง
     (จะแปลงก็ต้องเดา k ขึ้นมาเอง ซึ่งผิดกติกา "ห้ามเดา" — และงานที่ต้องใช้จริงคือส่วนต่างซ้าย-ขวา ซึ่งใช้ความกว้างได้) */
  const widthEstimate = (px: number | null, conf: Conf, clean?: boolean) =>
    isNum(px) ? buildEstimate(px * cmF, clean === false ? stepDownConf(conf) : conf, "width") : null;

  est.shoulderCm = widthEstimate(front.widths.shoulderW, visConf([p.shoulderL, p.shoulderR]));
  est.thighLCm = widthEstimate(front.widths.thighLW, visConf([p.hipL, p.kneeL]), front.clean.thighL);
  est.thighRCm = widthEstimate(front.widths.thighRW, visConf([p.hipR, p.kneeR]), front.clean.thighR);
  est.calfLCm = widthEstimate(front.widths.calfLW, visConf([p.kneeL, p.ankleL]), front.clean.calfL);
  est.calfRCm = widthEstimate(front.widths.calfRW, visConf([p.kneeR, p.ankleR]), front.clean.calfR);

  // สมมาตร — มีครบสองข้างเท่านั้น (ข้างเดียวเทียบกับอะไรไม่ได้)
  est.symmetry = {
    thighDiffCm:
      est.thighLCm && est.thighRCm ? round(Math.abs(est.thighLCm.mid - est.thighRCm.mid), 1) : null,
    calfDiffCm: est.calfLCm && est.calfRCm ? round(Math.abs(est.calfLCm.mid - est.calfRCm.mid), 1) : null,
  };

  est.whr = ratioEstimate(est.waistCm, est.hipCm);
  est.swr = ratioEstimate(est.shoulderCm, est.waistCm);

  // ── Body Fat ──
  const sex = normalizeSex(input.gender);
  if (sex && est.waistCm && est.neckCm && (sex === "male" || est.hipCm)) {
    const bfOf = (waist: number, neck: number, hip: number | null) =>
      navyBodyFat(sex, waist, neck, heightCm, hip);
    // BF โตตามเอว(และสะโพกในสูตรหญิง) และลดตามคอ → ขอบล่าง/บนต้องจับคู่ค่าให้ถูกด้าน
    const mid = bfOf(est.waistCm.mid, est.neckCm.mid, est.hipCm?.mid ?? null);
    const lo = bfOf(est.waistCm.lo, est.neckCm.hi, est.hipCm?.lo ?? null);
    const hi = bfOf(est.waistCm.hi, est.neckCm.lo, est.hipCm?.hi ?? null);
    const conf = worstConf(est.waistCm.conf, est.neckCm.conf, ...(est.hipCm ? [est.hipCm.conf] : []));
    if (mid == null || mid < BF_MIN_PCT || mid > BF_MAX_PCT) {
      /* ผลติดลบ/เกิน 60 หรือคิดไม่ออกเลย (เอวเล็กกว่าคอ) = ข้อมูลชุดนี้เพี้ยน
         สาเหตุจริงมักเป็นเงาร่างรวมแขน/ยืนเอียง/ส่วนสูงในโปรไฟล์ผิด
         → ไม่โชว์ BF และกด conf ทั้งชุดเป็น low เพราะถ้า BF เพี้ยน เอว-คอที่ป้อนมันก็เพี้ยนด้วย (WO-BP-2 §B2) */
      est.bfPct = null;
      est.suspect = true;
    } else {
      est.bfPct = {
        lo: round(clamp(lo ?? mid, BF_MIN_PCT, BF_MAX_PCT), 1),
        mid: round(mid, 1),
        hi: round(clamp(hi ?? mid, BF_MIN_PCT, BF_MAX_PCT), 1),
        conf,
        method: "navy",
      };
    }
  }

  if (est.suspect) downgradeAll(est);
  return { widthsPx, estimates: est };
}

/** สัดส่วนของสอง estimate — ขอบช่วงจับคู่ตรงข้ามกัน (lo/hi แล้ว hi/lo) ไม่ใช่ lo/lo */
function ratioEstimate(num: Estimate | null, den: Estimate | null): Estimate | null {
  if (!num || !den || den.mid <= 0 || den.lo <= 0) return null;
  const mid = num.mid / den.mid;
  return {
    lo: round(num.lo / den.hi, 3),
    mid: round(mid, 3),
    hi: round(num.hi / den.lo, 3),
    conf: worstConf(num.conf, den.conf),
    method: "ratio",
  };
}

/** กด conf ทุกค่าเป็น low (ใช้ตอนข้อมูลชุดนี้ถูกจับได้ว่าเพี้ยน) */
function downgradeAll(est: Estimates): void {
  for (const key of Object.keys(est) as (keyof Estimates)[]) {
    const v = est[key];
    if (v && typeof v === "object" && "conf" in v) (v as Estimate).conf = "low";
  }
}

function posture(front: FrontResult, side: SideResult): PostureFlags {
  const out: PostureFlags = {
    headForward: null,
    headForwardFrac: null,
    shoulderTilt: null,
    shoulderTiltDeg: null,
    hipTilt: null,
    hipTiltDeg: null,
  };

  /* หัวยื่น — ภาพข้างเท่านั้น (ภาพหน้าเห็นหู-ไหล่ซ้อนกันในแนวลึก จึงบอกอะไรไม่ได้เลย)
     🔴 dx ต้องแปลงเป็นพิกเซลก่อนหารด้วยความสูงร่างพิกเซล — สองแกนใช้ตัวหารคนละตัว
        (x เทียบความกว้างภาพ · y เทียบความสูงภาพ) ลืมแปลงแล้วเกณฑ์ 4% จะกลายเป็นคนละเกณฑ์ */
  const bodyPx = side.widths.bodyHeightPx;
  if (side.points.ear && side.points.shoulder && isNum(bodyPx) && bodyPx > 0 && isNum(side.imgW)) {
    const dxPx = Math.abs(side.points.ear.x - side.points.shoulder.x) * side.imgW;
    const frac = dxPx / bodyPx;
    out.headForwardFrac = round(frac, 4);
    out.headForward = frac > HEAD_FORWARD_FRAC;
  }

  const p = front.points;
  const sTilt = tiltDegrees(p.shoulderL, p.shoulderR, front.imgW, front.imgH);
  const hTilt = tiltDegrees(p.hipL, p.hipR, front.imgW, front.imgH);
  if (sTilt != null) {
    out.shoulderTiltDeg = sTilt;
    out.shoulderTilt = sTilt > TILT_FLAG_DEG;
  }
  if (hTilt != null) {
    out.hipTiltDeg = hTilt;
    out.hipTilt = hTilt > TILT_FLAG_DEG;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// calibration ด้วยสายวัดจริงของคนคนนั้น (WO-BODY §8 ความเสี่ยง 1)
// ────────────────────────────────────────────────────────────────

/** ชื่อ site ใน BodyMeasurement ↔ key ใน estimates */
export const SITE_TO_ESTIMATE: Record<string, keyof Estimates> = {
  waist: "waistCm",
  hip: "hipCm",
  chest: "chestCm",
  neck: "neckCm",
  shoulder: "shoulderCm",
  thigh_l: "thighLCm",
  thigh_r: "thighRCm",
  calf_l: "calfLCm",
  calf_r: "calfRCm",
};

/**
 * ป้ายไทยของแต่ละจุดวัด — อยู่ที่นี่เพราะทั้ง API สายวัดและ API เทรนด์ต้องใช้ชุดเดียวกัน
 * (เก็บไว้ในไฟล์ route แล้วให้อีก route import ข้ามกัน = ที่มาของคำเรียกที่เพี้ยนกันคนละหน้า)
 */
export const SITE_LABELS_TH: Record<string, string> = {
  waist: "เอว",
  hip: "สะโพก",
  chest: "รอบอก",
  shoulder: "ไหล่",
  neck: "คอ",
  arm_l: "ต้นแขนซ้าย",
  arm_r: "ต้นแขนขวา",
  thigh_l: "ต้นขาซ้าย",
  thigh_r: "ต้นขาขวา",
  calf_l: "น่องซ้าย",
  calf_r: "น่องขวา",
};

/** คู่ "สายวัดจริง ↔ ค่าที่ระบบประมาณของสแกนที่อยู่ในช่วง ±3 วัน" */
export interface TapePair {
  site: string;
  tapeCm: number;
  /** mid ก่อน calibrate ของสแกนที่จับคู่ */
  cvMid: number;
}

export function median(values: number[]): number | null {
  const v = values.filter(isNum).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface CalibrateOptions {
  /** ใส่มาเมื่ออยากให้ BF ถูกคิดใหม่ตามค่าที่ calibrate แล้ว (ไม่ใส่ = คง BF เดิม) */
  heightCm?: number | null;
  gender?: string | null;
}

/**
 * เลื่อน lo/mid/hi ทั้งเส้นของแต่ละ site ด้วย offset = median(สายวัด − ค่าที่ระบบประมาณ)
 *
 * ทำไมเป็น median ไม่ใช่ mean: สายวัดที่พิมพ์ผิดหนึ่งครั้ง (78 เป็น 87) จะลาก mean ไปทั้งเส้น
 * ทำไมเลื่อนทั้งเส้นไม่ใช่แทนค่า: สายวัดมีแค่วันที่วัด แต่กราฟต้องต่อเนื่องทุกสแกน
 *   ระบบเรียน "ความเอนเฉพาะตัว" ของคนคนนี้ (รูปร่าง/ท่ายืน/เสื้อผ้า) แล้วใช้กับทุกจุดในเส้นเดียวกัน
 * 🔴 offset ต้องคิดจาก rawMid เสมอ ไม่งั้นรอบถัดไปจะ calibrate ทับของเดิมจนเลื่อนสองเท่า
 */
export function applyTapeOffset(
  estimates: Estimates,
  pairs: TapePair[],
  opts: CalibrateOptions = {}
): Estimates {
  const out: Estimates = { ...estimates, symmetry: { ...estimates.symmetry }, posture: { ...estimates.posture } };
  if (!Array.isArray(pairs) || !pairs.length) return out;

  const bySite = new Map<string, number[]>();
  for (const p of pairs) {
    if (!p || !isNum(p.tapeCm) || !isNum(p.cvMid)) continue;
    const key = SITE_TO_ESTIMATE[String(p.site)];
    if (!key) continue;
    const list = bySite.get(key) ?? [];
    list.push(p.tapeCm - p.cvMid);
    bySite.set(key, list);
  }

  const slots = out as unknown as Record<string, Estimate | null>;
  let touchedBfInput = false;
  for (const [key, diffs] of bySite) {
    const offset = median(diffs);
    if (offset == null) continue;
    const cur = slots[key];
    if (!cur) continue;
    /* เลื่อนทั้งเส้นโดยคงความกว้างช่วงเดิมไว้ — สายวัดบอกตำแหน่ง ไม่ได้บอกว่าเราแม่นขึ้น
       (ผู้เรียกต้องส่ง cvMid = rawMid เสมอ ค่า offset จึงคิดจากฐานเดียวกันทุกครั้ง) */
    const raw = isNum(cur.rawMid) ? cur.rawMid : cur.mid;
    const loGap = cur.mid - cur.lo;
    const hiGap = cur.hi - cur.mid;
    const mid = raw + offset;
    slots[key] = {
      ...cur,
      lo: round(mid - loGap, 1),
      mid: round(mid, 1),
      hi: round(mid + hiGap, 1),
      rawMid: round(raw, 1),
      calibrated: true,
    };
    if (key === "waistCm" || key === "hipCm" || key === "neckCm") touchedBfInput = true;
  }

  // ค่าที่ต่อยอดจากของที่เพิ่งเลื่อน ต้องคิดใหม่ ไม่งั้นจะขัดกันเอง (เอวเลื่อนแล้วแต่ WHR ยังเป็นของเก่า)
  out.whr = ratioEstimate(out.waistCm, out.hipCm);
  out.swr = ratioEstimate(out.shoulderCm, out.waistCm);
  if (touchedBfInput) {
    const sex = normalizeSex(opts.gender);
    const heightCm = isNum(opts.heightCm) && opts.heightCm > 0 ? opts.heightCm : null;
    if (sex && heightCm && out.waistCm && out.neckCm && (sex === "male" || out.hipCm)) {
      const bfOf = (waist: number, neck: number, hip: number | null) =>
        navyBodyFat(sex, waist, neck, heightCm, hip);
      const mid = bfOf(out.waistCm.mid, out.neckCm.mid, out.hipCm?.mid ?? null);
      const lo = bfOf(out.waistCm.lo, out.neckCm.hi, out.hipCm?.lo ?? null);
      const hi = bfOf(out.waistCm.hi, out.neckCm.lo, out.hipCm?.hi ?? null);
      out.bfPct =
        mid == null || mid < BF_MIN_PCT || mid > BF_MAX_PCT
          ? null
          : {
              lo: round(clamp(lo ?? mid, BF_MIN_PCT, BF_MAX_PCT), 1),
              mid: round(mid, 1),
              hi: round(clamp(hi ?? mid, BF_MIN_PCT, BF_MAX_PCT), 1),
              conf: worstConf(out.waistCm.conf, out.neckCm.conf, ...(out.hipCm ? [out.hipCm.conf] : [])),
              method: "navy",
              calibrated: true,
            };
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// noise floor
// ────────────────────────────────────────────────────────────────

export type TrendLabel = "up" | "down" | "flat";

/**
 * เทรนด์เทียบสแกนก่อนหน้า — เล็กกว่าพื้นสัญญาณรบกวน = "คงที่" (WO-BODY §1 🔴)
 *
 * ระบบวัดจากภาพมีความคลาดเคลื่อนประมาณ ±1 ซม.อยู่แล้ว
 * ถ้าโชว์ลูกศรทุกครั้งที่ตัวเลขขยับ 0.3 ซม. เราจะเล่านิทานว่า "เอวลดลง" ให้ user ฟังทุกสัปดาห์
 * โดยที่ร่างกายเขาไม่ได้เปลี่ยนอะไรเลย — แล้ววันที่เขาลดได้จริง เขาจะไม่เชื่อเราอีก
 * 🔴 ฝั่งจอห้ามคิดเทรนด์เอง ต้องเรียกตัวนี้เท่านั้น
 */
export function trendLabel(
  prev: number | null | undefined,
  curr: number | null | undefined,
  floorCm: number = TREND_FLOOR_CM
): TrendLabel | null {
  if (!isNum(prev) || !isNum(curr)) return null;
  const floor = isNum(floorCm) ? Math.abs(floorCm) : TREND_FLOOR_CM;
  const d = curr - prev;
  if (Math.abs(d) < floor) return "flat";
  return d > 0 ? "up" : "down";
}
