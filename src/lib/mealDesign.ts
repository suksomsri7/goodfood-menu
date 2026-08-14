/**
 * ออกแบบมื้ออาหารผูกปิ่นโต 7 / 14 / 30 วัน จากเมนูที่ goodfood ขายจริง
 *
 * ต่อยอดจาก goodfoodMealPicker.ts (ตัวเลือกเมนูรายวัน) — ไฟล์นี้เพิ่ม 3 อย่าง:
 *   1. เอา "แบบสำรวจรสนิยม" (FoodProfile) มาเป็นตัวกรอง/ตัวเลือกจริง
 *   2. จัดหลายวันติดกันโดยกันเมนูซ้ำข้ามวัน
 *   3. เรียนรู้จากการกดเปลี่ยนเมนู (MealSwap) — ของที่ "ไม่ชอบ" ตัดทิ้งถาวร
 *
 * 🔴 ความปลอดภัยมาก่อนความอร่อยเสมอ: ของแพ้ถูกตัดออกก่อนทุกกรณี ไม่มีข้อยกเว้น
 * 🔴 ไม่เรียก AI เลยทั้งไฟล์ — deterministic ล้วน (จัดซ้ำได้ผลเดิม ตรวจสอบย้อนหลังได้)
 */
import { prisma } from "@/lib/prisma";
import {
  MAIN_SLOTS, MAIN_RATIO, ROTATION_DAYS, effectivePrice,
  loadGoodfoodMenu, pickMainMeals, foodAvoidHit,
  type PickableFood, type MacroTarget,
} from "@/lib/goodfoodMealPicker";

export const DESIGN_DAYS = [7, 14, 30] as const;
export type DesignDays = (typeof DESIGN_DAYS)[number];

/**
 * จำนวนเมนูขั้นต่ำที่ "จัดได้จริง" กับ "ควรมี"
 *
 * ที่มา: กันเมนูซ้ำเว้น 3 วัน + 3 มื้อหลัก/วัน → เมนู 1 ตัวโผล่ได้ทุก 4 วัน
 * 30 วัน = 90 ช่อง ถ้ามี 12 เมนู แต่ละตัวจะโผล่ 7-8 ครั้งใน 1 เดือน = น่าเบื่อจนเลิก
 * ตัวเลข recommended จึงสูงกว่า minimum พอสมควร
 */
export const MENU_REQUIREMENT: Record<number, { min: number; recommended: number }> = {
  7: { min: 12, recommended: 15 },
  14: { min: 15, recommended: 20 },
  30: { min: 18, recommended: 25 },
};

export type FoodProfileLike = {
  allergies: string[];
  avoidMeats: string[];
  spiceLevel: number;
  eatsVegetables: boolean;
  dislikedVeggies: string[];
  tastePref: string | null;
  cuisines: string[];
  mealSlots: string[];
  healthConditions: string[];
  budgetPerDay: number | null;
};

/** ค่าเริ่มต้นตอนยังไม่ได้ทำแบบสำรวจ — ไม่กรองอะไรเลย ยกเว้นมื้อมาตรฐาน 3 มื้อ */
export const DEFAULT_PROFILE: FoodProfileLike = {
  allergies: [], avoidMeats: [], spiceLevel: 1, eatsVegetables: true,
  dislikedVeggies: [], tastePref: null, cuisines: [],
  mealSlots: ["เช้า", "กลางวัน", "เย็น"], healthConditions: [], budgetPerDay: null,
};

/** คำที่บอกว่าเมนูนี้เผ็ด — ไล่จากเผ็ดจัดไปเผ็ดกลาง */
const SPICY_STRONG = ["เผ็ดมาก", "แกงป่า", "น้ำตก", "ลาบ", "พริกแกง", "ผัดพริกขี้หนู", "ยำ"];
const SPICY_MILD = ["เผ็ด", "พริก", "ต้มยำ", "ส้มตำ", "แกงเขียวหวาน", "แกงเผ็ด", "ผัดกะเพรา"];

