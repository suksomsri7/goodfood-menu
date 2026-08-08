/**
 * เครื่องจัดมื้อหลักจากเมนูจริงของ goodfood (เฟส C)
 *
 * หลักการที่ user เคาะ: **มื้อหลัก (เช้า/กลางวัน/เย็น) = เมนูจากตาราง Food เท่านั้น**
 * ส่วนมื้อว่าง/เสริม ปล่อยให้ระบบเดิม (AI/พฤติกรรม) จัดอิสระเหมือนเดิม
 *
 * 🔴 กฎเหล็ก no-fabrication: ถ้าเมนูจริงในระบบไม่พอ ห้ามแต่งเมนูขึ้นมาขาย
 *    → คืน null แล้วให้ planGenerator ทำงานแบบเดิมทุกประการ (แผนต้องไม่พังหรือว่าง)
 *
 * ไม่เรียก AI เลย — คัดด้วยกฎล้วน จึงเร็ว ถูก และอธิบายได้ว่าทำไมได้เมนูนี้
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const MAIN_SLOTS = ["เช้า", "กลางวัน", "เย็น"] as const;
export type MainSlot = (typeof MAIN_SLOTS)[number];

/** สัดส่วนพลังงานของแต่ละมื้อ (ชุดเดียวกับ fallbackDay เดิม — มื้อว่างได้ 10% ที่เหลือ) */
export const SLOT_RATIO: Record<MainSlot, number> = { เช้า: 0.25, กลางวัน: 0.35, เย็น: 0.3 };
export const MAIN_RATIO = SLOT_RATIO["เช้า"] + SLOT_RATIO["กลางวัน"] + SLOT_RATIO["เย็น"]; // 0.9

/** เมนูเดียวกันต้องไม่ซ้ำภายในกี่วัน */
export const ROTATION_DAYS = 3;
/** เมนู isActive ขั้นต่ำที่ถือว่า "พอจัดแผนได้" = 3 มื้อ × 3 วันหมุน */
export const MIN_ACTIVE_FOODS = 9;
/** เกณฑ์ยืดหยุ่นราย field (เท่ากับที่ planGenerator ใช้กับ AI แต่กว้างกว่านิดเพราะเมนูมีจำกัด) */
export const FIT_TOLERANCE = 0.15;
/** จำนวนกล่องต่อมื้อที่ยอมให้ (สั่งจริงได้ ไม่ใช่เศษส่วนแปลก ๆ) */
const SERVING_OPTIONS = [1, 2];
/** จำกัดผู้เข้าชิงต่อวัน — กันคอมบิเนทอเรียลบานเมื่อเมนูเยอะ */
const CANDIDATE_LIMIT = 40;

export type PickableFood = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  imageUrl: string | null;
  price: number;
  discountPrice: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
};

/** เป้าโภชนาการรายวันของสมาชิก (ชุดเดียวกับ PlanMember ใน planGenerator) */
export type MacroTarget = {
  targetKcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  sugar: number;
};

/** ข้อมูลที่แนบไปกับมื้อ เพื่อให้แอปกดสั่งได้ (additive — ของเดิมใน MealPlanItem อยู่ครบ) */
export type GoodfoodMealMeta = {
  source: "goodfood";
  foodId: string;
  price: number;
  imageUrl: string | null;
  servings: number;
};

export type PickedMeal = {
  slot: MainSlot;
  menu: string;
  ingredients?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
} & GoodfoodMealMeta;

export type PickResult = {
  meals: PickedMeal[];
  /** ส่วนต่างจากเป้าของมื้อหลัก (สัดส่วน เช่น 0.08 = เกินเป้า 8%) */
  fit: { kcal: number; protein: number; carbs: number; fat: number };
  /** เข้าเกณฑ์ ±15% ครบทุก field ไหม (ไม่เข้า = ยังใช้ได้ แต่บันทึก log ไว้ดู) */
  ok: boolean;
  foodIds: string[];
  /** ราคารวมของมื้อหลักวันนั้น */
  totalPrice: number;
};

/** ราคาที่ลูกค้าจ่ายจริง (มีราคาลดใช้ราคาลด) */
export function effectivePrice(f: PickableFood): number {
  return f.discountPrice != null && f.discountPrice > 0 && f.discountPrice < f.price
    ? f.discountPrice
    : f.price;
}

/** โหลดเมนูที่ขายจริงอยู่ตอนนี้ */
export async function loadGoodfoodMenu(): Promise<PickableFood[]> {
  try {
    return await prisma.food.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, description: true, ingredients: true, imageUrl: true,
        price: true, discountPrice: true,
        calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true,
      },
      orderBy: { order: "asc" },
    });
  } catch (e) {
    console.error("[goodfoodMealPicker] โหลดเมนูไม่สำเร็จ — ใช้แผนแบบเดิม", e);
    return [];
  }
}

/** เมนูพอจัดแผนไหม (ไม่พอ = planGenerator ทำงานแบบเดิมทั้งแผน) */
export function goodfoodMenuReady(foods: PickableFood[]): boolean {
  return foods.length >= MIN_ACTIVE_FOODS;
}

