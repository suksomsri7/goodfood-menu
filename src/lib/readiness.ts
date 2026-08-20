/**
 * Engine #4 — Readiness / Recovery (WO-PT-ENGINE §4.1 · เฟส C)
 *
 * "วันนี้ร่างกายพร้อมแค่ไหน" คิดจาก Watch + คำถาม 2 ข้อ — ไม่ใช่ให้ AI เดา
 * เหตุผลที่เป็นคณิตล้วน: คะแนนนี้ไปตัดเซ็ตของแผนวันนี้จริง ๆ ถ้าเลขไม่นิ่งลูกค้าจะเห็นแผนเปลี่ยนไปมาโดยไม่มีเหตุผล
 * และเราต้องตอบได้เสมอว่า "ทำไมวันนี้ถึงลดให้"
 *
 * 🔴 กติกาของไฟล์นี้ (เหมือน progression.ts):
 *   - ห้าม import prisma / fetch / new Date() — รับทุกอย่างผ่านพารามิเตอร์
 *   - ทุกกติกามีเทสถาวรที่ scripts/test-readiness.ts
 *   - ไม่มีข้อมูล = ตัดส่วนนั้นทิ้งแล้วเฉลี่ยจากที่เหลือ ห้ามให้ 0 (คนไม่มี Watch ไม่ใช่คนไม่พร้อม)
 */

// ── น้ำหนักแต่ละส่วน (§4.1) — รวม 100 เมื่อมีข้อมูลครบ ──
export const W_HRV = 25;
export const W_RHR = 15;
export const W_SLEEP = 25;
export const W_ENERGY = 15;
export const W_SORENESS = 20;

/** z ที่เกินนี้ถือว่าสุดขอบแล้ว (กันวันที่ Watch อ่านเพี้ยนดึงคะแนนทั้งวัน) */
export const Z_CLAMP = 2;
/** นอนเกินเป้าได้เครดิตเพิ่มถึงเพดานนี้ (นอน 9 ชม. ดีกว่า 8 แต่ไม่ใช่ดีขึ้นเรื่อย ๆ ไม่จำกัด) */
export const SLEEP_CAP = 1.15;
/** เป้านอนปริยาย (นาที) — ยังไม่มีที่ให้ user ตั้งเป้านอนในหน้าตั้งค่า */
export const DEFAULT_SLEEP_GOAL_MIN = 480;

/** เกณฑ์แบ่งช่วง (§4.1) */
export const BAND_FULL = 75;
export const BAND_NORMAL = 55;
export const BAND_REDUCED = 40;

/** ตัดปริมาณลงกี่ % ในวัน reduced */
export const REDUCED_CUT_PCT = 0.3;
/** วันที่ไม่มีเซ็ตให้ตัด (เดิน/ยืดล้วน) จะตัดที่ "นาที" แทน — ห้ามเหลือสั้นกว่านี้ (สั้นกว่านี้ดูเหมือนระบบพัง) */
export const MIN_TRIMMED_MINUTES = 10;

export type ReadinessBand = "full" | "normal" | "reduced" | "recovery";

export interface HrvInput {
  /** ค่าเฉลี่ย HRV 7 วันล่าสุด (ms) */
  today7dAvg: number;
  base28dAvg: number;
  sd28d: number;
}
export interface RhrInput {
  /** ชีพจรขณะพักของวันนี้ */
  today: number;
  base28dAvg: number;
  sd28d: number;
}
export interface SleepInput {
  minutes: number;
  goalMinutes?: number;
}

export interface ReadinessInput {
  /** ไม่มี Watch = undefined (ไม่ใช่ 0) */
  hrv?: HrvInput | null;
  rhr?: RhrInput | null;
  sleep?: SleepInput | null;
  /** 1-5 */
  energy?: number | null;
  /** 1-5 (5 = ปวดมาก) */
  soreness?: number | null;
}

