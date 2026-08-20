/**
 * Body Score — สูตรเปิด (WO-BP-3 §B2 · WO-BODY §2 ข้อ 1)
 *
 * 🔴 คะแนนนี้วัด "พฤติกรรม + ทิศทางเทียบเป้า" ไม่ใช่ "รูปร่างดีแค่ไหน"
 *    ห้ามมีส่วนไหนให้คะแนนจากขนาดตัวเด็ดขาด — คนตัวใหญ่ที่ทำทุกอย่างถูกต้องต้องได้ 100 ได้
 *    และคนผอมที่ไม่เคยสแกน/ไม่เคยชั่ง ต้องได้คะแนนต่ำ เพราะระบบไม่รู้อะไรเกี่ยวกับเขาเลย
 *
 * 🔴 เลขรวมที่อธิบายไม่ได้จะพังความเชื่อถือทั้งระบบ → ทุกส่วนต้องมีบรรทัด explain ว่าได้กี่แต้มเพราะอะไร
 *
 * pure ทั้งไฟล์ (ห้าม prisma / fetch / new Date()) — วันอ้างอิงรับผ่าน asOf
 */

export type ScoreOnTrack = "ahead" | "on" | "behind" | "flat";

export interface BodyScoreInput {
  /** วันที่สแกน (YYYY-MM-DD) — เอาเท่าที่มีในช่วง 28 วันล่าสุดก็พอ */
  scanDates: string[];
  last28d: {
    /** จำนวนวันที่ชั่งน้ำหนักใน 28 วัน */
    weighDays: number;
    /** จำนวนสแกนใน 28 วัน */
    scanCount: number;
  };
  hasHeight: boolean;
  /** เคยกรอกสายวัดจริงอย่างน้อย 1 ครั้ง = ระบบ calibrate เส้นของคนนี้ได้ */
  hasTapeCalib: boolean;
  /** เชื่อม Watch / เครื่องชั่งอัจฉริยะแล้ว */
  hasDeviceLink: boolean;
  /** ทิศทางของแต่ละเป้า (จาก goalProgress) — null/ว่าง = ยังไม่ได้ตั้งเป้า */
  goalOnTrack: ScoreOnTrack[] | null;
  /** วันอ้างอิง (YYYY-MM-DD) — ไม่ส่ง = ใช้วันสแกนล่าสุด (ไฟล์นี้ห้ามรู้จักเวลาปัจจุบันเอง) */
  asOf?: string;
}

export interface BodyScoreResult {
  score: number;
  parts: { consistency: number; direction: number; data: number };
  explain: string[];
}

// ── น้ำหนักของแต่ละส่วน (เปิดเผยเป็นค่าคงที่ เพื่อให้จอ/รายงานอ้างเลขชุดเดียวกัน) ──
export const MAX_CONSISTENCY = 40;
export const MAX_DIRECTION = 40;
export const MAX_DATA = 20;
/** สแกนสัปดาห์ละครั้ง 4 สัปดาห์ = เต็ม 28 แต้ม */
export const CONSISTENCY_SCAN_MAX = 28;
/** ชั่งน้ำหนัก ≥4 วัน/สัปดาห์ (16 วันใน 28 วัน) = เต็ม 12 แต้ม */
export const CONSISTENCY_WEIGH_MAX = 12;
export const WEIGH_DAYS_FULL = 16;
export const SCORE_WEEKS = 4;
/** ไม่มีเป้า = ให้ครึ่งเดียวของส่วนนี้ (ไม่ลงโทษคนที่ยังไม่ตั้งเป้า แต่ก็ไม่แจกฟรีเต็ม) */
export const DIRECTION_NO_GOAL = 20;
export const DATA_HEIGHT = 5;
export const DATA_TAPE = 10;
export const DATA_DEVICE = 5;

const DAY_MS = 24 * 3600 * 1000;

