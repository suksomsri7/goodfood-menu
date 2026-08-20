/**
 * โปรไฟล์การเทรน — ตรรกะล้วน (WO-PT-D §S2/§S4 · WO-PT-ENGINE §3, §5.1, §5.5)
 *
 * ไฟล์นี้คือจุดที่ "คำตอบตอน onboarding" กลายเป็น "ท่าที่ user ต้องทำจริงในสัปดาห์นี้"
 * ทุกอย่างที่ตัดสินใจแทนร่างกายคนอื่นต้องเทสได้โดยไม่มี DB/เวลา/AI → ห้าม import prisma,
 * ห้ามเรียก new Date()/Date.now() (เวลา "ตอนนี้" ต้องรับเป็นพารามิเตอร์เสมอ) และห้ามยิงเน็ต
 *
 * 🔴 ตำแหน่งในสายการผลิตแผน (planGenerator):
 *    เลือกท่า → trainDays/sessionMin/ชอบ-ไม่ชอบ (ก่อนด่านความปลอดภัย) → enforceAvoid + ตัวกรองบาดเจ็บ
 *    → applyProgression (ตัวเลข) → applyLightWeek (สอบเทียบ/PAR-Q/พักฟื้นบาดเจ็บ = คำสุดท้ายเรื่องน้ำหนัก)
 */
import type { CatalogExercise, ExerciseKind } from "@/lib/exerciseCatalog";
import type { DayPlan, ExercisePlanItem } from "@/lib/planGenerator";

// ────────────────────────────── ค่าคงที่ของกติกา ──────────────────────────────

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
/** JS getUTCDay() → ชื่อวัน (0 = อาทิตย์) */
export const JS_DAY_TO_KEY: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const PRIMARY_GOALS = ["fat_loss", "muscle_gain", "strength", "endurance", "general", "athletic"] as const;
export const TRAINING_STYLES = ["strength", "hypertrophy", "fatloss_hybrid", "endurance", "athletic", "balanced"] as const;
export const JOB_TYPES = ["desk", "standing", "physical"] as const;
export const INJURY_AREAS = ["shoulder", "knee", "back", "hip", "ankle", "wrist", "neck", "other"] as const;
export const INJURY_SEVERITIES = ["caution", "avoid"] as const;
/** ค่าที่อนุญาตในคอลัมน์ Exercise.pattern (ชุดเดียวกับ exerciseAdmin) */
export const PATTERNS = [
  "squat", "hinge", "push_h", "push_v", "pull_h", "pull_v", "lunge", "core", "carry", "cardio", "mobility",
] as const;

export const MIN_DAYS_PER_WEEK = 1;
export const MAX_DAYS_PER_WEEK = 7;
export const MIN_SESSION_MIN = 15;
export const MAX_SESSION_MIN = 120;
/** ชอบ/ไม่ชอบ เก็บกลุ่มละ 10 — เกินนั้นตัดท้ายทิ้ง (ไม่ใช่ตอบ error ใส่หน้า user) */
export const MAX_TAGS = 10;
/** สัปดาห์สอบเทียบยาว 7 วันนับจากวันตั้งโปรไฟล์ */
export const CALIBRATION_DAYS = 7;
/** สอบเทียบ/โหมดเบา: น้ำหนักครึ่งเดียวของที่ engine สั่ง */
export const LIGHT_LOAD_FACTOR = 0.5;
/** ยังไม่เคยมีตัวเลขของตัวเอง → เริ่มที่ก้าวต่ำสุดของอุปกรณ์ × 2 (เบาที่สุดที่ยังพอรู้สึก) */
export const CALIBRATION_START_STEPS = 2;
/** บาดเจ็บระดับ caution → ลดน้ำหนักเป้า 20% */
export const CAUTION_LOAD_FACTOR = 0.8;
export const DEFAULT_INCREMENT_KG = 0.5;

export const CALIBRATION_NOTE = "สัปดาห์สอบเทียบ — เก็บ feel ให้ครบ ระบบจะตั้งน้ำหนักจริงให้สัปดาห์หน้า";
export const LOW_INTENSITY_NOTE = "โหมดเบา — ครั้งเยอะ น้ำหนักน้อย จนกว่าจะยืนยันว่าปรึกษาแพทย์แล้ว";
export const REST_DAY_TITLE = "วันพัก";
export const REST_DAY_NOTE = "วันนี้ไม่ใช่วันเทรนตามตารางของคุณ — ยืดเหยียดเบา ๆ พอครับ";

/**
 * PAR-Q ตอบ "ใช่" → ข้อความแนะนำ (WO-PT-ENGINE §5.5)
 * 🔴 โทนต้องอ่อน: นี่ไม่ใช่ความผิดของ user และเราไม่ใช่หมอ ห้ามวินิจฉัย ห้ามขู่ ห้ามห้ามออกกำลังกาย
 */
export const PARQ_ADVISORY_TH =
  "จากคำตอบของคุณ แนะนำให้ปรึกษาแพทย์ก่อนเริ่มโปรแกรมหนักนะครับ ระหว่างนี้ระบบจะจัดแผนความหนักระดับเบาให้ก่อน " +
  "ออกกำลังกายได้ตามปกติเท่าที่สบายตัว เมื่อคุณยืนยันในหน้าตั้งค่าว่าปรึกษาแพทย์แล้ว ระบบจะกลับไปจัดแผนตามเป้าหมายเดิมให้ทันที";

// ────────────────────────────── ประเภทข้อมูล ──────────────────────────────

