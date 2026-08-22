/**
 * ที่เก็บ/ที่อ่านของโปรไฟล์การเทรน (WO-PT-D §S2 store + §S5)
 *
 * ตรรกะทั้งหมดอยู่ใน trainingProfile.ts (pure) — ไฟล์นี้มีหน้าที่แค่ "หยิบของจาก DB มาป้อน"
 * และ "เขียนกลับ" เท่านั้น เพื่อให้กติกาที่ตัดสินใจแทนร่างกายลูกค้าเทสได้โดยไม่ต้องมีฐานข้อมูล
 *
 * 🔴 ทุกฟังก์ชันที่แผน/โค้ชเรียกต้องล้มแบบเงียบได้ (คืน null / ค่าว่าง) — โปรไฟล์อ่านไม่ได้
 *    ต้องแปลว่า "จัดแผนแบบเดิม" ไม่ใช่ "ลูกค้าไม่มีแผนทั้งสัปดาห์"
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { modelsFor } from "@/lib/aiModels";
import { normalizeSoreArea, soreAreaLabel, SORE_AREA_PATTERNS } from "@/lib/readiness";
import {
  calibrationShouldClear,
  injuryFilters,
  injuryIsActive,
  intensityCap,
  isCalibrationWeek,
  profileSummaryPrompt,
  repRangeFor,
  type InjuryFilters,
  type InjuryLike,
  type NormalizedInjury,
  type NormalizedProfile,
  type PatternOfItem,
  type TrainingContextBlock,
  type TrainingProfileLike,
} from "@/lib/trainingProfile";

/** source ของ CoachMemory ที่เป็นสรุปตัวตนจาก LLM — มีแถวนี้แล้ว = ไม่สรุปซ้ำอีก */
export const PROFILE_SUMMARY_SOURCE = "training_profile";

/** area ของอาการบาดเจ็บ → pattern ที่ต้องเลี่ยง (ตารางเดียวกับ Readiness ไม่ตั้งใหม่ให้ขัดกันเอง) */
export function patternsForInjuryArea(area: string): string[] {
  const key = normalizeSoreArea(area) ?? area;
  return SORE_AREA_PATTERNS[key] ?? [];
}

/** คำไทยที่ user พิมพ์ ("เข่า") → area มาตรฐาน ("knee") */
export function injuryAreaAlias(raw: string): string | null {
  return normalizeSoreArea(raw);
}

// ────────────────────────────── โปรไฟล์ ──────────────────────────────

export type TrainingProfileRow = TrainingProfileLike & {
  memberId: string;
  calibrationStartedAt: Date;
  updatedAt?: Date;
};

/**
 * อ่านโปรไฟล์ + ปลดสัปดาห์สอบเทียบให้เองเมื่อครบ 7 วัน (คิดตอนอ่าน ไม่มี cron)
 * เขียนกลับครั้งเดียวตอนที่มันหมดอายุจริง ๆ — ถ้าเขียนไม่สำเร็จก็ยังคืนค่าที่ถูกต้องให้ผู้เรียก
 */
export async function getTrainingProfile(memberId: string, now = new Date()): Promise<TrainingProfileRow | null> {
  const row = (await prisma.trainingProfile.findUnique({ where: { memberId } })) as TrainingProfileRow | null;
  if (!row) return null;
  if (calibrationShouldClear(row, now)) {
    row.calibration = false;
    try {
      await prisma.trainingProfile.update({ where: { memberId }, data: { calibration: false } });
    } catch (e) {
      console.error("[trainingProfileStore] ปิดสัปดาห์สอบเทียบไม่สำเร็จ (ใช้ค่าที่คิดได้ต่อไป):", e);
    }
  }
  return row;
}

