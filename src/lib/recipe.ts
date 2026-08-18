/**
 * สูตรมาตรฐาน → จานเฉพาะบุคคล
 *
 * 🔑 หลักคิดที่ต่างจากของเดิม (`portionFor` ใน program.ts):
 *    ของเดิมคูณ "ทั้งกล่อง" ด้วย S/M/L/XL — ตัวเลขรวมจึงเข้าเป้าได้ทีละตัวเท่านั้น
 *    ตัวนี้ปรับ "รายวัตถุดิบ" โดยให้แต่ละบทบาทรับผิดชอบมาโครที่ตัวเองครองอยู่
 *      โปรตีน → ไล่โปรตีน · ไขมัน/ซอส → ไล่ไขมัน · ผัก → ไล่ไฟเบอร์ · คาร์บ → รับพลังงานที่เหลือ
 *    ผลลัพธ์ที่ครัวอ่านคือ "อกไก่ 100 → 190 ก." ไม่ใช่ "XL"
 *
 * 🔴 คาร์บต้องปรับเป็นตัวสุดท้ายเสมอ — มันคือตัวปิดยอดพลังงาน ถ้าปรับก่อนตัวอื่นจะพังทุกครั้ง
 * 🔴 ตัวเลขที่รายงานต้องคิดจาก "กรัมที่ปัดแล้ว" ไม่ใช่กรัมในอุดมคติ
 *    ครัวชั่งได้ทีละ 5-10 ก. ถ้ารายงานค่าก่อนปัด ตัวเลขบนกระดาษจะไม่ตรงกับของในกล่อง
 */

// ─────────────────────────── บทบาทของวัตถุดิบ ───────────────────────────

export const ROLES = ["protein", "carb", "veg", "fat", "other"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  protein: "โปรตีน",
  carb: "คาร์บ",
  veg: "ผัก",
  fat: "ไขมัน/ซอส",
  other: "อื่น ๆ",
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

// ─────────────────────────── ชนิดข้อมูล ───────────────────────────

/** โภชนาการต่อ 100 ก. (หรือ 100 มล.) — หน่วยเดียวทั้งไฟล์นี้ */
export interface IngredientNutrition {
  id: string;
  name: string;
  unit: string;
  gramsPerPiece?: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sodium?: number | null;
  sugar?: number | null;
  stepGrams: number;
}

export interface RecipeLine {
  ingredient: IngredientNutrition;
  role: Role;
  /** ปริมาณมาตรฐานต่อกล่อง — หน่วยตาม ingredient.unit (pc = จำนวนชิ้น) */
  baseAmount: number;
  scalable: boolean;
  minAmount?: number | null;
  maxAmount?: number | null;
  note?: string | null;
}

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
}

const ZERO: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };

/** ขอบเขตที่ยอมให้ปรับเมื่อครัวไม่ได้กำหนดเอง — กันสูตรเพี้ยนจนกลายเป็นคนละเมนู */
const DEFAULT_MIN_FACTOR = 0.5;
const DEFAULT_MAX_FACTOR = 2.5;

// ─────────────────────────── คิดโภชนาการ ───────────────────────────

/** ปริมาณในหน่วยของสูตร → กรัมจริง (ชิ้น/ฟอง ต้องมีน้ำหนักต่อชิ้น ไม่งั้นคิดไม่ได้) */
export function toGrams(line: { ingredient: IngredientNutrition }, amount: number): number {
  const g = line.ingredient.gramsPerPiece;
  return line.ingredient.unit === "pc" ? amount * (g && g > 0 ? g : 0) : amount;
}

/** โภชนาการของวัตถุดิบหนึ่งอย่างที่ปริมาณหนึ่ง ๆ */
export function nutritionOf(line: RecipeLine, amount: number): Nutrition {
  const grams = toGrams(line, amount);
  const k = grams / 100;
  const i = line.ingredient;
  return {
    kcal: i.calories * k,
    protein: i.protein * k,
    carbs: i.carbs * k,
    fat: i.fat * k,
    fiber: (i.fiber ?? 0) * k,
    sodium: (i.sodium ?? 0) * k,
    sugar: (i.sugar ?? 0) * k,
  };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sodium: a.sodium + b.sodium,
    sugar: a.sugar + b.sugar,
  };
}