/** ข้อความทั้งหมดของเมนูที่ต้องเอาไปตรวจกับข้อห้าม (ชื่อ + คำอธิบาย + วัตถุดิบ) */
export function foodSearchBlob(f: PickableFood): string {
  return [f.name, f.description || "", ...(f.ingredients || [])].join(" ").toLowerCase();
}

/** เมนูนี้ขัดข้อห้ามของสมาชิกไหม — คืนคำที่ชนถ้าขัด */
export function foodAvoidHit(f: PickableFood, avoidKeywords: string[]): string | null {
  if (!avoidKeywords.length) return null;
  const blob = foodSearchBlob(f);
  for (const k of avoidKeywords) if (blob.includes(k.toLowerCase())) return k;
  return null;
}

/** ลำดับที่ "สุ่มแต่ทำซ้ำได้" — seed จาก member + วัน (pattern เดียวกับบทความ/คลิปรายวัน) */
function dailyRank(memberId: string, dayKey: string, foodId: string): string {
  return createHash("sha256").update(`meal:${memberId}:${dayKey}:${foodId}`).digest("hex").slice(0, 16);
}

type Option = { food: PickableFood; servings: number };

function scaled(o: Option) {
  const s = o.servings;
  return {
    kcal: o.food.calories * s,
    protein: o.food.protein * s,
    carbs: o.food.carbs * s,
    fat: o.food.fat * s,
    sodium: (o.food.sodium ?? 0) * s,
    sugar: (o.food.sugar ?? 0) * s,
  };
}

/** ยิ่งน้อยยิ่งดี — ผิดเป้ามาโครเท่าไหร่ + โดนปรับถ้าโซเดียม/น้ำตาลเกินเพดาน */
function errorOf(
  total: { kcal: number; protein: number; carbs: number; fat: number; sodium: number; sugar: number },
  t: MacroTarget
) {
  const rel = (got: number, want: number) => (want > 0 ? Math.abs(got - want) / want : 0);
  // แคลอรี่กับโปรตีนสำคัญสุด (คุมน้ำหนัก + รักษากล้ามเนื้อ)
  let e =
    rel(total.kcal, t.targetKcal * MAIN_RATIO) * 3 +
    rel(total.protein, t.protein * MAIN_RATIO) * 2 +
    rel(total.carbs, t.carbs * MAIN_RATIO) +
    rel(total.fat, t.fat * MAIN_RATIO);
  // โซเดียม/น้ำตาลเป็น "เพดาน" ไม่ใช่เป้า — เกินเท่านั้นที่โดนปรับ
  const sodiumCap = t.sodium * MAIN_RATIO;
  const sugarCap = t.sugar * MAIN_RATIO;
  if (total.sodium > sodiumCap) e += ((total.sodium - sodiumCap) / Math.max(1, sodiumCap)) * 2;
  if (total.sugar > sugarCap) e += ((total.sugar - sugarCap) / Math.max(1, sugarCap)) * 1.5;
  return e;
}