/** ค่า 0-1 ที่ใช้จริงต่อส่วน — ส่วนที่ไม่มีข้อมูลจะไม่มี key นี้เลย (ไม่ใช่ 0) */
export interface ReadinessParts {
  hrv?: number;
  rhr?: number;
  sleep?: number;
  energy?: number;
  soreness?: number;
}

export interface ReadinessResult {
  /** 0-100 · null = ไม่มีข้อมูลสักส่วนเดียว → ห้ามแต่งคะแนนให้ */
  score: number | null;
  band: ReadinessBand;
  parts: ReadinessParts;
  /** น้ำหนักรวมของส่วนที่มีข้อมูลจริง (ก่อน re-normalize) — ไว้บอกว่า "คิดจากกี่ % ของสูตรเต็ม" */
  usedWeight: number;
  /** ชื่อส่วนที่ไม่มีข้อมูล (จอเอาไปบอกว่า "ใส่นาฬิกาแล้วคะแนนจะแม่นขึ้น") */
  missing: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** ปัด 4 ตำแหน่ง — ค่า part ไว้โชว์/เทส ไม่ใช่ตัวคูณต่อ ๆ ไป จึงปัดได้โดยไม่สะสมความคลาดเคลื่อน */
const round4 = (n: number) => Math.round(n * 10000) / 10000;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * z → 0-1: z อยู่ในช่วง ±2 (clamp) แล้ว map เป็น (z+2)/4
 * เหตุผลที่ไม่ใช้ sigmoid: ต้องอธิบายเป็นคำพูดได้ว่า "ต่ำกว่าค่าปกติ 2 sd = 0 คะแนนส่วนนี้"
 */
export function zToPart(z: number): number {
  return round4((clamp(z, -Z_CLAMP, Z_CLAMP) + Z_CLAMP) / (2 * Z_CLAMP));
}

/**
 * ส่วน HRV: สูงกว่าค่าปกติของตัวเอง = ฟื้นตัวดี
 * sd ≤ 0 หรือไม่มี = ยังไม่รู้ว่า "ปกติ" ของคนนี้แกว่งแค่ไหน → ตัดส่วนนี้ทิ้ง ไม่ใช่ให้ 0.5 มั่ว ๆ
 */
export function hrvPart(hrv?: HrvInput | null): number | null {
  if (!hrv || !isNum(hrv.today7dAvg) || !isNum(hrv.base28dAvg) || !isNum(hrv.sd28d) || hrv.sd28d <= 0) return null;
  return zToPart((hrv.today7dAvg - hrv.base28dAvg) / hrv.sd28d);
}

/** ส่วน RHR: กลับด้าน — ชีพจรพักวันนี้ "ต่ำกว่า" ค่าปกติ = ดี */
export function rhrPart(rhr?: RhrInput | null): number | null {
  if (!rhr || !isNum(rhr.today) || !isNum(rhr.base28dAvg) || !isNum(rhr.sd28d) || rhr.sd28d <= 0) return null;
  return zToPart(-(rhr.today - rhr.base28dAvg) / rhr.sd28d);
}

/** ส่วนนอน: นาที/เป้า ตัดที่ 1.15 แล้วหารกลับให้เป็น 0-1 (นอนครบเป้า = 0.87 ไม่ใช่เต็ม — เผื่อคนที่นอนเกินเป้า) */
export function sleepPart(sleep?: SleepInput | null): number | null {
  if (!sleep || !isNum(sleep.minutes) || sleep.minutes < 0) return null;
  const goal = isNum(sleep.goalMinutes) && sleep.goalMinutes > 0 ? sleep.goalMinutes : DEFAULT_SLEEP_GOAL_MIN;
  return round4(clamp(sleep.minutes / goal, 0, SLEEP_CAP) / SLEEP_CAP);
}

/** พลังงาน 1-5 → 0-1 */
export function energyPart(energy?: number | null): number | null {
  if (!isNum(energy)) return null;
  return round4((clamp(energy, 1, 5) - 1) / 4);
}

/** ปวดกล้ามเนื้อ 1-5 → 0-1 แบบกลับด้าน (ปวดมาก = พร้อมน้อย) */
export function sorenessPart(soreness?: number | null): number | null {
  if (!isNum(soreness)) return null;
  return round4(1 - (clamp(soreness, 1, 5) - 1) / 4);
}

/** คะแนน → ช่วง (§4.1) */
export function bandOf(score: number): ReadinessBand {
  if (score >= BAND_FULL) return "full";
  if (score >= BAND_NORMAL) return "normal";
  if (score >= BAND_REDUCED) return "reduced";
  return "recovery";
}

/**
 * คะแนนความพร้อม 0-100
 *
 * 🔴 หัวใจ: ส่วนที่ไม่มีข้อมูล = "ตัดออกแล้ว re-normalize น้ำหนักที่เหลือ"
 *    ไม่ใช่ให้ 0 — คนไม่มี Apple Watch ต้องได้คะแนนยุติธรรมจากคำถาม 2 ข้อ + นอน
 *    (ตอบครบแต่ไม่มี Watch แล้วยังได้ full = ถูกต้อง)
 * ไม่มีข้อมูลเลยสักส่วน → score = null และถือว่า normal (เดินตามแผนเดิม) ห้ามเดาคะแนนให้
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const raw: { key: keyof ReadinessParts; weight: number; value: number | null }[] = [
    { key: "hrv", weight: W_HRV, value: hrvPart(input.hrv) },
    { key: "rhr", weight: W_RHR, value: rhrPart(input.rhr) },
    { key: "sleep", weight: W_SLEEP, value: sleepPart(input.sleep) },
    { key: "energy", weight: W_ENERGY, value: energyPart(input.energy) },
    { key: "soreness", weight: W_SORENESS, value: sorenessPart(input.soreness) },
  ];

  const parts: ReadinessParts = {};
  const missing: string[] = [];
  let sum = 0;
  let usedWeight = 0;

  for (const r of raw) {
    if (r.value == null) {
      missing.push(r.key);
      continue;
    }
    parts[r.key] = r.value;
    sum += r.weight * r.value;
    usedWeight += r.weight;
  }

  if (usedWeight === 0) return { score: null, band: "normal", parts, usedWeight: 0, missing };

  const score = Math.round(100 * (sum / usedWeight));
  return { score, band: bandOf(score), parts, usedWeight, missing };
}

/** คำอธิบายไทย 1 ประโยคที่ user เห็นหลังตอบ check-in — ห้ามตำหนิ ห้ามสั่งให้หยุดเล่น */
export function suggestionFor(score: number | null, band: ReadinessBand): string {
  if (score == null) return "ยังไม่มีข้อมูลพอจะประเมิน — ตอบคำถามสั้น ๆ 2 ข้อแล้วเราคิดให้ทันที";
  switch (band) {
    case "full":
      return `ความพร้อม ${score}/100 — วันนี้ร่างกายพร้อมเต็มที่ ลุยตามแผนได้เลย`;
    case "normal":
      return `ความพร้อม ${score}/100 — พร้อมปกติ เดินตามแผนวันนี้ได้สบาย ๆ`;
    case "reduced":
      return `ความพร้อม ${score}/100 — วันนี้ฟื้นตัวยังไม่เต็มที่ ลดปริมาณลงหน่อยจะได้ผลดีกว่าฝืน`;
    default:
      return `ความพร้อม ${score}/100 — วันนี้ร่างกายขอพัก เปลี่ยนเป็นเดินเบา ๆ กับยืดเหยียดแทนนะ`;
  }
}

// ── ปรับแผนของวันนี้ตาม band ──

/**
 * จุดที่ปวด → pattern ที่ต้องลดก่อน (§4.1 "ลดเฉพาะ pattern ที่ใช้กล้ามเนื้อนั้น ไม่หั่นทั้งวัน")
 * pattern ที่ใช้ = ค่าในคอลัมน์ Exercise.pattern: squat|hinge|push_h|push_v|pull_h|pull_v|lunge|core|carry|cardio|mobility
 * 🔴 ตารางนี้คือ "ท่าไหนกวนจุดที่เขาปวด" ไม่ใช่ "กล้ามเนื้อมัดไหนทำงาน" — ปวดหลังต้องเลี่ยง hinge/squat แม้หลังไม่ใช่มัดหลัก
 */
export const SORE_AREA_PATTERNS: Record<string, string[]> = {
  knee: ["squat", "lunge"],
  back: ["hinge", "squat"],
  shoulder: ["push_v", "push_h", "pull_v"],
  chest: ["push_h", "push_v"],
  arm: ["push_h", "pull_h"],
  elbow: ["push_h", "push_v", "pull_h", "pull_v"],
  wrist: ["push_h", "push_v", "carry"],
  hip: ["hinge", "squat", "lunge"],
  hamstring: ["hinge", "lunge"],
  glute: ["hinge", "squat", "lunge"],
  calf: ["lunge", "squat", "cardio"],
  ankle: ["lunge", "squat", "cardio"],
  neck: ["push_v", "pull_v"],
  core: ["core", "carry"],
  leg: ["squat", "lunge", "hinge"],
};

/** ชื่อไทยของจุดที่ปวด — ใช้เขียนเหตุผลให้ user อ่านรู้เรื่อง ("ลด 1 เซ็ต — คุณบอกว่าปวดเข่า") */
export const SORE_AREA_LABELS_TH: Record<string, string> = {
  knee: "เข่า",
  back: "หลัง",
  shoulder: "ไหล่",
  chest: "อก",
  arm: "แขน",
  elbow: "ข้อศอก",
  wrist: "ข้อมือ",
  hip: "สะโพก",
  hamstring: "ต้นขาหลัง",
  glute: "ก้น",
  calf: "น่อง",
  ankle: "ข้อเท้า",
  neck: "คอ",
  core: "แกนกลางลำตัว",
  leg: "ขา",
};

/** คำไทยที่ user/แอปอาจส่งมาแทน key อังกฤษ — รับทั้งสองแบบ ไม่ใช่ทิ้งเงียบ ๆ */
const SORE_AREA_ALIASES: Record<string, string> = {
  เข่า: "knee",
  หลัง: "back",
  หลังล่าง: "back",
  lower_back: "back",
  ไหล่: "shoulder",
  บ่า: "shoulder",
  อก: "chest",
  แขน: "arm",
  ข้อศอก: "elbow",
  ศอก: "elbow",
  ข้อมือ: "wrist",
  สะโพก: "hip",
  ต้นขาหลัง: "hamstring",
  ก้น: "glute",
  น่อง: "calf",
  ข้อเท้า: "ankle",
  คอ: "neck",
  แกนกลาง: "core",
  หน้าท้อง: "core",
  ท้อง: "core",
  ขา: "leg",
  ต้นขา: "leg",
};

/** แปลงจุดที่ปวดที่ส่งมาให้เป็น key ในตาราง (ไม่รู้จัก = null) */
export function normalizeSoreArea(area: string): string | null {
  const a = String(area ?? "").trim().toLowerCase();
  if (!a) return null;
  if (SORE_AREA_PATTERNS[a]) return a;
  const alias = SORE_AREA_ALIASES[a] ?? SORE_AREA_ALIASES[String(area ?? "").trim()];
  return alias ?? null;
}

/** pattern ทั้งหมดที่ควรลดก่อน จากจุดที่ปวดที่ user เลือก */
export function patternsForSoreAreas(soreAreas?: string[] | null): Set<string> {
  const out = new Set<string>();
  for (const a of soreAreas ?? []) {
    const key = normalizeSoreArea(a);
    if (!key) continue;
    for (const p of SORE_AREA_PATTERNS[key] ?? []) out.add(p);
  }
  return out;
}

/** ชื่อไทยของจุดที่ปวด (ไม่รู้จัก = คืนคำเดิมที่ user พิมพ์มา) */
export function soreAreaLabel(area: string): string {
  const key = normalizeSoreArea(area);
  return (key && SORE_AREA_LABELS_TH[key]) || String(area ?? "").trim();
}

/** ท่าหนึ่งบรรทัดในแผน (= DailyPlan.exercisePlan.items[]) — ฟิลด์เท่าที่ engine นี้ต้องใช้/เขียน */
export interface ReadinessPlanItem {
  key?: string;
  name: string;
  sets?: number;
  reps?: number;
  minutes?: number;
  note?: string;
  /** ทำไมวันนี้ท่านี้ถึงเปลี่ยน — โชว์ใต้ชื่อท่าในแอป */
  readinessNote?: string;
  [k: string]: unknown;
}

/** ท่านี้เป็น pattern อะไร — ผู้เรียกส่งฟังก์ชันเข้ามา (ตาราง exercises อยู่ใน DB, ไฟล์นี้แตะ DB ไม่ได้) */
export type PatternOf = (item: ReadinessPlanItem) => string | null;

export interface AdjustResult {
  items: ReadinessPlanItem[];
  /** แผนถูกแตะจริงไหม (full/normal หรือไม่มีอะไรให้ตัด = false → อย่าไปบอก user ว่าปรับให้แล้ว) */
  changed: boolean;
  /** จำนวนเซ็ตที่ตัดออกทั้งวัน */
  cutSets: number;
  /** เปลี่ยนทั้งวันเป็นวันพักฟื้น */
  replacedDay: boolean;
  /** ข้อความระดับวัน (วันพักฟื้น) — ว่าง = ไม่มี */
  dayNote?: string;
}

/** ท่าประจำวันพักฟื้น — เดิน Zone 2 + ยืดเหยียด (ไม่ใช่ "หยุดเฉย ๆ" เพราะต้องรักษานิสัยไว้ §4.1) */
export const RECOVERY_WALK_MIN = 25;
export const RECOVERY_STRETCH_MIN = 10;
export const RECOVERY_DAY_NOTE = "วันพักฟื้น — ร่างกายขอ";

export function recoveryDayItems(): ReadinessPlanItem[] {
  return [
    {
      key: "walk_fast",
      name: "เดินเร็ว Zone 2",
      minutes: RECOVERY_WALK_MIN,
      note: "เดินให้ยังพูดเป็นประโยคได้ ไม่ต้องเร่ง",
      readinessNote: RECOVERY_DAY_NOTE,
    },
    {
      key: "stretch_full",
      name: "ยืดเหยียดทั้งตัว",
      minutes: RECOVERY_STRETCH_MIN,
      note: "ค้างท่าละ 20-30 วิ หายใจยาว ไม่กระตุก",
      readinessNote: RECOVERY_DAY_NOTE,
    },
  ];
}

/** ตัดกี่เซ็ตจากท่านี้ — 30% ปัดขึ้น แต่ต้องเหลืออย่างน้อย 1 เซ็ตเสมอ (ลดปริมาณ ≠ ยกเลิกท่า) */
export function cutSetsFor(sets: number): number {
  const s = Math.max(1, Math.round(sets));
  return Math.min(Math.ceil(s * REDUCED_CUT_PCT), s - 1);
}

/**
 * ปรับแผนวันนี้ตามคะแนนความพร้อม
 *
 *   full / normal → คืนของเดิมทั้งดุ้น (ไม่แตะ ไม่ใส่ note)
 *   reduced       → ตัดปริมาณรวม ~30% โดย "ท่าที่กวนจุดที่ปวด" โดนก่อน
 *                   ถ้าตัดเฉพาะท่าที่กวนแล้วถึง 30% แล้ว → ท่าที่เหลือไม่ต้องแตะ (§4.1 ไม่หั่นทั้งวัน)
 *                   ยังไม่ถึงเป้า → ไล่ตัดจาก "ท่าท้าย" ขึ้นมา (accessory อยู่ท้าย ท่าหลัก compound อยู่ต้นวัน §4.4)
 *   recovery      → เปลี่ยนทั้งวันเป็น เดิน Zone 2 + ยืดเหยียด
 *
 * ทุกท่าที่ถูกแตะได้ readinessNote ภาษาไทยติดไป — user ต้องรู้เสมอว่าทำไมวันนี้ไม่เหมือนที่วางไว้
 */
export function adjustPlanForReadiness(
  items: ReadinessPlanItem[],
  band: ReadinessBand,
  soreAreas?: string[] | null,
  patternOf?: PatternOf | null
): AdjustResult {
  const src = Array.isArray(items) ? items : [];

  if (band === "recovery") {
    return {
      items: recoveryDayItems(),
      changed: true,
      cutSets: src.reduce((n, it) => n + (Number(it.sets) > 0 ? Math.round(Number(it.sets)) : 0), 0),
      replacedDay: true,
      dayNote: RECOVERY_DAY_NOTE,
    };
  }

  if (band !== "reduced" || src.length === 0) {
    return { items: src, changed: false, cutSets: 0, replacedDay: false };
  }

  const next = src.map((it) => ({ ...it }));
  const setsOf = (it: ReadinessPlanItem) => (Number(it.sets) > 0 ? Math.round(Number(it.sets)) : 0);
  const totalSets = next.reduce((n, it) => n + setsOf(it), 0);

  // วันที่ไม่มีท่าไหนนับเป็นเซ็ตเลย (เดิน/ยืดเหยียดล้วน) — ตัดที่ "นาที" แทน ไม่งั้นบอกว่าลดให้แล้วแต่แผนเหมือนเดิม
  if (totalSets === 0) {
    let changed = false;
    for (const it of next) {
      const min = Number(it.minutes);
      if (!(min > 0)) continue;
      const trimmed = Math.max(MIN_TRIMMED_MINUTES, Math.round((min * (1 - REDUCED_CUT_PCT)) / 5) * 5);
      if (trimmed >= min) continue;
      it.minutes = trimmed;
      it.readinessNote = `ลดเหลือ ${trimmed} นาที — คะแนนความพร้อมต่ำ`;
      changed = true;
    }
    return { items: next, changed, cutSets: 0, replacedDay: false };
  }

  const goal = Math.ceil(totalSets * REDUCED_CUT_PCT);
  const sorePatterns = patternsForSoreAreas(soreAreas);
  const soreLabel = (soreAreas ?? []).map(soreAreaLabel).filter(Boolean).join("/");

  const isSore = (it: ReadinessPlanItem) => {
    if (!sorePatterns.size || !patternOf) return false;
    const p = patternOf(it);
    return !!p && sorePatterns.has(p);
  };

  let removed = 0;
  const cut = (it: ReadinessPlanItem, sore: boolean) => {
    const sets = setsOf(it);
    if (sets <= 1) return;
    const n = cutSetsFor(sets);
    if (n <= 0) return;
    it.sets = sets - n;
    it.readinessNote = sore
      ? `ลด ${n} เซ็ต — คุณบอกว่าปวด${soreLabel || "ตรงนี้"}วันนี้`
      : `ลด ${n} เซ็ต — คะแนนความพร้อมต่ำ`;
    removed += n;
  };

  // รอบที่ 1: ท่าที่กวนจุดที่ปวด — ตัดทุกตัว ไม่ว่าจะถึงเป้าหรือยัง (เป้าหมายคือ "ไม่กวนที่เจ็บ")
  const soreIdx = new Set<number>();
  next.forEach((it, i) => {
    if (isSore(it)) soreIdx.add(i);
  });
  for (const i of soreIdx) cut(next[i], true);

  // รอบที่ 2: ยังไม่ถึง 30% ของทั้งวัน → ไล่ตัดจากท่าท้ายขึ้นมาจนถึงเป้า แล้วหยุด (ท่าที่เหลือไม่โดนแตะ)
  for (let i = next.length - 1; i >= 0 && removed < goal; i--) {
    if (soreIdx.has(i)) continue;
    cut(next[i], false);
  }

  return { items: next, changed: removed > 0, cutSets: removed, replacedDay: false };
}
