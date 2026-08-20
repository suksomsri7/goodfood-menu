import { prisma } from "@/lib/prisma";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { getPersonalizationSafe, type Personalization } from "@/lib/personalization";
import {
  catalogFor, catalogPromptList, matchExercise, defaultExercise,
  type CatalogExercise, type EquipmentTier,
} from "@/lib/exerciseCatalog";
import {
  loadGoodfoodMenu, goodfoodMenuReady, pickMainMeals, recentGoodfoodFoodIds,
  MAIN_SLOTS, ROTATION_DAYS, type PickableFood,
} from "@/lib/goodfoodMealPicker";
import { applyProgressionToWeek } from "@/lib/applyProgression";

// ── โครงข้อมูลแผนรายวัน ──
export interface ExercisePlanItem {
  key?: string; // key ในคลังท่า (exerciseCatalog) — ใช้ผูกสื่อสาธิต + คุมชื่อให้คงที่
  media?: { webp: string; mp4: string; poster: string }; // คลิปสาธิต (ถ้าท่านั้นมีแล้ว)
  name: string;
  sets?: number;
  reps?: number;
  minutes?: number;
  note?: string;
  // ── เฟส B (additive): ตัวเลขจาก engine progression — แผนเก่าที่ไม่มี field พวกนี้ยังอ่านได้ปกติ ──
  /** น้ำหนักที่สั่งสัปดาห์นี้ (ท่าที่ใส่น้ำหนักได้) — Workout Player prefill ช่อง kg จากตรงนี้ */
  weightKg?: number;
  /** ท่าจับเวลา: วินาทีต่อเซ็ต (minutes ยังอยู่ครบเพื่อให้จอ/แคลอรี่เดิมไม่พัง) */
  seconds?: number;
  /** ทำไมสัปดาห์นี้ถึงเป็นเลขนี้ — โชว์ให้ user เห็นว่าระบบจำผลของเขาได้ */
  rxReason?: string;
  /** สัปดาห์พักฟื้น (ลดปริมาณ) */
  deload?: boolean;
}
export interface ExercisePlan {
  title: string;
  durationMin: number;
  items: ExercisePlanItem[];
  caloriesTarget: number;
}
export interface MealPlanItem {
  slot: string; // เช้า | กลางวัน | เย็น | ว่าง
  menu: string;
  ingredients?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
  // ── เฟส C (additive): มื้อหลักที่มาจากเมนูจริงของ goodfood → แอปกดสั่งได้ ──
  // ไม่มี field พวกนี้ = เมนูทั่วไปเหมือนเดิม (แผนเก่าใน DB ยังอ่านได้ปกติ)
  source?: "goodfood";
  foodId?: string;
  price?: number;
  imageUrl?: string | null;
  servings?: number;
}
export interface MealPlan {
  meals: MealPlanItem[];
  totalKcal: number;
  /** ราคารวมของมื้อหลักที่สั่งได้ (มีเฉพาะวันที่มื้อหลักมาจาก goodfood) */
  orderTotal?: number;
}
export interface DayPlan {
  exercisePlan: ExercisePlan;
  mealPlan: MealPlan;
  aiNote?: string;
}

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** BKK calendar date ของ Date → เก็บเป็น UTC midnight ของวันนั้น (คีย์ต่อวันที่เสถียร) */
export function bkkDateKey(d: Date): Date {
  const bkk = new Date(d.getTime() + BKK_OFFSET_MS);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate(), 0, 0, 0, 0));
}

/** วันนี้ (BKK) เป็น key */
export function bkkTodayKey(): Date {
  return bkkDateKey(new Date());
}

/** บวกวัน (UTC-safe) */
export function addDays(key: Date, n: number): Date {
  return new Date(key.getTime() + n * 24 * 60 * 60 * 1000);
}

interface PlanMember {
  bmr: number;
  targetKcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  sugar: number;
  activityLevel: string;
  dietType: string;
  goalType: string;
  equipment: EquipmentTier;
}

async function loadPlanMember(memberId: string): Promise<PlanMember | null> {
  const m = await prisma.member.findUnique({ where: { id: memberId } });
  if (!m) return null;
  const bmr = Math.round(m.bmr ?? 1200);
  // เป้าแคลอรี่ ≥ BMR เสมอ (กติกาความปลอดภัย)
  const rawTarget = m.dailyCalories ?? Math.round(m.tdee ?? bmr * 1.2);
  const targetKcal = Math.max(rawTarget, bmr);
  return {
    bmr,
    targetKcal,
    protein: Math.round(m.dailyProtein ?? 120),
    carbs: Math.round(m.dailyCarbs ?? 200),
    fat: Math.round(m.dailyFat ?? 60),
    sodium: Math.round(m.dailySodium ?? 2000),
    sugar: Math.round(m.dailySugar ?? 40),
    activityLevel: m.activityLevel ?? "moderate",
    dietType: m.dietType ?? "ทั่วไป",
    goalType: m.goalType ?? "ลดน้ำหนัก",
    // ไม่เคยถาม = ถือว่าไม่มีอุปกรณ์ (ปลอดภัยสุด) — user บอกโค้ชด้วยเสียงเพื่ออัปเดตได้
    equipment: (["none", "home", "gym"].includes(m.equipment || "") ? m.equipment : "none") as EquipmentTier,
  };
}

