/**
 * เทสตัววัดร่างกาย (BP-2 · WO-BP-2 §B4) — รัน: npx tsx scripts/test-body-measure.ts
 *
 * ทำไมต้องมี: ตัวเลขจากไฟล์นี้กลายเป็นจุดบนกราฟที่ user เชื่อไปอีกหลายเดือน
 *   สูตรผิดหนึ่งตัว = เทรนด์ทั้งเส้นผิดแบบ "ดูสมเหตุผล" ซึ่งจับได้ยากกว่าพังโต้ง ๆ
 *   และตัวเลขที่ควรเป็น null แต่ดันมีค่า = ระบบเดาแทนลูกค้าโดยไม่บอกว่าเดา
 *
 * 🔴 ห้ามใช้รูปคนจริงในเทสนี้เด็ดขาด — ทุกเคสเป็น "คนกระดาษ" ที่สร้างจากสี่เหลี่ยมในตารางเงาร่าง
 *    ข้อดีที่สำคัญกว่าเรื่องความเป็นส่วนตัว: เรารู้ขนาดจริงของมันทุกช่อง จึงเทียบกับค่าที่คำนวณมือได้
 *    (รูปคนจริงไม่มีใครรู้คำตอบที่ถูก — เทสที่ไม่มีคำตอบที่ถูกคือเทสที่ผ่านเสมอ)
 *
 * เลขที่คาดหวังทั้งหมดในไฟล์นี้คำนวณมือจากขนาดของคนกระดาษ (ดูตาราง "ขนาดจริงของคนกระดาษ" ด้านล่าง)
 */
import {
  applyTapeOffset,
  base64ToBytes,
  buildEstimate,
  cmPerPixel,
  decodeMaskGrid,
  ellipseCircumference,
  measureBody,
  median,
  navyBodyFat,
  runsAt,
  trendLabel,
  DEPTH_RATIO,
  HALF_RANGE_PCT,
  MIN_HALF_RANGE_CM,
  LOW_CONF_RANGE_MULT,
  TREND_FLOOR_BF,
  TREND_FLOOR_CM,
  type Estimates,
  type MeasureLandmark,
  type PackedMaskGrid,
  type ViewInput,
} from "../src/lib/bodyMeasure";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const near = (a: number | null | undefined, b: number, tol = 0.05) =>
  typeof a === "number" && Number.isFinite(a) && Math.abs(a - b) <= tol;

// ── ขนาดภาพและตาราง (เท่ากับที่ worker คืนมาจริง) ──
const GW = 128;
const GH = 256;
const IMG_W = 720;
const IMG_H = 1280;
/** 1 ช่องตาราง = กี่พิกเซลของภาพจริง */
const PX_PER_COL = IMG_W / GW; // 5.625
/** ส่วนสูงที่ใช้ในเทสทุกเคส — เลือกให้ cmPerPx ลงตัวพอดี */
const HEIGHT_CM = 180;

/* ── ขนาดจริงของคนกระดาษ (คำนวณมือ) ──────────────────────────────
   เงาร่างกินแถว 8..247 → 240 แถว × (1280/256) = 1200 พิกเซล
   cmPerPx = 180 ÷ 1200 = 0.15 ซม./พิกเซล  →  1 ช่องตาราง = 5.625 px = 0.84375 ซม.
   ภาพหน้า : คอ 12 ช่อง · อก 44 · เอว 36 · สะโพก 46 · ต้นขา 14 · น่อง 10
   ภาพข้าง : คอ 10 ช่อง · อก 30 · เอว 24 · สะโพก 32
   แนวไหล่ = แถว 40 · แนวสะโพก = แถว 130 (ภาพหน้า) → Δ = 90 แถว
   ภาพข้างตั้งใจให้ "คนละเฟรม": แนวไหล่ = แถว 50 · แนวสะโพก = แถว 145 → Δ = 95 แถว
   ─────────────────────────────────────────────────────────────── */
const CM_PER_PX = 0.15;
const CM_PER_CELL = PX_PER_COL * CM_PER_PX; // 0.84375

const cellsToCm = (n: number) => n * CM_PER_CELL;
const cellsToPx = (n: number) => n * PX_PER_COL;