export interface TrainingProfileLike {
  primaryGoal: string;
  secondaryGoals?: string[];
  style?: string | null;
  daysPerWeek: number;
  sessionMin: number;
  trainDays?: string[];
  preferredTime?: string | null;
  likes?: string[];
  dislikes?: string[];
  jobType?: string | null;
  stress?: number | null;
  waistCm?: number | null;
  bodyFatPct?: number | null;
  experienceMonths?: number | null;
  calibration?: boolean;
  calibrationStartedAt?: Date | null;
  parq?: unknown;
  parqFlag?: boolean;
}

export interface InjuryLike {
  id?: string;
  area: string;
  severity: string;
  avoidPatterns?: string[];
  avoidKeys?: string[];
  note?: string | null;
  active?: boolean;
  expiresAt?: Date | null;
}

/** "ท่านี้เป็น pattern อะไร" — generator อ่านจากตาราง exercises แล้วส่งฟังก์ชันเข้ามา (ไฟล์นี้ไม่แตะ DB) */
export type PatternOfItem = (item: { key?: string; name?: string }) => string | null;

// ────────────────────────────── §S2: ฟังก์ชันหลัก ──────────────────────────────

const REP_RANGE_BY_STYLE: Record<string, [number, number]> = {
  strength: [4, 6],
  hypertrophy: [8, 12],
  fatloss_hybrid: [10, 15],
  endurance: [12, 20],
  athletic: [6, 10],
};
const REP_RANGE_BY_GOAL: Record<string, [number, number]> = {
  fat_loss: [10, 15],
  muscle_gain: [8, 12],
  strength: [4, 6],
};
export const FALLBACK_REP_RANGE: [number, number] = [8, 12];

/**
 * ช่วงจำนวนครั้งของสัปดาห์นี้ — ตัวเสียบช่อง opts.repRange ที่ progression.ts เปิดรอไว้ตั้งแต่เฟส B
 * (v1 ใช้ [8,12] คงที่ทุกคน → คนที่บอกว่าอยากแข็งแรงก็ยังโดนสั่ง 12 ครั้งอยู่ดี)
 * style = balanced/ไม่ระบุ → ตกไปตาม goal
 */
export function repRangeFor(style?: string | null, primaryGoal?: string | null): [number, number] {
  const s = String(style ?? "").trim();
  if (s && s !== "balanced" && REP_RANGE_BY_STYLE[s]) return [...REP_RANGE_BY_STYLE[s]] as [number, number];
  const g = String(primaryGoal ?? "").trim();
  if (g && REP_RANGE_BY_GOAL[g]) return [...REP_RANGE_BY_GOAL[g]] as [number, number];
  return [...FALLBACK_REP_RANGE] as [number, number];
}

/**
 * ตัวคูณความเร็ว progression ตามประสบการณ์ (≥24 เดือน = 1.0 · 6-24 = 0.75 · <6 หรือไม่รู้ = 0.5)
 * 🔴 ยังเป็น "ค่าที่คำนวณไว้ให้" เฉย ๆ ยังไม่ได้เสียบเข้า progression — ดู deviation ในรายงานปิดงาน
 *    (ความหมายของตัวเลขกับพฤติกรรมที่ WO อธิบายไว้สวนทางกัน ต้องให้ผู้คุมงานเคาะก่อนถึงจะเอาไปคูณของจริงได้)
 */
export function experienceFactor(months?: number | null): number {
  const m = Number(months);
  if (!Number.isFinite(m) || m < 6) return 0.5;
  if (m >= 24) return 1.0;
  return 0.75;
}

/** PAR-Q ตอบใช่แล้วยังไม่ได้ยืนยันกับแพทย์ = คุมความหนักไว้ที่ระดับเบา */
export function intensityCap(profile?: TrainingProfileLike | null): "low" | null {
  if (!profile?.parqFlag) return null;
  const parq = profile.parq as { clearedAt?: unknown } | null | undefined;
  const cleared = parq && typeof parq === "object" ? (parq as Record<string, unknown>).clearedAt : null;
  return cleared ? null : "low";
}

/** อ่านคำตอบ PAR-Q → ตอบ "ใช่" ข้อใดข้อหนึ่ง = ติดธง */
export function parqFlagFrom(parq: unknown): boolean {
  if (!parq || typeof parq !== "object") return false;
  const o = parq as Record<string, unknown>;
  return ["q1", "q2", "q3"].some((k) => o[k] === true);
}

/**
 * ยังอยู่ในสัปดาห์สอบเทียบไหม — คิดตอนอ่านทุกครั้ง ไม่มี cron มาปลดให้
 * (cron ที่ลืมรัน = ลูกค้าติดโหมดเบาไปตลอดกาลโดยไม่มีใครรู้)
 */
export function isCalibrationWeek(profile: TrainingProfileLike | null | undefined, now: Date): boolean {
  if (!profile?.calibration) return false;
  const started = profile.calibrationStartedAt;
  if (!started) return true; // ไม่มีหมุดเวลา = เพิ่งตั้งโปรไฟล์
  const days = (now.getTime() - started.getTime()) / (24 * 3600 * 1000);
  return days < CALIBRATION_DAYS;
}

/** ครบ 7 วันแล้วแต่ในตารางยังเป็น true → store ต้องเขียนกลับเป็น false ครั้งเดียว */
export function calibrationShouldClear(profile: TrainingProfileLike | null | undefined, now: Date): boolean {
  return !!profile?.calibration && !isCalibrationWeek(profile, now);
}

// ────────────────────────────── §S3: ตรวจข้อมูลก่อนบันทึก ──────────────────────────────