// ── แผนสำรองที่ปลอดภัย (ใช้เมื่อ AI ล่ม หรือวันไหนแคลอรี่ต่ำกว่า BMR) ──
function fallbackDay(pm: PlanMember, dayIndex: number): DayPlan {
  const t = pm.targetKcal;
  const ratios = [
    { slot: "เช้า", r: 0.25, menu: "ข้าวต้มไข่ + ผักลวก" },
    { slot: "กลางวัน", r: 0.35, menu: "ข้าวกล้อง + อกไก่ย่าง + ผัดผักรวม" },
    { slot: "เย็น", r: 0.3, menu: "แกงจืดเต้าหู้หมูสับ + ข้าวสวย" },
    { slot: "ว่าง", r: 0.1, menu: "ผลไม้ + โยเกิร์ตรสธรรมชาติ" },
  ];
  const meals: MealPlanItem[] = ratios.map((x) => ({
    slot: x.slot,
    menu: x.menu,
    kcal: Math.round(t * x.r),
    protein: Math.round(pm.protein * x.r),
    carbs: Math.round(pm.carbs * x.r),
    fat: Math.round(pm.fat * x.r),
    sodium: Math.round(pm.sodium * x.r),
    sugar: Math.round(pm.sugar * x.r),
  }));
  const totalKcal = meals.reduce((s, m) => s + m.kcal, 0);
  const isHigh = pm.activityLevel === "active" || pm.activityLevel === "very_active";
  const restDay = dayIndex % 7 === 6; // วันที่ 7 = พัก
  const pool = catalogFor(pm.equipment);
  const pick = (key: string, kind: "cardio" | "strength" | "mobility") =>
    pool.find((e) => e.key === key) || defaultExercise(pool, kind);
  const asItem = (e: CatalogExercise, extra: Partial<ExercisePlanItem>): ExercisePlanItem => ({
    key: e.key, media: e.media, name: e.name, note: e.cue, ...extra,
  });
  const exercisePlan: ExercisePlan = restDay
    ? {
        title: "วันพักฟื้น",
        durationMin: 20,
        items: [asItem(pick("stretch_full", "mobility"), { minutes: 20 })],
        caloriesTarget: 80,
      }
    : {
        title: isHigh ? "คาร์ดิโอ + เวทเทรนนิ่ง" : "คาร์ดิโอเบา + บอดี้เวท",
        durationMin: 30,
        items: [
          asItem(pick("walk_fast", "cardio"), { minutes: 20 }),
          asItem(pick("squat_bw", "strength"), { sets: 3, reps: 12 }),
          asItem(pick("plank", "strength"), { sets: 3, minutes: 1 }),
        ],
        caloriesTarget: isHigh ? 300 : 180,
      };
  return {
    exercisePlan,
    mealPlan: { meals, totalKcal },
    aiNote: "แผนสำรองมาตรฐาน (ปลอดภัยตามเป้าโภชนาการของคุณ)",
  };
}

// ── WO-P.3: ด่านกันข้อห้าม (แพ้อาหาร/บาดเจ็บ) — deterministic ไม่พึ่ง AI ──
// prompt อย่างเดียวไม่พอ: เคยเจอ AI ใส่ "วิ่งเหยาะ" ทั้งที่ memory บอกเข่าเจ็บห้ามวิ่ง
// และ fallbackDay (ตอน AI ล่ม) ก็ไม่รู้จักข้อห้ามเลย → ต้องกรองที่ปลายทางเสมอ
const AVOID_LEXICON = [
  // อาหาร
  "กุ้ง", "ปู", "หอย", "ปลาหมึก", "อาหารทะเล", "ซีฟู้ด", "ปลา", "ไข่", "นมวัว", "นม", "ชีส", "เนย",
  "ถั่วลิสง", "ถั่วเหลือง", "เต้าหู้", "ถั่ว", "แป้งสาลี", "กลูเตน", "ข้าวสาลี", "ขนมปัง",
  "หมู", "เนื้อวัว", "ไก่", "ตับ", "เผ็ด", "พริก", "กะทิ", "ของทอด", "แอลกอฮอล์", "คาเฟอีน", "กาแฟ",
  // ท่าออกกำลังกาย
  "วิ่ง", "กระโดด", "สควอท", "แพลงก์", "ลันจ์", "ยกน้ำหนัก", "เวท", "ว่ายน้ำ", "จักรยาน", "ซิทอัพ", "วิดพื้น",
];

// ข้อจำกัดแบบ "หมวด" — พูดคำเดียวแต่ห้ามของหลายอย่าง (เทียบ keyword ตรง ๆ จับไม่ได้)
const CATEGORY_RULES: Array<{ match: string[]; add: string[] }> = [
  {
    match: ["มังสวิรัติ", "ไม่กินเนื้อสัตว์", "ไม่ทานเนื้อสัตว์", "วีแกน", "vegan", "vegetarian", "กินเจ", "อาหารเจ"],
    add: ["หมู", "ไก่", "เนื้อ", "ปลา", "กุ้ง", "ปู", "หอย", "ทูน่า", "ตับ", "เบคอน", "ไส้กรอก", "แฮม", "ลูกชิ้น", "น้ำปลา"],
  },
  { match: ["วีแกน", "vegan", "กินเจ", "อาหารเจ"], add: ["นม", "ชีส", "เนย", "โยเกิร์ต", "ไข่"] },
  { match: ["แพ้นม", "แลคโตส", "lactose"], add: ["นม", "ชีส", "เนย", "โยเกิร์ต", "ครีม"] },
  { match: ["กลูเตน", "gluten", "แพ้แป้งสาลี"], add: ["แป้งสาลี", "ขนมปัง", "บะหมี่", "พาสต้า", "ซีอิ๊ว"] },
  { match: ["ฮาลาล", "halal", "ไม่กินหมู", "มุสลิม"], add: ["หมู", "เบคอน", "แฮม", "ไส้กรอก", "แอลกอฮอล์"] },
];

/**
 * ไทยไม่มีเว้นวรรค → คำสั้นติดกลางคำอื่นได้ (เจอจริง: "กิ[นม]ังสวิรัติ" ทำให้ห้าม "นม")
 * คำกลุ่มนี้ต้องเจอเป็นวลีที่มีบริบทเท่านั้น
 */