/** "YYYY-MM-DD" → epoch (UTC เที่ยงคืน) · รูปแบบผิด = null */
function dayValue(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

/**
 * คะแนนร่างกาย 0-100 — คืน null เมื่อไม่มีข้อมูลอะไรเลย
 * (คะแนน 0 กับ "ยังไม่รู้จักคุณเลย" คนละความหมาย — ห้ามขึ้นเลข 0 ให้คนที่เพิ่งสมัครวันนี้)
 */
export function computeBodyScore(input: BodyScoreInput): BodyScoreResult | null {
  const scanDays = (Array.isArray(input.scanDates) ? input.scanDates : [])
    .map(dayValue)
    .filter((v): v is number => v !== null);
  const weighDays = Number.isFinite(input.last28d?.weighDays) ? Math.max(0, input.last28d.weighDays) : 0;
  const scanCount = Number.isFinite(input.last28d?.scanCount) ? Math.max(0, input.last28d.scanCount) : 0;
  const onTrack = Array.isArray(input.goalOnTrack) ? input.goalOnTrack : null;

  const nothing =
    scanDays.length === 0 &&
    scanCount === 0 &&
    weighDays === 0 &&
    !input.hasHeight &&
    !input.hasTapeCalib &&
    !input.hasDeviceLink &&
    (!onTrack || onTrack.length === 0);
  if (nothing) return null;

  const explain: string[] = [];

  // ── 1) ความสม่ำเสมอ (40) ──
  const ref = dayValue(input.asOf) ?? (scanDays.length ? Math.max(...scanDays) : null);
  const weeksWithScan = new Set<number>();
  if (ref !== null) {
    for (const d of scanDays) {
      const diffDays = Math.floor((ref - d) / DAY_MS);
      if (diffDays < 0 || diffDays >= SCORE_WEEKS * 7) continue;
      weeksWithScan.add(Math.floor(diffDays / 7));
    }
  }
  const scanPart = Math.round((weeksWithScan.size / SCORE_WEEKS) * CONSISTENCY_SCAN_MAX);
  const weighPart = Math.round(Math.min(1, weighDays / WEIGH_DAYS_FULL) * CONSISTENCY_WEIGH_MAX);
  const consistency = Math.min(MAX_CONSISTENCY, scanPart + weighPart);

  explain.push(
    `ความสม่ำเสมอ ${consistency}/${MAX_CONSISTENCY} แต้ม — สแกน ${weeksWithScan.size}/${SCORE_WEEKS} สัปดาห์ (${scanPart}/${CONSISTENCY_SCAN_MAX}) + ชั่งน้ำหนัก ${weighDays}/${WEIGH_DAYS_FULL} วัน (${weighPart}/${CONSISTENCY_WEIGH_MAX})`
  );

  // ── 2) ทิศทางเทียบเป้า (40) ──
  let direction: number;
  if (!onTrack || onTrack.length === 0) {
    direction = DIRECTION_NO_GOAL;
    explain.push(
      `ทิศทางเทียบเป้า ${direction}/${MAX_DIRECTION} แต้ม — ยังไม่ได้ตั้งเป้า ตั้งเป้าเพื่อให้คะแนนส่วนนี้ทำงานเต็มที่ครับ`
    );
  } else {
    const good = onTrack.filter((t) => t === "ahead" || t === "on").length;
    const flat = onTrack.filter((t) => t === "flat").length;
    const credit = good + flat * 0.5; // คงที่ = ยังไม่พ้น noise floor ให้ครึ่งแต้ม ไม่ใช่ศูนย์
    direction = Math.round((credit / onTrack.length) * MAX_DIRECTION);
    explain.push(
      `ทิศทางเทียบเป้า ${direction}/${MAX_DIRECTION} แต้ม — เป้าที่เดินตามแผน ${good}/${onTrack.length}` +
        (flat > 0 ? ` และยังคงที่อีก ${flat} เป้า (นับครึ่งแต้ม เพราะการเปลี่ยนแปลงยังเล็กกว่าที่เครื่องมือวัดแยกออก)` : "")
    );
  }

  // ── 3) ความครบของข้อมูล (20) ──
  const dHeight = input.hasHeight ? DATA_HEIGHT : 0;
  const dTape = input.hasTapeCalib ? DATA_TAPE : 0;
  const dDevice = input.hasDeviceLink ? DATA_DEVICE : 0;
  const data = dHeight + dTape + dDevice;
  explain.push(
    `ความครบของข้อมูล ${data}/${MAX_DATA} แต้ม — ส่วนสูง ${dHeight}/${DATA_HEIGHT} · สายวัดจริงที่ใช้ปรับค่าให้แม่นขึ้น ${dTape}/${DATA_TAPE} · เชื่อมนาฬิกา/เครื่องชั่ง ${dDevice}/${DATA_DEVICE}`
  );

  const score = consistency + direction + data;
  explain.push(`รวม ${score}/100 = ${consistency} + ${direction} + ${data}`);

  return { score, parts: { consistency, direction, data }, explain };
}