export interface NormalizedProfile {
  primaryGoal: string;
  secondaryGoals: string[];
  style: string | null;
  daysPerWeek: number;
  sessionMin: number;
  trainDays: string[];
  preferredTime: string | null;
  likes: string[];
  dislikes: string[];
  jobType: string | null;
  stress: number | null;
  waistCm: number | null;
  bodyFatPct: number | null;
  experienceMonths: number | null;
  parq: Record<string, unknown> | null;
  parqFlag: boolean;
}

export type Normalized<T> = { value: T } | { error: string };

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * ตรวจ + ปรับรูปข้อมูลจาก PUT /api/coach/training-profile
 * กติกา: ค่าที่ "ผิดจนคิดต่อไม่ได้" = ตอบกลับให้แก้ · ค่าที่ "เกิน/เขียนต่างรูปแบบ" = ปรับให้เงียบ ๆ
 * (ห้ามให้ user เจอหน้าจอที่กรอกยังไงก็ไม่ผ่านเพราะพิมพ์ชื่อ style ผิดตัวเดียว)
 */
export function normalizeProfileInput(body: unknown): Normalized<NormalizedProfile> {
  const b = (body ?? {}) as Record<string, unknown>;

  const primaryGoal = String(b.primaryGoal ?? "").trim();
  if (!(PRIMARY_GOALS as readonly string[]).includes(primaryGoal)) {
    return { error: "ยังไม่ได้เลือกเป้าหมายหลัก เลือกสักข้อแล้วบันทึกอีกครั้งนะครับ" };
  }

  const daysRaw = numOrNull(b.daysPerWeek);
  const days = daysRaw === null ? 3 : Math.round(daysRaw);
  if (days < MIN_DAYS_PER_WEEK || days > MAX_DAYS_PER_WEEK) {
    return { error: `จำนวนวันเทรนต่อสัปดาห์ใส่ได้ ${MIN_DAYS_PER_WEEK}-${MAX_DAYS_PER_WEEK} วันครับ` };
  }

  const minRaw = numOrNull(b.sessionMin);
  const sessionMin = minRaw === null ? 45 : Math.round(minRaw);
  if (sessionMin < MIN_SESSION_MIN || sessionMin > MAX_SESSION_MIN) {
    return { error: `เวลาต่อครั้งใส่ได้ ${MIN_SESSION_MIN}-${MAX_SESSION_MIN} นาทีครับ` };
  }

  const rawDays = asArray(b.trainDays).map((d) => d.toLowerCase());
  const badDay = rawDays.find((d) => !(WEEK_DAYS as readonly string[]).includes(d));
  if (badDay) return { error: "วันที่เลือกไม่ถูกต้อง เลือกจากวันจันทร์ถึงอาทิตย์นะครับ" };
  // เรียงตามสัปดาห์จริงเสมอ + ตัดวันซ้ำ (แอปส่งมาสลับลำดับได้)
  const trainDays = WEEK_DAYS.filter((d) => rawDays.includes(d)) as unknown as string[];

  // จำนวนวันไม่ตรงกับ trainDays → เชื่อ trainDays (นั่นคือวันที่ user แตะเลือกเองบนปฏิทิน)
  const daysPerWeek = trainDays.length ? trainDays.length : days;

  const stress = numOrNull(b.stress);
  if (stress !== null && (stress < 1 || stress > 5)) {
    return { error: "ระดับความเครียดใส่ได้ 1-5 ครับ" };
  }

  const waistCm = numOrNull(b.waistCm);
  if (waistCm !== null && (waistCm < 30 || waistCm > 250)) {
    return { error: "รอบเอวที่ใส่มาดูจะไม่ตรงกับหน่วยเซนติเมตร ลองตรวจอีกครั้งนะครับ" };
  }
  const bodyFatPct = numOrNull(b.bodyFatPct);
  if (bodyFatPct !== null && (bodyFatPct < 3 || bodyFatPct > 70)) {
    return { error: "เปอร์เซ็นต์ไขมันใส่ได้ 3-70% ครับ" };
  }
  const expRaw = numOrNull(b.experienceMonths);
  if (expRaw !== null && (expRaw < 0 || expRaw > 600)) {
    return { error: "จำนวนเดือนที่เคยเทรนใส่ได้ 0-600 เดือนครับ" };
  }

  const styleRaw = String(b.style ?? "").trim();
  const style = (TRAINING_STYLES as readonly string[]).includes(styleRaw) ? styleRaw : null;
  const jobRaw = String(b.jobType ?? "").trim();
  const jobType = (JOB_TYPES as readonly string[]).includes(jobRaw) ? jobRaw : null;

  // PAR-Q: เก็บเฉพาะ 3 คำถาม + เวลา — ไม่รับ field แปลกปลอมเข้าไปในก้อน Json
  let parq: Record<string, unknown> | null = null;
  const parqIn = b.parq;
  if (parqIn && typeof parqIn === "object") {
    const p = parqIn as Record<string, unknown>;
    parq = {
      q1: p.q1 === true,
      q2: p.q2 === true,
      q3: p.q3 === true,
      answeredAt: typeof p.answeredAt === "string" ? p.answeredAt : null,
    };
    // user ยืนยันว่าไปปรึกษาแพทย์มาแล้ว → ปลดโหมดเบา (เก็บเวลาที่ยืนยันไว้เป็นหลักฐาน)
    if (typeof p.clearedAt === "string" && p.clearedAt) parq.clearedAt = p.clearedAt;
  }

  return {
    value: {
      primaryGoal,
      secondaryGoals: asArray(b.secondaryGoals).slice(0, MAX_TAGS),
      style,
      daysPerWeek,
      sessionMin,
      trainDays,
      preferredTime: String(b.preferredTime ?? "").trim() || null,
      likes: [...new Set(asArray(b.likes).map((t) => t.toLowerCase()))].slice(0, MAX_TAGS),
      dislikes: [...new Set(asArray(b.dislikes).map((t) => t.toLowerCase()))].slice(0, MAX_TAGS),
      jobType,
      stress: stress === null ? null : Math.round(stress),
      waistCm,
      bodyFatPct,
      experienceMonths: expRaw === null ? null : Math.round(expRaw),
      parq,
      parqFlag: parqFlagFrom(parq),
    },
  };
}

