/**
 * สูตรตัวอย่าง 3 เมนู — ไว้ให้ครัวเห็นของจริงก่อนลงสูตรที่เหลือเอง
 *   npx tsx scripts/seed-example-recipes.ts            # ดูอย่างเดียว
 *   npx tsx scripts/seed-example-recipes.ts --apply    # เขียนจริง
 *   npx tsx scripts/seed-example-recipes.ts --remove   # ลบเฉพาะที่สคริปต์นี้สร้าง
 *
 * 🔴 ตัวเลขโภชนาการ "ไม่ได้แต่งเอง" — หารมาจาก `food_catalog` ที่ผ่าน QC แล้ว
 *    ด้วย `toPer100()` ตัวเดียวกับปุ่มช่วยกรอกในหลังบ้าน → ครัวได้เลขชุดเดียวกันไม่ว่าจะกรอกทางไหน
 *    ทุกตัวติดธง isEstimate = true จนกว่าครัวจะชั่งของจริงแล้วแก้เอง
 *
 * 🔴 ปริมาณมาตรฐานเลือกให้ "ประกอบกลับได้เท่ากับโภชนาการที่เมนูมีอยู่เดิม"
 *    ถ้าประกอบแล้วตัวเลขไม่ตรง แปลว่าเราเดาส่วนผสมผิด ไม่ใช่แค่ปัดเศษ — สคริปต์จะเตือนให้เห็น
 */
import { prisma } from "../src/lib/prisma";
import { toPer100 } from "../src/lib/catalogPer100";
import { recipeNutrition, rowsToLines } from "../src/lib/recipe";

const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");
const TAG = "สูตรตัวอย่าง";

/** ชื่อในคลังวัตถุดิบ → ชื่อแถวใน food_catalog ที่ใช้เป็นที่มา + บทบาท + ขั้นการชั่ง */
const INGREDIENTS: { name: string; from: string; role: string; step: number }[] = [
  { name: "อกไก่ต้ม", from: "อกไก่ต้ม 100 กรัม", role: "protein", step: 10 },
  { name: "อกไก่ย่าง", from: "อกไก่ย่างชิ้นใหญ่ 150 กรัม", role: "protein", step: 10 },
  { name: "ถั่วแดงต้ม", from: "ถั่วแดงต้ม", role: "protein", step: 10 },
  { name: "ข้าวกล้อง", from: "ข้าวกล้อง 1 ทัพพี", role: "carb", step: 10 },
  { name: "ผักลวกรวม", from: "ผักลวกรวม", role: "veg", step: 10 },
  { name: "บรอกโคลีลวก", from: "บรอกโคลีลวก", role: "veg", step: 10 },
  { name: "น้ำมันมะกอก", from: "น้ำมันมะกอก 1 ช้อนโต๊ะ", role: "fat", step: 5 },
];

interface Line { ing: string; role: string; grams: number; scalable?: boolean; max?: number; note?: string }

const RECIPES: { sku: string; lines: Line[] }[] = [
  {
    // มื้อเช้า — โปรตีนสูงแต่พลังงานต่ำ เหมาะเป็นตัวอย่างของ "ขยายโปรตีนโดยไม่ขยายข้าว"
    sku: "GF-01",
    lines: [
      { ing: "อกไก่ต้ม", role: "protein", grams: 100 },
      { ing: "ข้าวกล้อง", role: "carb", grams: 120, note: "1 ทัพพี" },
      { ing: "ผักลวกรวม", role: "veg", grams: 200 },
    ],
  },
  {
    // มื้อหนัก โปรตีนสูง — ตัวอย่างจานที่รองรับคนกินเยอะได้สบาย
    sku: "GF-23",
    lines: [
      { ing: "อกไก่ย่าง", role: "protein", grams: 150 },
      { ing: "ข้าวกล้อง", role: "carb", grams: 240, note: "2 ทัพพี" },
      { ing: "บรอกโคลีลวก", role: "veg", grams: 150 },
    ],
  },
  {
    // มังสวิรัติ — จงใจใส่ไว้เพื่อให้ครัวเห็นคำเตือน "โปรตีนขาด" ตอนเจอลูกค้าเป้าโปรตีนสูง
    // ถั่วแดงให้โปรตีนน้อยกว่าเนื้อสัตว์มาก ขยายสุดขอบเขตก็ยังไม่ถึงบางเป้า ซึ่งเป็นความจริงที่ต้องเห็น
    sku: "GF-20",
    lines: [
      { ing: "ถั่วแดงต้ม", role: "protein", grams: 90 },
      { ing: "ข้าวกล้อง", role: "carb", grams: 240, note: "2 ทัพพี" },
      { ing: "บรอกโคลีลวก", role: "veg", grams: 150 },
      // น้ำมันปรับได้แต่เพดานต่ำ — เกิน 20 ก. จานจะเลี่ยนจนไม่ใช่เมนูเดิม
      { ing: "น้ำมันมะกอก", role: "fat", grams: 14, max: 20, note: "1 ช้อนโต๊ะ" },
    ],
  },
];

