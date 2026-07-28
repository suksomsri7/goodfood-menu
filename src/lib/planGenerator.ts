import { prisma } from "@/lib/prisma";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { getPersonalizationSafe, type Personalization } from "@/lib/personalization";

// ── โครงข้อมูลแผนรายวัน ──
export interface ExercisePlanItem {
  name: string;
  sets?: number;
  reps?: number;
  minutes?: number;
  note?: string;
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
}
export interface MealPlan {
  meals: MealPlanItem[];
  totalKcal: number;
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
  const exercisePlan: ExercisePlan = restDay
    ? {
        title: "วันพักฟื้น",
        durationMin: 20,
        items: [{ name: "ยืดเหยียดกล้ามเนื้อเบา ๆ", minutes: 20, note: "ผ่อนคลาย ฟื้นฟูร่างกาย" }],
        caloriesTarget: 80,
      }
    : {
        title: isHigh ? "คาร์ดิโอ + เวทเทรนนิ่ง" : "คาร์ดิโอเบา + บอดี้เวท",
        durationMin: 30,
        items: [
          { name: "เดินเร็ว/วิ่งเหยาะ", minutes: 20, note: "โซนเบา-ปานกลาง" },
          { name: "สควอท", sets: 3, reps: 12 },
          { name: "แพลงก์", sets: 3, minutes: 1 },
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

/** ดึงคำต้องห้ามจากข้อความ memory (ภาษาไทยไม่มีเว้นวรรค → เทียบกับ lexicon) + คำที่ AI ระบุเอง */
export function deriveAvoidKeywords(avoidFacts: string[], aiKeywords: string[] = []): string[] {
  const blob = avoidFacts.join(" ");
  const hits = new Set<string>();
  for (const term of AVOID_LEXICON) if (blob.includes(term)) hits.add(term);
  for (const k of aiKeywords) {
    const t = String(k || "").trim();
    if (t.length >= 2) hits.add(t);
  }
  // ตัดคำที่เป็นส่วนย่อยของคำอื่นที่เจอแล้ว (เจอ "อาหารทะเล" แล้วไม่ต้องแบน "ปลา" ทั้งหมด)
  const all = [...hits];
  return all.filter((t) => !all.some((o) => o !== t && o.includes(t)));
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

const SAFE_EXERCISE = "เดินเร็วบนพื้นราบ";

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
      return { ...m, menu: alt || `เมนูผักและธัญพืชตามข้อจำกัดของคุณ (เลี่ยง${hit})`, ingredients: undefined };
    });

    const items = d.exercisePlan.items.map((it) => {
      const hit = hitKeyword(it.name, kws) || hitKeyword(it.note, kws);
      if (!hit) return it;
      fixed++;
      return { name: SAFE_EXERCISE, minutes: it.minutes ?? 20, note: `โค้ชปรับให้เข้ากับข้อจำกัดของคุณ (เลี่ยงท่า "${hit}")` };
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
function sanitizeDay(raw: unknown, pm: PlanMember, dayIndex: number): DayPlan {
  try {
    const r = raw as Record<string, unknown>;
    const ep = (r.exercisePlan ?? {}) as Record<string, unknown>;
    const mp = (r.mealPlan ?? {}) as Record<string, unknown>;
    const rawMeals = Array.isArray(mp.meals) ? (mp.meals as Record<string, unknown>[]) : [];
    if (rawMeals.length === 0) return fallbackDay(pm, dayIndex);

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
    let totalKcal = meals.reduce((s, m) => s + m.kcal, 0);

    // กติกาความปลอดภัย: แคลอรี่รวมต้อง ≥ BMR — ถ้าต่ำกว่า ใช้แผนสำรองแทนทั้งวัน
    if (totalKcal < pm.bmr) {
      return fallbackDay(pm, dayIndex);
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
      exercisePlan,
      mealPlan: { meals, totalKcal },
      aiNote: r.aiNote ? String(r.aiNote) : undefined,
    };
  } catch {
    return fallbackDay(pm, dayIndex);
  }
}

function buildWeekPrompt(pm: PlanMember, personal: Personalization): string {
  // WO-P.3 — memory + insight เฉพาะตัวเข้าแผนทุกครั้ง (รวมถึงตอน weeklyAdjust regenerate)
  const personalBlock = personal.text ? `\n${personal.text}\n` : "";
  const avoidRule = personal.avoid.length
    ? `\n- ห้ามใส่เมนู/วัตถุดิบ/ท่าออกกำลังกายที่ขัดกับข้อห้ามของสมาชิก (${personal.avoid.join(" · ")}) — รวมถึงวัตถุดิบที่ซ่อนอยู่ในเมนู · ให้เลือกวัตถุดิบ/ท่าอื่นแทน แผนต้องครบ 7 วันเสมอ`
    : "";

  return `คุณเป็นนักโภชนาการและเทรนเนอร์คนไทย ออกแบบแผน 7 วันสำหรับสมาชิก
เป้าหมาย: ${pm.goalType} · รูปแบบอาหาร: ${pm.dietType} · ระดับกิจกรรม: ${pm.activityLevel}
เป้าต่อวัน: แคลอรี่ ${pm.targetKcal} kcal, โปรตีน ${pm.protein}g, คาร์บ ${pm.carbs}g, ไขมัน ${pm.fat}g, โซเดียม ≤${pm.sodium}mg, น้ำตาล ≤${pm.sugar}g
${personalBlock}
กติกาสำคัญ:
- แคลอรี่รวมของแต่ละวันต้องไม่ต่ำกว่า ${pm.bmr} kcal (ค่า BMR) เด็ดขาด${avoidRule}
- ใช้ข้อมูลเฉพาะตัวข้างต้น (ถ้ามี) ปรับเมนู/ท่า/ตารางให้เข้ากับชีวิตจริงของสมาชิก ห้ามแต่งข้อมูลที่ไม่ได้ให้มา
- เมนูเป็นอาหารไทยหาซื้อได้ทั่วไปหรือทำเองง่าย ไม่ระบุชื่อร้าน
- ท่าออกกำลังกายระดับเริ่มต้น-กลาง ไม่ต้องใช้อุปกรณ์ยิม (ยกเว้นระดับกิจกรรมสูงเพิ่มเวทได้) มีวันพัก 1 วัน
- แต่ละวันมี 4 มื้อ: เช้า/กลางวัน/เย็น/ว่าง

ตอบเป็น JSON เท่านั้น รูปแบบ:
{"forbiddenKeywords":["คำ/วัตถุดิบ/ท่า ที่ห้ามปรากฏในแผนตามข้อห้ามของสมาชิก"],"days":[{"exercisePlan":{"title":"...","durationMin":30,"items":[{"name":"...","sets":3,"reps":12,"minutes":20,"note":"..."}],"caloriesTarget":200},"mealPlan":{"meals":[{"slot":"เช้า","menu":"...","ingredients":"...","kcal":400,"protein":25,"carbs":45,"fat":12,"sodium":500,"sugar":6}],"totalKcal":1600},"aiNote":"เหตุผล/คำแนะนำสั้น ๆ"}]}
ต้องมี days ครบ 7 รายการ · forbiddenKeywords ว่าง [] ได้ถ้าไม่มีข้อห้าม`;
}

export interface GenerateResult {
  created: number;
  weekBatchId: string;
  usedFallback: boolean;
  days: DayPlan[];
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
  let aiKeywords: string[] = [];

  const apiKey = await getSecret("OPENAI_API_KEY");
  if (apiKey) {
    try {
      const openai = buildOpenAI(apiKey);
      const resp = await openai.chat.completions.create({
        model: aiModel(apiKey, "gpt-4o-mini"),
        messages: [
          { role: "system", content: "คุณเป็นนักโภชนาการและเทรนเนอร์ ตอบเป็น JSON ภาษาไทยเท่านั้น" },
          { role: "user", content: buildWeekPrompt(pm, personal) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 3500,
        temperature: 0.7,
      });
      const content = resp.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as { days?: unknown[]; forbiddenKeywords?: unknown };
      if (Array.isArray(parsed.forbiddenKeywords))
        aiKeywords = parsed.forbiddenKeywords.map((k) => String(k));
      const rawDays = Array.isArray(parsed.days) ? parsed.days : [];
      days = Array.from({ length: 7 }, (_, i) =>
        i < rawDays.length ? sanitizeDay(rawDays[i], pm, i) : fallbackDay(pm, i)
      );
    } catch (e) {
      console.error("[planGenerator] AI failed, using fallback:", e);
      usedFallback = true;
      days = Array.from({ length: 7 }, (_, i) => fallbackDay(pm, i));
    }
  } else {
    usedFallback = true;
    days = Array.from({ length: 7 }, (_, i) => fallbackDay(pm, i));
  }

  // WO-P.3 — ด่านสุดท้าย: แผนต้องไม่ขัดข้อห้าม (ครอบทั้งแผน AI และแผนสำรอง)
  const avoidKeywords = deriveAvoidKeywords(personal.avoid, aiKeywords);
  const enforced = enforceAvoid(days, avoidKeywords);
  if (enforced.fixed > 0) {
    console.log(`[planGenerator] enforceAvoid แก้ ${enforced.fixed} จุด (${avoidKeywords.join(",")}) member=${memberId}`);
  }
  days = enforced.days;

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

  return { created: result.count, weekBatchId, usedFallback, days };
}