export interface NormalizedInjury {
  area: string;
  severity: string;
  avoidPatterns: string[];
  avoidKeys: string[];
  note: string | null;
  temporaryDays: number | null;
}

/** ตรวจ POST /api/coach/injury — area นอกรายการถือเป็น "other" (ไม่ปฏิเสธคำที่ user พิมพ์เอง) */
export function normalizeInjuryInput(body: unknown, areaAlias?: (raw: string) => string | null): Normalized<NormalizedInjury> {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawArea = String(b.area ?? "").trim().toLowerCase();
  if (!rawArea) return { error: "ยังไม่ได้เลือกจุดที่เจ็บครับ" };
  const mapped = (INJURY_AREAS as readonly string[]).includes(rawArea)
    ? rawArea
    : areaAlias?.(rawArea) ?? null;
  const area = mapped && (INJURY_AREAS as readonly string[]).includes(mapped) ? mapped : "other";

  const sevRaw = String(b.severity ?? "caution").trim().toLowerCase();
  const severity = (INJURY_SEVERITIES as readonly string[]).includes(sevRaw) ? sevRaw : "caution";

  const avoidPatterns = [...new Set(asArray(b.avoidPatterns).map((p) => p.toLowerCase()))]
    .filter((p) => (PATTERNS as readonly string[]).includes(p))
    .slice(0, MAX_TAGS);
  const avoidKeys = [...new Set(asArray(b.avoidKeys))].slice(0, MAX_TAGS);

  const tempRaw = numOrNull(b.temporaryDays);
  if (tempRaw !== null && (tempRaw < 1 || tempRaw > 365)) {
    return { error: "จำนวนวันของอาการชั่วคราวใส่ได้ 1-365 วันครับ" };
  }

  const note = String(b.note ?? "").trim().slice(0, 300) || null;
  return {
    value: { area, severity, avoidPatterns, avoidKeys, note, temporaryDays: tempRaw === null ? null : Math.round(tempRaw) },
  };
}

/** อาการที่ยังมีผลจริง ณ เวลานี้ — ปิดเองแล้ว/หมดอายุแล้ว = ไม่นับ */
export function injuryIsActive(inj: InjuryLike, now: Date): boolean {
  if (inj.active === false) return false;
  if (!inj.expiresAt) return true;
  return inj.expiresAt.getTime() > now.getTime();
}

export interface InjuryFilters {
  /** ตัดทิ้งเสมอ (severity=avoid) */
  avoidKeys: Set<string>;
  avoidPatterns: Set<string>;
  /** ลดน้ำหนัก 20% (severity=caution) */
  cautionKeys: Set<string>;
  cautionPatterns: Set<string>;
  /** ชื่อไทยของจุดที่เจ็บระดับ caution — ใช้เขียนโน้ตให้ user อ่านรู้เรื่อง */
  cautionAreas: string[];
  hasAny: boolean;
}

/**
 * รวมรายการบาดเจ็บเป็นตัวกรองชุดเดียว
 * area → pattern ใช้ตารางเดียวกับ Readiness (ส่งเข้ามาทาง patternsForArea) — ไม่ระบุ pattern เอง
 * ก็ยังกันได้ เพราะ "เข่าเจ็บ" ต้องแปลว่า squat/lunge โดยที่ user ไม่ต้องรู้ศัพท์เทรน
 */
export function injuryFilters(
  injuries: InjuryLike[] | null | undefined,
  now: Date,
  patternsForArea: (area: string) => string[],
  areaLabel: (area: string) => string
): InjuryFilters {
  const out: InjuryFilters = {
    avoidKeys: new Set(),
    avoidPatterns: new Set(),
    cautionKeys: new Set(),
    cautionPatterns: new Set(),
    cautionAreas: [],
    hasAny: false,
  };
  for (const inj of injuries ?? []) {
    if (!injuryIsActive(inj, now)) continue;
    const patterns = new Set<string>([...(inj.avoidPatterns ?? []), ...patternsForArea(inj.area)]);
    const keys = inj.avoidKeys ?? [];
    if (inj.severity === "avoid") {
      patterns.forEach((p) => out.avoidPatterns.add(p));
      keys.forEach((k) => out.avoidKeys.add(k));
    } else {
      patterns.forEach((p) => out.cautionPatterns.add(p));
      keys.forEach((k) => out.cautionKeys.add(k));
      const label = areaLabel(inj.area);
      if (label && !out.cautionAreas.includes(label)) out.cautionAreas.push(label);
    }
    out.hasAny = true;
  }
  return out;
}

// ────────────────────────────── §S4: ปรับรูปแผนตามโปรไฟล์ ──────────────────────────────

