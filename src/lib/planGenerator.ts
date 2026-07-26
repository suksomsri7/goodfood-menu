import { prisma } from "@/lib/prisma";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";

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

function buildWeekPrompt(pm: PlanMember): string {
  return `คุณเป็นนักโภชนาการและเทรนเนอร์คนไทย ออกแบบแผน 7 วันสำหรับสมาชิก
เป้าหมาย: ${pm.goalType} · รูปแบบอาหาร: ${pm.dietType} · ระดับกิจกรรม: ${pm.activityLevel}
เป้าต่อวัน: แคลอรี่ ${pm.targetKcal} kcal, โปรตีน ${pm.protein}g, คาร์บ ${pm.carbs}g, ไขมัน ${pm.fat}g, โซเดียม ≤${pm.sodium}mg, น้ำตาล ≤${pm.sugar}g

กติกาสำคัญ:
- แคลอรี่รวมของแต่ละวันต้องไม่ต่ำกว่า ${pm.bmr} kcal (ค่า BMR) เด็ดขาด
- เมนูเป็นอาหารไทยหาซื้อได้ทั่วไปหรือทำเองง่าย ไม่ระบุชื่อร้าน
- ท่าออกกำลังกายระดับเริ่มต้น-กลาง ไม่ต้องใช้อุปกรณ์ยิม (ยกเว้นระดับกิจกรรมสูงเพิ่มเวทได้) มีวันพัก 1 วัน
- แต่ละวันมี 4 มื้อ: เช้า/กลางวัน/เย็น/ว่าง

ตอบเป็น JSON เท่านั้น รูปแบบ:
{"days":[{"exercisePlan":{"title":"...","durationMin":30,"items":[{"name":"...","sets":3,"reps":12,"minutes":20,"note":"..."}],"caloriesTarget":200},"mealPlan":{"meals":[{"slot":"เช้า","menu":"...","ingredients":"...","kcal":400,"protein":25,"carbs":45,"fat":12,"sodium":500,"sugar":6}],"totalKcal":1600},"aiNote":"เหตุผล/คำแนะนำสั้น ๆ"}]}
ต้องมี days ครบ 7 รายการ`;
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

  const apiKey = await getSecret("OPENAI_API_KEY");
  if (apiKey) {
    try {
      const openai = buildOpenAI(apiKey);
      const resp = await openai.chat.completions.create({
        model: aiModel(apiKey, "gpt-4o-mini"),
        messages: [
          { role: "system", content: "คุณเป็นนักโภชนาการและเทรนเนอร์ ตอบเป็น JSON ภาษาไทยเท่านั้น" },
          { role: "user", content: buildWeekPrompt(pm) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 3500,
        temperature: 0.7,
      });
      const content = resp.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as { days?: unknown[] };
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
