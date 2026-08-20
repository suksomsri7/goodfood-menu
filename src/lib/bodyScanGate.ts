/**
 * Quality gate ของภาพสแกนร่างกาย (WO-BP-1 §B3 · WO-BODY §2 ข้อ 3)
 *
 * "ถ่าย → ตรวจ 1 วิ → ผ่าน หรือถ่ายใหม่พร้อมเหตุผลไทย" — นี่คือของที่ทำให้เทรนด์เชื่อถือได้
 * เพราะตัววัดใน BP-2 เทียบสัปดาห์ต่อสัปดาห์: ถ้าครั้งนี้ยืนใกล้กว่าเดิม 20% เอวจะ "ใหญ่ขึ้น" ทั้งที่ตัวเท่าเดิม
 * ดักที่ประตูทางเข้าถูกกว่าไปแก้ที่ปลายทางเสมอ — ภาพที่ไม่ผ่านคือภาพที่ถูกลบทิ้ง ไม่ใช่ภาพที่เก็บไว้แล้วค่อยกรอง
 *
 * 🔴 กติกาของไฟล์นี้ (เหมือน readiness.ts / progression.ts):
 *   - ห้าม import prisma / fetch / fs / new Date() — รับ output ของ worker เข้ามาตรง ๆ เท่านั้น
 *   - ทุก threshold มีเทสถาวรที่ scripts/test-body-gate.ts
 *   - ข้อความทุกอันเป็นภาษาไทยที่ "บอกวิธีแก้" ไม่ใช่ตำหนิ (user ยืนห่างจากเครื่อง ฟังเสียง TTS อ่านอันนี้)
 */

// ── ดัชนี landmark ของ MediaPipe Pose (33 จุด) เท่าที่ gate นี้ใช้ ──
export const LM_NOSE = 0;
export const LM_SHOULDER_L = 11;
export const LM_SHOULDER_R = 12;
export const LM_HIP_L = 23;
export const LM_HIP_R = 24;
export const LM_KNEE_L = 25;
export const LM_KNEE_R = 26;
export const LM_ANKLE_L = 27;
export const LM_ANKLE_R = 28;

/** จุดสำคัญที่ต้อง "เห็นชัด" ถึงจะวัดได้ — จมูก ไหล่ สะโพก เข่า ข้อเท้า (WO-BP-1 §B3) */
export const KEY_LANDMARKS = [
  LM_NOSE,
  LM_SHOULDER_L,
  LM_SHOULDER_R,
  LM_HIP_L,
  LM_HIP_R,
  LM_KNEE_L,
  LM_KNEE_R,
  LM_ANKLE_L,
  LM_ANKLE_R,
];

export const LANDMARK_COUNT = 33;

// ── เกณฑ์ปฏิเสธ (ต่ำ/สูงกว่านี้ = poor = ลบภาพทิ้ง) ──
/** visibility เฉลี่ยของจุดสำคัญ */
export const MIN_KEY_VISIBILITY = 0.7;
/** ความสูงร่าง (จมูก→ข้อเท้า) เป็นสัดส่วนของความสูงภาพ */
export const MIN_BODY_HEIGHT_FRAC = 0.55;
export const MAX_BODY_HEIGHT_FRAC = 0.95;
/** มุมเอียงของเส้นไหล่/เส้นสะโพกเทียบแนวนอน (องศา) */
export const MAX_TILT_DEG = 7;
/**
 * 🔴 เส้นไหล่/สะโพกต้องกว้างอย่างน้อยเท่านี้ (เทียบความสูงร่างเป็นพิกเซล) ถึงจะเอาไปวัดมุมได้
 *
 * เจอตอนรัน worker จริงกับภาพยืนด้านข้าง: ไหล่ซ้าย-ขวาซ้อนกันเกือบสนิท (ห่างกัน 10px บนร่าง 649px)
 * เส้นสั้นขนาดนั้น ขยับ 1 พิกเซลก็เหวี่ยงเป็นสิบองศา — ภาพนั้นวัดได้ 51° ทั้งที่คนยืนตรงเป๊ะ
 * ถ้าไม่กันไว้ ภาพ "ด้านข้าง" ซึ่งเป็นภาพที่ระบบบังคับให้ถ่ายทุกครั้ง จะถูกปฏิเสธเกือบทั้งหมด
 * ค่าอ้างอิง: ภาพด้านหน้าอยู่แถว 0.13 · ภาพด้านข้างอยู่แถว 0.02
 */