/** จำนวนท่าที่พอดีกับเวลาที่ user มีจริง (WO §S4) */
export function itemsForSessionMin(sessionMin: number): { min: number; max: number } {
  if (sessionMin <= 30) return { min: 3, max: 3 };
  if (sessionMin < 60) return { min: 4, max: 5 };
  return { min: 5, max: 6 };
}

const isMobility = (it: ExercisePlanItem, pool: CatalogExercise[]): boolean => {
  const e = pool.find((x) => x.key === it.key);
  if (e) return e.kind === "mobility";
  return /ยืด|โยคะ|stretch|mobility/i.test(`${it.key ?? ""} ${it.name ?? ""}`);
};

/** วันนั้นเป็นวันพักอยู่แล้วหรือไม่ (ชื่อวัน/ท่าล้วนเป็นยืดเหยียด) */
export function isRestDay(day: DayPlan, pool: CatalogExercise[]): boolean {
  const items = day.exercisePlan.items ?? [];
  if (!items.length) return true;
  if (/พัก|ฟื้นฟู/.test(day.exercisePlan.title || "")) return true;
  return items.every((it) => isMobility(it, pool));
}

function restDayPlan(day: DayPlan, pool: CatalogExercise[]): DayPlan {
  const stretch = pool.find((e) => e.key === "stretch_full") ?? pool.find((e) => e.kind === "mobility");
  const item: ExercisePlanItem = stretch
    ? { key: stretch.key, media: stretch.media, name: stretch.name, minutes: 15, note: stretch.cue }
    : { name: "ยืดเหยียดเบา ๆ", minutes: 15 };
  return {
    ...day,
    exercisePlan: { ...day.exercisePlan, title: REST_DAY_TITLE, durationMin: 15, items: [item], caloriesTarget: 60 },
    aiNote: day.aiNote ? `${REST_DAY_NOTE} · ${day.aiNote}` : REST_DAY_NOTE,
  };
}

/**
 * วันเทรนต้องตรงกับวันที่ user เลือกไว้จริง (ไม่ใช่ "วันที่ 7 ของแผน = วันพัก" แบบเหมารวม)
 * startDow = getUTCDay() ของวันแรกในแผน · trainDays ว่าง = ไม่ยุ่ง (ปล่อยตามเดิม)
 * 🔴 ไม่ย้ายท่าข้ามวัน: วันที่ไม่ได้เลือกกลายเป็นวันพัก เท่านั้น
 *    (ย้ายท่าไปกองวันที่เหลือ = ยัดงาน 5 วันลง 3 วันโดยที่เขาไม่ได้ขอ)
 */
export function applyTrainDays(
  days: DayPlan[],
  startDow: number,
  trainDays: string[] | null | undefined,
  pool: CatalogExercise[]
): { days: DayPlan[]; rested: number } {
  const wanted = (trainDays ?? []).filter((d) => (WEEK_DAYS as readonly string[]).includes(d));
  if (!wanted.length) return { days, rested: 0 };

  let rested = 0;
  const out = days.map((d, i) => {
    const dow = JS_DAY_TO_KEY[(((startDow + i) % 7) + 7) % 7];
    if (wanted.includes(dow)) return d;
    if (isRestDay(d, pool)) return d;
    rested++;
    return restDayPlan(d, pool);
  });
  return { days: out, rested };
}

/**
 * ตัดจำนวนท่าให้พอดีเวลาที่มี + เขียน durationMin ให้ตรงกับที่ user ตั้งไว้
 * ตัดจากท้ายรายการ (ท่าแรก ๆ คือท่าหลักของวันเสมอ) แต่กันไม่ให้เหลือ 0 ท่า
 * 🔴 มีแต่ "ตัดออก" ไม่มี "เติมเข้า" — การเติมท่าเป็นหน้าที่ ensureVariety ที่รับ minItems ไปแล้ว
 *    (เติมตรงนี้ = เพิ่มท่าหลังด่านความปลอดภัยไปแล้วในบางเส้นทาง)
 */
export function fitSessionLength(
  days: DayPlan[],
  sessionMin: number,
  pool: CatalogExercise[]
): { days: DayPlan[]; trimmed: number } {
  const { max } = itemsForSessionMin(sessionMin);
  let trimmed = 0;
  const out = days.map((d) => {
    if (isRestDay(d, pool)) return d;
    const items = d.exercisePlan.items ?? [];
    const kept = items.length > max ? items.slice(0, max) : items;
    trimmed += items.length - kept.length;
    return {
      ...d,
      exercisePlan: { ...d.exercisePlan, items: kept, durationMin: sessionMin },
    };
  });
  return { days: out, trimmed };
}

/** ชอบ/ไม่ชอบ → กลุ่มท่าในคลัง (รับทั้งคำอังกฤษและไทยที่แอปอาจส่งมา) */
const TAG_RULES: Record<string, { kinds?: ExerciseKind[]; keys?: string[]; re?: RegExp }> = {
  strength: { kinds: ["strength"] },
  cardio: { kinds: ["cardio"] },
  running: { re: /jog|run|วิ่ง/i },
  walking: { re: /walk|เดิน/i },
  hiit: { keys: ["burpee", "mountain_climber", "jumping_jack"] },
  jumping: { keys: ["burpee", "jumping_jack"], re: /jump|กระโดด/i },
  yoga: { kinds: ["mobility"], re: /yoga|โยคะ|ยืด/i },
  stretching: { kinds: ["mobility"] },
  boxing: { keys: ["shadow_box"], re: /box|ชก|มวย/i },
  cycling: { re: /bike|cycle|จักรยาน/i },
  rowing: { re: /row_machine|เรือ/i },
  core: { re: /plank|crunch|core|แพลงก์|ครันช์|ท้อง/i },
};
/** คำไทยที่ user/แอปอาจส่งมาแทน tag อังกฤษ */
const TAG_ALIASES: Record<string, string> = {
  เวท: "strength",
  ยกน้ำหนัก: "strength",
  คาร์ดิโอ: "cardio",
  วิ่ง: "running",
  เดิน: "walking",
  โยคะ: "yoga",
  ยืดเหยียด: "stretching",
  มวย: "boxing",
  ชกมวย: "boxing",
  จักรยาน: "cycling",
  กระโดด: "jumping",
  หน้าท้อง: "core",
};