const TERM_PHRASES: Record<string, string[]> = {
  นม: ["แพ้นม", "ไม่กินนม", "ไม่ดื่มนม", "งดนม", "เลี่ยงนม", "นมวัว", "แลคโตส", "lactose"],
  ปู: ["แพ้ปู", "ไม่กินปู", "งดปู", "เนื้อปู", "ปูม้า", "ปูทะเล"],
};

/** คำที่ตามด้วยตัวอักษรนี้แล้วกลายเป็นคนละความหมาย (ปลา→ปลายเท้า, เวท→เวทนา) */
const TERM_NEGATIVE_NEXT: Record<string, string[]> = {
  ปลา: ["ย"],
  เวท: ["นา"],
};

function termInText(blob: string, term: string): boolean {
  const phrases = TERM_PHRASES[term];
  if (phrases) return phrases.some((p) => blob.includes(p));

  const neg = TERM_NEGATIVE_NEXT[term];
  if (!neg) return blob.includes(term);

  for (let i = blob.indexOf(term); i >= 0; i = blob.indexOf(term, i + 1)) {
    const rest = blob.slice(i + term.length);
    if (!neg.some((n) => rest.startsWith(n))) return true;
  }
  return false;
}

/**
 * ดึงคำต้องห้ามจากข้อความ memory — ภาษาไทยไม่มีเว้นวรรค จึงใช้ lexicon + กฎหมวด
 * (เคยลองให้ AI คืน forbiddenKeywords เอง แต่ได้ทั้งคำที่จับไม่ได้ ("เนื้อสัตว์" ไม่ตรงกับ "หมูสับ")
 *  และ false positive (สั่งห้าม "นม" ทั้งที่มังสวิรัติดื่มนมได้) → ใช้กฎ deterministic ล้วน)
 */
export function deriveAvoidKeywords(avoidFacts: string[]): string[] {
  const blob = avoidFacts.join(" ");
  const hits = new Set<string>();
  for (const term of AVOID_LEXICON) if (termInText(blob, term)) hits.add(term);
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some((m) => blob.toLowerCase().includes(m.toLowerCase())))
      rule.add.forEach((t) => hits.add(t));
  }
  // เก็บคำกว้างไว้ ตัดคำที่แคบกว่าออก (เจอทั้ง "เนื้อ" และ "เนื้อวัว" → เก็บ "เนื้อ" ครอบคลุมกว่า)
  // ฝั่งความปลอดภัยของคนแพ้อาหาร: กรองเกินดีกว่ากรองไม่พอ
  const all = [...hits];
  return all.filter((t) => !all.some((o) => o !== t && t.includes(o)));
}

function hitKeyword(text: string | undefined, kws: string[]): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const k of kws) if (t.includes(k.toLowerCase())) return k;
  return null;
}

const SAFE_MENUS: Record<string, string[]> = {
  เช้า: ["ข้าวกล้อง + ผักลวก + งาดำ", "โจ๊กข้าวกล้องผัก", "สลัดผักรวมน้ำสลัดใส"],
  กลางวัน: ["ข้าวกล้อง + ผักผัดน้ำมันน้อย + สลัด", "ข้าวกล้อง + แกงจืดผักรวม", "ก๋วยเตี๋ยวผักน้ำใส"],
  เย็น: ["ข้าวกล้อง + ผักนึ่ง + ซุปผัก", "สลัดผักรวม + ธัญพืช", "แกงจืดผักรวม + ข้าวกล้อง"],
  ว่าง: ["ผลไม้สด", "ผักแท่งจิ้มน้ำสลัดใส", "ธัญพืชอบไม่ใส่น้ำตาล"],
};

const SAFE_EXERCISE = "เดินเร็ว"; // = catalog key walk_fast

/**
 * บังคับให้ทุกท่าในแผนเป็นท่าจากคลัง (ชื่อคงที่ + มี key ผูกสื่อสาธิต + อยู่ในอุปกรณ์ที่ user มี)
 * AI ชอบแต่งชื่อเอง ("โปรแกรมวันจันทร์", "เดินเร็ว/วิ่งเหยาะ") → จับคู่กลับเข้าคลัง
 */
export function snapExercises(days: DayPlan[], pool: CatalogExercise[]): { days: DayPlan[]; snapped: number } {
  let snapped = 0;
  const out = days.map((d) => {
    const seen = new Set<string>();
    const items: ExercisePlanItem[] = [];
    for (const it of d.exercisePlan.items) {
      const hit = matchExercise(it.name || "", pool);
      const e = hit || defaultExercise(pool, it.minutes && !it.sets ? "cardio" : "strength");
      if (!hit || e.name !== it.name) snapped++;
      if (seen.has(e.key)) continue; // กันท่าซ้ำหลังจับคู่
      seen.add(e.key);
      items.push({
        key: e.key,
        media: e.media,
        name: e.name,
        sets: it.sets,
        reps: e.unit === "reps" ? it.reps ?? 12 : undefined,
        minutes: e.unit === "minutes" ? it.minutes ?? 20 : it.minutes,
        note: it.note || e.cue,
      });
    }
    if (!items.length) {
      const e = defaultExercise(pool, "cardio");
      items.push({ key: e.key, media: e.media, name: e.name, minutes: 20, note: e.cue });
    }
    return { ...d, exercisePlan: { ...d.exercisePlan, items } };
  });
  return { days: out, snapped };
}

/**
 * prompt อย่างเดียวไม่พอ: AI ชอบให้ท่าเดียวต่อวัน และไม่ยอมใช้อุปกรณ์ที่ user มี
 * (คนมีฟิตเนสครบได้แต่ท่าตัวเปล่า) → บังคับที่ปลายทาง
 */