/** สร้าง/แก้โปรไฟล์ — สร้างใหม่ = เริ่มนับสัปดาห์สอบเทียบ · แก้ของเดิม = ไม่รีเซ็ตนาฬิกา 7 วัน */
export async function saveTrainingProfile(
  memberId: string,
  input: NormalizedProfile,
  now = new Date()
): Promise<TrainingProfileRow> {
  const data = {
    primaryGoal: input.primaryGoal,
    secondaryGoals: input.secondaryGoals,
    style: input.style,
    daysPerWeek: input.daysPerWeek,
    sessionMin: input.sessionMin,
    trainDays: input.trainDays,
    preferredTime: input.preferredTime,
    likes: input.likes,
    dislikes: input.dislikes,
    jobType: input.jobType,
    stress: input.stress,
    waistCm: input.waistCm,
    bodyFatPct: input.bodyFatPct,
    experienceMonths: input.experienceMonths,
    // ก้อน Json ผ่านด่าน normalizeProfileInput มาแล้ว (มีแค่ q1-q3 + เวลา) — cast เพื่อให้ตรงชนิดของ Prisma
    parq: (input.parq ?? undefined) as Prisma.InputJsonValue | undefined,
    parqFlag: input.parqFlag,
  };
  const row = await prisma.trainingProfile.upsert({
    where: { memberId },
    create: { memberId, ...data, calibration: true, calibrationStartedAt: now },
    update: data,
  });
  return row as unknown as TrainingProfileRow;
}

// ────────────────────────────── อาการบาดเจ็บ ──────────────────────────────

export async function listInjuries(memberId: string, opts: { activeOnly?: boolean } = {}, now = new Date()) {
  const rows = await prisma.injuryLimitation.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });
  return opts.activeOnly ? rows.filter((r) => injuryIsActive(r as InjuryLike, now)) : rows;
}

/** อาการที่ยังมีผลจริง — ทุกจุดที่กรองท่าต้องเรียกผ่านตรงนี้ (กันลืมเช็ค expiresAt) */
export async function activeInjuries(memberId: string, now = new Date()): Promise<InjuryLike[]> {
  const rows = await prisma.injuryLimitation.findMany({
    where: { memberId, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: "desc" },
  });
  return rows as unknown as InjuryLike[];
}

export async function createInjury(memberId: string, input: NormalizedInjury, now = new Date()) {
  const expiresAt = input.temporaryDays ? new Date(now.getTime() + input.temporaryDays * 24 * 3600 * 1000) : null;
  return prisma.injuryLimitation.create({
    data: {
      memberId,
      area: input.area,
      severity: input.severity,
      avoidPatterns: input.avoidPatterns,
      avoidKeys: input.avoidKeys,
      note: input.note,
      expiresAt,
    },
  });
}

export async function setInjuryActive(memberId: string, id: string, active: boolean) {
  const row = await prisma.injuryLimitation.findFirst({ where: { id, memberId } });
  if (!row) return null;
  return prisma.injuryLimitation.update({ where: { id: row.id }, data: { active } });
}

/**
 * เขียนชั้นที่สอง: ทุกครั้งที่โค้ชจำ "อาการบาดเจ็บ" (CoachMemory kind=injury)
 * ต้องมีแถวใน InjuryLimitation ด้วย — ความจำเอาไว้คุย ตัวกรองเอาไว้กันท่า
 * 🔴 ข้อความอิสระกรองท่าไม่ได้: "เข่าซ้ายเจ็บตอนลงน้ำหนัก" ไม่ตรงกับชื่อท่าใดในคลังเลย
 * ระดับที่ตั้งให้ = caution (ลดน้ำหนัก) ไม่ใช่ avoid — การตัดท่าทิ้งทั้ง pattern ต้องมาจากที่ user เลือกเอง
 */