export function normalizeTag(tag: string): string {
  const t = String(tag ?? "").trim().toLowerCase();
  return TAG_ALIASES[t] ?? t;
}

/** ท่านี้อยู่ในกลุ่มที่ user บอกว่าชอบ/ไม่ชอบไหม */
export function matchesTag(ex: CatalogExercise, tag: string): boolean {
  const t = normalizeTag(tag);
  const rule = TAG_RULES[t];
  if (!rule) {
    // tag ที่ไม่รู้จัก = เทียบตรง ๆ กับ key/ชื่อไทย (ยังดีกว่าทิ้งคำที่ user พิมพ์เอง)
    return ex.key === t || ex.name.toLowerCase().includes(t);
  }
  if (rule.keys?.includes(ex.key)) return true;
  if (rule.re && (rule.re.test(ex.key) || rule.re.test(ex.name))) return true;
  if (rule.kinds?.includes(ex.kind)) return true;
  return false;
}

const inAnyTag = (ex: CatalogExercise, tags: string[]): boolean => tags.some((t) => matchesTag(ex, t));

/**
 * ไม่ชอบ = soft filter (WO §S4): เปลี่ยนให้เมื่อมี "ตัวแทนที่ทำงานแทนกันได้จริง" เท่านั้น
 *   - ตัวแทน = ท่าที่ pattern เดียวกัน (จากตาราง exercises) และไม่อยู่ในกลุ่มที่ไม่ชอบ
 *   - ไม่มีตัวแทน = คงท่าเดิมไว้ (ตัดทิ้งเลย = แผนขาดกล้ามเนื้อมัดนั้นทั้งสัปดาห์ ซึ่งอันตรายกว่าฝืนใจ)
 * ชอบ = bias: เมื่อมีตัวแทนหลายตัวคะแนนเท่ากัน เลือกตัวที่อยู่ในกลุ่มที่ชอบก่อน
 */
export function applyPreferences(
  days: DayPlan[],
  pool: CatalogExercise[],
  likes: string[],
  dislikes: string[],
  patternOf: PatternOfItem
): { days: DayPlan[]; swapped: number; kept: number } {
  const dis = (dislikes ?? []).filter(Boolean);
  if (!dis.length) return { days, swapped: 0, kept: 0 };
  const lik = (likes ?? []).filter(Boolean);

  let swapped = 0;
  let kept = 0;
  const out = days.map((d) => {
    const items = d.exercisePlan.items ?? [];
    const used = new Set(items.map((it) => it.key ?? ""));
    const next = items.map((it) => {
      const ex = pool.find((e) => e.key === it.key);
      if (!ex || !inAnyTag(ex, dis)) return it;

      const pattern = patternOf(it);
      const cands = pool.filter(
        (c) =>
          c.key !== ex.key &&
          !used.has(c.key) &&
          c.unit === ex.unit &&
          c.kind === ex.kind &&
          !inAnyTag(c, dis) &&
          // pattern ต้องตรงกัน — ไม่รู้ pattern ของท่าเดิม = ยอมให้แทนด้วยท่า kind เดียวกัน
          (pattern ? patternOf({ key: c.key, name: c.name }) === pattern : true)
      );
      if (!cands.length) {
        kept++;
        return it;
      }
      // ชอบมาก่อน แล้วค่อยตามลำดับในคลัง (คลังเรียงจากง่ายไปยากอยู่แล้ว)
      const liked = lik.length ? cands.filter((c) => inAnyTag(c, lik)) : [];
      const pick = (liked.length ? liked : cands)[0];
      used.add(pick.key);
      used.delete(ex.key);
      swapped++;
      return {
        ...it,
        key: pick.key,
        media: pick.media,
        name: pick.name,
        reps: pick.unit === "reps" ? it.reps ?? 12 : undefined,
        minutes: pick.unit === "minutes" ? it.minutes ?? 20 : it.minutes,
        note: pick.cue,
      } as ExercisePlanItem;
    });
    return { ...d, exercisePlan: { ...d.exercisePlan, items: next } };
  });
  return { days: out, swapped, kept };
}

/**
 * ตัวกรองบาดเจ็บ = hard filter — อยู่ในด่านเดียวกับ enforceAvoid (ด่านสุดท้ายก่อนคิดตัวเลข)
 * severity=avoid → ท่าที่ pattern/key ตรงข้อห้าม ถูกตัดทิ้ง ไม่มีข้อยกเว้น
 * วันไหนถูกตัดจนไม่เหลือท่า → ใส่ท่ายืดเหยียดแทน (แผนต้องไม่ว่างเปล่า แต่ห้ามหาท่าอื่นมายัดแทน
 * เพราะท่าใหม่จะไม่ได้ผ่านด่าน keyword ของ enforceAvoid ที่วิ่งไปแล้ว)
 */