export function ensureVariety(
  days: DayPlan[],
  pool: CatalogExercise[],
  tier: EquipmentTier,
  minItems = 3
): { days: DayPlan[]; added: number } {
  let added = 0;
  const byKey = new Map(pool.map((e) => [e.key, e]));

  const out = days.map((d) => {
    const items = [...d.exercisePlan.items];
    const isRest = /พัก|ฟื้นฟู/.test(d.exercisePlan.title || "") ||
      items.every((it) => byKey.get(it.key || "")?.kind === "mobility");
    if (isRest) return d;

    const used = new Set(items.map((it) => it.key || ""));
    const push = (e: CatalogExercise) => {
      used.add(e.key);
      added++;
      items.push(
        e.unit === "reps"
          ? { key: e.key, media: e.media, name: e.name, sets: 3, reps: 12, note: e.cue }
          : { key: e.key, media: e.media, name: e.name, minutes: 15, note: e.cue }
      );
    };

    // 1) มีอุปกรณ์แต่ไม่ได้ใช้เลย → เติมท่าที่ใช้อุปกรณ์
    if (tier !== "none") {
      const usesGear = items.some((it) => (byKey.get(it.key || "")?.equipment ?? "none") !== "none");
      if (!usesGear) {
        const gear = pool.filter((e) => e.equipment !== "none" && e.kind === "strength" && !used.has(e.key));
        if (gear.length) push(gear[(added + items.length) % gear.length]);
      }
    }

    // 2) ท่าน้อยเกินไป → เติมให้ครบ (คาร์ดิโอ 1 + กำลังที่เหลือ)
    let guard = 0;
    while (items.length < minItems && guard++ < 6) {
      const needCardio = !items.some((it) => byKey.get(it.key || "")?.kind === "cardio");
      const cand = pool.filter(
        (e) => !used.has(e.key) && e.kind === (needCardio ? "cardio" : "strength")
      );
      if (!cand.length) break;
      push(cand[(items.length + guard) % cand.length]);
    }

    return { ...d, exercisePlan: { ...d.exercisePlan, items } };
  });

  return { days: out, added };
}

/** กรองแผนทั้งสัปดาห์ให้ไม่ขัดข้อห้าม — คืนจำนวนจุดที่แก้ */
export function enforceAvoid(days: DayPlan[], kws: string[]): { days: DayPlan[]; fixed: number } {
  if (!kws.length) return { days, fixed: 0 };
  let fixed = 0;

  const out = days.map((d) => {
    const meals = d.mealPlan.meals.map((m) => {
      const hit = hitKeyword(m.menu, kws) || hitKeyword(m.ingredients, kws);
      if (!hit) return m;
      fixed++;
      const alt = (SAFE_MENUS[m.slot] || SAFE_MENUS["ว่าง"]).find((s) => !hitKeyword(s, kws));
      // เมนูถูกเปลี่ยนแล้ว = ไม่ใช่สินค้าตัวนั้นอีกต่อไป → ถอด foodId/ราคา/รูปทิ้ง
      // (ปล่อยไว้ = โชว์ราคาของสินค้าที่ไม่ได้กิน + กดสั่งแล้วได้ของที่แพ้)
      return {
        ...m,
        menu: alt || `เมนูผักและธัญพืชตามข้อจำกัดของคุณ (เลี่ยง${hit})`,
        ingredients: undefined,
        source: undefined, foodId: undefined, price: undefined, imageUrl: undefined, servings: undefined,
      };
    });

    const items = d.exercisePlan.items.map((it) => {
      const hit = hitKeyword(it.name, kws) || hitKeyword(it.note, kws);
      if (!hit) return it;
      fixed++;
      return { key: "walk_fast", name: SAFE_EXERCISE, minutes: it.minutes ?? 20, note: `โค้ชปรับให้เข้ากับข้อจำกัดของคุณ (เลี่ยงท่า "${hit}")` };
    });
    // กันซ้ำ: ถ้าโดนแทนหลายท่าจนเหลือท่าเดียวกันหมด ให้เหลือรายการเดียว
    const dedup = items.filter(
      (it, i) => it.name !== SAFE_EXERCISE || items.findIndex((x) => x.name === SAFE_EXERCISE) === i
    );

    const totalKcal = meals.reduce((s, m) => s + m.kcal, 0);
    return {
      ...d,
      mealPlan: { meals, totalKcal },
      exercisePlan: { ...d.exercisePlan, items: dedup },
    };
  });

  return { days: out, fixed };
}

// ── validate + clamp แผน 1 วันจาก AI ──
// คืนเหตุผลด้วย เพื่อให้ generateWeekPlan ขอ AI ซ่อมเฉพาะวันที่ตก แทนทิ้งทั้งวันไปใช้เมนู hardcode
type DayResult = { day: DayPlan; fellBack: boolean; reason?: "lowKcal" | "invalid"; totalKcal?: number };