/** สูตร Ramanujan เขียนซ้ำในเทส (ตั้งใจ) — ถ้าลอก import มาใช้ เทสจะผ่านแม้สูตรในไลบรารีถูกแก้ผิด */
function handRamanujan(widthCm: number, depthCm: number): number {
  const a = widthCm / 2;
  const b = depthCm / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

// ── ตัวสร้างตารางเงาร่าง ──
function blankGrid(): boolean[][] {
  return Array.from({ length: GH }, () => new Array<boolean>(GW).fill(false));
}
/** วาดสี่เหลี่ยมทึบ (แถว/คอลัมน์แบบรวมปลายทั้งสองข้าง) */
function fillRect(grid: boolean[][], r0: number, r1: number, c0: number, c1: number): void {
  for (let r = Math.max(0, r0); r <= Math.min(GH - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(GW - 1, c1); c++) grid[r][c] = true;
  }
}
/** แถบกว้าง n ช่อง จัดกึ่งกลางที่คอลัมน์ 63.5 (= x 0.496 ซึ่งเป็นแกนกลางของคนกระดาษ) */
function fillBand(grid: boolean[][], r0: number, r1: number, n: number): void {
  fillRect(grid, r0, r1, 64 - n / 2, 63 + n / 2);
}
const col = (c: number) => c / GW;
const row = (r: number) => r / GH;

function point(x: number, y: number, visibility = 0.95): MeasureLandmark {
  return { x, y, visibility };
}

/** ชุด landmark 33 จุดที่ใส่เฉพาะจุดที่ตัววัดใช้ (ที่เหลือเป็นจุดกลางภาพ เหมือน worker ที่คืนครบ 33 เสมอ) */
function landmarkSet(
  overrides: Record<number, MeasureLandmark>,
  visibility = 0.95
): MeasureLandmark[] {
  const pts: MeasureLandmark[] = Array.from({ length: 33 }, () => point(0.5, 0.5, visibility));
  for (const [i, p] of Object.entries(overrides)) pts[Number(i)] = p;
  return pts;
}

// ── คนกระดาษ: ภาพหน้า ──
interface DollOpts {
  waistCells?: number;
  hipCells?: number;
  chestCells?: number;
  neckCells?: number;
  thighLCells?: number;
  thighRCells?: number;
  /** ขาชิดกัน (วาดเป็นก้อนเดียว) */
  legsTogether?: boolean;
  /** ก้อนแยกเพิ่มข้าง ๆ (จำลองมือ) — ทำให้แถวมี ≥2 run ทั้งที่ขายังติดกัน */
  extraBlob?: boolean;
  /** เอียงไหล่/สะโพกกี่องศา (คิดในหน่วยพิกเซลจริง แล้วแปลงกลับเป็นสัดส่วน) */
  tiltDeg?: number;
  visibility?: number;
}

function frontDoll(opts: DollOpts = {}): ViewInput {
  const {
    waistCells = 36,
    hipCells = 46,
    chestCells = 44,
    neckCells = 12,
    thighLCells = 14,
    thighRCells = 14,
    legsTogether = false,
    extraBlob = false,
    tiltDeg = 0,
    visibility = 0.95,
  } = opts;

  const g = blankGrid();
  fillBand(g, 8, 29, 16); // หัว
  fillBand(g, 30, 35, neckCells); // คอ — แคบสุดในช่วง [หู, ไหล่]
  /* ลำตัวบนแบ่งสองช่วงโดยตั้งใจ: ระดับอก t=0.30 ตกที่แถว 67 พอดี
     ถ้าใครไปขยับ T_CHEST ระดับจะเลื่อนไปโดนช่วงล่างที่แคบกว่า แล้วเทสจะจับได้ทันที
     (แถบเดียวสม่ำเสมอ = เทสผ่านแม้ระดับผิด ซึ่งคือเทสที่ไม่ได้เทสอะไรเลย) */
  fillBand(g, 36, 69, chestCells); // แถว 67 = ระดับอก
  fillBand(g, 70, 88, chestCells - 6);
  fillBand(g, 89, 104, waistCells + 4);
  fillBand(g, 105, 114, waistCells); // เอว — แคบสุดในช่วง t 0.55-0.92
  fillBand(g, 115, 122, waistCells + 2);
  fillBand(g, 123, 129, hipCells - 6);
  fillBand(g, 130, 140, hipCells); // สะโพก — กว้างสุดในช่วง t 0.95-1.18
  fillBand(g, 141, 150, hipCells - 4);

  if (legsTogether) {
    fillRect(g, 151, 247, 48, 79); // ขาติดกันเป็นก้อนเดียว
  } else {
    fillRect(g, 151, 190, 80 - thighLCells, 79); // ต้นขา "ซ้าย" (ฝั่งขวาของภาพ)
    fillRect(g, 151, 190, 48, 47 + thighRCells); // ต้นขา "ขวา"
    fillRect(g, 191, 247, 68, 77); // น่องซ้าย 10 ช่อง
    fillRect(g, 191, 247, 50, 59); // น่องขวา 10 ช่อง
  }
  if (extraBlob) fillRect(g, 151, 247, 10, 15); // ก้อนแยก: แถวมี 2 run แต่ขายังติดกัน

  // เอียง: หมุนปลายไหล่/สะโพกในหน่วยพิกเซลจริงก่อน แล้วค่อยแปลงกลับเป็นสัดส่วน
  const dyPx = Math.tan((tiltDeg * Math.PI) / 180) * (44 * PX_PER_COL);
  const dy = dyPx / IMG_H / 2;

  const landmarks = landmarkSet(
    {
      7: point(col(63.5), row(25), visibility), // หู (ใช้เป็นขอบบนของช่วงคอ)
      8: point(col(63.5), row(25), visibility),
      11: point(col(63.5 + 22), row(40) + dy, visibility), // ไหล่ซ้าย
      12: point(col(63.5 - 22), row(40) - dy, visibility), // ไหล่ขวา
      23: point(col(72.5), row(130) + dy, visibility), // สะโพกซ้าย
      24: point(col(54.5), row(130) - dy, visibility),
      25: point(col(72.5), row(190), visibility), // เข่า
      26: point(col(54.5), row(190), visibility),
      27: point(col(72.5), row(240), visibility), // ข้อเท้า
      28: point(col(54.5), row(240), visibility),
    },
    visibility
  );

  return {
    landmarks,
    mask: g,
    maskBounds: { top: row(8), bottom: row(248), left: col(10), right: col(118) },
    width: IMG_W,
    height: IMG_H,
  };
}

// ── คนกระดาษ: ภาพข้าง (คนละเฟรม — ไหล่/สะโพกคนละแถวกับภาพหน้าโดยตั้งใจ) ──
interface SideOpts {
  waistCells?: number;
  hipCells?: number;
  chestCells?: number;
  neckCells?: number;
  /** ระยะหู-ไหล่แนวนอน เป็นช่องตาราง (0 = หัวตรง) */
  earOffsetCells?: number;
  visibility?: number;
}

function sideDoll(opts: SideOpts = {}): ViewInput {
  const {
    waistCells = 24,
    hipCells = 32,
    chestCells = 30,
    neckCells = 10,
    earOffsetCells = 0,
    visibility = 0.95,
  } = opts;

  const g = blankGrid();
  fillBand(g, 12, 35, 18); // หัว
  fillBand(g, 36, 44, neckCells); // คอ (ระดับคอของภาพหน้าแปลงมาอยู่แถว 39)
  /* 🔴 แถบล่างสุดของแต่ละช่วงตั้งใจให้ต่างกัน เพื่อพิสูจน์ว่าโค้ดแปลงระดับผ่านไหล่/สะโพก "ของภาพข้างเอง"
     ถ้าใครเผลอเอา y ของภาพหน้ามาใช้ตรง ๆ (อก=แถว 67 · เอว=แถว 105) จะไปโดนแถบที่แคบกว่า แล้วเทสตก */
  fillBand(g, 45, 72, chestCells - 4);
  fillBand(g, 73, 100, chestCells); // อก (แถวที่แปลงแล้ว = 78)
  fillBand(g, 101, 112, waistCells - 4);
  fillBand(g, 113, 130, waistCells); // เอว/สะดือ (แถวที่แปลงแล้ว = 119 และ 121)
  fillBand(g, 131, 160, hipCells); // สะโพก (แถว 145)
  fillBand(g, 161, 251, 12); // ขา (ภาพข้างขาบังกัน = run เดียว)

  const landmarks = landmarkSet(
    {
      7: point(col(63.5 + earOffsetCells), row(20), visibility),
      8: point(col(63.5 + earOffsetCells), row(20), visibility),
      11: point(col(63.5), row(50), visibility), // ไหล่สองข้างซ้อนกันในภาพข้าง
      12: point(col(63.5), row(50), visibility),
      23: point(col(63.5), row(145), visibility),
      24: point(col(63.5), row(145), visibility),
      25: point(col(63.5), row(200), visibility),
      26: point(col(63.5), row(200), visibility),
      27: point(col(63.5), row(240), visibility),
      28: point(col(63.5), row(240), visibility),
    },
    visibility
  );

  return {
    landmarks,
    mask: g,
    maskBounds: { top: row(12), bottom: row(252), left: col(20), right: col(108) },
    width: IMG_W,
    height: IMG_H,
  };
}

const measure = (front: ViewInput | null, side: ViewInput | null, gender: string | null = "male", heightCm: number | null = HEIGHT_CM) =>
  measureBody({ front, side, heightCm, gender });

console.log("\n── 1. สเกลจากส่วนสูง ──");
{
  const bounds = { top: row(8), bottom: row(248), left: 0, right: 1 };
  const s = cmPerPixel(HEIGHT_CM, bounds, IMG_H);
  check("ความสูงร่าง 240 แถว = 1200 พิกเซล", near(s.bodyHeightPx, 1200, 0.001), String(s.bodyHeightPx));
  check("cmPerPx = 180/1200 = 0.15", near(s.cmPerPx, CM_PER_PX, 1e-9), String(s.cmPerPx));
  check(
    "ไม่มีส่วนสูง = ไม่มีสเกล (แต่ยังรู้ความสูงพิกเซล ไว้ใช้กับ posture)",
    cmPerPixel(null, bounds, IMG_H).cmPerPx === null && cmPerPixel(null, bounds, IMG_H).bodyHeightPx === 1200
  );
  check("ไม่มีกรอบ mask = ไม่มีสเกล", cmPerPixel(HEIGHT_CM, null, IMG_H).cmPerPx === null);
  check("กรอบสูงศูนย์ = ไม่มีสเกล", cmPerPixel(HEIGHT_CM, { top: 0.5, bottom: 0.5, left: 0, right: 1 }, IMG_H).cmPerPx === null);
}

console.log("\n── 2. ความกว้าง/ลึกดิบ (พิกเซล) ──");
const base = measure(frontDoll(), sideDoll());
{
  const f = base.widthsPx.front!;
  const s = base.widthsPx.side!;
  check("เอวแคบสุดในช่วง = 36 ช่อง", near(f.waistW, cellsToPx(36), 0.01), String(f.waistW));
  check("สะโพกกว้างสุดในช่วง = 46 ช่อง", near(f.hipW, cellsToPx(46), 0.01), String(f.hipW));
  check("อกที่ระดับ t=0.30 = 44 ช่อง", near(f.chestW, cellsToPx(44), 0.01), String(f.chestW));
  check("คอแคบสุดช่วงหู-ไหล่ = 12 ช่อง", near(f.neckW, cellsToPx(12), 0.01), String(f.neckW));
  check("ไหล่จาก landmark = 44 ช่อง", near(f.shoulderW, cellsToPx(44), 0.01), String(f.shoulderW));
  check("ต้นขาซ้าย = 14 ช่อง", near(f.thighLW, cellsToPx(14), 0.01), String(f.thighLW));
  check("น่องซ้าย = 10 ช่อง", near(f.calfLW, cellsToPx(10), 0.01), String(f.calfLW));
  check("ระดับเอวที่เจอ t ≈ 0.728 (แถว 105)", near(f.levels.waist, 65.5 / 90, 0.002), String(f.levels.waist));
  check("ระดับสะโพกที่เจอ t ≈ 1.006 (แถว 130)", near(f.levels.hip, 90.5 / 90, 0.002), String(f.levels.hip));
  check("ความลึกเอว (ภาพข้างคนละเฟรม) = 24 ช่อง", near(s.waistD, cellsToPx(24), 0.01), String(s.waistD));
  check("ความลึกสะโพก = 32 ช่อง", near(s.hipD, cellsToPx(32), 0.01), String(s.hipD));
  check("ความลึกอก = 30 ช่อง", near(s.chestD, cellsToPx(30), 0.01), String(s.chestD));
  check("ความลึกคอ = 10 ช่อง", near(s.neckD, cellsToPx(10), 0.01), String(s.neckD));
  check("ความลึกสะดือ t=0.75 = 24 ช่อง", near(s.abdomenD, cellsToPx(24), 0.01), String(s.abdomenD));
  /* หุ่นภาพข้างถูกวาดให้ "แถวดิบของภาพหน้า" ตกในแถบที่แคบกว่าเสมอ
     ค่าที่ถูกต้องข้างบนจึงเป็นไปได้ทางเดียว = โค้ดแปลงระดับผ่านไหล่/สะโพกของภาพข้างเอง */
  check("ภาพข้างวัดที่ระดับกายวิภาคเดียวกัน ไม่ใช่แถว y เดียวกัน", near(s.chestD, cellsToPx(30), 0.01) && near(s.waistD, cellsToPx(24), 0.01));
}

console.log("\n── 3. เส้นรอบวง Ramanujan (เทียบค่าคำนวณมือ) ──");
{
  const e = base.estimates;
  const waistHand = handRamanujan(cellsToCm(36), cellsToCm(24));
  const hipHand = handRamanujan(cellsToCm(46), cellsToCm(32));
  const chestHand = handRamanujan(cellsToCm(44), cellsToCm(30));
  const neckHand = handRamanujan(cellsToCm(12), cellsToCm(10));
  check("เอว = สูตรมือ", near(e.waistCm?.mid, Math.round(waistHand * 10) / 10, 0.051), `${e.waistCm?.mid} vs ${waistHand.toFixed(2)}`);
  check("เอว ≈ 80.3 ซม. (เลขคงที่ที่คิดไว้ล่วงหน้า)", near(e.waistCm?.mid, 80.3, 0.1), String(e.waistCm?.mid));
  check("สะโพก = สูตรมือ (≈104.2)", near(e.hipCm?.mid, Math.round(hipHand * 10) / 10, 0.051), String(e.hipCm?.mid));
  check("อก = สูตรมือ (≈99.0)", near(e.chestCm?.mid, Math.round(chestHand * 10) / 10, 0.051), String(e.chestCm?.mid));
  check("คอ = สูตรมือ (≈29.2)", near(e.neckCm?.mid, Math.round(neckHand * 10) / 10, 0.051), String(e.neckCm?.mid));
  check("วงกลม (a=b) ให้เส้นรอบวง = 2πr", near(ellipseCircumference(5, 5)!, 2 * Math.PI * 5, 1e-9));
  check("ค่าลบ/ศูนย์ = null ไม่ใช่ NaN", ellipseCircumference(0, 5) === null && ellipseCircumference(5, -1) === null);
  check("มีภาพข้าง = method 2view", e.waistCm?.method === "2view", String(e.waistCm?.method));
  check("จุดชัดครบ + run สะอาด = conf high", e.waistCm?.conf === "high", String(e.waistCm?.conf));
}

console.log("\n── 4. ช่วง + confidence ──");
{
  const e = base.estimates;
  const half = Math.max(MIN_HALF_RANGE_CM, HALF_RANGE_PCT * (e.waistCm?.mid ?? 0));
  check("ครึ่งช่วงเอว = 4% ของค่ากลาง", near((e.waistCm!.hi - e.waistCm!.lo) / 2, half, 0.06), String(e.waistCm));
  check("ครึ่งช่วงขั้นต่ำ 1.5 ซม. เมื่อค่าน้อย", near(buildEstimate(20, "high", "2view")!.hi - 20, MIN_HALF_RANGE_CM, 0.001));
  check(
    "conf ต่ำ = ช่วงกว้างขึ้น 1.5 เท่า",
    near(buildEstimate(100, "low", "2view")!.hi - 100, HALF_RANGE_PCT * 100 * LOW_CONF_RANGE_MULT, 0.001)
  );
  check("conf med ไม่ขยายช่วง", near(buildEstimate(100, "med", "2view")!.hi - 100, 4, 0.001));
  check("ค่ากลาง ≤ 0 = null", buildEstimate(0, "high", "2view") === null && buildEstimate(-5, "high", "2view") === null);
  const lowVis = measure(frontDoll({ visibility: 0.5 }), sideDoll({ visibility: 0.5 }));
  check("visibility ต่ำ = conf low", lowVis.estimates.waistCm?.conf === "low", String(lowVis.estimates.waistCm?.conf));
  const medVis = measure(frontDoll({ visibility: 0.8 }), sideDoll({ visibility: 0.8 }));
  check("visibility กลาง = conf med", medVis.estimates.waistCm?.conf === "med", String(medVis.estimates.waistCm?.conf));
}

console.log("\n── 5. ไม่มีภาพข้าง → fallback วงกลมจากภาพหน้า ──");
{
  const one = measure(frontDoll(), null);
  const e = one.estimates;
  check("method = 1view", e.waistCm?.method === "1view", String(e.waistCm?.method));
  check("conf ถูกลดหนึ่งขั้นจาก high", e.waistCm?.conf === "med", String(e.waistCm?.conf));
  // 🔴 ใส่ 0.72 เป็นตัวเลขตรง ๆ ห้ามอ้าง DEPTH_RATIO จากไลบรารี — ไม่งั้นแก้ค่าในไลบรารีแล้วเทสก็ยังผ่าน
  const hand = handRamanujan(cellsToCm(36), cellsToCm(36) * 0.72);
  check("เอว 1view = สูตรมือด้วย k=0.72", near(e.waistCm?.mid, Math.round(hand * 10) / 10, 0.051), `${e.waistCm?.mid} vs ${hand.toFixed(2)}`);
  const hipHand = handRamanujan(cellsToCm(46), cellsToCm(46) * 0.78);
  check("สะโพก 1view ใช้ k=0.78", near(e.hipCm?.mid, Math.round(hipHand * 10) / 10, 0.051), String(e.hipCm?.mid));
  check("ไม่ส่งภาพข้าง = widthsPx.side เป็น null", one.widthsPx.side === null);
  check(
    "อัตราส่วนความลึกตรงตาม WO (0.72/0.78/0.74/0.85)",
    DEPTH_RATIO.waist === 0.72 && DEPTH_RATIO.hip === 0.78 && DEPTH_RATIO.chest === 0.74 && DEPTH_RATIO.neck === 0.85,
    JSON.stringify(DEPTH_RATIO)
  );

  // ภาพข้างมีอยู่แต่ mask เสีย (เคสจริงของ fallback ตาม WO)
  const brokenSide: ViewInput = { ...sideDoll(), mask: null };
  const e2 = measure(frontDoll(), brokenSide).estimates;
  check("ภาพข้างมีแต่ mask เสีย = 1view เหมือนกัน", e2.waistCm?.method === "1view", String(e2.waistCm?.method));
}

console.log("\n── 6. US Navy Body Fat ──");
{
  check("ชาย: เทียบเครื่องคิดเลข (เอว 80.3 คอ 29.2 สูง 180 → 19.2%)", near(navyBodyFat("male", 80.3, 29.2, 180), 19.18, 0.05), String(navyBodyFat("male", 80.3, 29.2, 180)));
  check(
    "หญิง: เทียบเครื่องคิดเลข (เอว 80.3 สะโพก 104.2 คอ 29.2 สูง 180 → 31.9%)",
    near(navyBodyFat("female", 80.3, 29.2, 180, 104.2), 31.89, 0.05),
    String(navyBodyFat("female", 80.3, 29.2, 180, 104.2))
  );
  check("หญิงไม่มีสะโพก = คิดไม่ได้", navyBodyFat("female", 80, 30, 180, null) === null);
  check("เอวเล็กกว่าคอ = คิดไม่ได้ (log ของค่าติดลบ)", navyBodyFat("male", 28, 30, 180) === null);
  check("ไม่มีส่วนสูง = คิดไม่ได้", navyBodyFat("male", 80, 30, 0) === null);

  const male = base.estimates;
  check("ท่อเต็ม (ชาย) BF ≈ 19.2%", near(male.bfPct?.mid, 19.2, 0.2), String(male.bfPct?.mid));
  check("BF มีช่วง lo < mid < hi", !!male.bfPct && male.bfPct.lo < male.bfPct.mid && male.bfPct.mid < male.bfPct.hi, JSON.stringify(male.bfPct));
  check("BF method = navy", male.bfPct?.method === "navy");
  const female = measure(frontDoll(), sideDoll(), "female");
  check("ท่อเต็ม (หญิง) BF ≈ 31.9%", near(female.estimates.bfPct?.mid, 31.9, 0.3), String(female.estimates.bfPct?.mid));
  check("หญิงกับชายได้คนละค่า (ใช้สูตรคนละตัวจริง)", female.estimates.bfPct?.mid !== male.bfPct?.mid);
  check("ไม่มีเพศในโปรไฟล์ = ไม่คิด BF", measure(frontDoll(), sideDoll(), null).estimates.bfPct === null);
  check("เพศไม่รู้จัก = ไม่คิด BF", measure(frontDoll(), sideDoll(), "other").estimates.bfPct === null);
  check("ค่าปกติ = ไม่ถูกตั้งธงเพี้ยน", male.suspect === false);
}

console.log("\n── 7. ผล BF เพี้ยน → null ทั้งค่าและกด conf ทั้งชุด ──");
{
  // เอวแคบกว่าคอ = สูตรคิดไม่ออก (ข้อมูลชุดนี้เชื่อไม่ได้)
  const thin = measure(frontDoll({ waistCells: 8, neckCells: 20 }), sideDoll({ waistCells: 6 }));
  check("BF คิดไม่ออก = null", thin.estimates.bfPct === null);
  check("ติดธง suspect", thin.estimates.suspect === true);
  check("conf ถูกกดเป็น low ทั้งชุด", thin.estimates.waistCm?.conf === "low" && thin.estimates.hipCm?.conf === "low");

  // เอวมหึมา → BF เกิน 60
  const huge = measure(frontDoll({ waistCells: 110, neckCells: 12 }), sideDoll({ waistCells: 100 }));
  check("BF เกิน 60 = null + suspect", huge.estimates.bfPct === null && huge.estimates.suspect === true, String(huge.estimates.bfPct));
}

console.log("\n── 8. ขาซ้าย-ขวา + สมมาตร ──");
{
  const e = base.estimates;
  check("ต้นขาซ้าย = 14 ช่อง เป็นซม.", near(e.thighLCm?.mid, cellsToCm(14), 0.06), String(e.thighLCm?.mid));
  check("ต้นขาเป็นค่ากว้าง ไม่ใช่รอบวง (method=width)", e.thighLCm?.method === "width");
  check("น่องซ้าย = 10 ช่อง เป็นซม.", near(e.calfLCm?.mid, cellsToCm(10), 0.06), String(e.calfLCm?.mid));
  check("ขาเท่ากัน = ส่วนต่าง 0", near(e.symmetry.thighDiffCm, 0, 0.001), String(e.symmetry.thighDiffCm));

  const asym = measure(frontDoll({ thighRCells: 12 }), sideDoll());
  check("ขาไม่เท่ากัน 2 ช่อง = ต่าง 1.7 ซม.", near(asym.estimates.symmetry.thighDiffCm, cellsToCm(2), 0.06), String(asym.estimates.symmetry.thighDiffCm));

  const together = measure(frontDoll({ legsTogether: true }), sideDoll());
  check("ขาชิดกัน = ต้นขา null (ไม่ใช่หารสอง)", together.estimates.thighLCm === null && together.estimates.thighRCm === null);
  check("ขาชิดกัน = ส่วนต่างซ้ายขวา null", together.estimates.symmetry.thighDiffCm === null);
  check("ขาชิดกันแต่ลำตัวยังวัดได้", together.estimates.waistCm !== null);

  const merged = measure(frontDoll({ legsTogether: true, extraBlob: true }), sideDoll());
  check("มี 2 run แต่ run เดียวกินขาทั้งสองข้าง = null", merged.estimates.thighLCm === null);
}

console.log("\n── 9. สัดส่วน + posture ──");
{
  const e = base.estimates;
  check("WHR = เอว/สะโพก", near(e.whr?.mid, (e.waistCm!.mid / e.hipCm!.mid), 0.002), String(e.whr?.mid));
  check("SWR = ไหล่/เอว", near(e.swr?.mid, e.shoulderCm!.mid / e.waistCm!.mid, 0.002), String(e.swr?.mid));
  check("ขอบช่วงสัดส่วนจับคู่สลับด้าน (lo = เอวต่ำสุด/สะโพกสูงสุด)", near(e.whr?.lo, e.waistCm!.lo / e.hipCm!.hi, 0.002));
  check("ยืนตรง = ไหล่ไม่เอียง", e.posture.shoulderTilt === false && near(e.posture.shoulderTiltDeg, 0, 0.01), String(e.posture.shoulderTiltDeg));

  const tilted = measure(frontDoll({ tiltDeg: 6 }), sideDoll());
  check("เอียง 6° = วัดได้ ~6° (แปลงสัดส่วนภาพกลับถูก)", near(tilted.estimates.posture.shoulderTiltDeg, 6, 0.3), String(tilted.estimates.posture.shoulderTiltDeg));
  check("เอียง 6° = ติดธงไหล่เอียง", tilted.estimates.posture.shoulderTilt === true);
  check("เอียง 6° = ติดธงสะโพกเอียงด้วย", tilted.estimates.posture.hipTilt === true);
  const small = measure(frontDoll({ tiltDeg: 2 }), sideDoll());
  check("เอียง 2° = ต่ำกว่าเกณฑ์ 3° ไม่ติดธง", small.estimates.posture.shoulderTilt === false, String(small.estimates.posture.shoulderTiltDeg));

  check("หัวตรง = ไม่ติดธงหัวยื่น", e.posture.headForward === false, String(e.posture.headForwardFrac));
  const fwd = measure(frontDoll(), sideDoll({ earOffsetCells: 12 }));
  check("หู-ไหล่ห่าง 12 ช่อง (>4% ของส่วนสูง) = ติดธงหัวยื่น", fwd.estimates.posture.headForward === true, String(fwd.estimates.posture.headForwardFrac));
}

console.log("\n── 10. ข้อมูลไม่พอ → null ไม่ใช่เดา และห้าม throw ──");
{
  const noHeight = measure(frontDoll(), sideDoll(), "male", null);
  check("ไม่มีส่วนสูง = ทุก estimate เป็น null", noHeight.estimates.waistCm === null && noHeight.estimates.hipCm === null && noHeight.estimates.bfPct === null);
  check("ไม่มีส่วนสูง = ยังเก็บค่าพิกเซลไว้ reprocess ได้", near(noHeight.widthsPx.front?.waistW, cellsToPx(36), 0.01));
  check("ไม่มีส่วนสูง = posture ยังคิดได้ (เป็นสัดส่วน ไม่ใช่ซม.)", noHeight.estimates.posture.shoulderTilt === false);

  const emptyGrid: ViewInput = { ...frontDoll(), mask: blankGrid() };
  const empty = measure(emptyGrid, sideDoll());
  check("mask ว่างเปล่า = เอว/สะโพก/อก null", empty.estimates.waistCm === null && empty.estimates.hipCm === null && empty.estimates.chestCm === null);
  check("mask ว่างเปล่า = ไหล่ยังวัดได้จาก landmark", empty.estimates.shoulderCm !== null);

  const noMask: ViewInput = { ...frontDoll(), mask: null };
  check("ไม่มี mask เลย = ไม่ throw และค่าเป็น null", measure(noMask, sideDoll()).estimates.waistCm === null);

  const noLandmarks: ViewInput = { ...frontDoll(), landmarks: null };
  const nl = measure(noLandmarks, sideDoll());
  check("ไม่มี landmark = ไม่ throw ทุกค่าเป็น null", nl.estimates.waistCm === null && nl.estimates.shoulderCm === null);

  const nothing = measure(null, null);
  check("ไม่มีภาพเลย = โครงสร้างครบแต่ค่าเป็น null", nothing.widthsPx.front === null && nothing.estimates.waistCm === null && nothing.estimates.suspect === false);

  const noBounds: ViewInput = { ...frontDoll(), maskBounds: null };
  check("ไม่มีกรอบ mask = ไม่มีสเกล = null ทั้งชุด", measure(noBounds, sideDoll()).estimates.waistCm === null);

  const flipped: ViewInput = {
    ...frontDoll(),
    landmarks: landmarkSet({ 11: point(col(85), row(200)), 12: point(col(42), row(200)), 23: point(col(72), row(40)), 24: point(col(54), row(40)) }),
  };
  check("สะโพกอยู่เหนือไหล่ (ข้อมูลกลับหัว) = ไม่ throw และ null", measure(flipped, sideDoll()).estimates.waistCm === null);
}

console.log("\n── 11. ถอดตารางเงาร่างจาก base64 (ต้องตรงกับ worker เป๊ะ) ──");
{
  /** แพ็กแบบเดียวกับ numpy.packbits(bitorder="big") ใน worker แล้วเข้ารหัสด้วย Buffer (คนละตัวกับ decoder ที่เทส) */
  function packGrid(grid: boolean[][]): PackedMaskGrid {
    const h = grid.length;
    const w = grid[0].length;
    const perRow = Math.ceil(w / 8);
    const bytes = Buffer.alloc(perRow * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) if (grid[r][c]) bytes[r * perRow + (c >> 3)] |= 1 << (7 - (c & 7));
    }
    return { w, h, data: bytes.toString("base64") };
  }

  const g = blankGrid();
  fillRect(g, 10, 20, 3, 9); // ก้อนที่คร่อมขอบไบต์ (คอลัมน์ 3-9 = ข้ามไบต์แรกไปไบต์ที่สอง)
  const packed = packGrid(g);
  check("ขนาด base64 ของตาราง 128×256 = 4096 ไบต์", Buffer.from(packed.data, "base64").length === 4096);
  const decoded = decodeMaskGrid(packed);
  let same = !!decoded && decoded.length === GH && decoded[0].length === GW;
  if (decoded) {
    for (let r = 0; r < GH && same; r++) for (let c = 0; c < GW; c++) if (decoded[r][c] !== g[r][c]) { same = false; break; }
  }
  check("ถอดแล้วได้ตารางเดิมทุกช่อง (รวมช่วงที่คร่อมขอบไบต์)", same);
  check("ตัวถอด base64 ตรงกับ Buffer ของ node", (() => {
    const b = base64ToBytes(Buffer.from([0, 1, 254, 255, 128]).toString("base64"));
    return !!b && Array.from(b).join(",") === "0,1,254,255,128";
  })());
  check("ความยาวไม่ตรงกับ w×h = null (ยอมวัดไม่ได้ ดีกว่าอ่านบิตเหลื่อม)", decodeMaskGrid({ w: 128, h: 256, data: "AAAA" }) === null);
  check("base64 พัง = null", decodeMaskGrid({ w: 8, h: 1, data: "!!!!" }) === null);
  check("ไม่มีตาราง = null", decodeMaskGrid(null) === null && decodeMaskGrid(undefined) === null);
  check("ตารางที่ถอดมาวัดได้ผลเท่ากับตารางต้นฉบับ", (() => {
    const front = frontDoll();
    const roundTripped: ViewInput = { ...front, mask: decodeMaskGrid(packGrid(front.mask!)) };
    return measure(roundTripped, sideDoll()).estimates.waistCm?.mid === base.estimates.waistCm?.mid;
  })());
  check("runsAt แยกช่วงถูก", (() => {
    const line = [false, true, true, false, true, false];
    const rs = runsAt([line], 0);
    return rs.length === 2 && rs[0].s === 1 && rs[0].e === 3 && rs[1].s === 4 && rs[1].e === 5;
  })());
}

