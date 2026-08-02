/**
 * โหลดข้อมูลคลังอาหาร (TypeScript) เข้ามาใช้ในสคริปต์ Node ธรรมดา
 *
 * ทำไมต้องคอมไพล์ก่อน: ข้อมูลอยู่ใน src/data/foodCatalog/*.ts (TS) แต่ scripts/ ของโปรเจกต์นี้
 * เป็น CommonJS ล้วนและเครื่องไม่มี tsx/ts-node → ใช้ tsc ที่ติดมากับ devDependencies คอมไพล์
 * ลงโฟลเดอร์ชั่วคราวแล้ว require เอา (ลบทิ้งทุกครั้งก่อนคอมไพล์ใหม่ กันของค้าง)
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, ".tmp-food-catalog");

function compile() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const entries = [
    path.join(ROOT, "src/data/foodCatalog/index.ts"),
    path.join(ROOT, "src/lib/foodName.ts"),
  ].join(" ");
  execSync(
    `npx --no-install tsc ${entries} --outDir ${OUT} --rootDir ${path.join(ROOT, "src")} ` +
      `--module commonjs --target es2020 --moduleResolution node --skipLibCheck --esModuleInterop`,
    { cwd: ROOT, stdio: "inherit" }
  );
}

function loadCatalog() {
  compile();
  const mod = require(path.join(OUT, "data/foodCatalog/index.js"));
  const name = require(path.join(OUT, "lib/foodName.js"));
  return {
    seed: mod.FOOD_CATALOG_SEED,
    ALCOHOL_CATEGORY: mod.ALCOHOL_CATEGORY,
    CATALOG_SOURCE: mod.CATALOG_SOURCE,
    normaliseFoodName: name.normaliseFoodName,
  };
}

module.exports = { loadCatalog };