function sanitizeDay(raw: unknown, pm: PlanMember, dayIndex: number): DayResult {
  try {
    const r = raw as Record<string, unknown>;
    const ep = (r.exercisePlan ?? {}) as Record<string, unknown>;
    const mp = (r.mealPlan ?? {}) as Record<string, unknown>;
    const rawMeals = Array.isArray(mp.meals) ? (mp.meals as Record<string, unknown>[]) : [];
    if (rawMeals.length === 0)
      return { day: fallbackDay(pm, dayIndex), fellBack: true, reason: "invalid" };

    const meals: MealPlanItem[] = rawMeals.map((m) => ({
      slot: String(m.slot ?? "มื้อ"),
      menu: String(m.menu ?? "-"),
      ingredients: m.ingredients ? String(m.ingredients) : undefined,
      kcal: Math.max(0, Math.round(Number(m.kcal) || 0)),
      protein: Math.max(0, Math.round(Number(m.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(m.fat) || 0)),
      sodium: m.sodium != null ? Math.max(0, Math.round(Number(m.sodium))) : undefined,
      sugar: m.sugar != null ? Math.max(0, Math.round(Number(m.sugar))) : undefined,
    }));
    const totalKcal = meals.reduce((s, m) => s + m.kcal, 0);

    // กติกาความปลอดภัย: แคลอรี่รวมต้อง ≥ BMR — ต่ำกว่านี้ส่งกลับไปให้ AI ซ่อม (ดู repairLowDays)
    if (totalKcal < pm.bmr) {
      return { day: fallbackDay(pm, dayIndex), fellBack: true, reason: "lowKcal", totalKcal };
    }

    const items = Array.isArray(ep.items) ? (ep.items as Record<string, unknown>[]) : [];
    const exercisePlan: ExercisePlan = {
      title: String(ep.title ?? "ออกกำลังกายวันนี้"),
      durationMin: Math.max(0, Math.round(Number(ep.durationMin) || 30)),
      items: items.length
        ? items.map((it) => ({
            name: String(it.name ?? "-"),
            sets: it.sets != null ? Number(it.sets) : undefined,
            reps: it.reps != null ? Number(it.reps) : undefined,
            minutes: it.minutes != null ? Number(it.minutes) : undefined,
            note: it.note ? String(it.note) : undefined,
          }))
        : fallbackDay(pm, dayIndex).exercisePlan.items,
      caloriesTarget: Math.max(0, Math.round(Number(ep.caloriesTarget) || 180)),
    };

    return {
      day: {
        exercisePlan,
        mealPlan: { meals, totalKcal },
        aiNote: r.aiNote ? String(r.aiNote) : undefined,
      },
      fellBack: false,
      totalKcal,
    };
  } catch {
    return { day: fallbackDay(pm, dayIndex), fellBack: true, reason: "invalid" };
  }
}

function buildWeekPrompt(pm: PlanMember, personal: Personalization, pool: CatalogExercise[]): string {
  // WO-P.3 — memory + insight เฉพาะตัวเข้าแผนทุกครั้ง (รวมถึงตอน weeklyAdjust regenerate)
  const personalBlock = personal.text ? `\n${personal.text}\n` : "";
  const avoidRule = personal.avoid.length
    ? `\n- ห้ามใส่เมนู/วัตถุดิบ/ท่าออกกำลังกายที่ขัดกับข้อห้ามของสมาชิก (${personal.avoid.join(" · ")}) — รวมถึงวัตถุดิบที่ซ่อนอยู่ในเมนู · ให้เลือกวัตถุดิบ/ท่าอื่นแทน แผนต้องครบ 7 วันเสมอ`
    : "";

  return `คุณเป็นนักโภชนาการและเทรนเนอร์คนไทย ออกแบบแผน 7 วันสำหรับสมาชิก
เป้าหมาย: ${pm.goalType} · รูปแบบอาหาร: ${pm.dietType} · ระดับกิจกรรม: ${pm.activityLevel}
อุปกรณ์ที่สมาชิกมี: ${{ none: "ไม่มีอุปกรณ์ (ตัวเปล่า)", home: "ดัมเบล/ยางยืดที่บ้าน", gym: "ฟิตเนสครบ" }[pm.equipment]}
เป้าต่อวัน: แคลอรี่ ${pm.targetKcal} kcal, โปรตีน ${pm.protein}g, คาร์บ ${pm.carbs}g, ไขมัน ${pm.fat}g, โซเดียม ≤${pm.sodium}mg, น้ำตาล ≤${pm.sugar}g
${personalBlock}
กติกาสำคัญ:
- ผลรวม kcal ของ 4 มื้อในแต่ละวันต้องได้ ${pm.targetKcal} kcal (±10%) และห้ามต่ำกว่า ${pm.bmr} kcal (BMR) เด็ดขาด — บวกเลข kcal ของทุกมื้อตรวจก่อนตอบทุกวัน${avoidRule}
- ใช้ข้อมูลเฉพาะตัวข้างต้น (ถ้ามี) ปรับเมนู/ท่า/ตารางให้เข้ากับชีวิตจริงของสมาชิก ห้ามแต่งข้อมูลที่ไม่ได้ให้มา
- เมนูเป็นอาหารไทยหาซื้อได้ทั่วไปหรือทำเองง่าย ไม่ระบุชื่อร้าน
- **ท่าออกกำลังกายต้องเลือกจากรายการนี้เท่านั้น และเขียนชื่อให้ตรงเป๊ะ** (เลือกให้เข้ากับเป้าหมาย/ระดับกิจกรรม สลับกลุ่มกล้ามเนื้อ มีวันพัก 1 วัน):
${catalogPromptList(pool)}
- ท่าที่นับเป็นครั้งให้ใส่ sets+reps · ท่าที่นับเป็นเวลาให้ใส่ minutes
- วันที่ไม่ใช่วันพัก ให้มี 3-5 ท่า ผสมคาร์ดิโอ + กำลัง และสลับกลุ่มกล้ามเนื้อในแต่ละวัน
- **ใช้อุปกรณ์ที่สมาชิกมีให้คุ้ม**: มีดัมเบล/ยางยืด → อย่างน้อย 2 ท่าต่อวันเป็นท่าที่ใช้อุปกรณ์ ·
  มีฟิตเนสครบ → อย่างน้อย 2 ท่าต่อวันเป็นท่าเครื่อง/บาร์เบล (คนที่ไม่มีอุปกรณ์ใช้ท่าตัวเปล่าล้วน)
- แต่ละวันมี 4 มื้อ: เช้า/กลางวัน/เย็น/ว่าง
- เขียนสั้นเพื่อให้ตอบครบ 7 วัน: aiNote ไม่เกิน 60 ตัวอักษร · ingredients ไม่เกิน 60 ตัวอักษร

ตอบเป็น JSON เท่านั้น รูปแบบ:
{"days":[{"exercisePlan":{"title":"...","durationMin":30,"items":[{"name":"...","sets":3,"reps":12,"minutes":20,"note":"..."}],"caloriesTarget":200},"mealPlan":{"meals":[{"slot":"เช้า","menu":"...","ingredients":"...","kcal":400,"protein":25,"carbs":45,"fat":12,"sodium":500,"sugar":6}],"totalKcal":1600},"aiNote":"เหตุผล/คำแนะนำสั้น ๆ"}]}
ต้องมี days ครบ 7 รายการ`;
}

/**
 * กู้ JSON ที่ถูกตัดกลางคัน (max_tokens หมด) — ดึงเฉพาะ object ของวันที่ปิดวงเล็บครบ
 * ต้นตอที่เจอจริง: คำตอบ 7 วันยาวเกิน max_tokens → JSON.parse พัง → ทั้งสัปดาห์กลายเป็นแผนสำรอง
 */
export function salvageDays(content: string): unknown[] {
  const keyAt = content.indexOf('"days"');
  const arrStart = keyAt >= 0 ? content.indexOf("[", keyAt) : -1;
  if (arrStart < 0) return [];

  const out: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  let esc = false;

  for (let i = arrStart + 1; i < content.length; i++) {
    const ch = content[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try {
          out.push(JSON.parse(content.slice(objStart, i + 1)));
        } catch {
          /* วันนี้กู้ไม่ได้ ข้ามไป */
        }
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) break;
  }
  return out;
}

/**
 * รอบซ่อม: วันที่ AI ให้แคลอรี่ต่ำกว่า BMR จะถูกส่งกลับไปให้ AI เพิ่มปริมาณ/มื้อ
 * (เดิมทิ้งทั้งวันไปใช้ fallbackDay ซึ่งเป็นเมนู hardcode → ของจริงกลายเป็นแผนสำรองเกือบทุกวัน
 *  และแผนสำรองก็ไม่รู้จักข้อมูลเฉพาะตัวของ user เลย)
 */
async function repairLowDays(
  openai: ReturnType<typeof buildOpenAI>,
  model: string,
  pm: PlanMember,
  personal: Personalization,
  low: Array<{ index: number; raw: unknown; totalKcal: number }>
): Promise<Map<number, DayPlan>> {
  const fixed = new Map<number, DayPlan>();
  const avoidRule = personal.avoid.length
    ? `\nข้อห้ามของสมาชิกที่ต้องคงไว้: ${personal.avoid.join(" · ")}`
    : "";

  const prompt = `แผนรายวันด้านล่างมีแคลอรี่รวมต่ำเกินไป (ต่ำกว่า BMR ${pm.bmr} kcal) ให้แก้เฉพาะวันเหล่านี้
เป้าต่อวัน: ${pm.targetKcal} kcal (±10%), โปรตีน ${pm.protein}g, คาร์บ ${pm.carbs}g, ไขมัน ${pm.fat}g, โซเดียม ≤${pm.sodium}mg, น้ำตาล ≤${pm.sugar}g

วิธีแก้: เพิ่มปริมาณอาหารในมื้อเดิม หรือเพิ่ม/ปรับเมนูให้ได้พลังงานตามเป้า — ห้ามแค่แก้ตัวเลขโดยไม่ปรับเมนู
- ผลรวม kcal ของทุกมื้อในวันนั้นต้อง ≥ ${pm.bmr} และใกล้ ${pm.targetKcal} kcal (บวกเลขตรวจก่อนตอบ)
- คงรูปแบบอาหารไทยหาซื้อง่าย และคงแผนออกกำลังกายเดิมของวันนั้นไว้${avoidRule}

วันที่ต้องแก้ (kcal ที่ได้ตอนนี้ในวงเล็บ):
${low.map((d) => `[วันที่ ${d.index + 1}] (รวม ${d.totalKcal} kcal)\n${JSON.stringify(d.raw)}`).join("\n\n")}

ตอบเป็น JSON เท่านั้น: {"days":[{"dayNumber":1,"exercisePlan":{...},"mealPlan":{"meals":[...],"totalKcal":0},"aiNote":"..."}]}
ต้องมีครบทุกวันที่ระบุ`;

  const resp = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "คุณเป็นนักโภชนาการ ตอบเป็น JSON ภาษาไทยเท่านั้น" },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
    temperature: 0.5,
  });

  const content = resp.choices[0]?.message?.content ?? "{}";
  let rawDays: unknown[] = [];
  try {
    const parsed = JSON.parse(content) as { days?: unknown[] };
    rawDays = Array.isArray(parsed.days) ? parsed.days : [];
  } catch {
    rawDays = salvageDays(content); // คำตอบถูกตัด → กู้เท่าที่ครบ
  }

  for (const raw of rawDays) {
    const r = raw as Record<string, unknown>;
    const dayNumber = Number(r.dayNumber);
    const index = Number.isFinite(dayNumber) ? dayNumber - 1 : NaN;
    if (!low.some((d) => d.index === index)) continue;
    const res = sanitizeDay(raw, pm, index);
    if (!res.fellBack) fixed.set(index, res.day); // ยังต่ำอยู่ → คงแผนสำรองไว้ (กติกาความปลอดภัยเดิม)
  }
  return fixed;
}