const sum = (opts: Option[]) =>
  opts.reduce(
    (a, o) => {
      const s = scaled(o);
      return {
        kcal: a.kcal + s.kcal, protein: a.protein + s.protein, carbs: a.carbs + s.carbs,
        fat: a.fat + s.fat, sodium: a.sodium + s.sodium, sugar: a.sugar + s.sugar,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, sugar: 0 }
  );

/**
 * จัดมื้อหลัก 1 วัน
 * @param recentFoodIds เมนูที่เพิ่งได้ไปใน ROTATION_DAYS วันก่อนหน้า (กันซ้ำ)
 * คืน null เมื่อเมนูที่ "กินได้จริง" เหลือไม่ถึง 3 อย่าง → ผู้เรียกต้อง fallback
 */
export function pickMainMeals(opts: {
  memberId: string;
  dayKey: string; // YYYY-MM-DD (BKK)
  foods: PickableFood[];
  target: MacroTarget;
  avoidKeywords: string[];
  recentFoodIds?: Set<string>;
}): PickResult | null {
  const { memberId, dayKey, foods, target, avoidKeywords } = opts;
  const recent = opts.recentFoodIds ?? new Set<string>();

  // ① ตัดเมนูที่ขัดข้อห้ามออกก่อนเสมอ (ความปลอดภัยมาก่อนความหลากหลาย)
  const safe = foods.filter((f) => foodAvoidHit(f, avoidKeywords) === null);
  if (safe.length < MAIN_SLOTS.length) return null;

  // ② กันซ้ำกับวันก่อน ๆ — แต่ถ้าตัดแล้วเหลือไม่พอ ให้ยอมซ้ำดีกว่าไม่มีแผน
  let pool = safe.filter((f) => !recent.has(f.id));
  if (pool.length < MAIN_SLOTS.length) pool = safe;

  // ③ ลำดับ deterministic ต่อ (member, วัน) → วันใหม่ได้ชุดใหม่ เรียกซ้ำวันเดิมได้ชุดเดิม
  const ordered = [...pool].sort((a, b) =>
    dailyRank(memberId, dayKey, a.id).localeCompare(dailyRank(memberId, dayKey, b.id))
  );
  const candidates = ordered.slice(0, CANDIDATE_LIMIT);
  const options: Option[] = candidates.flatMap((food) =>
    SERVING_OPTIONS.map((servings) => ({ food, servings }))
  );

  // ④ เลือกทีละมื้อให้เข้าเป้าสะสม (greedy) — ห้ามเมนูซ้ำกันภายในวันเดียว
  const chosen: Option[] = [];
  const usedIds = new Set<string>();
  let cumRatio = 0;
  for (const slot of MAIN_SLOTS) {
    cumRatio += SLOT_RATIO[slot];
    const stageTarget: MacroTarget = {
      targetKcal: (target.targetKcal * cumRatio) / MAIN_RATIO,
      protein: (target.protein * cumRatio) / MAIN_RATIO,
      carbs: (target.carbs * cumRatio) / MAIN_RATIO,
      fat: (target.fat * cumRatio) / MAIN_RATIO,
      sodium: (target.sodium * cumRatio) / MAIN_RATIO,
      sugar: (target.sugar * cumRatio) / MAIN_RATIO,
    };
    let best: Option | null = null;
    let bestErr = Infinity;
    for (const o of options) {
      if (usedIds.has(o.food.id)) continue;
      const err = errorOf(sum([...chosen, o]), stageTarget);
      if (err < bestErr) { bestErr = err; best = o; }
    }
    if (!best) return null;
    chosen.push(best);
    usedIds.add(best.food.id);
  }

  // ⑤ รอบขัดเกลา: ลองสลับทีละมื้อ ถ้าลด error รวมได้ก็เอา (จบเร็ว ไม่วนไม่รู้จบ)
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let i = 0; i < chosen.length; i++) {
      const cur = chosen[i];
      let bestErr = errorOf(sum(chosen), target);
      let bestOpt: Option | null = null;
      for (const o of options) {
        if (o.food.id !== cur.food.id && usedIds.has(o.food.id)) continue;
        const trial = [...chosen];
        trial[i] = o;
        const err = errorOf(sum(trial), target);
        if (err < bestErr - 1e-9) { bestErr = err; bestOpt = o; }
      }
      if (bestOpt) {
        usedIds.delete(cur.food.id);
        usedIds.add(bestOpt.food.id);
        chosen[i] = bestOpt;
        improved = true;
      }
    }
    if (!improved) break;
  }

  const totals = sum(chosen);
  const dev = (got: number, want: number) => (want > 0 ? (got - want) / want : 0);
  const fit = {
    kcal: dev(totals.kcal, target.targetKcal * MAIN_RATIO),
    protein: dev(totals.protein, target.protein * MAIN_RATIO),
    carbs: dev(totals.carbs, target.carbs * MAIN_RATIO),
    fat: dev(totals.fat, target.fat * MAIN_RATIO),
  };
  const ok = Object.values(fit).every((v) => Math.abs(v) <= FIT_TOLERANCE);

  const meals: PickedMeal[] = chosen.map((o, i) => {
    const s = scaled(o);
    const slot = MAIN_SLOTS[i];
    return {
      slot,
      // บอกจำนวนกล่องตรง ๆ ถ้ามากกว่า 1 — user ต้องรู้ว่าสั่งกี่กล่อง
      menu: o.servings > 1 ? `${o.food.name} (${o.servings} กล่อง)` : o.food.name,
      ingredients: (o.food.ingredients || []).join(", ") || undefined,
      kcal: Math.round(s.kcal),
      protein: Math.round(s.protein),
      carbs: Math.round(s.carbs),
      fat: Math.round(s.fat),
      sodium: o.food.sodium != null ? Math.round(s.sodium) : undefined,
      sugar: o.food.sugar != null ? Math.round(s.sugar) : undefined,
      source: "goodfood",
      foodId: o.food.id,
      price: Math.round(effectivePrice(o.food) * o.servings * 100) / 100,
      imageUrl: o.food.imageUrl,
      servings: o.servings,
    };
  });

  return {
    meals,
    fit,
    ok,
    foodIds: chosen.map((o) => o.food.id),
    totalPrice: Math.round(meals.reduce((a, m) => a + m.price, 0) * 100) / 100,
  };
}

/** เมนู goodfood ที่สมาชิกเพิ่งได้ไปใน N วันก่อนหน้า `before` — ใช้กันซ้ำ */
export async function recentGoodfoodFoodIds(
  memberId: string,
  before: Date,
  days = ROTATION_DAYS
): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const plans = await prisma.dailyPlan.findMany({
      where: { memberId, date: { gte: new Date(before.getTime() - days * 86400_000), lt: before } },
      select: { mealPlan: true },
    });
    for (const p of plans) {
      const meals = (p.mealPlan as { meals?: Array<{ foodId?: string }> } | null)?.meals ?? [];
      for (const m of meals) if (m?.foodId) out.add(m.foodId);
    }
  } catch {
    // อ่านไม่ได้ = ไม่กันซ้ำ ดีกว่าทำแผนไม่ได้
  }
  return out;
}
