/**
 * เทสสมองของโปรไฟล์การเทรน (WO-PT-D §S6) — รัน: npx tsx scripts/test-training-profile.ts
 *
 * ครอบ: repRangeFor · experienceFactor · intensityCap · สัปดาห์สอบเทียบ · ด่านตรวจข้อมูลก่อนบันทึก
 *       · ตัวกรองอาการบาดเจ็บ (hard/soft/หมดอายุ) · รูปร่างสัปดาห์ตามตาราง/เวลา/ชอบ-ไม่ชอบ · โหมดเบา
 *
 * ทำไมชุดนี้สำคัญ: ตัวเลขจากไฟล์นี้กลายเป็น "ยก 10 กก. 12 ครั้ง วันพุธ" ที่ลูกค้าทำกับร่างกายตัวเองจริง
 *   - กรองบาดเจ็บพลาด = สั่งท่าที่เขาบอกแล้วว่าทำไม่ได้
 *   - สัปดาห์สอบเทียบไม่ปลด = ติดโหมดเบาตลอดกาลโดยไม่มีใครรู้ (ไม่มี cron มาช่วย)
 * 🔴 เคสที่ห้ามหาย: "ไม่ชอบแต่ไม่มีตัวแทน" ต้องคงท่าไว้ ไม่ใช่ตัดทิ้งจนแผนขาดกล้ามเนื้อมัดนั้นทั้งสัปดาห์
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  CALIBRATION_DAYS,
  CALIBRATION_NOTE,
  LOW_INTENSITY_NOTE,
  MAX_TAGS,
  PARQ_ADVISORY_TH,
  REST_DAY_TITLE,
  applyInjuryFilter,
  applyLightWeek,
  applyPreferences,
  applyTrainDays,
  calibrationShouldClear,
  experienceFactor,
  fitSessionLength,
  injuryFilters,
  injuryIsActive,
  intensityCap,
  isCalibrationWeek,
  itemsForSessionMin,
  matchesTag,
  KNOWN_TAGS,
  TAG_KEYS,
  tagLabel,
  normalizeInjuryInput,
  normalizeProfileInput,
  parqFlagFrom,
  repRangeFor,
  roundToIncrement,
  trainingLines,
  type InjuryLike,
  type PatternOfItem,
  type TrainingContextBlock,
  type TrainingProfileLike,
} from "../src/lib/trainingProfile";
import { EXERCISE_CATALOG, catalogFor } from "../src/lib/exerciseCatalog";
import type { DayPlan, ExercisePlanItem } from "../src/lib/planGenerator";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const DAY_MS = 24 * 3600 * 1000;
const NOW = new Date("2026-08-20T03:00:00.000Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

/** pattern ของท่า — ของจริงมาจากตาราง exercises (ชุดเดียวกับ scripts/seed-exercise-metadata.ts) */
const PATTERN_BY_KEY: Record<string, string> = {
  walk_fast: "cardio", jog_light: "cardio", stair_step: "cardio", shadow_box: "cardio",
  jumping_jack: "cardio", burpee: "cardio", mountain_climber: "cardio",
  // เครื่องคาร์ดิโอฝั่งฟิตเนส — ตรงกับ pattern ที่ seed ลงตาราง exercises จริง (ตรวจกับ DB แล้ว)
  treadmill: "cardio", stationary_bike: "cardio", elliptical: "cardio", rowing_machine: "cardio",
  squat_bw: "squat", wall_sit: "squat", db_squat: "squat", barbell_squat: "squat", leg_press: "squat",
  lunge: "lunge", step_up: "lunge",
  glute_bridge: "hinge", db_rdl: "hinge",
  pushup: "push_h", pushup_knee: "push_h", db_press: "push_v", chest_press: "push_h",
  db_row: "pull_h", band_row: "pull_h", cable_row: "pull_h", lat_pulldown: "pull_v",
  plank: "core", side_plank: "core", crunch: "core",
  stretch_full: "mobility", yoga_basic: "mobility",
};
const patternOf: PatternOfItem = (it) => PATTERN_BY_KEY[String(it?.key ?? "")] ?? null;

const pool = catalogFor("home");
const item = (key: string, extra: Partial<ExercisePlanItem> = {}): ExercisePlanItem => {
  const e = EXERCISE_CATALOG.find((x) => x.key === key)!;
  return { key: e.key, name: e.name, note: e.cue, ...(e.unit === "reps" ? { sets: 3, reps: 12 } : { minutes: 20 }), ...extra };
};
const day = (keys: string[], extra: Partial<DayPlan> = {}): DayPlan => ({
  exercisePlan: { title: "ออกกำลังกายวันนี้", durationMin: 30, items: keys.map((k) => item(k)), caloriesTarget: 200 },
  mealPlan: { meals: [{ slot: "เช้า", menu: "ข้าวต้ม", kcal: 400, protein: 20, carbs: 50, fat: 10 }], totalKcal: 400 },
  ...extra,
});
const week = (keys: string[]) => Array.from({ length: 7 }, () => day(keys));

const profileOf = (p: Partial<TrainingProfileLike> = {}): TrainingProfileLike => ({
  primaryGoal: "general",
  daysPerWeek: 3,
  sessionMin: 45,
  calibration: false,
  calibrationStartedAt: ago(30),
  ...p,
});