console.log("\n── 12. noise floor (ห้ามให้จอคิดเอง) ──");
{
  check("ต่างกัน 0.5 ซม. = คงที่", trendLabel(80, 80.5) === "flat");
  check("ต่างกัน 0.99 ซม. = ยังคงที่", trendLabel(80, 80.99) === "flat");
  check("เพิ่ม 1.5 ซม. = ขึ้น", trendLabel(80, 81.5) === "up");
  check("ลด 1.5 ซม. = ลง", trendLabel(80, 78.5) === "down");
  check("พอดีเกณฑ์ 1.0 = ขึ้น (ไม่ใช่คงที่)", trendLabel(80, 81, TREND_FLOOR_CM) === "up");
  check("BF ต่าง 1.2 จุด = คงที่ (เกณฑ์ 1.5)", trendLabel(20, 21.2, TREND_FLOOR_BF) === "flat");
  check("BF ต่าง 2 จุด = ขึ้น", trendLabel(20, 22, TREND_FLOOR_BF) === "up");
  check("ไม่มีค่าก่อนหน้า = ไม่มีทิศทาง", trendLabel(null, 80) === null && trendLabel(80, null) === null);
}

console.log("\n── 13. calibrate ด้วยสายวัดจริง ──");
{
  const e = base.estimates;
  const cvWaist = e.waistCm!.mid;
  const one = applyTapeOffset(e, [{ site: "waist", tapeCm: cvWaist + 3, cvMid: cvWaist }]);
  check("สายวัด 1 ครั้ง = เลื่อนค่ากลางเท่าส่วนต่าง", near(one.waistCm?.mid, cvWaist + 3, 0.051), String(one.waistCm?.mid));
  check("ความกว้างช่วงเท่าเดิม (สายวัดบอกตำแหน่ง ไม่ได้บอกว่าเราแม่นขึ้น)", near(one.waistCm!.hi - one.waistCm!.lo, e.waistCm!.hi - e.waistCm!.lo, 0.051));
  check("ติดธง calibrated", one.waistCm?.calibrated === true);
  check("เก็บ rawMid ไว้", near(one.waistCm?.rawMid, cvWaist, 0.051));
  check("จุดที่ไม่มีสายวัด ไม่ถูกแตะ", one.hipCm?.mid === e.hipCm?.mid && !one.hipCm?.calibrated);

  const three = applyTapeOffset(e, [
    { site: "waist", tapeCm: cvWaist + 2, cvMid: cvWaist },
    { site: "waist", tapeCm: cvWaist + 4, cvMid: cvWaist },
    { site: "waist", tapeCm: cvWaist + 30, cvMid: cvWaist }, // ค่าพิมพ์ผิด — median ต้องไม่สนใจ
  ]);
  check("median ของ 3 คู่ = ตัวกลาง (กันค่าพิมพ์ผิดลากทั้งเส้น)", near(three.waistCm?.mid, cvWaist + 4, 0.051), String(three.waistCm?.mid));

  const two = applyTapeOffset(e, [
    { site: "waist", tapeCm: cvWaist + 2, cvMid: cvWaist },
    { site: "waist", tapeCm: cvWaist + 6, cvMid: cvWaist },
  ]);
  check("จำนวนคู่เป็นเลขคู่ = เฉลี่ยสองตัวกลาง", near(two.waistCm?.mid, cvWaist + 4, 0.051), String(two.waistCm?.mid));

  const twice = applyTapeOffset(one, [{ site: "waist", tapeCm: cvWaist + 3, cvMid: one.waistCm!.rawMid! }]);
  check("calibrate ซ้ำด้วย rawMid = ค่าเท่าเดิม (ไม่เลื่อนทับสองเท่า)", near(twice.waistCm?.mid, cvWaist + 3, 0.051), String(twice.waistCm?.mid));

  check("ไม่มีคู่เลย = ไม่เปลี่ยนอะไร", applyTapeOffset(e, []).waistCm?.mid === e.waistCm?.mid);
  check("site ที่ระบบไม่รู้จัก = ข้าม", applyTapeOffset(e, [{ site: "ไม่มีจุดนี้", tapeCm: 10, cvMid: 20 }]).waistCm?.mid === e.waistCm?.mid);
  check("WHR ถูกคิดใหม่หลังเลื่อนเอว", near(one.whr?.mid, one.waistCm!.mid / one.hipCm!.mid, 0.002), String(one.whr?.mid));

  const withBf = applyTapeOffset(e, [{ site: "waist", tapeCm: cvWaist + 5, cvMid: cvWaist }], { heightCm: HEIGHT_CM, gender: "male" });
  check("BF ถูกคิดใหม่จากเอวที่ calibrate แล้ว", near(withBf.bfPct?.mid, navyBodyFat("male", cvWaist + 5, e.neckCm!.mid, HEIGHT_CM)!, 0.15), `${withBf.bfPct?.mid} vs ${e.bfPct?.mid}`);
  check("ไม่ส่งเพศ/ส่วนสูง = ไม่แตะ BF เดิม", applyTapeOffset(e, [{ site: "waist", tapeCm: cvWaist + 5, cvMid: cvWaist }]).bfPct?.mid === e.bfPct?.mid);
  check("ของเดิมไม่ถูกแก้ (คืนก้อนใหม่เสมอ)", e.waistCm?.mid === cvWaist && !e.waistCm?.calibrated);

  check("median: จำนวนคี่", median([5, 1, 3]) === 3);
  check("median: จำนวนคู่", median([1, 2, 3, 4]) === 2.5);
  check("median: ว่าง = null", median([]) === null);
}

