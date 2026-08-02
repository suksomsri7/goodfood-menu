/**
 * Seed คลังอาหารไทยลงตาราง food_catalog — idempotent (upsert ด้วย name รันซ้ำได้)
 *
 * ใช้: node scripts/seed-food-catalog.js
 * ต้องผ่าน QC ก่อนเสมอ (สคริปต์นี้เรียก QC ซ้ำในตัว ถ้าไม่ผ่านจะไม่แตะ DB)
 */
const { PrismaClient } = require("@prisma/client");
const { execFileSync } = require("child_process");
const path = require("path");
const { loadCatalog } = require("./load-food-catalog");

const ROOT = path.resolve(__dirname, "..");

(async () => {
  // QC gate — ห้ามให้ของไม่ผ่านหลุดเข้า DB
  try {
    execFileSync("node", [path.join(ROOT, "scripts/qc-food-catalog.js")], { stdio: "inherit" });
  } catch {
    console.error("\n❌ QC ไม่ผ่าน — ยกเลิกการ seed");
    process.exit(1);
  }

  const { seed, CATALOG_SOURCE } = loadCatalog();
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;

  try {
    for (const f of seed) {
      const data = {
        aliases: f.aliases || [],
        category: f.category,
        portion: f.portion,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        sodium: f.sodium ?? null,
        sugar: f.sugar ?? null,
        isEstimate: true,
        source: CATALOG_SOURCE,
      };
      const before = await prisma.foodCatalog.findUnique({ where: { name: f.name }, select: { id: true } });
      await prisma.foodCatalog.upsert({
        where: { name: f.name },
        update: data,
        create: { name: f.name, ...data },
      });
      if (before) updated++;
      else created++;
    }

    const total = await prisma.foodCatalog.count();
    const byCat = await prisma.foodCatalog.groupBy({ by: ["category"], _count: { _all: true } });
    console.log("");
    console.log(`── seed เสร็จ ── สร้างใหม่ ${created} · อัปเดต ${updated} · ในตารางทั้งหมด ${total} แถว`);
    for (const c of byCat.sort((a, b) => b._count._all - a._count._all)) {
      console.log(`  ${String(c._count._all).padStart(4)}  ${c.category}`);
    }
  } finally {
    await prisma.$disconnect();
  }
})();
