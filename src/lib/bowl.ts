/**
 * ชามจัดเอง (poke bowl) — ตัวกลางระหว่างคลังวัตถุดิบกับจอสั่งอาหารในแอป
 *
 * 🔴 คลังวัตถุดิบเก็บโภชนาการ "ต่อ 100 ก./มล." เสมอ (ดู src/app/api/ingredients/route.ts)
 *    แต่ลูกค้าสั่งเป็น "ที่" (portion) — การแปลงต้องผ่าน perPortion() ที่เดียวเท่านั้น
 *    ห้ามคูณเองในหน้าใด ๆ ไม่งั้นราคา/แคลอรี่ในแอปกับในครัวจะเพี้ยนคนละทาง
 *
 * 🔴 เพดานของแต่ละขั้นนับเป็น "จำนวนที่รวม" ไม่ใช่จำนวนชนิด
 *    PROTEIN 2 ที่ = แซลมอน 2 ที่ ก็ได้ หรือ แซลมอน 1 + ไก่ 1 ก็ได้
 */

export type BowlStepKey = "base" | "protein" | "veggies" | "toppings" | "sauce" | "finish";

export type BowlStepDef = {
  key: BowlStepKey;
  no: number;
  title: string; // ที่โชว์ในแอป (อังกฤษตามเมนูร้าน)
  th: string;
  limit: number; // จำนวน "ที่" สูงสุดในขั้นนี้
  /// true = ต้องเลือกให้ครบ limit ถึงจะไปต่อได้ (ผัก 3 ที่)
  exact?: boolean;
};

export const BOWL_STEPS: BowlStepDef[] = [
  { key: "base", no: 1, title: "BASE", th: "ฐาน", limit: 1 },
  { key: "protein", no: 2, title: "PROTEIN", th: "โปรตีน", limit: 2 },
  { key: "veggies", no: 3, title: "VEGGIES", th: "ผัก", limit: 3, exact: true },
  { key: "toppings", no: 4, title: "TOPPINGS", th: "ท็อปปิ้ง", limit: 2 },
  { key: "sauce", no: 5, title: "SAUCE", th: "ซอส", limit: 1 },
  { key: "finish", no: 6, title: "TOP IT OFF", th: "โรยหน้า", limit: 1 },
];

export const BOWL_STEP_KEYS = BOWL_STEPS.map((s) => s.key);

export const DEFAULT_BOWL_BASE_PRICE = 99;

/** สารก่อภูมิแพ้ที่หลังบ้านติดป้ายได้ — ตรงกับที่ถามไว้ในแบบสอบถามของแอป */
export const ALLERGEN_OPTIONS: { value: string; label: string }[] = [
  { value: "shrimp", label: "กุ้ง" },
  { value: "shellfish", label: "หอย/ปู" },
  { value: "fish", label: "ปลา" },
  { value: "egg", label: "ไข่" },
  { value: "milk", label: "นม" },
  { value: "soy", label: "ถั่วเหลือง" },
  { value: "wheat", label: "แป้งสาลี/กลูเตน" },
  { value: "peanut", label: "ถั่วลิสง" },
  { value: "treenut", label: "ถั่วเปลือกแข็ง" },
  { value: "sesame", label: "งา" },
];

export type IngredientLike = {
  unit: string;
  gramsPerPiece?: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sodium?: number | null;
  sugar?: number | null;
  portionSize?: number | null;
};

export type PortionNutrition = {
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * โภชนาการต่อ 1 ที่ — คิดจากค่าต่อ 100 คูณด้วยปริมาณต่อที่
 * unit = pc: portionSize คือ "จำนวนชิ้น" จึงต้องคูณ gramsPerPiece ก่อน (ไข่ 2 ฟอง = 100 ก.)
 */
export function portionGrams(ing: IngredientLike): number {
  const size = ing.portionSize ?? 0;
  if (!size) return 0;
  if (ing.unit === "pc") return size * (ing.gramsPerPiece ?? 0);
  return size;
}

export function perPortion(ing: IngredientLike): PortionNutrition {
  const grams = portionGrams(ing);
  const k = grams / 100;
  return {
    grams: r1(grams),
    calories: Math.round(ing.calories * k),
    protein: r1(ing.protein * k),
    carbs: r1(ing.carbs * k),
    fat: r1(ing.fat * k),
    fiber: r1((ing.fiber ?? 0) * k),
    sodium: Math.round((ing.sodium ?? 0) * k),
    sugar: r1((ing.sugar ?? 0) * k),
  };
}

/** ป้ายบอกปริมาณต่อที่ที่คนอ่านรู้เรื่อง — "150 ก." / "2 ฟอง" / "30 มล." */
export function portionLabel(ing: IngredientLike): string {
  const size = ing.portionSize ?? 0;
  if (!size) return "—";
  if (ing.unit === "pc") {
    const g = portionGrams(ing);
    return `${size} ชิ้น${g ? ` (${r1(g)} ก.)` : ""}`;
  }
  return `${r1(size)} ${ing.unit === "ml" ? "มล." : "ก."}`;
}

export type BowlPick = { ingredientId: string; qty: number };

export type BowlLine = BowlPick & {
  step: BowlStepKey;
  name: string;
  unitPrice: number;
  nutrition: PortionNutrition;
};

/**
 * รวมราคา + โภชนาการของชาม — ใช้ทั้งตอนแสดงในแอปและตอนสร้างออเดอร์
 * ราคาฐานคลุม base/ผัก/ซอส/โรยหน้าไว้แล้ว ตัวที่บวกเพิ่มคือ portionPrice ของแต่ละที่
 */
export function bowlTotals(lines: BowlLine[], basePrice: number) {
  const t = {
    price: basePrice,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    sugar: 0,
    portions: 0,
  };
  for (const l of lines) {
    t.price += l.unitPrice * l.qty;
    t.calories += l.nutrition.calories * l.qty;
    t.protein += l.nutrition.protein * l.qty;
    t.carbs += l.nutrition.carbs * l.qty;
    t.fat += l.nutrition.fat * l.qty;
    t.fiber += l.nutrition.fiber * l.qty;
    t.sodium += l.nutrition.sodium * l.qty;
    t.sugar += l.nutrition.sugar * l.qty;
    t.portions += l.qty;
  }
  return {
    ...t,
    protein: r1(t.protein),
    carbs: r1(t.carbs),
    fat: r1(t.fat),
    fiber: r1(t.fiber),
    sugar: r1(t.sugar),
  };
}

/** เพดานจริงของแต่ละขั้น — เอาค่าที่หลังบ้านตั้งไว้ทับค่าเริ่มต้นถ้ามี */
export function resolveStepLimits(raw: unknown): BowlStepDef[] {
  const override = (raw ?? {}) as Record<string, unknown>;
  return BOWL_STEPS.map((s) => {
    const v = override[s.key];
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 && n <= 9 ? { ...s, limit: n } : s;
  });
}

/** ตรวจว่าที่ลูกค้าเลือกมาไม่เกินเพดาน — คืนข้อความไทยที่บอกตรง ๆ ว่าขั้นไหนเกิน */
export function validatePicks(
  picksByStep: Record<string, number>,
  steps: BowlStepDef[] = BOWL_STEPS,
): string | null {
  for (const s of steps) {
    const used = picksByStep[s.key] ?? 0;
    if (used > s.limit) return `${s.title} เลือกได้ไม่เกิน ${s.limit} ที่ (ตอนนี้ ${used} ที่)`;
    if (s.exact && used > 0 && used !== s.limit) return `${s.title} ต้องเลือกให้ครบ ${s.limit} ที่`;
  }
  return null;
}