export function roundNutrition(n: Nutrition): Nutrition {
  return {
    kcal: Math.round(n.kcal),
    protein: Math.round(n.protein * 10) / 10,
    carbs: Math.round(n.carbs * 10) / 10,
    fat: Math.round(n.fat * 10) / 10,
    fiber: Math.round(n.fiber * 10) / 10,
    sodium: Math.round(n.sodium),
    sugar: Math.round(n.sugar * 10) / 10,
  };
}

/** โภชนาการของกล่องมาตรฐาน = ผลรวมของสูตร — นี่คือตัวเลขที่ควรโชว์แทนค่าที่กรอกมือ */
export function recipeNutrition(lines: RecipeLine[]): Nutrition {
  return roundNutrition(lines.reduce((acc, l) => addNutrition(acc, nutritionOf(l, l.baseAmount)), ZERO));
}

// ─────────────────────────── ปรับเฉพาะบุคคล ───────────────────────────

export interface MacroTarget {
  kcal: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export interface PersonalLine {
  ingredientId: string;
  name: string;
  role: Role;
  unit: string;
  /** ปริมาณมาตรฐานของสูตร */
  baseAmount: number;
  /** ปริมาณที่คนนี้ต้องได้ — ปัดตามที่ครัวชั่งได้แล้ว */
  amount: number;
  /** amount − baseAmount (บวก = เพิ่ม, ลบ = ลด, 0 = เท่าเดิม) */
  delta: number;
  /** เหตุผลที่ไม่ปรับ — null = ปรับได้ตามปกติ */
  lockedReason: string | null;
  /** ชนขอบเขตที่ครัวกำหนด (ปรับได้ไม่สุดเท่าที่ควร) */
  clamped: boolean;
  note: string | null;
}

export interface PersonalPlan {
  lines: PersonalLine[];
  /** โภชนาการที่ลูกค้าได้จริงจากกรัมที่ปัดแล้ว */
  delivered: Nutrition;
  target: MacroTarget;
  /** ส่วนต่าง delivered − target (บวก = เกิน) */
  gap: { kcal: number; protein: number };
  /** คำเตือนที่ต้องขึ้นให้ครัวเห็น — ว่าง = จานนี้เข้าเป้า */
  warnings: string[];
}

interface Group {
  role: Role;
  lines: { line: RecipeLine; amount: number }[];
}

/** ปัดปริมาณให้ครัวชั่งได้จริง — ของที่ชั่งทีละ 10 ก. ห้ามสั่ง 187 ก. */
function roundToStep(line: RecipeLine, grams: number): number {
  if (line.ingredient.unit === "pc") return Math.max(1, Math.round(grams));
  const step = Math.max(1, line.ingredient.stepGrams || 10);
  return Math.max(step, Math.round(grams / step) * step);
}

function bounds(line: RecipeLine): { min: number; max: number } {
  return {
    min: line.minAmount ?? line.baseAmount * DEFAULT_MIN_FACTOR,
    max: line.maxAmount ?? line.baseAmount * DEFAULT_MAX_FACTOR,
  };
}

/** ปรับกลุ่มหนึ่งให้ผลรวมของ macro ที่กลุ่มนั้นครองอยู่ ไปแตะค่าที่ยังขาด */
function solveGroup(group: Group, macro: keyof Nutrition, want: number) {
  if (group.lines.length === 0) return;
  const atBase = group.lines.reduce((n, g) => n + nutritionOf(g.line, g.line.baseAmount)[macro], 0);
  // กลุ่มนี้ไม่มีมาโครตัวนั้นเลย (เช่นผักไม่มีข้อมูลไฟเบอร์) → ปรับไปก็ไม่ช่วยอะไร ปล่อยไว้
  if (atBase <= 0) return;
  const factor = want / atBase;
  if (!Number.isFinite(factor) || factor <= 0) return;
  for (const g of group.lines) g.amount = g.line.baseAmount * factor;
}

function sumAt(entries: { line: RecipeLine; amount: number }[]): Nutrition {
  return entries.reduce((acc, e) => addNutrition(acc, nutritionOf(e.line, e.amount)), ZERO);
}

/**
 * สูตรมาตรฐาน + เป้าของคนคนนี้ → ต้องตักวัตถุดิบละเท่าไร
 *
 * ลำดับสำคัญมาก: โปรตีน → ไขมัน → ผัก(ไฟเบอร์) → คาร์บ(ปิดยอดพลังงาน)
 * เพราะคาร์บเป็นตัวเดียวที่ยืดหยุ่นได้โดยไม่เสียคุณค่าอย่างอื่น จึงต้องเป็นตัวสุดท้าย
 */
export function personalize(lines: RecipeLine[], target: MacroTarget): PersonalPlan {
  const entries = lines.map((line) => ({ line, amount: line.baseAmount }));
  const scalable = entries.filter((e) => e.line.scalable);
  const fixed = entries.filter((e) => !e.line.scalable);

  const baseTotal = sumAt(entries);

  // ── ขั้น 0: ย่อ/ขยายทุกตัวที่ปรับได้ตามสัดส่วนพลังงานก่อน (user เลือก "ปรับทุกวัตถุดิบ")
  //    ขั้นนี้ทำให้จานยังดูเป็นจานเดิม — ไม่ใช่อกไก่ท่วมจานแต่ข้าวเท่าเดิม
  if (baseTotal.kcal > 0 && target.kcal > 0) {
    const overall = clamp(target.kcal / baseTotal.kcal, DEFAULT_MIN_FACTOR, DEFAULT_MAX_FACTOR);
    for (const e of scalable) e.amount = e.line.baseAmount * overall;
  }

  const groupOf = (role: Role): Group => ({ role, lines: scalable.filter((e) => e.line.role === role) });
  const gProtein = groupOf("protein");
  const gFat = groupOf("fat");
  const gVeg = groupOf("veg");
  const gCarb = groupOf("carb");

  /** มาโครที่มาจากทุกอย่าง "ยกเว้น" กลุ่มที่กำลังจะแก้ — ใช้หาว่ากลุ่มนั้นต้องรับเท่าไร */
  const restOf = (g: Group, macro: keyof Nutrition) => {
    const ids = new Set(g.lines.map((x) => x.line.ingredient.id));
    return sumAt(entries.filter((e) => !ids.has(e.line.ingredient.id)))[macro];
  };

  // ── ขั้น 1: โปรตีนต้องตรงเป้า (คนลดน้ำหนักยอมลดข้าวได้ แต่โปรตีนขาดไม่ได้)
  if (target.protein > 0) solveGroup(gProtein, "protein", target.protein - restOf(gProtein, "protein"));

  // ── ขั้น 2: ไขมัน/ซอส
  if (target.fat != null && target.fat > 0) solveGroup(gFat, "fat", target.fat - restOf(gFat, "fat"));

  // ── ขั้น 3: ผัก ไล่ตามไฟเบอร์ (ไม่มีเป้าไฟเบอร์ = ปล่อยตามสัดส่วนพลังงานจากขั้น 0)
  if (target.fiber != null && target.fiber > 0) solveGroup(gVeg, "fiber", target.fiber - restOf(gVeg, "fiber"));

  // ── ขั้น 4: คาร์บปิดยอดพลังงาน
  if (target.kcal > 0) solveGroup(gCarb, "kcal", target.kcal - restOf(gCarb, "kcal"));

  // ── ปัด + คุมขอบเขต แล้วค่อยคิดว่าลูกค้าได้อะไรจริง ๆ
  const out: PersonalLine[] = entries.map((e) => {
    const { line } = e;
    let amount = e.amount;
    let clamped = false;

    if (line.scalable) {
      const { min, max } = bounds(line);
      if (amount < min) { amount = min; clamped = true; }
      if (amount > max) { amount = max; clamped = true; }
      amount = roundToStep(line, amount);
      // ปัดแล้วอาจหลุดขอบอีกรอบ — ดึงกลับเข้ากรอบด้วยขั้นที่ชั่งได้
      const step = line.ingredient.unit === "pc" ? 1 : Math.max(1, line.ingredient.stepGrams || 10);
      if (amount < min) amount = Math.ceil(min / step) * step;
      if (amount > max) amount = Math.floor(max / step) * step;
    }

    e.amount = amount;
    return {
      ingredientId: line.ingredient.id,
      name: line.ingredient.name,
      role: line.role,
      unit: line.ingredient.unit,
      baseAmount: line.baseAmount,
      amount,
      delta: Math.round((amount - line.baseAmount) * 10) / 10,
      lockedReason: line.scalable ? null : "สูตรกำหนดให้เท่ากันทุกคน",
      clamped,
      note: line.note ?? null,
    };
  });

  const delivered = roundNutrition(sumAt(entries));
  const warnings: string[] = [];

  const kcalGap = delivered.kcal - target.kcal;
  const proteinGap = delivered.protein - target.protein;

  if (target.kcal > 0 && Math.abs(kcalGap) > target.kcal * 0.15) {
    warnings.push(
      kcalGap < 0
        ? `⚠️ สูตรนี้เล็กเกินไปสำหรับเป้า — ตักสุดขอบเขตแล้วยังขาด ${Math.abs(Math.round(kcalGap))} kcal (แก้ที่สูตรหรือเปลี่ยนเมนูในปฏิทิน ไม่ใช่ฝืนตัก)`
        : `⚠️ สูตรนี้ใหญ่เกินเป้า — ลดสุดขอบเขตแล้วยังเกิน ${Math.round(kcalGap)} kcal`,
    );
  }
  if (target.protein > 0 && proteinGap < -Math.max(5, target.protein * 0.1)) {
    warnings.push(`⚠️ โปรตีนขาด ${Math.abs(Math.round(proteinGap))} ก. — วัตถุดิบโปรตีนในสูตรชนเพดานแล้ว`);
  }
  if (fixed.length > 0 && scalable.length === 0) {
    warnings.push("⚠️ สูตรนี้ตั้งเป็นตายตัวทุกบรรทัด — ปรับตามคนไม่ได้เลย");
  }

  return {
    lines: out,
    delivered,
    target,
    gap: { kcal: Math.round(kcalGap), protein: Math.round(proteinGap * 10) / 10 },
    warnings,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ─────────────────────────── แปลงแถวจาก DB ───────────────────────────

export interface RecipeRow {
  role: string;
  baseAmount: number;
  scalable: boolean;
  minAmount: number | null;
  maxAmount: number | null;
  note: string | null;
  ingredient: IngredientNutrition;
}

/** แถว recipe_items → RecipeLine — จุดแปลงจุดเดียวของทั้งระบบ (API สูตร + หน้าครัว ใช้ตัวนี้ร่วมกัน) */
export function rowsToLines(rows: RecipeRow[]): RecipeLine[] {
  return rows.map((r) => ({
    ingredient: r.ingredient,
    role: isRole(r.role) ? r.role : "other",
    baseAmount: r.baseAmount,
    scalable: r.scalable,
    minAmount: r.minAmount,
    maxAmount: r.maxAmount,
    note: r.note,
  }));
}

// ─────────────────────────── สรุปของที่ครัวต้องเตรียม ───────────────────────────

export interface PrepLine {
  ingredientId: string;
  name: string;
  unit: string;
  /** รวมทุกกล่องที่ต้องทำในมื้อนี้ */
  total: number;
  boxes: number;
}

/**
 * รวมวัตถุดิบข้ามลูกค้า → "วันนี้ต้องเตรียมอกไก่กี่กรัม"
 * ครัวซื้อของเป็นกิโล ไม่ได้ซื้อเป็นกล่อง — ถ้าไม่มีแถวรวมนี้ต้องมานั่งบวกเอง
 */
export function prepTotals(plans: PersonalPlan[]): PrepLine[] {
  const by = new Map<string, PrepLine>();
  for (const p of plans) {
    for (const l of p.lines) {
      const cur = by.get(l.ingredientId) ?? { ingredientId: l.ingredientId, name: l.name, unit: l.unit, total: 0, boxes: 0 };
      cur.total += l.amount;
      cur.boxes += 1;
      by.set(l.ingredientId, cur);
    }
  }
  return [...by.values()]
    .map((l) => ({ ...l, total: Math.round(l.total * 10) / 10 }))
    .sort((a, b) => b.total - a.total);
}

/** "1.2 กก." / "850 ก." / "3 ฟอง" — ครัวอ่านแล้วหยิบตะกร้าได้เลย */
export function formatAmount(amount: number, unit: string): string {
  if (unit === "pc") return `${Math.round(amount)} ชิ้น`;
  const u = unit === "ml" ? "มล." : "ก.";
  // ตัดศูนย์ท้ายทิ้ง — "1.20 กก." อ่านเหมือนความละเอียดที่ครัวชั่งไม่ได้จริง
  if (unit !== "ml" && amount >= 1000) return `${parseFloat((amount / 1000).toFixed(2))} กก.`;
  return `${Math.round(amount * 10) / 10} ${u}`;
}