/**
 * สวมมื้อหลัก (เช้า/กลางวัน/เย็น) ของทุกวันด้วยเมนูจริงจากตาราง Food
 * มื้อว่าง/มื้ออื่นคงของเดิมไว้ทั้งหมด (ระบบเดิมจัดอิสระ)
 * วันไหนคัดไม่ได้ (เมนูที่กินได้เหลือไม่ถึง 3 อย่าง) → คงมื้อเดิมของวันนั้นไว้
 */
async function applyGoodfoodMainMeals(
  days: DayPlan[],
  memberId: string,
  startKey: Date,
  pm: PlanMember,
  foods: PickableFood[],
  avoidKeywords: string[]
): Promise<{ days: DayPlan[]; applied: number; offTarget: number }> {
  const target = {
    targetKcal: pm.targetKcal, protein: pm.protein, carbs: pm.carbs,
    fat: pm.fat, sodium: pm.sodium, sugar: pm.sugar,
  };
  // เมนูที่เพิ่งได้ไปก่อนหน้าสัปดาห์นี้ (จากแผนเก่าใน DB)
  const beforeWeek = [...(await recentGoodfoodFoodIds(memberId, startKey))];
  // หน้าต่างเลื่อน ROTATION_DAYS วัน — ไม่ใช่เซ็ตที่โตไปเรื่อย ๆ แล้วต้องล้างทิ้ง
  // (ล้างทิ้งทีเดียวทำให้วันที่ 5 ได้ชุดเดียวกับวันที่ 1 เป๊ะ = หมุนเวียนไม่จริง)
  const usedByDay: string[][] = [];
  let applied = 0;
  let offTarget = 0;

  const out = days.map((d) => d); // เขียนทับทีละ index ด้านล่าง
  for (let i = 0; i < out.length; i++) {
    const date = addDays(startKey, i);
    const dayKey = date.toISOString().slice(0, 10);
    const window = usedByDay.slice(Math.max(0, i - ROTATION_DAYS), i).flat();
    // วันแรก ๆ ของสัปดาห์ยังต้องเลี่ยงเมนูของสัปดาห์ก่อนด้วย
    const carry = i < ROTATION_DAYS ? beforeWeek : [];
    // มื้อว่าง/เสริมที่ระบบเดิมจัดไว้ กินงบไปเท่าไหร่แล้ว → มื้อหลักรับผิดชอบเฉพาะส่วนที่เหลือ
    // (AI บางวันให้มื้อว่าง 2 มื้อ ถ้าใช้ 90% ตายตัว ยอดรวมทั้งวันจะทะลุเป้า)
    const others = out[i].mealPlan.meals.filter((m) => !MAIN_SLOTS.includes(m.slot as never));
    const otherKcal = others.reduce((s2, m) => s2 + (m.kcal || 0), 0);
    const mainShare = Math.min(1, Math.max(0.5, (pm.targetKcal - otherKcal) / pm.targetKcal));

    const picked = pickMainMeals({
      memberId, dayKey, foods, target, avoidKeywords, mainShare,
      recentFoodIds: new Set([...window, ...carry]),
    });
    if (!picked) { usedByDay.push([]); continue; }

    // มื้อที่ไม่ใช่มื้อหลักคงไว้ตามเดิม (ว่าง/เสริม = ระบบเดิม)
    const meals = [...picked.meals, ...others];
    out[i] = {
      ...out[i],
      mealPlan: {
        meals,
        totalKcal: meals.reduce((s, m) => s + m.kcal, 0),
        orderTotal: picked.totalPrice,
      },
    };
    applied++;
    if (!picked.ok) offTarget++;
    usedByDay.push(picked.foodIds);
  }
  return { days: out, applied, offTarget };
}