/** เนื้อสัตว์ → คำที่ต้องเลี่ยงในชื่อ/ส่วนผสม */
const MEAT_TERMS: Record<string, string[]> = {
  หมู: ["หมู", "สามชั้น", "คอหมู", "หมูสับ", "เบคอน", "แฮม", "ไส้กรอก"],
  วัว: ["เนื้อวัว", "เนื้อ", "สเต๊ก", "บีฟ"],
  ไก่: ["ไก่", "อกไก่", "น่องไก่", "สะโพกไก่"],
  ทะเล: ["กุ้ง", "ปลาหมึก", "หอย", "ปู", "ทะเล", "แซลมอน", "ปลาทู", "ปลา"],
  ไม่กินเนื้อสัตว์: ["หมู", "ไก่", "เนื้อ", "กุ้ง", "ปลา", "หอย", "ปู", "ปลาหมึก", "เบคอน", "ไส้กรอก"],
};

/**
 * รวมคำต้องห้ามทั้งหมดจากแบบสำรวจ
 * 🔴 ของแพ้มาก่อน — ไม่ว่าจะทำให้เมนูเหลือน้อยแค่ไหนก็ต้องตัด
 */
export function profileAvoidKeywords(p: FoodProfileLike): string[] {
  const out = new Set<string>();
  for (const a of p.allergies) {
    const t = a.trim();
    if (t) out.add(t);
  }
  for (const m of p.avoidMeats) {
    for (const t of MEAT_TERMS[m] ?? [m]) out.add(t);
  }
  for (const v of p.dislikedVeggies) {
    const t = v.trim();
    if (t) out.add(t);
  }
  if (p.spiceLevel <= 0) {
    for (const t of [...SPICY_STRONG, ...SPICY_MILD]) out.add(t);
  } else if (p.spiceLevel === 1) {
    for (const t of SPICY_STRONG) out.add(t);
  }
  return [...out];
}

/**
 * ปรับเป้าโภชนาการตามโรคประจำตัว
 * ตัวเลขอ้างอิงคำแนะนำทั่วไป (ไม่ใช่การรักษา) — บีบเพดาน ไม่ได้แตะแคลอรี่/โปรตีน
 */
export function adjustTargetForHealth(target: MacroTarget, conditions: string[]): MacroTarget {
  let sodium = target.sodium;
  let sugar = target.sugar;
  if (conditions.includes("ความดัน") || conditions.includes("ไต")) sodium = Math.round(sodium * 0.7);
  if (conditions.includes("เบาหวาน")) sugar = Math.round(sugar * 0.6);
  if (conditions.includes("ไขมันในเลือด")) sugar = Math.round(sugar * 0.8);
  return { ...target, sodium, sugar };
}

const blob = (f: PickableFood) =>
  [f.name, f.description ?? "", ...(f.ingredients ?? [])].join(" ").toLowerCase();

/**
 * คัดเมนูที่ "กินได้จริง" สำหรับคนนี้
 *
 * ลำดับความสำคัญ:
 *   1. ตัดของแพ้/ของต้องห้าม (ห้ามต่อรอง)
 *   2. ตัดเมนูที่เคยกด "ไม่ชอบ" (dislike) — เบื่อ/อยากลองอย่างอื่น ไม่ตัด
 *   3. ถ้าเลือกประเภทอาหารไว้และเมนูที่ตรงมีมากพอ → ใช้เฉพาะที่ตรง
 *      ไม่พอ = ใช้ทั้งหมด (ความชอบเป็น "ถ้าได้ก็ดี" ไม่ใช่เงื่อนไขบังคับ)
 */
export function filterFoodsForProfile(opts: {
  foods: PickableFood[];
  profile: FoodProfileLike;
  dislikedFoodIds: Set<string>;
  needAtLeast: number;
}): { foods: PickableFood[]; droppedAvoid: number; droppedDisliked: number; cuisineNarrowed: boolean } {
  const { foods, profile, dislikedFoodIds, needAtLeast } = opts;
  const avoid = profileAvoidKeywords(profile);

  const safe = foods.filter((f) => foodAvoidHit(f, avoid) === null);
  const droppedAvoid = foods.length - safe.length;

  let liked = safe.filter((f) => !dislikedFoodIds.has(f.id));
  const droppedDisliked = safe.length - liked.length;
  // ตัดของไม่ชอบแล้วเหลือน้อยเกินจัดแผน → ยอมใส่กลับ ดีกว่าไม่มีแผนให้เลย
  if (liked.length < needAtLeast) liked = safe;

  let cuisineNarrowed = false;
  if (profile.cuisines.length > 0) {
    const terms = profile.cuisines.map((c) => c.toLowerCase());
    const match = liked.filter((f) => terms.some((t) => blob(f).includes(t)));
    if (match.length >= needAtLeast) {
      liked = match;
      cuisineNarrowed = true;
    }
  }
  return { foods: liked, droppedAvoid, droppedDisliked, cuisineNarrowed };
}