export async function syncInjuryMemoryToLimitation(memberId: string, fact: string, now = new Date()) {
  try {
    const area = normalizeSoreArea(fact) ?? guessAreaFromText(fact);
    if (!area) return null; // ไม่รู้ว่าเจ็บตรงไหน = ไม่เดา (กรองผิดจุดแย่กว่าไม่กรอง)

    const existing = await prisma.injuryLimitation.findFirst({
      where: { memberId, area, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    if (existing) return existing;

    return await prisma.injuryLimitation.create({
      data: { memberId, area, severity: "caution", note: fact.slice(0, 300) },
    });
  } catch (e) {
    console.error("[trainingProfileStore] dual-write อาการบาดเจ็บไม่สำเร็จ (ความจำยังบันทึกแล้ว):", e);
    return null;
  }
}

/** หา area จากประโยคไทยยาว ๆ — normalizeSoreArea รับคำเดี่ยว ประโยคจริงมีคำอื่นปนเสมอ */
function guessAreaFromText(text: string): string | null {
  const t = String(text ?? "");
  const words: Array<[RegExp, string]> = [
    [/เข่า|knee/i, "knee"],
    [/ไหล่|บ่า|shoulder/i, "shoulder"],
    [/หลัง|back|เอว/i, "back"],
    [/สะโพก|hip/i, "hip"],
    [/ข้อเท้า|ankle/i, "ankle"],
    [/ข้อมือ|wrist/i, "wrist"],
    [/คอ|neck/i, "neck"],
  ];
  for (const [re, area] of words) if (re.test(t)) return area;
  return null;
}

// ────────────────────────────── ของที่ generator ต้องใช้ ──────────────────────────────

export interface TrainingPlanInputs {
  profile: TrainingProfileRow | null;
  injuries: InjuryFilters;
  repRange: [number, number];
  cap: "low" | null;
  calibration: boolean;
  patternOf: PatternOfItem;
  loadableKeys: Set<string>;
  incrementKg: number | null;
}

const NO_PATTERN: PatternOfItem = () => null;

/** ค่าปริยายเมื่อยังไม่มีโปรไฟล์/อ่านไม่ได้ — แผนต้องออกเหมือนระบบก่อนเฟส D ทุกประการ */
export function emptyPlanInputs(): TrainingPlanInputs {
  return {
    profile: null,
    injuries: {
      avoidKeys: new Set(),
      avoidPatterns: new Set(),
      cautionKeys: new Set(),
      cautionPatterns: new Set(),
      cautionAreas: [],
      avoidHighImpact: false,
      hasAny: false,
    },
    repRange: repRangeFor(null, null),
    cap: null,
    calibration: false,
    patternOf: NO_PATTERN,
    loadableKeys: new Set(),
    incrementKg: null,
  };
}

/**
 * รวบของทุกอย่างที่ generator ต้องใช้ในครั้งเดียว (โปรไฟล์ · อาการ · pattern/loadable ของท่า · ก้าวอุปกรณ์)
 * pattern/loadable อ่านจากตาราง exercises ทั้งคลัง (ไม่กี่สิบแถว) เพราะตัวเลือกท่าแทนต้องรู้ pattern ของท่าที่ยังไม่อยู่ในแผนด้วย
 */
export async function loadTrainingPlanInputs(memberId: string, now = new Date()): Promise<TrainingPlanInputs> {
  try {
    const [profile, injuries, exRows, equipment] = await Promise.all([
      getTrainingProfile(memberId, now),
      activeInjuries(memberId, now),
      prisma.exercise.findMany({ select: { key: true, name: true, pattern: true, loadable: true } }),
      prisma.memberEquipment.findMany({ where: { memberId }, select: { incrementKg: true } }),
    ]);

    const patternByKey = new Map<string, string | null>();
    const patternByName = new Map<string, string | null>();
    const loadableKeys = new Set<string>();
    for (const r of exRows) {
      patternByKey.set(r.key, r.pattern);
      if (!patternByName.has(r.name)) patternByName.set(r.name, r.pattern);
      if (r.loadable) loadableKeys.add(r.key);
    }
    const patternOf: PatternOfItem = (item) => {
      const k = item.key ? String(item.key) : "";
      if (k && patternByKey.has(k)) return patternByKey.get(k) ?? null;
      const n = String(item.name ?? "").trim();
      return (n && patternByName.get(n)) ?? null;
    };

    const increments = equipment.map((e) => e.incrementKg).filter((v): v is number => !!v && v > 0);

    return {
      profile,
      injuries: injuryFilters(injuries, now, patternsForInjuryArea, soreAreaLabel),
      repRange: repRangeFor(profile?.style ?? null, profile?.primaryGoal ?? null),
      cap: intensityCap(profile),
      calibration: isCalibrationWeek(profile, now),
      patternOf,
      loadableKeys,
      incrementKg: increments.length ? Math.min(...increments) : null,
    };
  } catch (e) {
    console.error("[trainingProfileStore] อ่านโปรไฟล์เทรนไม่ได้ — จัดแผนแบบเดิม:", e);
    return emptyPlanInputs();
  }
}

// ────────────────────────────── §S5: บริบทให้โค้ช + สรุปตัวตน 1 ครั้ง ──────────────────────────────

/** ก้อน training สำหรับ gatherMemberContext — ยังไม่มีโปรไฟล์ = ไม่มีก้อนนี้เลย (ไม่ใช่ก้อนที่เต็มไปด้วย null) */
export async function buildTrainingContextSafe(
  memberId: string,
  now = new Date()
): Promise<TrainingContextBlock | null> {
  try {
    const profile = await getTrainingProfile(memberId, now);
    if (!profile) return null;
    const injuries = await activeInjuries(memberId, now);

    return {
      primaryGoal: profile.primaryGoal,
      style: profile.style ?? null,
      daysPerWeek: profile.daysPerWeek,
      sessionMin: profile.sessionMin,
      trainDays: profile.trainDays ?? [],
      preferredTime: profile.preferredTime ?? null,
      likes: profile.likes ?? [],
      dislikes: profile.dislikes ?? [],
      experienceMonths: profile.experienceMonths ?? null,
      stress: profile.stress ?? null,
      jobType: profile.jobType ?? null,
      calibration: isCalibrationWeek(profile, now),
      parqFlag: !!profile.parqFlag,
      intensityCap: intensityCap(profile),
      injuries: injuries.map((i) => ({
        area: soreAreaLabel(i.area) || i.area,
        severity: i.severity,
        note: i.note ?? null,
        until: i.expiresAt ? i.expiresAt.toISOString().slice(0, 10) : null,
      })),
    };
  } catch (e) {
    console.error("[trainingProfileStore] สร้างก้อน training ไม่สำเร็จ — โค้ชคุยต่อโดยไม่มีก้อนนี้:", e);
    return null;
  }
}

/**
 * สรุป "คนนี้เป็นใคร" ด้วย LLM ครั้งเดียวหลังตั้งโปรไฟล์ (WO-PT-ENGINE ตาราง AI #1) → CoachMemory
 * 🔴 ไม่มีคีย์ / AI ล่ม / เครดิตหมด = ข้ามเงียบ ๆ คืน null — การตั้งโปรไฟล์ต้องสำเร็จเสมอ
 *    ห้ามให้ user เห็น error เรื่อง AI ตอนที่เขาแค่กดบันทึกตารางเทรนของตัวเอง
 */
export async function summarizeTrainingProfileOnce(
  memberId: string,
  context: TrainingContextBlock | null,
  timeoutMs = 12000
): Promise<string | null> {
  try {
    if (!context) return null;
    const already = await prisma.coachMemory.findFirst({
      where: { memberId, source: PROFILE_SUMMARY_SOURCE },
      select: { id: true },
    });
    if (already) return null; // ครั้งเดียวพอ — โปรไฟล์แก้กี่รอบก็ไม่ยิงซ้ำ

    const apiKey = await getSecret("OPENAI_API_KEY");
    if (!apiKey) return null;

    const { primary } = await modelsFor("chat");
    const openai = buildOpenAI(apiKey);
    const call = openai.chat.completions.create({
      model: aiModel(apiKey, primary),
      messages: [
        { role: "system", content: "คุณเป็นเทรนเนอร์คนไทย ตอบเป็นภาษาไทยสั้น ๆ ไม่เกิน 3 ประโยค ไม่ใช้ bullet" },
        { role: "user", content: profileSummaryPrompt(context) },
      ],
      max_tokens: 300,
      temperature: 0.4,
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const resp = await Promise.race([call, timeout]);
    const text = String((resp as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;

    await prisma.coachMemory.create({
      data: {
        memberId,
        kind: "context",
        fact: text.slice(0, 500),
        source: PROFILE_SUMMARY_SOURCE,
        confidence: 0.7,
      },
    });
    return text;
  } catch (e) {
    console.error("[trainingProfileStore] สรุปโปรไฟล์ด้วย AI ไม่สำเร็จ — ข้ามไป (ไม่กระทบการบันทึก):", e);
    return null;
  }
}