(async () => {
  if (REMOVE) {
    const ings = await prisma.ingredient.findMany({ where: { source: { startsWith: TAG } }, select: { id: true, name: true } });
    const del = await prisma.recipeItem.deleteMany({ where: { ingredientId: { in: ings.map((i) => i.id) } } });
    const di = await prisma.ingredient.deleteMany({ where: { id: { in: ings.map((i) => i.id) } } });
    console.log(`ลบสูตร ${del.count} บรรทัด · ลบวัตถุดิบ ${di.count} ตัว (${ings.map((i) => i.name).join(", ")})`);
    await prisma.$disconnect();
    return;
  }

  // ── 1. เตรียมวัตถุดิบจากคลังอาหาร ──
  const per100 = new Map<string, ReturnType<typeof toPer100>>();
  for (const def of INGREDIENTS) {
    const row = await prisma.foodCatalog.findUnique({
      where: { name: def.from },
      select: { name: true, portion: true, calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true },
    });
    if (!row) throw new Error(`ไม่พบ "${def.from}" ในคลังอาหาร — สคริปต์นี้ห้ามเดาตัวเลขเอง`);
    const p = toPer100(row);
    if (!p) throw new Error(`แกะน้ำหนักหน่วยบริโภคของ "${def.from}" ไม่ออก (${row.portion})`);
    per100.set(def.name, p);
    console.log(
      `${def.name.padEnd(14)} ← ${row.portion.padEnd(18)} = ${p.calories} kcal · P ${p.protein} · C ${p.carbs} · F ${p.fat} ต่อ 100 ก.`,
    );
  }

  if (!APPLY) console.log("\n(ยังไม่เขียนอะไร — ใส่ --apply เพื่อบันทึกจริง)\n");

  const ingId = new Map<string, string>();
  if (APPLY) {
    for (const def of INGREDIENTS) {
      const p = per100.get(def.name)!;
      const data = {
        unit: p.unit,
        calories: p.calories,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        sodium: p.sodium,
        sugar: p.sugar,
        defaultRole: def.role,
        stepGrams: def.step,
        isEstimate: true,
        source: `${TAG} · ${p.source}`,
      };
      const r = await prisma.ingredient.upsert({ where: { name: def.name }, update: data, create: { name: def.name, ...data } });
      ingId.set(def.name, r.id);
    }
  }

  // ── 2. ลงสูตร + ตรวจว่าประกอบกลับได้ตรงกับเมนูเดิมไหม ──
  let mismatch = 0;
  for (const rec of RECIPES) {
    const food = await prisma.food.findFirst({ where: { sku: rec.sku }, select: { id: true, name: true, calories: true, protein: true } });
    if (!food) {
      console.log(`\n⚠️ ไม่พบเมนู ${rec.sku} — ข้าม`);
      continue;
    }

    // คิดล่วงหน้าจากค่าในคลัง เพื่อเทียบกับของเดิมก่อนตัดสินใจเขียน
    const preview = recipeNutrition(
      rowsToLines(
        rec.lines.map((l) => {
          const p = per100.get(l.ing)!;
          const def = INGREDIENTS.find((d) => d.name === l.ing)!;
          return {
            role: l.role,
            baseAmount: l.grams,
            scalable: l.scalable ?? true,
            minAmount: null,
            maxAmount: l.max ?? null,
            note: l.note ?? null,
            ingredient: {
              id: l.ing, name: l.ing, unit: p.unit, gramsPerPiece: null,
              calories: p.calories, protein: p.protein, carbs: p.carbs, fat: p.fat,
              fiber: null, sodium: p.sodium, sugar: p.sugar, stepGrams: def.step,
            },
          };
        }),
      ),
    );

    const dKcal = preview.kcal - food.calories;
    const dPro = preview.protein - food.protein;
    const ok = Math.abs(dKcal) <= Math.max(15, food.calories * 0.03) && Math.abs(dPro) <= 2;
    if (!ok) mismatch++;

    console.log(
      `\n${ok ? "✓" : "✗"} ${rec.sku} ${food.name}\n` +
        `   สูตร: ${rec.lines.map((l) => `${l.ing} ${l.grams} ก.`).join(" + ")}\n` +
        `   ประกอบได้ ${preview.kcal} kcal · P ${preview.protein}  (เมนูเดิม ${food.calories} kcal · P ${food.protein}` +
        `${ok ? "" : ` → ต่าง ${dKcal > 0 ? "+" : ""}${dKcal} kcal / ${dPro > 0 ? "+" : ""}${Math.round(dPro * 10) / 10} ก.`})`,
    );

    if (!APPLY) continue;

    await prisma.recipeItem.deleteMany({ where: { foodId: food.id } });
    await prisma.recipeItem.createMany({
      data: rec.lines.map((l, i) => ({
        foodId: food.id,
        ingredientId: ingId.get(l.ing)!,
        role: l.role,
        baseAmount: l.grams,
        scalable: l.scalable ?? true,
        maxAmount: l.max ?? null,
        note: l.note ?? null,
        order: i,
      })),
    });

    // โภชนาการของเมนู = ผลรวมสูตร (เหมือนที่ API ทำ — ให้สองทางได้ผลตรงกัน)
    const saved = await prisma.recipeItem.findMany({ where: { foodId: food.id }, include: { ingredient: true }, orderBy: { order: "asc" } });
    const computed = recipeNutrition(rowsToLines(saved));
    await prisma.food.update({
      where: { id: food.id },
      data: {
        calories: computed.kcal, protein: computed.protein, carbs: computed.carbs, fat: computed.fat,
        fiber: computed.fiber, sodium: computed.sodium, sugar: computed.sugar,
        ingredients: saved.map((s) => `${s.ingredient.name} ${s.baseAmount} ก.`),
      },
    });
  }

  console.log(
    mismatch === 0
      ? `\nสูตรทั้ง ${RECIPES.length} เมนูประกอบกลับได้ตรงกับโภชนาการเดิม${APPLY ? " · บันทึกแล้ว" : ""}`
      : `\n⚠️ มี ${mismatch} เมนูที่ประกอบแล้วไม่ตรงของเดิม — ต้องแก้ส่วนผสมก่อน${APPLY ? " (บันทึกไปแล้ว ให้รีวิวในหลังบ้าน)" : ""}`,
  );
  await prisma.$disconnect();
})();