export type DesignItemDraft = {
  dayNumber: number;
  slot: string;
  foodId: string;
  foodName: string;
  imageUrl: string | null;
  price: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
};

export type DesignResult = {
  items: DesignItemDraft[];
  totalPrice: number;
  offTargetDays: number;
  warnings: string[];
};

/**
 * เมนูนี้เหมาะกับมื้อไหน — ตัดสินจากหมวดสินค้าที่แอดมินตั้งไว้
 *
 * 🔴 ถ้าไม่มีกติกานี้ ระบบจะเลือกด้วย "ตัวเลขมาโคร" ล้วน แล้วได้ผลแบบที่เจอตอนเทสจริง:
 *    โยเกิร์ต 2 กล่องเป็นมื้อเช้า 590 kcal · ข้าวหน้าปลาเป็นมื้อเช้า · มันหวาน 2 กล่องเป็นมื้อเย็น
 *    ตัวเลขเข้าเป้าหมดแต่ไม่มีใครกินแบบนั้นจริง
 */
export function slotAllowsFood(slot: string, food: PickableFood): boolean {
  const cat = food.categorySlug ?? null;
  if (cat === "snack") return slot === "ว่าง";        // ของว่างลงได้เฉพาะมื้อว่าง
  if (cat === "breakfast") return slot === "เช้า";    // เมนูมื้อเช้าลงได้เฉพาะเช้า
  // จานเดียว / โปรตีนสูง / มังสวิรัติ = มื้อหลักกลางวัน-เย็น (เช้าก็ได้ถ้าไม่มีตัวเลือกอื่น)
  return slot !== "ว่าง";
}

/** ของว่าง: หมวด snack ก่อน ถ้าไม่มีค่อยหาเมนูเบา ๆ แทน */
function pickSnack(foods: PickableFood[], targetKcal: number, used: Set<string>): PickableFood | null {
  const want = targetKcal * 0.1;
  const cap = Math.max(120, Math.round(targetKcal * 0.15));
  const near = (a: PickableFood, b: PickableFood) => Math.abs(a.calories - want) - Math.abs(b.calories - want);
  const all = foods.filter((f) => f.calories > 0);
  const free = all.filter((f) => !used.has(f.id));
  const freeSnacks = free.filter((f) => f.categorySlug === "snack").sort(near);
  if (freeSnacks.length) return freeSnacks[0];
  // ของว่างมีน้อย (ร้านส่วนใหญ่มี 2-3 อย่าง) → ยอมให้ซ้ำดีกว่าเอากล่องมื้อเช้ามาเป็นของว่าง
  const anySnack = all.filter((f) => f.categorySlug === "snack").sort(near);
  if (anySnack.length) return anySnack[0];
  return free.filter((f) => f.calories <= cap).sort(near)[0] ?? null;
}

/**
 * จัดแผน N วัน
 *
 * ⚠️ คืน warnings เสมอเมื่อเมนูน้อยกว่าที่ควรมี — ต้องเอาไปโชว์ user ตรง ๆ
 *    ไม่ใช่จัดให้แล้วเงียบ ปล่อยให้ไปเจอเมนูซ้ำเองตอนกินจริง
 */