// ────────────────────────────────────────────────────────────────
console.log("\n── 1. repRangeFor: สไตล์มาก่อน แล้วค่อยตกไปตามเป้าหมาย ──");
{
  const eq = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
  check("strength → 4-6", eq(repRangeFor("strength", "general"), [4, 6]));
  check("hypertrophy → 8-12", eq(repRangeFor("hypertrophy", "fat_loss"), [8, 12]));
  check("fatloss_hybrid → 10-15", eq(repRangeFor("fatloss_hybrid", "strength"), [10, 15]));
  check("endurance → 12-20", eq(repRangeFor("endurance", "muscle_gain"), [12, 20]));
  check("athletic → 6-10", eq(repRangeFor("athletic", "general"), [6, 10]));
  check("balanced + fat_loss → 10-15 (ตกไปตามเป้า)", eq(repRangeFor("balanced", "fat_loss"), [10, 15]));
  check("balanced + muscle_gain → 8-12", eq(repRangeFor("balanced", "muscle_gain"), [8, 12]));
  check("balanced + strength → 4-6", eq(repRangeFor("balanced", "strength"), [4, 6]));
  check("balanced + endurance → 8-12 (เป้าที่ไม่มีในตาราง)", eq(repRangeFor("balanced", "endurance"), [8, 12]));
  check("balanced + general → 8-12", eq(repRangeFor("balanced", "general"), [8, 12]));
  check("balanced + athletic → 8-12", eq(repRangeFor("balanced", "athletic"), [8, 12]));
  check("ไม่ระบุสไตล์ + fat_loss → 10-15", eq(repRangeFor(null, "fat_loss"), [10, 15]));
  check("ไม่ระบุอะไรเลย → 8-12 (ค่าเดิมของ v1)", eq(repRangeFor(null, null), [8, 12]));
  check("สไตล์ที่ไม่รู้จัก → ตกไปตามเป้า", eq(repRangeFor("crossfit", "strength"), [4, 6]));
  const r = repRangeFor("strength", "general");
  r[0] = 99;
  check("คืน array ใหม่ทุกครั้ง (แก้ของผู้เรียกไม่กระทบตาราง)", repRangeFor("strength", "general")[0] === 4);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 2. experienceFactor: ขอบของทุกช่วง ──");
{
  check("null → 0.5 (ไม่รู้ = ถือว่ามือใหม่)", experienceFactor(null) === 0.5);
  check("undefined → 0.5", experienceFactor(undefined) === 0.5);
  check("0 เดือน → 0.5", experienceFactor(0) === 0.5);
  check("5 เดือน → 0.5", experienceFactor(5) === 0.5);
  check("6 เดือน → 0.75 (ขอบล่างของกลุ่มกลาง)", experienceFactor(6) === 0.75);
  check("23 เดือน → 0.75", experienceFactor(23) === 0.75);
  check("24 เดือน → 1.0 (ขอบล่างของมือเก๋า)", experienceFactor(24) === 1.0);
  check("120 เดือน → 1.0", experienceFactor(120) === 1.0);
  check("ค่าที่ไม่ใช่ตัวเลข → 0.5", experienceFactor(NaN) === 0.5);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 3. PAR-Q → โหมดเบา ──");
{
  check("ไม่มีโปรไฟล์ → ไม่คุม", intensityCap(null) === null);
  check("ไม่ติดธง → ไม่คุม", intensityCap(profileOf({ parqFlag: false })) === null);
  check("ติดธง ยังไม่ยืนยัน → low", intensityCap(profileOf({ parqFlag: true, parq: { q1: true } })) === "low");
  check(
    "ติดธงแต่ยืนยันกับแพทย์แล้ว → ปลดคืน",
    intensityCap(profileOf({ parqFlag: true, parq: { q1: true, clearedAt: "2026-08-01" } })) === null
  );
  check("ติดธงแต่ parq หาย → ยังคุมไว้ (ปลอดภัยไว้ก่อน)", intensityCap(profileOf({ parqFlag: true, parq: null })) === "low");
  check("parqFlagFrom: ตอบใช่ข้อ 2", parqFlagFrom({ q1: false, q2: true, q3: false }) === true);
  check("parqFlagFrom: ตอบไม่ทุกข้อ", parqFlagFrom({ q1: false, q2: false, q3: false }) === false);
  check("parqFlagFrom: ไม่มีคำตอบเลย", parqFlagFrom(null) === false);
  check('parqFlagFrom: ค่าที่ไม่ใช่ true ("yes") ไม่นับ', parqFlagFrom({ q1: "yes" }) === false);
  check("คำแนะนำ PAR-Q แนะนำให้ปรึกษาแพทย์", PARQ_ADVISORY_TH.includes("ปรึกษาแพทย์"));
  check("คำแนะนำ PAR-Q บอกว่าปลดได้เมื่อยืนยัน", PARQ_ADVISORY_TH.includes("ยืนยัน"));
  check(
    "คำแนะนำ PAR-Q ไม่โทษ/ไม่ขู่/ไม่วินิจฉัย user",
    !/ผิด|ห้ามออกกำลังกาย|อันตรายถึงชีวิต|คุณเป็นโรค|ป่วย/.test(PARQ_ADVISORY_TH)
  );
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 4. สัปดาห์สอบเทียบ: ปลดเองเมื่อครบ 7 วัน (คิดตอนอ่าน) ──");
{
  const cal = (d: number) => profileOf({ calibration: true, calibrationStartedAt: ago(d) });
  check("วันแรก = ยังอยู่ในสัปดาห์สอบเทียบ", isCalibrationWeek(cal(0), NOW) === true);
  check("วันที่ 6 = ยังอยู่", isCalibrationWeek(cal(6), NOW) === true);
  check(`ครบ ${CALIBRATION_DAYS} วันพอดี = จบแล้ว`, isCalibrationWeek(cal(7), NOW) === false);
  check("วันที่ 8 = จบแล้ว", isCalibrationWeek(cal(8), NOW) === false);
  check("ธง calibration=false = ไม่ใช่สัปดาห์สอบเทียบ ไม่ว่าจะตั้งเมื่อไร", isCalibrationWeek(cal(0) && profileOf({ calibration: false }), NOW) === false);
  check("ไม่มีโปรไฟล์ = ไม่ใช่", isCalibrationWeek(null, NOW) === false);
  check("ไม่มีหมุดเวลา = ถือว่าเพิ่งตั้ง", isCalibrationWeek({ ...profileOf({ calibration: true }), calibrationStartedAt: null }, NOW) === true);
  check("ครบแล้วแต่ในตารางยังเป็น true → ต้องเขียนกลับ", calibrationShouldClear(cal(9), NOW) === true);
  check("ยังไม่ครบ → ไม่ต้องเขียน", calibrationShouldClear(cal(2), NOW) === false);
  check("false อยู่แล้ว → ไม่ต้องเขียนซ้ำ", calibrationShouldClear(profileOf({ calibration: false }), NOW) === false);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 5. ด่านตรวจข้อมูลก่อนบันทึกโปรไฟล์ (PUT) ──");
{
  const ok = normalizeProfileInput({
    primaryGoal: "strength", style: "strength", daysPerWeek: 3, sessionMin: 45,
    trainDays: ["fri", "mon", "wed"], likes: ["Strength"], dislikes: ["running"], stress: 3, experienceMonths: 12,
  });
  check("ข้อมูลครบถ้วน = ผ่าน", "value" in ok);
  if ("value" in ok) {
    check("เรียงวันตามสัปดาห์จริง", ok.value.trainDays.join(",") === "mon,wed,fri");
    check("แปลง tag เป็นตัวพิมพ์เล็ก", ok.value.likes[0] === "strength");
  }

  const noGoal = normalizeProfileInput({ daysPerWeek: 3 });
  check("ไม่เลือกเป้าหมายหลัก = ตอบกลับให้เลือก", "error" in noGoal && noGoal.error.includes("เป้าหมาย"));
  check("เป้าหมายนอกรายการ = ไม่ผ่าน", "error" in normalizeProfileInput({ primaryGoal: "bulking" }));

  const base = { primaryGoal: "general" };
  check("daysPerWeek 0 = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, daysPerWeek: 0 }));
  check("daysPerWeek 8 = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, daysPerWeek: 8 }));
  check("daysPerWeek 1 = ผ่าน (ขอบล่าง)", "value" in normalizeProfileInput({ ...base, daysPerWeek: 1 }));
  check("daysPerWeek 7 = ผ่าน (ขอบบน)", "value" in normalizeProfileInput({ ...base, daysPerWeek: 7 }));
  check("sessionMin 14 = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, sessionMin: 14 }));
  check("sessionMin 121 = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, sessionMin: 121 }));
  check("sessionMin 15 = ผ่าน (ขอบล่าง)", "value" in normalizeProfileInput({ ...base, sessionMin: 15 }));
  check("sessionMin 120 = ผ่าน (ขอบบน)", "value" in normalizeProfileInput({ ...base, sessionMin: 120 }));
  check("วันที่ไม่มีจริง = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, trainDays: ["mon", "funday"] }));

  const mismatch = normalizeProfileInput({ ...base, daysPerWeek: 5, trainDays: ["tue", "thu"] });
  check(
    "จำนวนวันไม่ตรงกับวันที่เลือก → เชื่อวันที่เลือก",
    "value" in mismatch && mismatch.value.daysPerWeek === 2 && mismatch.value.trainDays.length === 2
  );
  const dup = normalizeProfileInput({ ...base, trainDays: ["mon", "mon", "wed"] });
  check("วันซ้ำถูกตัดทิ้ง", "value" in dup && dup.value.trainDays.length === 2);

  check("stress 0 = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, stress: 0 }));
  check("stress 6 = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, stress: 6 }));
  check("stress 5 = ผ่าน", "value" in normalizeProfileInput({ ...base, stress: 5 }));
  check("เอว 10 ซม. = ไม่ผ่าน (คนละหน่วย)", "error" in normalizeProfileInput({ ...base, waistCm: 10 }));
  check("ไขมัน 90% = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, bodyFatPct: 90 }));
  check("เดือนที่เคยเทรนติดลบ = ไม่ผ่าน", "error" in normalizeProfileInput({ ...base, experienceMonths: -1 }));

  const many = normalizeProfileInput({ ...base, likes: Array.from({ length: 30 }, (_, i) => `t${i}`) });
  check(`ชอบเกิน ${MAX_TAGS} รายการ → ตัดให้เหลือ ${MAX_TAGS} (ไม่ปฏิเสธทั้งฟอร์ม)`, "value" in many && many.value.likes.length === MAX_TAGS);
  const badStyle = normalizeProfileInput({ ...base, style: "powerlifting" });
  check("สไตล์ที่ไม่รู้จัก → null (ให้ระบบเลือกตามเป้า ไม่ใช่ error)", "value" in badStyle && badStyle.value.style === null);

  const parq = normalizeProfileInput({ ...base, parq: { q1: false, q2: true, q3: false, answeredAt: "2026-08-20" } });
  check("ตอบ PAR-Q ว่าใช่ 1 ข้อ → ติดธง", "value" in parq && parq.value.parqFlag === true);
  const parqNo = normalizeProfileInput({ ...base, parq: { q1: false, q2: false, q3: false } });
  check("ตอบไม่ทุกข้อ → ไม่ติดธง", "value" in parqNo && parqNo.value.parqFlag === false);
  const cleared = normalizeProfileInput({ ...base, parq: { q1: true, clearedAt: "2026-08-19" } });
  check("เก็บเวลาที่ยืนยันกับแพทย์ไว้", "value" in cleared && !!cleared.value.parq?.clearedAt);
  const junk = normalizeProfileInput({ ...base, parq: { q1: true, hacked: "x" } });
  check("ไม่รับ field แปลกปลอมเข้าก้อน PAR-Q", "value" in junk && !("hacked" in (junk.value.parq ?? {})));
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 6. ด่านตรวจอาการบาดเจ็บ (POST) ──");
{
  const alias = (raw: string) => ({ เข่า: "knee", ไหล่: "shoulder" }[raw] ?? null);
  const th = normalizeInjuryInput({ area: "เข่า" }, alias);
  check("รับคำไทย → area มาตรฐาน", "value" in th && th.value.area === "knee");
  check("ไม่ระบุจุด = ตอบกลับให้เลือก", "error" in normalizeInjuryInput({}, alias));
  const unknown = normalizeInjuryInput({ area: "นิ้วก้อย" }, alias);
  check("จุดที่ไม่รู้จัก → other (ไม่ทิ้งสิ่งที่ user พิมพ์)", "value" in unknown && unknown.value.area === "other");
  check("severity ปริยาย = caution", "value" in th && th.value.severity === "caution");
  const sev = normalizeInjuryInput({ area: "knee", severity: "avoid" }, alias);
  check("severity=avoid รับได้", "value" in sev && sev.value.severity === "avoid");
  const badSev = normalizeInjuryInput({ area: "knee", severity: "extreme" }, alias);
  check("severity ที่ไม่รู้จัก → caution (เบาไว้ก่อน ไม่ใช่ตัดท่าทิ้ง)", "value" in badSev && badSev.value.severity === "caution");
  const pat = normalizeInjuryInput({ area: "knee", avoidPatterns: ["squat", "ไม่รู้จัก"] }, alias);
  check("pattern นอกรายการถูกคัดออก", "value" in pat && pat.value.avoidPatterns.join() === "squat");
  check("temporaryDays 0 = ไม่ผ่าน", "error" in normalizeInjuryInput({ area: "knee", temporaryDays: 0 }, alias));
  check("temporaryDays 400 = ไม่ผ่าน", "error" in normalizeInjuryInput({ area: "knee", temporaryDays: 400 }, alias));
  const temp = normalizeInjuryInput({ area: "knee", temporaryDays: 7 }, alias);
  check("temporaryDays 7 = ผ่าน", "value" in temp && temp.value.temporaryDays === 7);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 7. อาการที่ยังมีผลจริง + รวมเป็นตัวกรอง ──");
{
  const inj = (p: Partial<InjuryLike>): InjuryLike => ({ area: "knee", severity: "caution", ...p });
  check("ไม่มีวันหมดอายุ + active = มีผล", injuryIsActive(inj({}), NOW));
  check("user ปิดเอง = ไม่มีผล", !injuryIsActive(inj({ active: false }), NOW));
  check("หมดอายุไปแล้ว = ไม่มีผล", !injuryIsActive(inj({ expiresAt: ago(1) }), NOW));
  check("ยังไม่ถึงกำหนด = มีผล", injuryIsActive(inj({ expiresAt: ahead(3) }), NOW));

  const patternsForArea = (a: string) => ({ knee: ["squat", "lunge"], shoulder: ["push_v", "push_h", "pull_v"] }[a] ?? []);
  const label = (a: string) => ({ knee: "เข่า", shoulder: "ไหล่" }[a] ?? a);

  const f = injuryFilters(
    [
      inj({ area: "knee", severity: "avoid" }),
      inj({ area: "shoulder", severity: "caution" }),
      inj({ area: "knee", severity: "avoid", expiresAt: ago(1), avoidKeys: ["walk_fast"] }),
    ],
    NOW, patternsForArea, label
  );
  check("เข่า avoid → ตัด squat/lunge", f.avoidPatterns.has("squat") && f.avoidPatterns.has("lunge"));
  check("ไหล่ caution → เข้าถังลดน้ำหนัก ไม่ใช่ถังตัดทิ้ง", f.cautionPatterns.has("push_v") && !f.avoidPatterns.has("push_v"));
  check("อาการที่หมดอายุไม่ถูกนับ", !f.avoidKeys.has("walk_fast"));
  check("ชื่อไทยของจุดที่พักฟื้นถูกเก็บไว้เขียนโน้ต", f.cautionAreas.join() === "ไหล่");
  check("hasAny = true เมื่อมีอย่างน้อย 1 รายการ", f.hasAny);

  const explicit = injuryFilters([inj({ area: "other", severity: "avoid", avoidKeys: ["burpee"] })], NOW, patternsForArea, label);
  check("ระบุรายท่าเองได้แม้ area = other", explicit.avoidKeys.has("burpee"));
  const none = injuryFilters([], NOW, patternsForArea, label);
  check("ไม่มีอาการ = ตัวกรองว่าง", !none.hasAny && none.avoidPatterns.size === 0);
  const allExpired = injuryFilters([inj({ expiresAt: ago(5) })], NOW, patternsForArea, label);
  check("มีแต่รายการหมดอายุ = ถือว่าไม่มี", !allExpired.hasAny);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 8. เวลาต่อครั้ง → จำนวนท่า ──");
{
  check("20 นาที → 3 ท่า", itemsForSessionMin(20).max === 3);
  check("30 นาที → 3 ท่า (ขอบ)", itemsForSessionMin(30).max === 3);
  check("31 นาที → 4-5 ท่า", itemsForSessionMin(31).min === 4 && itemsForSessionMin(31).max === 5);
  check("45 นาที → 4-5 ท่า", itemsForSessionMin(45).min === 4 && itemsForSessionMin(45).max === 5);
  check("59 นาที → ยังเป็น 4-5", itemsForSessionMin(59).max === 5);
  check("60 นาที → ถึง 6 ท่า", itemsForSessionMin(60).max === 6);
  check("90 นาที → 6 ท่า (ไม่ยัดเกินนี้)", itemsForSessionMin(90).max === 6);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 9. วันเทรนตรงกับวันที่เลือกไว้ ──");
{
  // 20 ส.ค. 2026 = วันพฤหัสบดี (getUTCDay = 4)
  const startDow = new Date("2026-08-20T00:00:00.000Z").getUTCDay();
  check("วันเริ่มแผนคือพฤหัสบดี", startDow === 4);

  const res = applyTrainDays(week(["squat_bw", "pushup"]), startDow, ["mon", "wed", "fri"], pool);
  const titles = res.days.map((d) => d.exercisePlan.title);
  check("เหลือวันเทรน 3 วันตามที่เลือก", titles.filter((t) => t !== REST_DAY_TITLE).length === 3);
  check("วันศุกร์ (วันที่ 2 ของแผน) ยังเป็นวันเทรน", titles[1] !== REST_DAY_TITLE);
  check("วันพฤหัส (วันแรก) กลายเป็นวันพัก", titles[0] === REST_DAY_TITLE);
  check("นับจำนวนวันที่เปลี่ยนเป็นวันพักได้ถูก", res.rested === 4);
  check("วันพักมีท่ายืดเหยียดให้ ไม่ใช่หน้าว่าง", (res.days[0].exercisePlan.items ?? []).length === 1);
  check("วันพักไม่แตะแผนอาหาร", res.days[0].mealPlan.totalKcal === 400);

  /* คำตัดสิน QC 20 ส.ค.: วันในตารางที่ AI จัดเป็นวันพัก ต้องได้เวิร์คเอาต์ "ย้าย" มาจากวันนอกตาราง
     (เจอบน prod จริง: เลือก จ/พ/ศ แต่พุธกลายเป็นวันพักเพราะ AI สุ่มให้พุธพัก) */
  const wk = week(["squat_bw", "pushup"]);
  wk[6] = { ...wk[6], exercisePlan: { title: REST_DAY_TITLE, durationMin: 20, items: [{ key: "stretch_full", name: "ยืดเหยียดทั้งตัว", minutes: 20 }], caloriesTarget: 80 } };
  const mv = applyTrainDays(wk, startDow, ["mon", "wed", "fri"], pool); // index 6 = วันพุธ (เริ่มพฤหัส)
  check("วันพุธ (ในตารางแต่ AI ให้พัก) ได้เวิร์คเอาต์ย้ายมา", mv.days[6].exercisePlan.title !== REST_DAY_TITLE);
  check("นับจำนวนวันที่ย้ายได้ถูก", mv.moved === 1);
  check("อาหารของวันพุธไม่ถูกย้ายตาม (อาหารผูกกับวัน)", mv.days[6].mealPlan === wk[6].mealPlan);
  const noDonor = applyTrainDays([day(["stretch_full"])], new Date("2026-08-24T00:00:00.000Z").getUTCDay(), ["mon"], pool);
  check("ไม่มีเวิร์คเอาต์ให้ย้าย = คงวันพักไว้ (ห้ามแต่งวันเทรนเอง)", noDonor.moved === 0);

  const noDays = applyTrainDays(week(["squat_bw"]), startDow, [], pool);
  check("ไม่ได้เลือกวัน = ไม่ยุ่งกับแผน", noDays.rested === 0);
  const already = applyTrainDays([day(["stretch_full"])], startDow, ["mon"], pool);
  check("วันที่เป็นวันพักอยู่แล้ว ไม่นับซ้ำ", already.rested === 0);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 10. ความยาววันตามเวลาที่มีจริง ──");
{
  const six = week(["squat_bw", "pushup", "plank", "db_row", "db_press", "lunge"]);
  const short = fitSessionLength(six, 30, pool);
  check("30 นาที → เหลือ 3 ท่า", (short.days[0].exercisePlan.items ?? []).length === 3);
  check("นับจำนวนท่าที่ตัดออกทั้งสัปดาห์ได้", short.trimmed === 21);
  check("เขียน durationMin ให้ตรงกับเวลาที่ตั้งไว้", short.days[0].exercisePlan.durationMin === 30);
  check("ท่าที่เหลือคือท่าแรก ๆ ของวัน (ท่าหลัก)", short.days[0].exercisePlan.items[0].key === "squat_bw");

  const long = fitSessionLength(six, 60, pool);
  check("60 นาที → เก็บครบ 6 ท่า", (long.days[0].exercisePlan.items ?? []).length === 6 && long.trimmed === 0);
  const rest = fitSessionLength([day(["stretch_full"])], 30, pool);
  check("วันพักไม่โดนตัด/ไม่โดนเปลี่ยนเวลา", rest.days[0].exercisePlan.durationMin === 30 && rest.trimmed === 0);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 11. ชอบ/ไม่ชอบ = soft filter ──");
{
  check("tag running จับท่าวิ่งเหยาะได้", matchesTag(EXERCISE_CATALOG.find((e) => e.key === "jog_light")!, "running"));
  check("tag ไทย 'วิ่ง' จับได้เหมือนกัน", matchesTag(EXERCISE_CATALOG.find((e) => e.key === "jog_light")!, "วิ่ง"));
  check("tag strength ไม่จับท่าคาร์ดิโอ", !matchesTag(EXERCISE_CATALOG.find((e) => e.key === "walk_fast")!, "strength"));

  const days = [day(["jog_light", "squat_bw"])];
  const swap = applyPreferences(days, pool, [], ["running"], patternOf);
  const first = swap.days[0].exercisePlan.items[0];
  check("ไม่ชอบวิ่ง + มีตัวแทนคาร์ดิโอ → เปลี่ยนให้", swap.swapped === 1 && first.key !== "jog_light");
  check("ตัวแทนยัง pattern เดิม (cardio)", patternOf(first) === "cardio");
  check("ไม่ยุ่งกับท่าที่เขาไม่ได้บ่น", swap.days[0].exercisePlan.items[1].key === "squat_bw");
  check("ท่าที่สลับเข้ามาพกคำแนะนำฟอร์มมาด้วย", !!first.note);

  const liked = applyPreferences(days, pool, ["boxing"], ["running"], patternOf);
  check("มีตัวแทนหลายตัว → เลือกตัวที่เขาชอบก่อน", liked.days[0].exercisePlan.items[0].key === "shadow_box");

  const noSub = applyPreferences(days, pool, [], ["cardio"], patternOf);
  check("ไม่ชอบคาร์ดิโอทั้งกลุ่ม (ไม่มีตัวแทน) → คงท่าเดิมไว้ ไม่ตัดทิ้ง", noSub.swapped === 0 && noSub.kept === 1);
  check("ท่ายังอยู่ในแผนจริง ๆ", noSub.days[0].exercisePlan.items.length === 2);

  const nothing = applyPreferences(days, pool, ["yoga"], [], patternOf);
  check("ไม่มีรายการไม่ชอบ = ไม่แตะแผนเลย", nothing.swapped === 0 && nothing.days === days);
}

// ────────────────────────────────────────────────────────────────
// แท็กที่แอปให้เลือกได้ ต้องมีที่ลงฝั่ง server ทุกตัว — ว่ายน้ำเคยหลุด (เลือกได้แต่ไม่มีผลอะไรเลย)
console.log("\n── 11.1 แท็กที่ไม่มีท่าจริงในคลัง (ว่ายน้ำ) + กรรเชียง ──");
{
  const ex = (k: string) => EXERCISE_CATALOG.find((e) => e.key === k)!;
  const gym = catalogFor("gym");

  // คัดลอกจาก ACTIVITY_TAGS ใน coach-app/src/lib/trainingOptions.ts — เพิ่มตัวเลือกในแอปแล้วต้องมาเพิ่มที่นี่ด้วย
  const APP_TAGS = ["strength", "running", "hiit", "yoga", "boxing", "cycling", "swimming"];
  const orphan = APP_TAGS.filter((t) => !KNOWN_TAGS.has(t));
  check(`ทุกแท็กที่แอปให้เลือก server รู้จักหมด`, orphan.length === 0, orphan.join(","));

  check("ชอบว่ายน้ำ → เอียงไปหาคาร์ดิโอกระแทกต่ำแทนได้", matchesTag(ex("elliptical"), "swimming", "like"));
  check("คำไทย 'ว่ายน้ำ' ใช้แทนกันได้", matchesTag(ex("stationary_bike"), "ว่ายน้ำ", "like"));
  check(
    "🔴 ไม่ชอบว่ายน้ำ ต้องไม่ไปเขี่ยเครื่องเดินวงรี/จักรยานออก (คนละเรื่องกัน)",
    !matchesTag(ex("elliptical"), "swimming") && !matchesTag(ex("stationary_bike"), "swimming")
  );
  check("ว่ายน้ำไม่ลามไปจับคาร์ดิโอทั้งกลุ่ม (วิ่งเหยาะไม่ใช่ตัวแทนว่ายน้ำ)", !matchesTag(ex("jog_light"), "swimming", "like"));
  check("tag rowing จับเครื่องกรรเชียงบกได้ (key จริงคือ rowing_machine)", matchesTag(ex("rowing_machine"), "rowing"));

  const swim = applyPreferences([day(["jog_light", "squat_bw"])], gym, ["swimming"], ["running"], patternOf);
  const picked = swim.days[0].exercisePlan.items[0].key;
  check(
    "ไม่ชอบวิ่ง + ชอบว่ายน้ำ → ได้คาร์ดิโอกระแทกต่ำ ไม่ใช่ตัวแรกในคลัง",
    swim.swapped === 1 && ["stationary_bike", "elliptical", "rowing_machine"].includes(String(picked))
  );

  const disSwim = applyPreferences([day(["jog_light", "squat_bw"])], gym, [], ["swimming"], patternOf);
  check("ไม่ชอบว่ายน้ำอย่างเดียว = ไม่มีอะไรในแผนโดนแตะ", disSwim.swapped === 0 && disSwim.kept === 0);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 12. อาการบาดเจ็บ = hard filter (ตัดทิ้งเสมอ) ──");
{
  const filters = injuryFilters(
    [{ area: "knee", severity: "avoid" }],
    NOW,
    (a) => (a === "knee" ? ["squat", "lunge"] : []),
    (a) => (a === "knee" ? "เข่า" : a)
  );
  const res = applyInjuryFilter([day(["squat_bw", "pushup", "lunge"])], filters, patternOf, pool);
  const keys = res.days[0].exercisePlan.items.map((i) => i.key);
  check("สควอทหายไปตามข้อห้ามเข่า", !keys.includes("squat_bw"));
  check("ลันจ์หายไปด้วย (pattern lunge)", !keys.includes("lunge"));
  check("วิดพื้นยังอยู่ (คนละ pattern)", keys.includes("pushup"));
  check("นับจำนวนท่าที่ตัดได้ถูก", res.removed === 2);

  const allGone = applyInjuryFilter([day(["squat_bw", "lunge"])], filters, patternOf, pool);
  check("ตัดจนหมดวัน → กลายเป็นวันพัก ไม่ใช่วันว่างเปล่า", allGone.days[0].exercisePlan.title === REST_DAY_TITLE);
  check("วันพักที่เกิดจากการตัด มีท่ายืดเหยียด 1 ท่า", allGone.days[0].exercisePlan.items.length === 1);

  const byKey = injuryFilters([{ area: "other", severity: "avoid", avoidKeys: ["pushup"] }], NOW, () => [], (a) => a);
  const keyRes = applyInjuryFilter([day(["squat_bw", "pushup"])], byKey, patternOf, pool);
  check("ระบุรายท่าเองก็ตัดได้", keyRes.removed === 1 && !keyRes.days[0].exercisePlan.items.some((i) => i.key === "pushup"));

  const empty = injuryFilters([], NOW, () => [], (a) => a);
  const noop = applyInjuryFilter([day(["squat_bw"])], empty, patternOf, pool);
  check("ไม่มีอาการ = ไม่แตะแผน", noop.removed === 0);

  const cautionOnly = injuryFilters([{ area: "knee", severity: "caution" }], NOW, () => ["squat"], (a) => "เข่า");
  const keep = applyInjuryFilter([day(["squat_bw"])], cautionOnly, patternOf, pool);
  check("caution ไม่ตัดท่าทิ้ง (แค่ลดน้ำหนักทีหลัง)", keep.removed === 0);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 13. ปัดน้ำหนักให้ลงล็อกอุปกรณ์ ──");
{
  // 🔴 ปัดลงเสมอ: ฟังก์ชันนี้ใช้เฉพาะตอนทำให้เบาลง ปัดขึ้น = สั่งหนักกว่าที่กติกาคำนวณให้คนที่เพิ่งบอกว่าเจ็บ
  check("ก้าว 2 กก.: 9 → 8 (ปัดลง ไม่ใช่ 10)", roundToIncrement(9, 2) === 8);
  check("ก้าว 2 กก.: 11 → 10", roundToIncrement(11, 2) === 10);
  check("ก้าว 2 กก.: 12 → 12 (ลงล็อกพอดี ไม่ต้องขยับ)", roundToIncrement(12, 2) === 12);
  check("ก้าว 2.5 กก.: 10 → 10", roundToIncrement(10, 2.5) === 10);
  check("ไม่รู้ก้าว → ปัดลงทีละครึ่งกิโล (7.3 → 7)", roundToIncrement(7.3, null) === 7);
  check("ไม่ต่ำกว่าก้าวเล็กที่สุด (0.4 → 2)", roundToIncrement(0.4, 2) === 2);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 14. โหมดเบา: สัปดาห์สอบเทียบ / PAR-Q / จุดที่พักฟื้น ──");
{
  const empty = injuryFilters([], NOW, () => [], (a) => a);
  const loadable = new Set(["db_squat", "db_press", "db_row"]);
  const base = () => [day(["db_squat", "walk_fast"], {})];
  const withWeight = () => {
    const d = base();
    d[0].exercisePlan.items[0] = { ...d[0].exercisePlan.items[0], weightKg: 20, reps: 12, sets: 3, rxReason: "สัปดาห์ก่อนทำครบ" };
    return d;
  };

  const cal = applyLightWeek(withWeight(), {
    calibration: true, cap: null, repRange: [8, 12], loadableKeys: loadable, incrementKg: 2, injuries: empty, patternOf,
  });
  const calItem = cal.days[0].exercisePlan.items[0];
  check("สอบเทียบ: น้ำหนักเหลือครึ่งเดียว (20 → 10)", calItem.weightKg === 10);
  check("สอบเทียบ: ครั้งอยู่กลางช่วง (8-12 → 10)", calItem.reps === 10);
  check("สอบเทียบ: มีโน้ตบอกว่าทำไม", (calItem.rxReason ?? "").includes(CALIBRATION_NOTE));
  check("สอบเทียบ: ไม่ทิ้งเหตุผลเดิมของ engine", (calItem.rxReason ?? "").includes("สัปดาห์ก่อนทำครบ"));
  check("สอบเทียบ: โน้ตขึ้นระดับวันด้วย", (cal.days[0].aiNote ?? "").includes(CALIBRATION_NOTE));

  const fresh = applyLightWeek(base(), {
    calibration: true, cap: null, repRange: [8, 12], loadableKeys: loadable, incrementKg: 2, injuries: empty, patternOf,
  });
  check("ยังไม่มีตัวเลขของตัวเอง + รู้ก้าวอุปกรณ์ → เริ่มที่ก้าว×2 (4 กก.)", fresh.days[0].exercisePlan.items[0].weightKg === 4);

  const noGear = applyLightWeek(base(), {
    calibration: true, cap: null, repRange: [8, 12], loadableKeys: loadable, incrementKg: null, injuries: empty, patternOf,
  });
  check("ไม่รู้อุปกรณ์ → ไม่เดาน้ำหนักให้คนที่ไม่เคยยก", noGear.days[0].exercisePlan.items[0].weightKg === undefined);
  check("ท่าเดินไม่ถูกยัดน้ำหนัก", noGear.days[0].exercisePlan.items[1].weightKg === undefined);

  const low = applyLightWeek(withWeight(), {
    calibration: false, cap: "low", repRange: [8, 12], loadableKeys: loadable, incrementKg: 2, injuries: empty, patternOf,
  });
  const lowItem = low.days[0].exercisePlan.items[0];
  check("โหมดเบา (PAR-Q): ครั้งไปที่ปลายช่วงสูง (12)", lowItem.reps === 12);
  check("โหมดเบา: น้ำหนักครึ่งเดียวเหมือนกัน", lowItem.weightKg === 10);
  check("โหมดเบา: โน้ตคนละข้อความกับสัปดาห์สอบเทียบ", (lowItem.rxReason ?? "").includes(LOW_INTENSITY_NOTE));

  const caution = injuryFilters([{ area: "knee", severity: "caution" }], NOW, () => ["squat"], () => "เข่า");
  const cau = applyLightWeek(withWeight(), {
    calibration: false, cap: null, repRange: [8, 12], loadableKeys: loadable, incrementKg: 1, injuries: caution, patternOf,
  });
  const cauItem = cau.days[0].exercisePlan.items[0];
  check("พักฟื้นเข่า: ลดน้ำหนักเป้า 20% (20 → 16)", cauItem.weightKg === 16);
  check("พักฟื้น: โน้ตบอกจุดที่พักฟื้นเป็นภาษาคน", (cauItem.rxReason ?? "").includes("ช่วงพักฟื้นเข่า"));
  check("พักฟื้น: ท่าที่ไม่เกี่ยวไม่โดนแตะ", cau.days[0].exercisePlan.items[1].rxReason === undefined);
  check("พักฟื้นอย่างเดียว: ไม่ใส่โน้ตโหมดเบาที่ระดับวัน", cau.days[0].aiNote === undefined);

  const both = applyLightWeek(withWeight(), {
    calibration: true, cap: null, repRange: [8, 12], loadableKeys: loadable, incrementKg: 1, injuries: caution, patternOf,
  });
  check("สอบเทียบ + พักฟื้น = ลดซ้อนกัน (20 → 10 → 8)", both.days[0].exercisePlan.items[0].weightKg === 8);

  const nothing = applyLightWeek(withWeight(), {
    calibration: false, cap: null, repRange: [8, 12], loadableKeys: loadable, incrementKg: 2, injuries: empty, patternOf,
  });
  check("ไม่เข้าเงื่อนไขใดเลย = ไม่แตะแผน", nothing.touched === 0 && nothing.days[0].exercisePlan.items[0].weightKg === 20);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 15. ก้อนบริบทที่โค้ชได้อ่าน ──");
{
  const ctx: TrainingContextBlock = {
    primaryGoal: "strength", style: "strength", daysPerWeek: 3, sessionMin: 45,
    trainDays: ["mon", "wed", "fri"], preferredTime: "morning", likes: ["strength"], dislikes: ["running"],
    experienceMonths: 12, stress: 3, jobType: "desk", calibration: true, parqFlag: true, intensityCap: "low",
    injuries: [{ area: "เข่า", severity: "avoid", note: null, until: "2026-08-27" }],
  };
  const lines = trainingLines(ctx).join("\n");
  check("ไม่มีโปรไฟล์ = ไม่มีบรรทัดเลย", trainingLines(null).length === 0);
  check("บอกเป้าหมายเป็นภาษาไทย", lines.includes("เพิ่มความแข็งแรง"));
  check("บอกตารางวันที่เขาเลือก", lines.includes("จ พ ศ"));
  check("บอกเวลาต่อครั้ง", lines.includes("45 นาที"));
  check("บอกสิ่งที่เขาไม่ชอบ", lines.includes("ไม่ชอบ"));
  check("บอกข้อจำกัดร่างกาย + วันหมดอายุ", lines.includes("เข่า") && lines.includes("2026-08-27"));
  check("บอกว่าเป็นสัปดาห์สอบเทียบ", lines.includes("สอบเทียบ"));
  check("โหมดเบา: สั่งห้ามเชียร์ให้ดันหนัก + ห้ามวินิจฉัย", lines.includes("ห้ามเชียร์") && lines.includes("ห้ามวินิจฉัย"));
  const bare = trainingLines({ ...ctx, trainDays: [], likes: [], dislikes: [], injuries: [], calibration: false, intensityCap: null, stress: null, experienceMonths: null });
  check("ไม่มีข้อมูล = ไม่มีบรรทัดว่าง ๆ ที่เขียนว่าไม่ทราบ", !bare.join("\n").includes("ไม่ทราบ"));
  check("ไม่ได้เลือกวัน → บอกเป็นจำนวนวันต่อสัปดาห์แทน", bare.join("\n").includes("3 วัน/สัปดาห์"));
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 16. ความบริสุทธิ์ของเอนจิน (เทสได้โดยไม่มี DB/เวลา/AI) ──");
{
  const code = readFileSync(join(process.cwd(), "src/lib/trainingProfile.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  check("trainingProfile.ts: ไม่ import prisma", !/@\/lib\/prisma/.test(code));
  check("trainingProfile.ts: ไม่เรียกเวลาปัจจุบัน (รับ now เข้ามาเสมอ)", !/new Date\(\)|Date\.now\(/.test(code));
  check("trainingProfile.ts: ไม่ยิงเน็ต/ไม่เรียก AI", !/\bfetch\(|openai/i.test(code));
}


/* ── ป้ายไทยของแท็กชอบ/ไม่ชอบ ───────────────────────────────────────────
   หน้าหลังบ้านเคยโชว์ค่าดิบ "strength, running" ให้แอดมินอ่าน — แท็กใหม่ที่ลืมใส่ป้าย
   จะหลุดเป็นภาษาอังกฤษอีก ข้อสอบข้อนี้กันไว้ตั้งแต่ตอนเพิ่มกฎ */
for (const k of TAG_KEYS) {
  check(`แท็ก "${k}" มีป้ายไทย`, tagLabel(k) !== k && /[\u0E00-\u0E7F]/.test(tagLabel(k)) || k === "hiit", tagLabel(k));
}
check("ป้ายไทยรับคำไทยที่ผู้ใช้ส่งมาได้ด้วย", tagLabel("ว่ายน้ำ") === "ว่ายน้ำ", tagLabel("ว่ายน้ำ"));
check("แท็กที่ไม่รู้จักคืนค่าเดิม ไม่กลืนหาย", tagLabel("zzz") === "zzz");

console.log(`\n${failed === 0 ? "✅" : "❌"} ผ่าน ${total - failed}/${total} เคส`);
process.exit(failed === 0 ? 0 : 1);
