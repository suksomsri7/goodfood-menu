/**
 * เทสตัวคิดจานเฉพาะบุคคล — รัน: npx tsx scripts/test-recipe.ts
 *
 * ทำไมต้องมี: ตัวเลขจากไฟล์นี้คือสิ่งที่ครัวชั่งจริงลงกล่องจริง
 * ถ้าคิดผิด ลูกค้าได้อาหารผิดโดยไม่มีใครรู้ตัว — เห็นได้แค่ตอนน้ำหนักไม่ลง/ลงเร็วเกิน
 */
import {
  IngredientNutrition,
  RecipeLine,
  formatAmount,
  personalize,
  prepTotals,
  recipeNutrition,
} from "../src/lib/recipe";

// ── วัตถุดิบจริง (ต่อ 100 ก.) ──
const ING: Record<string, IngredientNutrition> = {
  chicken: { id: "c", name: "อกไก่ย่าง", unit: "g", calories: 180, protein: 32, carbs: 0, fat: 4, fiber: 0, sodium: 70, sugar: 0, stepGrams: 10 },
  rice: { id: "r", name: "ข้าวกล้อง", unit: "g", calories: 125, protein: 2.9, carbs: 26, fat: 1, fiber: 1.6, sodium: 3, sugar: 0.4, stepGrams: 10 },
  broc: { id: "b", name: "บรอกโคลีลวก", unit: "g", calories: 35, protein: 2.4, carbs: 7, fat: 0.4, fiber: 3.3, sodium: 30, sugar: 1.4, stepGrams: 10 },
  oil: { id: "o", name: "น้ำมันมะกอก", unit: "g", calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 0, sugar: 0, stepGrams: 5 },
  sauce: { id: "s", name: "ซอสน้ำสลัด", unit: "g", calories: 300, protein: 1, carbs: 10, fat: 28, fiber: 0, sodium: 900, sugar: 8, stepGrams: 5 },
  egg: { id: "e", name: "ไข่ต้ม", unit: "pc", gramsPerPiece: 50, calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sodium: 124, sugar: 1.1, stepGrams: 1 },
};

const line = (
  ing: IngredientNutrition,
  role: RecipeLine["role"],
  baseAmount: number,
  extra: Partial<RecipeLine> = {},
): RecipeLine => ({ ingredient: ing, role, baseAmount, scalable: true, ...extra });

/** สูตรกล่องมาตรฐาน: อกไก่ 100 + ข้าวกล้อง 120 + บรอกโคลี 80 + ซอส 20 (ตายตัว) */
const BOX: RecipeLine[] = [
  line(ING.chicken, "protein", 100),
  line(ING.rice, "carb", 120),
  line(ING.broc, "veg", 80),
  line(ING.sauce, "fat", 20, { scalable: false }),
];

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol;

// ── 1. โภชนาการกล่องมาตรฐาน = ผลรวมสูตร ──
const base = recipeNutrition(BOX);
// อกไก่ 180 + ข้าว 150 + บรอกโคลี 28 + ซอส 60 = 418
check("กล่องมาตรฐานคิดจากสูตรได้ 418 kcal", base.kcal === 418, `ได้ ${base.kcal}`);
// โปรตีน 32 + 3.48 + 1.92 + 0.2 = 37.6
check("โปรตีนกล่องมาตรฐาน ~37.6 ก.", near(base.protein, 37.6, 0.2), `ได้ ${base.protein}`);

// ── 2. คนกินเยอะ: เป้า 600 kcal / โปรตีน 50 ──
const big = personalize(BOX, { kcal: 600, protein: 50, fat: 18, fiber: 6 });
const chickenBig = big.lines.find((l) => l.name === "อกไก่ย่าง")!;
const riceBig = big.lines.find((l) => l.name === "ข้าวกล้อง")!;
check("อกไก่เพิ่มขึ้นจาก 100 ก.", chickenBig.amount > 100, `ได้ ${chickenBig.amount} ก.`);
check("พลังงานเข้าเป้า 600 ±15%", near(big.delivered.kcal, 600, 90), `ได้ ${big.delivered.kcal} kcal`);
check("โปรตีนเข้าเป้า 50 ±5 ก.", near(big.delivered.protein, 50, 5), `ได้ ${big.delivered.protein} ก.`);
check("ไม่มีคำเตือน", big.warnings.length === 0, big.warnings.join(" / "));
console.log(
  "   →",
  big.lines.map((l) => `${l.name} ${l.baseAmount}→${l.amount}`).join(" · "),
);