export function buildDesign(opts: {
  memberId: string;
  days: number;
  foods: PickableFood[];
  target: MacroTarget;
  profile: FoodProfileLike;
  startDate?: Date;
}): DesignResult {
  const { memberId, days, foods, target, profile } = opts;
  const start = opts.startDate ?? new Date();
  const wantSnack = profile.mealSlots.includes("ว่าง");
  const avoid = profileAvoidKeywords(profile);

  const items: DesignItemDraft[] = [];
  const warnings: string[] = [];
  let offTargetDays = 0;
  let totalPrice = 0;

  // เมนูที่ใช้ไปแล้วในกี่วันล่าสุด — กันซ้ำติดกัน
  const usedByDay: string[][] = [];

  for (let d = 1; d <= days; d++) {
    const dayDate = new Date(start.getTime() + (d - 1) * 86400_000);
    const dayKey = new Date(dayDate.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const recent = new Set(usedByDay.slice(-ROTATION_DAYS).flat());

    const picked = pickMainMeals({
      memberId,
      dayKey,
      foods,
      target,
      avoidKeywords: avoid,
      recentFoodIds: recent,
      mainShare: wantSnack ? MAIN_RATIO : 1,
      slotAllows: slotAllowsFood,
    });
    if (!picked) {
      warnings.push(`วันที่ ${d} จัดไม่ได้ — เมนูที่กินได้เหลือน้อยเกินไป`);
      usedByDay.push([]);
      continue;
    }
    if (!picked.ok) offTargetDays++;

    const todays: string[] = [];
    for (const m of picked.meals) {
      items.push({
        dayNumber: d, slot: m.slot,
        foodId: m.foodId, foodName: m.menu, imageUrl: m.imageUrl,
        price: m.price, servings: m.servings,
        calories: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
        sodium: m.sodium ?? null, sugar: m.sugar ?? null,
      });
      totalPrice += m.price;
      todays.push(m.foodId);
    }

    if (wantSnack) {
      const snack = pickSnack(
        foods.filter((f) => foodAvoidHit(f, avoid) === null),
        target.targetKcal,
        new Set([...recent, ...todays])
      );
      if (snack) {
        const price = effectivePrice(snack);
        items.push({
          dayNumber: d, slot: "ว่าง",
          foodId: snack.id, foodName: snack.name, imageUrl: snack.imageUrl,
          price, servings: 1,
          calories: snack.calories, protein: snack.protein, carbs: snack.carbs, fat: snack.fat,
          sodium: snack.sodium, sugar: snack.sugar,
        });
        totalPrice += price;
        todays.push(snack.id);
      }
    }
    usedByDay.push(todays);
  }

  const req = MENU_REQUIREMENT[days];
  if (req && foods.length < req.recommended) {
    warnings.push(
      `ตอนนี้มีเมนูให้เลือก ${foods.length} อย่าง — แพ็กเกจ ${days} วันควรมีอย่างน้อย ${req.recommended} อย่าง จะได้ไม่เจอเมนูซ้ำบ่อย`
    );
  }
  if (offTargetDays > 0) {
    warnings.push(`มี ${offTargetDays} วันที่สารอาหารยังไม่เข้าเกณฑ์ ±15% — กดเปลี่ยนเมนูปรับได้`);
  }
  return { items, totalPrice: Math.round(totalPrice), offTargetDays, warnings };
}

/** เมนูที่สมาชิกคนนี้เคยกด "ไม่ชอบ" (เบื่อ/อยากลองอย่างอื่น ไม่นับ) */
export async function dislikedFoodIds(memberId: string): Promise<Set<string>> {
  const rows = await prisma.mealSwap.findMany({
    where: { memberId, reason: "dislike" },
    select: { fromFoodId: true },
  });
  return new Set(rows.map((r) => r.fromFoodId));
}

/** โปรไฟล์รสนิยม (ยังไม่ได้ทำแบบสำรวจ = ค่าเริ่มต้น) */
export async function loadFoodProfile(memberId: string): Promise<FoodProfileLike> {
  const row = await prisma.foodProfile.findUnique({ where: { memberId } });
  if (!row) return DEFAULT_PROFILE;
  return {
    allergies: row.allergies, avoidMeats: row.avoidMeats, spiceLevel: row.spiceLevel,
    eatsVegetables: row.eatsVegetables, dislikedVeggies: row.dislikedVeggies,
    tastePref: row.tastePref, cuisines: row.cuisines,
    mealSlots: row.mealSlots.length ? row.mealSlots : DEFAULT_PROFILE.mealSlots,
    healthConditions: row.healthConditions, budgetPerDay: row.budgetPerDay,
  };
}

/** เมนูพร้อมขายตอนนี้ + เช็คว่าพอสำหรับแพ็กเกจกี่วัน */
export async function menuAvailability() {
  const foods = await loadGoodfoodMenu();
  const packages = DESIGN_DAYS.map((d) => ({
    days: d,
    ...MENU_REQUIREMENT[d],
    available: foods.length >= MENU_REQUIREMENT[d].min,
  }));
  return { foods, count: foods.length, packages };
}

export { MAIN_SLOTS };