export function applyInjuryFilter(
  days: DayPlan[],
  filters: InjuryFilters,
  patternOf: PatternOfItem,
  pool: CatalogExercise[]
): { days: DayPlan[]; removed: number } {
  if (!filters.avoidKeys.size && !filters.avoidPatterns.size) return { days, removed: 0 };
  let removed = 0;

  const out = days.map((d) => {
    const items = d.exercisePlan.items ?? [];
    const kept = items.filter((it) => {
      const key = it.key ?? "";
      const pattern = patternOf(it);
      const hit = (key && filters.avoidKeys.has(key)) || (pattern && filters.avoidPatterns.has(pattern));
      if (hit) removed++;
      return !hit;
    });
    if (kept.length === items.length) return d;
    if (!kept.length) return restDayPlan(d, pool);
    return { ...d, exercisePlan: { ...d.exercisePlan, items: kept } };
  });
  return { days: out, removed };
}

/**
 * ปัดน้ำหนักให้ลงล็อกอุปกรณ์จริง (ดัมเบลก้าว 2 กก. → สั่ง 9 กก. ยกไม่ได้)
 * 🔴 ปัดลงเสมอ ไม่ใช่ปัดใกล้สุด: ฟังก์ชันนี้ถูกเรียกเฉพาะตอน "ทำให้เบาลง" (สอบเทียบ/โหมดเบา/พักฟื้น)
 *    ปัดขึ้นเมื่อไหร่ = สั่งหนักกว่าที่กติกาความปลอดภัยคำนวณไว้ ให้กับคนที่เพิ่งบอกว่าเจ็บ
 * ต่ำสุดคือ 1 ก้าว — เบากว่านั้นใส่เข้าเครื่อง/ดัมเบลไม่ได้อยู่ดี
 */
export function roundToIncrement(kg: number, incrementKg?: number | null): number {
  const inc = Number(incrementKg);
  const step = Number.isFinite(inc) && inc > 0 ? inc : DEFAULT_INCREMENT_KG;
  const floored = Math.floor(kg / step) * step;
  // ปัดทศนิยมทิ้ง (0.1+0.2 ของ float) แล้วกันไม่ให้ต่ำกว่า 1 ก้าว
  return Math.max(step, Math.round(floored * 100) / 100);
}

export interface LightWeekOptions {
  /** สัปดาห์สอบเทียบ (ENGINE §5.1) */
  calibration: boolean;
  /** PAR-Q ยังไม่ปลด → ครั้งเยอะ น้ำหนักเบา */
  cap: "low" | null;
  repRange: [number, number];
  /** ท่าที่ใส่น้ำหนักได้จริง (จากคอลัมน์ exercises.loadable) — ไฟล์นี้ไม่เดาเอง */
  loadableKeys: Set<string>;
  /** ก้าวต่ำสุดของอุปกรณ์ที่ user มี — ไม่มี = ไม่ตั้งน้ำหนักให้คนที่ยังไม่เคยยก */
  incrementKg: number | null;
  injuries: InjuryFilters;
  patternOf: PatternOfItem;
}

/**
 * คำสุดท้ายเรื่องน้ำหนัก/ครั้งของสัปดาห์นี้ (รันหลัง applyProgression)
 *   สอบเทียบ/โหมดเบา → น้ำหนักครึ่งเดียว · ครั้งกลางช่วง (สอบเทียบ) หรือปลายช่วงสูง (โหมดเบา)
 *   caution → ลดอีก 20% เฉพาะท่าที่กวนจุดที่เจ็บ + โน้ตบอกเหตุผลเป็นภาษาคน
 * 🔴 ต้องอยู่หลัง progression: ถ้าวางก่อน ตัวเลขจะโดน engine เขียนทับทั้งหมด (บทเรียนเดียวกับ volumeDown)
 */
export function applyLightWeek(days: DayPlan[], opts: LightWeekOptions): { days: DayPlan[]; touched: number } {
  const light = opts.calibration || opts.cap === "low";
  const hasCaution = opts.injuries.cautionKeys.size > 0 || opts.injuries.cautionPatterns.size > 0;
  if (!light && !hasCaution) return { days, touched: 0 };

  const [lo, hi] = opts.repRange;
  const targetReps = opts.calibration ? Math.round((lo + hi) / 2) : hi;
  const note = opts.calibration ? CALIBRATION_NOTE : LOW_INTENSITY_NOTE;
  const cautionNote = opts.injuries.cautionAreas.length
    ? `ช่วงพักฟื้น${opts.injuries.cautionAreas.join("/")} — เบาไว้ก่อนครับ`
    : "ช่วงพักฟื้น — เบาไว้ก่อนครับ";

  let touched = 0;
  const out = days.map((d) => {
    const items = (d.exercisePlan.items ?? []).map((it) => {
      const key = it.key ?? "";
      const pattern = opts.patternOf(it);
      const caution =
        (key && opts.injuries.cautionKeys.has(key)) || (pattern && opts.injuries.cautionPatterns.has(pattern));
      if (!light && !caution) return it;

      const next: ExercisePlanItem = { ...it };
      const reasons: string[] = [];
      const loadable = opts.loadableKeys.has(key);

      if (light) {
        if (it.weightKg != null) {
          next.weightKg = roundToIncrement(it.weightKg * LIGHT_LOAD_FACTOR, opts.incrementKg);
        } else if (loadable && opts.incrementKg) {
          // ยังไม่เคยมีตัวเลขของตัวเอง → เริ่มที่ก้าวต่ำสุด×2 (เบาพอที่จะเก็บ feel ได้โดยไม่เจ็บ)
          next.weightKg = roundToIncrement(opts.incrementKg * CALIBRATION_START_STEPS, opts.incrementKg);
        }
        if (it.reps != null) next.reps = targetReps;
        reasons.push(note);
      }
      if (caution) {
        if (next.weightKg != null) next.weightKg = roundToIncrement(next.weightKg * CAUTION_LOAD_FACTOR, opts.incrementKg);
        reasons.push(cautionNote);
      }
      next.rxReason = [it.rxReason, ...reasons].filter(Boolean).join(" · ");
      touched++;
      return next;
    });

    const dayNote = light ? (d.aiNote ? `${note} · ${d.aiNote}` : note) : d.aiNote;
    return { ...d, exercisePlan: { ...d.exercisePlan, items }, aiNote: dayNote };
  });
  return { days: out, touched };
}

