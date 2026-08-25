/**
 * ลงวัตถุดิบตั้งต้นของ "ชามจัดเอง" 60 รายการ + รูป
 *   npx tsx scripts/seed-bowl-ingredients.ts                 # ดูอย่างเดียว (ไม่เขียนอะไรเลย)
 *   npx tsx scripts/seed-bowl-ingredients.ts --apply         # เขียนจริง
 *   npx tsx scripts/seed-bowl-ingredients.ts --apply --images=/path/to/jpg
 *
 * 🔴 ตัวเลขในคลังเป็น "ต่อ 100 ก./มล." — ข้อมูลตั้งต้นแปลงมาจากค่าต่อที่แล้ว (ดู bowl-ingredients.data.ts)
 *    ทุกแถวติดธง isEstimate = true จนกว่าครัวจะชั่งของจริง
 * 🔴 ของที่มีอยู่แล้วในคลัง (ชื่อซ้ำ) จะ "ไม่ทับตัวเลขโภชนาการ" — เติมเฉพาะช่องฝั่งแอปที่ยังว่าง
 *    เพราะครัวอาจแก้ตัวเลขเองไปแล้ว การ seed ต้องไม่ลบงานของคน
 * 🔴 รูปคัดลอกไปที่ volume ของ uploads (ค่าเริ่มต้น /var/lib/goodfood/uploads) แล้วเก็บ path เป็น /uploads/ingredients/<slug>.jpg
 */
import { copyFile, mkdir, access } from "fs/promises";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import { BOWL_SEED } from "./bowl-ingredients.data";
import { perPortion, portionLabel } from "../src/lib/bowl";

const APPLY = process.argv.includes("--apply");
const imagesArg = process.argv.find((a) => a.startsWith("--images="));
const IMAGE_SRC = imagesArg ? imagesArg.split("=")[1] : "/root/coach_mock/poke/ing";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/lib/goodfood/uploads";
const IMAGE_DIR = join(UPLOAD_DIR, "ingredients");

const exists = async (p: string) => access(p).then(() => true).catch(() => false);

async function main() {
  if (APPLY) await mkdir(IMAGE_DIR, { recursive: true });

  let created = 0;
  let patched = 0;
  let skipped = 0;
  let noImage = 0;
  const unitMismatch: string[] = [];

  for (const row of BOWL_SEED) {
    const src = join(IMAGE_SRC, `${row.slug}.jpg`);
    const hasImage = await exists(src);
    if (!hasImage) noImage++;
    const imageUrl = hasImage ? `/uploads/ingredients/${row.slug}.jpg` : null;
    if (APPLY && hasImage) await copyFile(src, join(IMAGE_DIR, `${row.slug}.jpg`));

    const bowlFields = {
      nameEn: row.nameEn,
      displayName: row.displayName ?? null,
      bowlStep: row.step,
      portionSize: row.portionSize,
      portionPrice: row.price,
      allergens: row.allergens,
      sortOrder: row.sort,
      ...(imageUrl ? { imageUrl } : {}),
    };

    const existing = await prisma.ingredient.findUnique({ where: { name: row.name } });

    if (existing) {
      // ครัวอาจแก้ตัวเลขไปแล้ว — แตะเฉพาะฝั่งแอป ไม่ยุ่งกับโภชนาการ/หน่วยเดิม
      if (existing.bowlStep && existing.portionSize) {
        skipped++;
        continue;
      }
      // 🔴 หน่วยไม่ตรงกัน = ปริมาณต่อที่ของเราคนละความหมาย (2 ชิ้น vs 2 กรัม) ห้ามยัดลงไป
      const unitClash = existing.unit !== row.unit;
      if (unitClash) unitMismatch.push(`${row.name} (คลัง=${existing.unit} · ชุดตั้งต้น=${row.unit})`);
      patched++;
      if (APPLY) {
        const { portionSize, ...rest } = bowlFields;
        await prisma.ingredient.update({
          where: { id: existing.id },
          data: unitClash ? rest : { ...rest, portionSize },
        });
      }
      continue;
    }

    created++;
    if (APPLY) {
      await prisma.ingredient.create({
        data: {
          name: row.name,
          unit: row.unit,
          gramsPerPiece: row.gramsPerPiece,
          calories: row.per100.calories,
          protein: row.per100.protein,
          carbs: row.per100.carbs,
          fat: row.per100.fat,
          sodium: row.per100.sodium,
          sugar: row.per100.sugar,
          defaultRole: row.role,
          stepGrams: row.unit === "pc" ? 1 : row.portionSize >= 100 ? 10 : 5,
          isEstimate: true,
          source: "ค่ามาตรฐานเริ่มต้นของชามจัดเอง — ครัวต้องชั่งของจริงแล้วยืนยัน",
          isActive: true,
          ...bowlFields,
        },
      });
    }
  }

  // ตรวจย้อนกลับ: แปลงต่อ 100 → ต่อที่ แล้วต้องได้ค่าเดิมที่ตั้งใจไว้ (กันหารผิดฐาน)
  const sample = BOWL_SEED.slice(0, 3).map((r) => {
    const per = perPortion({
      unit: r.unit,
      gramsPerPiece: r.gramsPerPiece,
      calories: r.per100.calories,
      protein: r.per100.protein,
      carbs: r.per100.carbs,
      fat: r.per100.fat,
      sodium: r.per100.sodium,
      sugar: r.per100.sugar,
      portionSize: r.portionSize,
    });
    return `  ${r.name} · ${portionLabel({ unit: r.unit, gramsPerPiece: r.gramsPerPiece, calories: 0, protein: 0, carbs: 0, fat: 0, portionSize: r.portionSize })} → ${per.calories} kcal · P ${per.protein} · ราคา +${r.price} ฿`;
  });

  console.log(`${APPLY ? "เขียนแล้ว" : "ยังไม่เขียน (ใส่ --apply เพื่อเขียนจริง)"}`);
  console.log(`  สร้างใหม่ ${created} · เติมช่องฝั่งแอปให้ของเดิม ${patched} · ข้าม (ตั้งไว้แล้ว) ${skipped}`);
  if (noImage) console.log(`  ⚠️ ไม่พบรูป ${noImage} รายการใน ${IMAGE_SRC}`);
  if (unitMismatch.length)
    console.log(`  ⚠️ หน่วยไม่ตรงกับคลัง ${unitMismatch.length} รายการ — ไม่ได้ใส่ปริมาณต่อที่ให้ ต้องกรอกเองในหลังบ้าน:\n     ${unitMismatch.join("\n     ")}`);
  console.log("ตัวอย่างที่ลูกค้าจะเห็น:");
  console.log(sample.join("\n"));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
