/**
 * เทส "กล่องนี้ลูกค้าได้จริงเท่าไร" ที่แอปเอาไปโชว์ — รัน: npx tsx scripts/test-served.ts
 *
 * ทำไมต้องมี: ตัวเลขจากไฟล์นี้คือสิ่งที่ลูกค้าอ่านในแอปแล้วเชื่อ
 * ถ้าโชว์โภชนาการของ "กล่องมาตรฐาน" ทั้งที่ครัวตักไซต์ XL ให้ ตัวเลขบนจอจะไม่ตรงกับของในกล่อง
 * — นั่นคือที่มาของคำถาม "ทำไมเป้า 694 แต่กล่องเขียน 550"
 */
import { MealTarget, servedFor } from "../src/lib/program";
import { IngredientNutrition, RecipeLine } from "../src/lib/recipe";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const target = (kcal: number, protein: number): MealTarget => ({
  slot: "กลางวัน",
  share: 0.39,
  kcal,
  protein,
  carbs: Math.round((kcal * 0.45) / 4),
  fat: Math.round((kcal * 0.28) / 9),
  fiber: Math.round((kcal / 1000) * 14),
  sodiumMax: Math.round(kcal * 1.29),
  sugarMax: Math.round(kcal * 0.027),
});

const ING: Record<string, IngredientNutrition> = {
  chicken: { id: "c", name: "อกไก่ย่าง", unit: "g", calories: 180, protein: 32, carbs: 0, fat: 4, fiber: 0, sodium: 70, sugar: 0, stepGrams: 10 },
  rice: { id: "r", name: "ข้าวกล้อง", unit: "g", calories: 125, protein: 2.9, carbs: 26, fat: 1, fiber: 1.6, sodium: 3, sugar: 0.4, stepGrams: 10 },
  broc: { id: "b", name: "บรอกโคลีลวก", unit: "g", calories: 35, protein: 2.4, carbs: 7, fat: 0.4, fiber: 3.3, sodium: 30, sugar: 1.4, stepGrams: 10 },
};
const row = (ing: IngredientNutrition, role: RecipeLine["role"], baseAmount: number) => ({
  ingredient: ing,
  role,
  baseAmount,
  scalable: true,
  minAmount: null,
  maxAmount: null,
  note: null,
});
const RECIPE = [row(ING.chicken, "protein", 100), row(ING.rice, "carb", 120), row(ING.broc, "veg", 80)];
const BASE = { calories: 550, protein: 22, carbs: 84, fat: 14, fiber: 6, sodium: 700, sugar: 8 };

// ── 1. มีสูตร = ปรับรายวัตถุดิบจนเข้าเป้า ──
const t694 = target(694, 49);
const byRecipe = servedFor(RECIPE, t694, BASE)!;
check("มีสูตร → source=recipe", byRecipe.source === "recipe", byRecipe.source);
check("มีสูตร → พลังงานเข้าเป้า (คลาด ≤10%)", Math.abs(byRecipe.gapKcal) <= 69, `ได้ ${byRecipe.kcal} เป้า 694`);
check("มีสูตร → onTarget", byRecipe.onTarget, `gapKcal ${byRecipe.gapKcal} · gapProtein ${byRecipe.gapProtein}`);
check("เข้าเป้าแล้วไม่ต้องมีข้อความอธิบาย", byRecipe.note === null, String(byRecipe.note));

// ── 2. ไม่มีสูตร = ครัวตักตามไซต์ → ต้องคูณ scale ไม่ใช่โชว์กล่องมาตรฐานดิบ ──
const bySize = servedFor(null, t694, BASE)!;
check("ไม่มีสูตร → source=size", bySize.source === "size", bySize.source);
check("ไม่มีสูตร → ได้ไซต์ที่ใหญ่กว่า M", bySize.sizeLabel !== null && bySize.sizeLabel !== "M", String(bySize.sizeLabel));
check(
  "ไม่มีสูตร → ตัวเลขต้องมากกว่ากล่องมาตรฐาน (ไม่ใช่ 550 ดิบ)",
  bySize.kcal > BASE.calories,
  `ได้ ${bySize.kcal} · กล่องมาตรฐาน ${BASE.calories}`,
);
check("ไม่มีสูตร → โปรตีนคูณ scale เดียวกัน", bySize.protein > BASE.protein, `${bySize.protein} > ${BASE.protein}`);
check("gapKcal = ได้จริง − เป้า", bySize.gapKcal === bySize.kcal - t694.kcal, `${bySize.gapKcal}`);

// ── 3. เมนูเล็กเกินไป → บอกตามตรง และห้ามโทษลูกค้า ──
const tiny = servedFor(null, target(694, 49), { calories: 200, protein: 8, carbs: 30, fat: 5, fiber: 2, sodium: 200, sugar: 3 })!;
check("เมนูเล็กเกินเป้า → ไม่ onTarget", !tiny.onTarget, `ได้ ${tiny.kcal}`);
check("เมนูเล็กเกินเป้า → มีข้อความบอกลูกค้า", !!tiny.note, String(tiny.note));
check(
  "ข้อความถึงลูกค้าต้องไม่ใช่คำสั่งของครัว",
  !!tiny.note && !tiny.note.includes("ปฏิทิน") && !tiny.note.includes("แก้ที่สูตร") && !tiny.note.includes("⚠️"),
  String(tiny.note),
);

// ── 4. เมนูใหญ่เกินเป้า → บอกว่าเหลือไว้ได้ ไม่ใช่เร่งให้กินหมด ──
const big = servedFor(null, target(400, 25), { calories: 900, protein: 40, carbs: 110, fat: 30, fiber: 6, sodium: 900, sugar: 10 })!;
check("เมนูใหญ่เกินเป้า → gap เป็นบวก", big.gapKcal > 0, `${big.gapKcal}`);
check("เมนูใหญ่เกินเป้า → บอกว่าไม่ต้องกินให้หมด", !!big.note && big.note.includes("ไม่ต้องกินให้หมด"), String(big.note));

// ── 5. โปรตีนขาดทั้งที่พลังงานเข้าเป้า = ความจริงที่ต้องบอก (เคสมังสวิรัติ) ──
const lowProtein = servedFor(null, target(600, 45), { calories: 600, protein: 15, carbs: 100, fat: 18, fiber: 8, sodium: 500, sugar: 6 })!;
check("พลังงานเข้าเป้าแต่โปรตีนขาด → ไม่ onTarget", !lowProtein.onTarget, JSON.stringify(lowProtein.gapProtein));
check("บอกวิธีเติมโปรตีนแทนการปล่อยเงียบ", !!lowProtein.note && lowProtein.note.includes("โปรตีน"), String(lowProtein.note));

// ── 6. ไม่มีทั้งสูตรและโภชนาการ → null (ห้ามเดาตัวเลข) ──
check("ไม่มีข้อมูลเลย → null", servedFor(null, t694, null) === null);
check("โภชนาการเป็น 0 → null (ไม่ใช่ 0 kcal)", servedFor(null, t694, { calories: 0, protein: 0, carbs: 0, fat: 0 }) === null);

console.log(failed === 0 ? "\nผ่านครบทุกเคส" : `\nพัง ${failed} เคส`);
process.exit(failed ? 1 : 0);