// ── 3. คนคุมแคลอรี่: เป้า 300 kcal แต่โปรตีนยังต้อง 35 ก. (เคสคลาสสิกของคนลดน้ำหนัก) ──
const lean = personalize(BOX, { kcal: 300, protein: 35, fat: 8, fiber: 5 });
const chickenLean = lean.lines.find((l) => l.name === "อกไก่ย่าง")!;
const riceLean = lean.lines.find((l) => l.name === "ข้าวกล้อง")!;
check("โปรตีนยังได้ ~35 ก. แม้แคลอรี่ต่ำ", near(lean.delivered.protein, 35, 5), `ได้ ${lean.delivered.protein} ก.`);
check("ข้าวถูกลดลงจาก 120 ก.", riceLean.amount < 120, `ได้ ${riceLean.amount} ก.`);
check("อกไก่ไม่ถูกลดตามข้าว", chickenLean.amount >= 100, `ได้ ${chickenLean.amount} ก.`);
console.log(
  "   →",
  lean.lines.map((l) => `${l.name} ${l.baseAmount}→${l.amount}`).join(" · "),
);

// ── 4. ซอสตายตัว ห้ามขยับไม่ว่าเป้าจะเป็นเท่าไร (คุมโซเดียม) ──
const sauceBig = big.lines.find((l) => l.name === "ซอสน้ำสลัด")!;
const sauceLean = lean.lines.find((l) => l.name === "ซอสน้ำสลัด")!;
check("ซอสคงที่ 20 ก. ทั้งคนกินเยอะและคนคุมแคล", sauceBig.amount === 20 && sauceLean.amount === 20);
check("ซอสบอกเหตุผลที่ล็อก", !!sauceBig.lockedReason, sauceBig.lockedReason ?? "");

// ── 5. ทุกปริมาณต้องชั่งได้จริง (ลงตัวตามขั้นของวัตถุดิบ) ──
const allStep = [...big.lines, ...lean.lines].every((l) => {
  const step = l.name === "ซอสน้ำสลัด" ? 5 : l.unit === "pc" ? 1 : 10;
  return l.amount % step === 0;
});
check("ทุกปริมาณลงตัวตามขั้นที่ครัวชั่งได้", allStep);

// ── 6. สูตรเล็กเกินเป้า → ต้องเตือน ไม่ใช่เงียบ ──
const tiny: RecipeLine[] = [line(ING.broc, "veg", 50)];
const impossible = personalize(tiny, { kcal: 700, protein: 45 });
check("สูตรผักล้วนแต่เป้า 700 kcal → ขึ้นคำเตือน", impossible.warnings.length > 0, impossible.warnings[0] ?? "");
check("เตือนว่าโปรตีนขาดด้วย", impossible.warnings.some((w) => w.includes("โปรตีน")));

// ── 7. ตัวเลขที่รายงาน ต้องคิดจากกรัมที่ปัดแล้ว ──
const recomputed = recipeNutrition(
  BOX.map((l) => ({ ...l, baseAmount: big.lines.find((x) => x.name === l.ingredient.name)!.amount })),
);
check("delivered ตรงกับผลรวมของกรัมที่ปัดแล้วเป๊ะ", recomputed.kcal === big.delivered.kcal, `${recomputed.kcal} vs ${big.delivered.kcal}`);

// ── 8. หน่วยนับชิ้น (ไข่) ──
const eggBox: RecipeLine[] = [line(ING.egg, "protein", 2), line(ING.rice, "carb", 120)];
const eggPlan = personalize(eggBox, { kcal: 500, protein: 30 });
const eggLine = eggPlan.lines.find((l) => l.name === "ไข่ต้ม")!;
check("ไข่ออกมาเป็นจำนวนเต็มฟอง", Number.isInteger(eggLine.amount), `ได้ ${eggLine.amount}`);
check("ไข่อย่างน้อย 1 ฟอง", eggLine.amount >= 1);

// ── 9. ยอดรวมที่ครัวต้องเตรียม ──
const prep = prepTotals([big, lean, big]);
const chickenPrep = prep.find((p) => p.name === "อกไก่ย่าง")!;
check(
  "ยอดรวมอกไก่ = ผลบวกของทั้ง 3 กล่อง",
  chickenPrep.total === chickenBig.amount * 2 + chickenLean.amount,
  `ได้ ${chickenPrep.total} ก. จาก ${chickenPrep.boxes} กล่อง`,
);
check("เรียงจากของที่ใช้เยอะสุดก่อน", prep[0].total >= prep[prep.length - 1].total);
check("formatAmount แปลงกิโลถูก", formatAmount(1200, "g") === "1.2 กก.", formatAmount(1200, "g"));
check("formatAmount ต่ำกว่ากิโลเป็นกรัม", formatAmount(850, "g") === "850 ก.", formatAmount(850, "g"));

// ── 10. เป้าเท่ากับสูตรพอดี → ไม่ควรขยับอะไรเลย ──
const same = personalize(BOX, { kcal: base.kcal, protein: base.protein, fat: base.fat, fiber: base.fiber });
check(
  "เป้าตรงกับสูตรพอดี = ทุกอย่างคงเดิม",
  same.lines.every((l) => l.delta === 0),
  same.lines.map((l) => `${l.name} ${l.delta}`).join(" · "),
);

console.log(failed === 0 ? "\nผ่านครบทุกเคส" : `\nพัง ${failed} เคส`);
process.exit(failed ? 1 : 0);
