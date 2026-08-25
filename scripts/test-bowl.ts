/**
 * ข้อสอบของ "ชามจัดเอง" — ตัวแปลงต่อ 100 → ต่อที่ · เพดานจำนวนที่ · การจับคู่คำแพ้
 *   npx tsx scripts/test-bowl.ts
 *
 * 🔴 ที่ต้องมีชุดนี้ เพราะทั้งราคาที่ลูกค้าจ่ายและแคลอรี่ที่โชว์เกิดจากการคูณฐานเดียวกัน
 *    ถ้าฐานเพี้ยน (ชิ้น vs กรัม) ทุกชามผิดพร้อมกันโดยไม่มีใครเห็น
 */
import {
  ALLERGEN_OPTIONS,
  BOWL_STEPS,
  BowlLine,
  bowlTotals,
  perPortion,
  portionLabel,
  resolveStepLimits,
  validatePicks,
} from "../src/lib/bowl";

let pass = 0;
const fails: string[] = [];

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fails.push(`${name}\n     ได้  ${JSON.stringify(got)}\n     คาด ${JSON.stringify(want)}`);
  console.log(`${ok ? "✅" : "❌"} ${name}`);
}

// ── 1. แปลงต่อ 100 → ต่อ 1 ที่ ──────────────────────────────────────────
const brownRice = { unit: "g", calories: 120, protein: 2.7, carbs: 25.3, fat: 1, sodium: 3.3, sugar: 0, portionSize: 150 };
check("ข้าวกล้อง 150 ก. จากฐาน 120 kcal/100 ก.", perPortion(brownRice).calories, 180);

const egg = { unit: "pc", gramsPerPiece: 50, calories: 150, protein: 13, carbs: 1, fat: 10, sodium: 140, portionSize: 2 };
check("ไข่ 2 ฟอง (50 ก./ฟอง) = ฐาน 100 ก.", perPortion(egg).calories, 150);
check("ป้ายปริมาณของหน่วยชิ้น", portionLabel(egg), "2 ชิ้น (100 ก.)");
check("ป้ายปริมาณของหน่วยกรัม", portionLabel(brownRice), "150 ก.");

// 🔴 เคสที่เคยพลาดจริงตอน seed: หน่วยเป็นชิ้นแต่ไม่มีน้ำหนักต่อชิ้น → ต้องได้ 0 ไม่ใช่ตัวเลขมั่ว
check("หน่วยชิ้นแต่ไม่มี gramsPerPiece", perPortion({ ...egg, gramsPerPiece: null }).calories, 0);
check("ไม่ได้ตั้งปริมาณต่อที่", perPortion({ ...brownRice, portionSize: null }).calories, 0);

const sauce = { unit: "ml", calories: 400, protein: 6.7, carbs: 13.3, fat: 36.7, sodium: 1066.7, sugar: 10, portionSize: 30 };
check("ซอส 30 มล. จากฐานต่อ 100 มล.", perPortion(sauce).calories, 120);

// ── 2. ราคารวม: ฐาน + ของที่บวกเพิ่มคูณจำนวนที่ ────────────────────────
const line = (name: string, price: number, kcal: number, qty: number): BowlLine => ({
  ingredientId: name,
  qty,
  step: "protein",
  name,
  unitPrice: price,
  nutrition: { grams: 100, calories: kcal, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 },
});
const totals = bowlTotals([line("แซลมอน", 79, 220, 2), line("ไก่ย่าง", 45, 165, 1)], 99);
check("แซลมอน 2 ที่ + ไก่ 1 ที่ + ฐาน 99", totals.price, 99 + 79 * 2 + 45);
check("แคลอรี่คูณจำนวนที่", totals.calories, 220 * 2 + 165);
check("นับจำนวนที่รวม", totals.portions, 3);

// ── 3. เพดานของแต่ละขั้น (นับเป็น "ที่" ไม่ใช่ชนิด) ─────────────────────
check("โปรตีน 2 ที่ = ผ่าน", validatePicks({ protein: 2 }), null);
check("โปรตีน 3 ที่ = ไม่ผ่าน", validatePicks({ protein: 3 }), "PROTEIN เลือกได้ไม่เกิน 2 ที่ (ตอนนี้ 3 ที่)");
check("ผัก 3 ที่ = ผ่าน", validatePicks({ veggies: 3 }), null);
check("ผัก 2 ที่ = ยังไม่ครบ", validatePicks({ veggies: 2 }), "VEGGIES ต้องเลือกให้ครบ 3 ที่");
check("ยังไม่เลือกผักเลย = ยังไม่ฟ้อง (เพิ่งเริ่มจัดชาม)", validatePicks({ veggies: 0 }), null);
check("ฐาน 2 ที่ = ไม่ผ่าน", validatePicks({ base: 2 }), "BASE เลือกได้ไม่เกิน 1 ที่ (ตอนนี้ 2 ที่)");

// เพดานที่หลังบ้านตั้งทับ
const custom = resolveStepLimits({ protein: 3, veggies: 99, sauce: "2" });
check("ตั้งเพดานโปรตีนเป็น 3", custom.find((s) => s.key === "protein")!.limit, 3);
check("ค่าเกินช่วง (99) ต้องตกกลับค่าเริ่มต้น", custom.find((s) => s.key === "veggies")!.limit, 3);
check("ค่าที่ส่งมาเป็นสตริง '2' ใช้ได้", custom.find((s) => s.key === "sauce")!.limit, 2);
check("จำนวนขั้นต้องครบ 6", custom.length, BOWL_STEPS.length);

// ── 4. จับคู่คำแพ้จากแบบสอบถาม (ภาษาคน) กับรหัสที่ครัวติดไว้ ─────────────
const blocked = (words: string[]) =>
  ALLERGEN_OPTIONS.filter((o) => words.some((w) => o.label.includes(w) || w.includes(o.label)))
    .map((o) => o.value)
    .sort();

check("แพ้กุ้ง", blocked(["กุ้ง"]), ["shrimp"]);
check("แพ้ไข่", blocked(["ไข่"]), ["egg"]);
check("แพ้นมวัว (คำยาวกว่าป้าย)", blocked(["นมวัว"]), ["milk"]);
check("แพ้งา + ปลา", blocked(["งา", "ปลา"]), ["fish", "sesame"]);
// 🔴 คำกว้างอย่าง "อาหารทะเล" จับรหัสไม่ได้ — ต้องรู้ตัวว่ากันไม่ได้ ไม่ใช่นึกว่ากันแล้ว
check("คำกว้าง 'อาหารทะเล' ยังจับไม่ได้", blocked(["อาหารทะเล"]), []);

console.log(`\nผ่าน ${pass} · ตก ${fails.length}`);
if (fails.length) {
  for (const f of fails) console.log(`  ❌ ${f}`);
  process.exit(1);
}