export const MIN_TILT_SPAN_RATIO = 0.06;
/** ความสว่างเฉลี่ยทั้งภาพ 0-255 */
export const MIN_MEAN_LUMA = 60;

// ── เกณฑ์ "ดีจริง" (ผ่านแต่ไม่ถึงเกณฑ์นี้ = ok = เก็บได้แต่เตือน) ──
export const GOOD_KEY_VISIBILITY = 0.85;
export const GOOD_BODY_HEIGHT_LO = 0.62;
export const GOOD_BODY_HEIGHT_HI = 0.9;
export const GOOD_TILT_DEG = 4;
export const GOOD_MEAN_LUMA = 90;

export type ScanQuality = "good" | "ok" | "poor";

export type GateCode =
  | "worker_failed"
  | "no_person"
  | "many_people"
  | "no_landmarks"
  | "low_visibility"
  | "too_far"
  | "too_close"
  | "tilted"
  | "dark";

/** เหตุผลไทยตรงตาม WO-BP-1 §B3 — ห้ามแก้ข้อความโดยไม่แก้เทส (TTS อ่านออกเสียงอันนี้ตอน user ยืนห่างจอ) */
export const GATE_MESSAGES: Record<GateCode, string> = {
  worker_failed: "อ่านรูปนี้ไม่ได้ ลองถ่ายใหม่อีกครั้งนะครับ",
  no_person: "ยังเห็นไม่เต็มตัว ลองถอยอีกนิดครับ",
  many_people: "เห็นคนมากกว่าหนึ่งคนในภาพ ขอให้เหลือคุณคนเดียวในเฟรมนะครับ",
  no_landmarks: "ยังเห็นไม่เต็มตัว ลองถอยอีกนิดครับ",
  low_visibility: "ยังเห็นไม่เต็มตัว ลองถอยอีกนิดครับ",
  too_far: "ยืนไกลไปหน่อย ขยับเข้ามาใกล้กล้องอีกนิดครับ",
  too_close: "ยืนใกล้ไปหน่อย ถอยออกให้เห็นตั้งแต่หัวถึงข้อเท้าครับ",
  tilted: "ยืนตรง ๆ กล้องอาจเอียงอยู่",
  dark: "แสงน้อยไป เปิดไฟหรือหันหน้าเข้าแสงครับ",
};

export interface GateLandmark {
  x: number;
  y: number;
  visibility: number;
}

/** = 1 รายการใน images[] ที่ worker/body_worker.py คืนมา */
export interface WorkerImage {
  ok?: boolean;
  error?: string;
  personCount?: number;
  landmarks?: GateLandmark[];
  maskCoverage?: number;
  width?: number;
  height?: number;
  meanLuma?: number;
}

export interface GateIssue {
  code: GateCode;
  /** reject = ภาพนี้ใช้ไม่ได้ ต้องลบ · warn = เก็บได้แต่คุณภาพลดเป็น ok */
  severity: "reject" | "warn";
  message: string;
}

export interface GateMetrics {
  personCount: number;
  /** visibility เฉลี่ยของจุดสำคัญ 9 จุด (null = ไม่มี landmark ให้คิด) */
  keyVisibility: number | null;
  /** (ข้อเท้าที่ต่ำสุด − จมูก) เป็นสัดส่วนของความสูงภาพ */
  bodyHeightFrac: number | null;
  /** มุมเอียงของเส้นไหล่ (องศา · แก้สัดส่วนภาพแล้ว) */
  shoulderTiltDeg: number | null;
  hipTiltDeg: number | null;
  /** ความกว้างของเส้นไหล่/สะโพกเทียบความสูงร่าง — ต่ำกว่า MIN_TILT_SPAN_RATIO = วัดมุมไม่ได้ (ภาพด้านข้าง) */
  shoulderSpanRatio: number | null;
  hipSpanRatio: number | null;
  meanLuma: number | null;
  maskCoverage: number | null;
}