// ────────────────────────────── §S5: ก้อนบริบทให้โค้ช ──────────────────────────────

export interface TrainingContextBlock {
  primaryGoal: string;
  style: string | null;
  daysPerWeek: number;
  sessionMin: number;
  trainDays: string[];
  preferredTime: string | null;
  likes: string[];
  dislikes: string[];
  experienceMonths: number | null;
  stress: number | null;
  jobType: string | null;
  calibration: boolean;
  parqFlag: boolean;
  intensityCap: "low" | null;
  injuries: Array<{ area: string; severity: string; note: string | null; until: string | null }>;
}

const GOAL_TH: Record<string, string> = {
  fat_loss: "ลดไขมัน",
  muscle_gain: "เพิ่มกล้าม",
  strength: "เพิ่มความแข็งแรง",
  endurance: "ความอึด",
  general: "สุขภาพทั่วไป",
  athletic: "สมรรถนะนักกีฬา",
};
const STYLE_TH: Record<string, string> = {
  strength: "เน้นแรง",
  hypertrophy: "เน้นสร้างกล้าม",
  fatloss_hybrid: "ผสมลดไขมัน",
  endurance: "เน้นความอึด",
  athletic: "เชิงกีฬา",
  balanced: "สมดุล",
};
const DAY_TH: Record<string, string> = {
  mon: "จ", tue: "อ", wed: "พ", thu: "พฤ", fri: "ศ", sat: "ส", sun: "อา",
};

/** ก้อน training → บรรทัดไทยสำหรับ prompt (ไม่มีข้อมูล = ไม่มีบรรทัด ไม่ใช่เขียนว่า "ไม่ทราบ") */
export function trainingLines(t: TrainingContextBlock | null | undefined): string[] {
  if (!t) return [];
  const lines: string[] = [];
  const style = t.style ? ` · สไตล์ ${STYLE_TH[t.style] ?? t.style}` : "";
  lines.push(`- เป้าหมายการเทรน: ${GOAL_TH[t.primaryGoal] ?? t.primaryGoal}${style}`);
  const dayText = t.trainDays.length ? t.trainDays.map((d) => DAY_TH[d] ?? d).join(" ") : `${t.daysPerWeek} วัน/สัปดาห์`;
  lines.push(`- ตารางเทรน: ${dayText} · ครั้งละ ${t.sessionMin} นาที${t.preferredTime ? ` · ช่วง ${t.preferredTime}` : ""}`);
  if (t.likes.length) lines.push(`- ชอบ: ${t.likes.join(" · ")}`);
  if (t.dislikes.length) lines.push(`- ไม่ชอบ (เลี่ยงให้ถ้ามีตัวแทน): ${t.dislikes.join(" · ")}`);
  if (t.experienceMonths != null) lines.push(`- เคยเทรนมาแล้วประมาณ ${t.experienceMonths} เดือน`);
  if (t.stress != null) lines.push(`- ความเครียดที่บอกไว้: ${t.stress}/5${t.jobType ? ` · งาน ${t.jobType}` : ""}`);
  if (t.injuries.length) {
    lines.push(
      `- ข้อจำกัดร่างกาย: ${t.injuries
        .map((i) => `${i.area}${i.severity === "avoid" ? " (ห้ามท่าที่เกี่ยว)" : " (เบาไว้ก่อน)"}${i.until ? ` ถึง ${i.until}` : ""}`)
        .join(" · ")}`
    );
  }
  if (t.calibration) lines.push("- สัปดาห์นี้เป็นสัปดาห์สอบเทียบ (เก็บ feel เพื่อตั้งน้ำหนักจริงสัปดาห์หน้า)");
  if (t.intensityCap === "low") {
    lines.push("- ตอบแบบสอบถามความปลอดภัยว่ามีข้อควรระวัง → ระบบคุมความหนักไว้ระดับเบา (ห้ามเชียร์ให้ดันหนักขึ้น และห้ามวินิจฉัยโรคให้)");
  }
  return lines;
}

/** ข้อความสำหรับ prompt สรุปตัวตน (LLM #1 ของ ENGINE) — ตัวเลขล้วน ไม่มีข้อมูลระบุตัวตน */
export function profileSummaryPrompt(t: TrainingContextBlock): string {
  return (
    `สรุปว่า "ผู้ใช้คนนี้เป็นใครในแง่การเทรน" เป็นภาษาไทย 2-3 ประโยค สำหรับให้โค้ชอ่านก่อนคุย\n` +
    `ห้ามแต่งข้อมูลที่ไม่ได้ให้มา ห้ามวินิจฉัยโรค ห้ามสั่งการรักษา และห้ามพูดถึงตัวเลขที่ไม่มีในรายการนี้\n\n` +
    trainingLines(t).join("\n")
  );
}