export interface GenerateResult {
  created: number;
  weekBatchId: string;
  usedFallback: boolean;
  days: DayPlan[];
  /** จำนวนวันที่มื้อหลักมาจากเมนูจริงของ goodfood (0 = แผนแบบเดิมล้วน) */
  goodfoodDays?: number;
}

/**
 * สร้างแผน 7 วันเริ่มจาก startKey (BKK date key). 1 OpenAI call.
 * ไม่เขียนทับวันที่มีแผนอยู่แล้ว (skipDuplicates)
 */
export async function generateWeekPlan(memberId: string, startKey: Date): Promise<GenerateResult> {
  const pm = await loadPlanMember(memberId);
  if (!pm) throw new Error("member not found");

  const weekBatchId = `${memberId}-${startKey.toISOString().slice(0, 10)}`;
  let days: DayPlan[] = [];
  let usedFallback = false;

  // WO-P.3 — memory/insight ของ user (จุดเดียวกับที่โค้ชใช้) · ใช้ทั้งใน prompt และด่านกันข้อห้าม
  const personal = await getPersonalizationSafe(memberId);
  const pool = catalogFor(pm.equipment); // ท่าที่ user ทำได้จริงตามอุปกรณ์

  const apiKey = await getSecret("OPENAI_API_KEY");
  if (apiKey) {
    try {
      const openai = buildOpenAI(apiKey);
      const resp = await openai.chat.completions.create({
        model: aiModel(apiKey, "gpt-4o-mini"),
        messages: [
          { role: "system", content: "คุณเป็นนักโภชนาการและเทรนเนอร์ ตอบเป็น JSON ภาษาไทยเท่านั้น" },
          { role: "user", content: buildWeekPrompt(pm, personal, pool) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
        temperature: 0.7,
      });
      const content = resp.choices[0]?.message?.content ?? "";
      let rawDays: unknown[] = [];
      try {
        const parsed = JSON.parse(content) as { days?: unknown[] };
        rawDays = Array.isArray(parsed.days) ? parsed.days : [];
      } catch {
        // คำตอบถูกตัดกลางคัน → กู้วันที่ครบ แล้วให้วันที่เหลือเข้ารอบซ่อม/แผนสำรอง
        rawDays = salvageDays(content);
        console.warn(`[planGenerator] JSON ถูกตัด — กู้ได้ ${rawDays.length}/7 วัน member=${memberId}`);
      }
      const results: DayResult[] = Array.from({ length: 7 }, (_, i) =>
        i < rawDays.length
          ? sanitizeDay(rawDays[i], pm, i)
          : { day: fallbackDay(pm, i), fellBack: true, reason: "invalid" }
      );
      days = results.map((r) => r.day);

      // รอบซ่อม: เฉพาะวันที่ AI ให้แคลอรี่ต่ำกว่า BMR (1 call, เฉพาะเมื่อจำเป็น)
      const low = results
        .map((r, i) => ({ index: i, raw: rawDays[i], totalKcal: r.totalKcal ?? 0, r }))
        .filter((x) => x.r.reason === "lowKcal" && x.raw != null);
      if (low.length) {
        try {
          const fixed = await repairLowDays(openai, aiModel(apiKey, "gpt-4o-mini"), pm, personal, low);
          for (const [i, day] of fixed) days[i] = day;
          console.log(
            `[planGenerator] ซ่อมวันแคลอรี่ต่ำ ${fixed.size}/${low.length} วัน member=${memberId}`
          );
        } catch (e) {
          console.error("[planGenerator] repairLowDays failed (คงแผนสำรองไว้):", e);
        }
      }
    } catch (e) {
      console.error("[planGenerator] AI failed, using fallback:", e);
      usedFallback = true;
      days = Array.from({ length: 7 }, (_, i) => fallbackDay(pm, i));
    }
  } else {
    usedFallback = true;
    days = Array.from({ length: 7 }, (_, i) => fallbackDay(pm, i));
  }

  // ท่าทั้งหมดต้องเป็นท่าจากคลัง (ชื่อคงที่ + ตรงกับอุปกรณ์ที่มี)
  const snappedResult = snapExercises(days, pool);
  if (snappedResult.snapped > 0) {
    console.log(`[planGenerator] จับท่าเข้าคลัง ${snappedResult.snapped} จุด (${pm.equipment}) member=${memberId}`);
  }
  days = snappedResult.days;

  const variety = ensureVariety(days, pool, pm.equipment);
  if (variety.added > 0) {
    console.log(`[planGenerator] เติมท่าให้ครบ/ให้ใช้อุปกรณ์ ${variety.added} ท่า member=${memberId}`);
  }
  days = variety.days;

  const avoidKeywords = deriveAvoidKeywords(personal.avoid);

  // ── เฟส C: มื้อหลักใช้เมนูจริงของ goodfood (ถ้ามีพอ) ──
  // 🔴 เมนูไม่พอ = ข้ามทั้งก้อน แผนออกมาเหมือนเดิมทุกประการ (ห้ามแต่งเมนูที่ไม่ได้ขายจริง)
  let goodfoodDays = 0;
  const menu = await loadGoodfoodMenu();
  if (goodfoodMenuReady(menu)) {
    const swapped = await applyGoodfoodMainMeals(days, memberId, startKey, pm, menu, avoidKeywords);
    days = swapped.days;
    goodfoodDays = swapped.applied;
    console.log(
      `[planGenerator] มื้อหลักจากเมนู goodfood ${swapped.applied}/7 วัน ` +
        `(เมนูใช้ได้ ${menu.length} รายการ · นอกเกณฑ์ ±15% ${swapped.offTarget} วัน) member=${memberId}`
    );
  } else if (menu.length > 0) {
    console.log(
      `[planGenerator] เมนู goodfood มี ${menu.length} รายการ (ต้องการอย่างน้อย 9) — ใช้แผนแบบเดิม member=${memberId}`
    );
  }

  // WO-P.3 — ด่านสุดท้าย: แผนต้องไม่ขัดข้อห้าม (ครอบทั้งแผน AI และแผนสำรอง)
  const enforced = enforceAvoid(days, avoidKeywords);
  if (enforced.fixed > 0) {
    console.log(`[planGenerator] enforceAvoid แก้ ${enforced.fixed} จุด (${avoidKeywords.join(",")}) member=${memberId}`);
  }
  days = enforced.days;

  /* ── เฟส B: ต่อยอดจากผลจริงของสัปดาห์ก่อน (น้ำหนัก/ครั้ง/เซ็ต + เหตุผล) ──
     🔴 ต้องอยู่ "หลัง" snapExercises + enforceAvoid เสมอ: ท่าถูกเลือกและกรองข้อห้ามเรียบร้อยแล้ว
        ตรงนี้แตะแค่ตัวเลขของท่าที่ผ่านด่านมา (ไม่เพิ่ม/ไม่สลับท่า) — ห้ามย้ายขึ้นไปก่อนด่านความปลอดภัย
     🔴 engine ล้ม = แผนต้องยังออก (ตัวเลขตามที่ AI/แผนสำรองให้มา) ห้ามให้ลูกค้าไม่มีแผนทั้งสัปดาห์ */
  try {
    const progressed = await applyProgressionToWeek(memberId, days);
    days = progressed.days;
    if (progressed.applied > 0 || progressed.deloadWeek) {
      console.log(
        `[planGenerator] progression ต่อยอด ${progressed.applied} ท่า` +
          `${progressed.deloadWeek ? " · สัปดาห์พักฟื้น" : ""}` +
          `${progressed.capped ? ` · คุมเพดานปริมาณ ${progressed.capped} pattern` : ""} member=${memberId}`
      );
    }
  } catch (e) {
    console.error("[planGenerator] applyProgression ล้ม — ใช้ตัวเลขตามแผนเดิม:", e);
  }

  // เขียนลง DB — ไม่ทับวันที่มีแล้ว
  const rows = days.map((d, i) => ({
    memberId,
    date: addDays(startKey, i),
    exercisePlan: d.exercisePlan as object,
    mealPlan: d.mealPlan as object,
    aiNote: d.aiNote ?? null,
    weekBatchId,
  }));
  const result = await prisma.dailyPlan.createMany({ data: rows, skipDuplicates: true });

  return { created: result.count, weekBatchId, usedFallback, days, goodfoodDays };
}