export interface GateResult {
  /** true = เก็บภาพนี้ได้ (quality good/ok) · false = poor → ลบไฟล์ทิ้งทันที ห้ามเก็บ */
  pass: boolean;
  quality: ScanQuality;
  /** เหตุผลข้อแรกที่ user ต้องได้ยิน (null = ผ่านสบาย ๆ ไม่มีอะไรต้องบอก) */
  reason: string | null;
  /** เหตุผลทั้งหมดเรียงตามความสำคัญ */
  reasons: string[];
  issues: GateIssue[];
  metrics: GateMetrics;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

function lm(landmarks: GateLandmark[] | undefined, i: number): GateLandmark | null {
  const p = landmarks?.[i];
  if (!p || !isNum(p.x) || !isNum(p.y)) return null;
  return { x: p.x, y: p.y, visibility: isNum(p.visibility) ? p.visibility : 0 };
}

/** visibility เฉลี่ยของจุดสำคัญ — จุดที่หายไปนับเป็น 0 (ไม่ใช่ข้ามทิ้ง: จุดที่ไม่มีคือจุดที่มองไม่เห็น) */
export function keyVisibility(landmarks?: GateLandmark[]): number | null {
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  let sum = 0;
  for (const i of KEY_LANDMARKS) {
    const p = lm(landmarks, i);
    sum += p ? Math.max(0, Math.min(1, p.visibility)) : 0;
  }
  return round(sum / KEY_LANDMARKS.length, 4);
}

/**
 * สัดส่วนความสูงร่างในภาพ = (ข้อเท้าที่อยู่ต่ำสุด − จมูก) / ความสูงภาพ
 * y ของ MediaPipe เป็นสัดส่วนของความสูงภาพอยู่แล้ว → ลบกันได้ตรง ๆ
 * ใช้ข้อเท้า "ต่ำสุด" ไม่ใช่ค่าเฉลี่ย เพราะภาพด้านข้างขาหนึ่งบังอีกขาหนึ่งเสมอ
 * ค่านี้ไม่รวมหัวส่วนบนกับปลายเท้า — เกณฑ์ 55/95% ตั้งบนนิยามนี้ (WO-BP-1 §B3)
 */
export function bodyHeightFrac(landmarks?: GateLandmark[]): number | null {
  const nose = lm(landmarks, LM_NOSE);
  const al = lm(landmarks, LM_ANKLE_L);
  const ar = lm(landmarks, LM_ANKLE_R);
  if (!nose || (!al && !ar)) return null;
  const ankleY = Math.max(al?.y ?? -Infinity, ar?.y ?? -Infinity);
  return round(ankleY - nose.y, 4);
}

/**
 * มุมเอียงของเส้นที่ลากผ่านสองจุด เทียบแนวนอน (0-90°)
 *
 * 🔴 ต้องคูณกลับด้วยขนาดภาพก่อน: x เป็นสัดส่วนของ "ความกว้าง" แต่ y เป็นสัดส่วนของ "ความสูง"
 *    ภาพมือถือ 9:16 ถ้าลืมแปลง มุมจะพองขึ้นเกือบเท่าตัว = คนยืนตรงก็โดนบอกว่าเอียง
 *    ไม่รู้ขนาดภาพ → คิดบนสัดส่วนดิบไปก่อน (ดีกว่าไม่ตรวจเลย)
 */
export function tiltDeg(
  a: GateLandmark | null,
  b: GateLandmark | null,
  width?: number,
  height?: number
): number | null {
  if (!a || !b) return null;
  const w = isNum(width) && width > 0 ? width : 1;
  const h = isNum(height) && height > 0 ? height : 1;
  const dx = Math.abs(a.x - b.x) * w;
  const dy = Math.abs(a.y - b.y) * h;
  if (dx === 0 && dy === 0) return null;
  return round((Math.atan2(dy, dx) * 180) / Math.PI, 2);
}

/**
 * ความกว้างแนวนอนของเส้น (พิกเซล) เทียบกับความสูงร่าง (พิกเซล)
 * ใช้ตัดสินว่าเส้นนี้ "ยาวพอจะวัดมุมได้ไหม" — คืน null ถ้าข้อมูลไม่พอ
 */
export function tiltSpanRatio(
  a: GateLandmark | null,
  b: GateLandmark | null,
  frac: number | null,
  width?: number,
  height?: number
): number | null {
  if (!a || !b || frac == null || frac <= 0) return null;
  const w = isNum(width) && width > 0 ? width : 1;
  const h = isNum(height) && height > 0 ? height : 1;
  const bodyPx = frac * h;
  if (bodyPx <= 0) return null;
  return round((Math.abs(a.x - b.x) * w) / bodyPx, 4);
}

/** เรียงลำดับความสำคัญของเหตุผล — ข้อแรกคือข้อที่ TTS จะอ่าน จึงต้องเป็น "สาเหตุราก" ไม่ใช่อาการปลายทาง */
const PRIORITY: GateCode[] = [
  "worker_failed",
  "many_people",
  "dark",
  "no_person",
  "no_landmarks",
  "low_visibility",
  "too_far",
  "too_close",
  "tilted",
];

/**
 * ตรวจภาพเดียว
 *
 * ลำดับการตัดสินใจที่ตั้งใจ: ถ้าภาพมืดจนตรวจไม่เจอคน ต้องบอก "เปิดไฟ" ไม่ใช่ "ถอยอีกนิด"
 * (บอกให้ถอยในห้องมืดคือให้เขาทำสิ่งที่แก้ปัญหาไม่ได้ แล้วโทษว่าเขายืนผิดที่)
 */
export function gateImage(img: WorkerImage | null | undefined, view?: string | null): GateResult {
  const issues: GateIssue[] = [];
  const add = (code: GateCode, severity: "reject" | "warn") =>
    issues.push({ code, severity, message: GATE_MESSAGES[code] });

  const landmarks = Array.isArray(img?.landmarks) ? img?.landmarks : undefined;
  const personCount = isNum(img?.personCount) ? Math.max(0, Math.round(img!.personCount!)) : 0;
  const meanLuma = isNum(img?.meanLuma) ? img!.meanLuma! : null;
  const frac = bodyHeightFrac(landmarks);
  const shoulderL = lm(landmarks, LM_SHOULDER_L);
  const shoulderR = lm(landmarks, LM_SHOULDER_R);
  const hipL = lm(landmarks, LM_HIP_L);
  const hipR = lm(landmarks, LM_HIP_R);
  const metrics: GateMetrics = {
    personCount,
    keyVisibility: keyVisibility(landmarks),
    bodyHeightFrac: frac,
    shoulderTiltDeg: tiltDeg(shoulderL, shoulderR, img?.width, img?.height),
    hipTiltDeg: tiltDeg(hipL, hipR, img?.width, img?.height),
    shoulderSpanRatio: tiltSpanRatio(shoulderL, shoulderR, frac, img?.width, img?.height),
    hipSpanRatio: tiltSpanRatio(hipL, hipR, frac, img?.width, img?.height),
    meanLuma,
    maskCoverage: isNum(img?.maskCoverage) ? img!.maskCoverage! : null,
  };

  const isDark = meanLuma != null && meanLuma < MIN_MEAN_LUMA;

  // 0. worker วิเคราะห์ภาพนี้ไม่สำเร็จ (ไฟล์เสีย/ไม่ใช่รูป) — ไม่ใช่ความผิดของท่าทาง
  if (!img || img.ok === false) {
    add("worker_failed", "reject");
    return finish(issues, metrics);
  }

  // 1. แสง — ตรวจก่อนเรื่องคน เพราะแสงคือสาเหตุรากของ "ตรวจไม่เจอคน" ที่พบบ่อยที่สุด
  if (isDark) add("dark", "reject");

  // 2. มีคนไหม / กี่คน
  if (personCount > 1) {
    add("many_people", "reject");
  } else if (personCount === 0) {
    add("no_person", "reject");
  } else if (!landmarks || landmarks.length < LANDMARK_COUNT) {
    // ตรวจเจอคนแต่จุดไม่ครบ 33 = ผลลัพธ์ที่เอาไปวัดต่อไม่ได้
    add("no_landmarks", "reject");
  }

  const hasBody = personCount === 1 && !!landmarks && landmarks.length >= LANDMARK_COUNT;

  if (hasBody) {
    // 3. เห็นครบไหม
    const vis = metrics.keyVisibility;
    if (vis != null && vis < MIN_KEY_VISIBILITY) add("low_visibility", "reject");
    else if (vis != null && vis < GOOD_KEY_VISIBILITY) add("low_visibility", "warn");

    // 4. ระยะ
    if (frac != null) {
      if (frac < MIN_BODY_HEIGHT_FRAC) add("too_far", "reject");
      else if (frac > MAX_BODY_HEIGHT_FRAC) add("too_close", "reject");
      else if (frac < GOOD_BODY_HEIGHT_LO) add("too_far", "warn");
      else if (frac > GOOD_BODY_HEIGHT_HI) add("too_close", "warn");
    }

    /* 5. เอียง — เส้นไหล่หรือเส้นสะโพกอันไหนเอียงกว่า ใช้อันนั้นตัดสิน
       🔴 วัดได้เฉพาะภาพที่เห็นซ้าย-ขวาแยกกันจริง (หน้า/หลัง)
          ภาพด้านข้าง ไหล่สองข้างซ้อนกัน = มุมที่คำนวณได้เป็นสัญญาณรบกวนล้วน ห้ามเอาไปตัดสิน
          กันสองชั้น: (ก) view บอกว่าเป็นด้านข้าง (ข) เส้นสั้นผิดปกติ เผื่อ view ถูกส่งมาผิด */
    const isSideView = String(view ?? "").toLowerCase() === "side";
    if (!isSideView) {
      const pairs: [number | null, number | null][] = [
        [metrics.shoulderTiltDeg, metrics.shoulderSpanRatio],
        [metrics.hipTiltDeg, metrics.hipSpanRatio],
      ];
      const tilts = pairs
        .filter(([deg, span]) => deg != null && span != null && span >= MIN_TILT_SPAN_RATIO)
        .map(([deg]) => deg as number);
      if (tilts.length) {
        const worst = Math.max(...tilts);
        if (worst > MAX_TILT_DEG) add("tilted", "reject");
        else if (worst > GOOD_TILT_DEG) add("tilted", "warn");
      }
    }
  }

  // 6. แสงพอแต่ยังไม่ดีนัก
  if (!isDark && meanLuma != null && meanLuma < GOOD_MEAN_LUMA) add("dark", "warn");

  return finish(issues, metrics);
}

function finish(issues: GateIssue[], metrics: GateMetrics): GateResult {
  const rank = (c: GateCode) => {
    const i = PRIORITY.indexOf(c);
    return i < 0 ? PRIORITY.length : i;
  };
  const sorted = [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "reject" ? -1 : 1;
    return rank(a.code) - rank(b.code);
  });
  const rejected = sorted.some((i) => i.severity === "reject");
  const quality: ScanQuality = rejected ? "poor" : sorted.length ? "ok" : "good";
  const reasons = sorted.map((i) => i.message);
  return {
    pass: !rejected,
    quality,
    reason: reasons[0] ?? null,
    reasons,
    issues: sorted,
    metrics,
  };
}

/** คุณภาพของทั้งสแกน = ภาพที่แย่ที่สุด (สแกนดีเท่าภาพที่อ่อนที่สุด เพราะต้องใช้ทุกภาพร่วมกันคำนวณ) */
export function worstQuality(qualities: (ScanQuality | string | null | undefined)[]): ScanQuality {
  let out: ScanQuality = "good";
  for (const q of qualities) {
    if (q === "poor") return "poor";
    if (q === "ok") out = "ok";
  }
  return out;
}