console.log("\n── 14. ผลต้องนิ่ง (ภาพเดิม → เลขเดิม) ──");
{
  const a = measure(frontDoll(), sideDoll()).estimates;
  const b = measure(frontDoll(), sideDoll()).estimates;
  check("รันซ้ำได้ค่าเท่ากันทุกตัว", JSON.stringify(a) === JSON.stringify(b));
  const keys: (keyof Estimates)[] = ["neckCm", "chestCm", "waistCm", "hipCm", "shoulderCm", "thighLCm", "thighRCm", "calfLCm", "calfRCm", "whr", "swr", "bfPct"];
  check("ทุกค่ามีครบทั้ง lo/mid/hi/conf หรือเป็น null", keys.every((k) => {
    const v = a[k] as { lo?: unknown; mid?: unknown; hi?: unknown; conf?: unknown } | null;
    return v === null || (typeof v.lo === "number" && typeof v.mid === "number" && typeof v.hi === "number" && !!v.conf);
  }));
  // JSON.stringify เปลี่ยน NaN เป็น null เงียบ ๆ → ต้องไล่ดูค่าจริงทีละตัว ไม่ใช่ดูสตริง
  check(
    "ไม่มีค่าไหนเป็น NaN",
    keys.every((k) => {
      const v = a[k] as { lo: number; mid: number; hi: number } | null;
      return v === null || [v.lo, v.mid, v.hi].every((n) => Number.isFinite(n));
    })
  );
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ผ่าน ${total - failed}/${total} เคส`);
process.exit(failed === 0 ? 0 : 1);
