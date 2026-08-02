/**
 * QC gate ของคลังอาหาร — ต้องผ่านก่อน seed ลง DB เสมอ
 *
 * ตรวจ 5 อย่าง:
 *  1) นับจำนวนรวม + ต่อหมวด
 *  2) ช่วงค่าสมเหตุสมผล: kcal 5–1500 / protein ≤ 80 / sodium ≤ 5000 / sugar ≤ 150
 *  3) มาโครสอดคล้องกับแคลอรี่: |4P+4C+9F − kcal| ≤ 35% ของ kcal (ยกเว้นหมวดแอลกอฮอล์)
 *  4) ชื่อซ้ำหลัง normalise (normaliseFoodName ตัวเดียวกับที่ระบบใช้จับคู่เมนู)
 *  5) field ครบ: name/category/portion/calories/protein/carbs/fat
 *
 * ใช้: node scripts/qc-food-catalog.js   (exit code 1 = ไม่ผ่าน)
 */
const { loadCatalog } = require("./load-food-catalog");

const { seed, ALCOHOL_CATEGORY, normaliseFoodName } = loadCatalog();

const problems = [];
const byCategory = new Map();
const seenNorm = new Map();

for (const f of seed) {
  const tag = `[${f.name}]`;

  // (5) field ครบ
  for (const k of ["name", "category", "portion"]) {
    if (!f[k] || typeof f[k] !== "string") problems.push(`${tag} ขาด field ${k}`);
  }
  for (const k of ["calories", "protein", "carbs", "fat"]) {
    if (typeof f[k] !== "number" || !Number.isFinite(f[k])) problems.push(`${tag} ${k} ไม่ใช่ตัวเลข`);
  }
  if (!Array.isArray(f.aliases)) problems.push(`${tag} aliases ต้องเป็น array`);

  byCategory.set(f.category, (byCategory.get(f.category) || 0) + 1);

  // (2) ช่วงค่า
  if (f.calories < 5 || f.calories > 1500) problems.push(`${tag} kcal นอกช่วง 5–1500: ${f.calories}`);
  if (f.protein > 80) problems.push(`${tag} protein > 80: ${f.protein}`);
  if (f.protein < 0 || f.carbs < 0 || f.fat < 0) problems.push(`${tag} มาโครติดลบ`);
  if (f.sodium != null && (f.sodium < 0 || f.sodium > 5000)) problems.push(`${tag} sodium นอกช่วง 0–5000: ${f.sodium}`);
  if (f.sugar != null && (f.sugar < 0 || f.sugar > 150)) problems.push(`${tag} sugar นอกช่วง 0–150: ${f.sugar}`);

  // (3) มาโครสอดคล้อง (แอลกอฮอล์ยกเว้น — พลังงานมาจากเอทานอล 7 kcal/g ที่ไม่ใช่มาโคร)
  if (f.category !== ALCOHOL_CATEGORY) {
    const fromMacro = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
    const diff = Math.abs(fromMacro - f.calories);
    if (diff > 0.35 * f.calories) {
      problems.push(
        `${tag} มาโครไม่ตรงแคลอรี่: 4P+4C+9F=${fromMacro.toFixed(0)} vs kcal=${f.calories} (ต่าง ${((diff / f.calories) * 100).toFixed(0)}%)`
      );
    }
  }

  // (4) ชื่อซ้ำหลัง normalise
  const key = normaliseFoodName(f.name);
  if (seenNorm.has(key)) problems.push(`${tag} ชื่อซ้ำกับ [${seenNorm.get(key)}] หลัง normalise → "${key}"`);
  else seenNorm.set(key, f.name);
}

// alias ซ้ำข้ามเมนู (ทำให้ค้นแล้วได้ผลกำกวม — เตือนอย่างเดียว ไม่ใช่ error)
const aliasOwner = new Map();
const aliasDupes = [];
for (const f of seed) {
  for (const a of f.aliases || []) {
    const k = normaliseFoodName(a);
    if (!k) continue;
    if (aliasOwner.has(k) && aliasOwner.get(k) !== f.name) aliasDupes.push(`"${a}": ${aliasOwner.get(k)} / ${f.name}`);
    else aliasOwner.set(k, f.name);
  }
}

console.log("── QC คลังอาหารไทย ──");
console.log(`รวมทั้งหมด: ${seed.length} เมนู · ${byCategory.size} หมวด`);
console.log("");
console.log("จำนวนต่อหมวด:");
for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${cat}`);
}
console.log("");
console.log(`ชื่อไม่ซ้ำหลัง normalise: ${seenNorm.size}/${seed.length}`);
console.log(`alias ทั้งหมด: ${aliasOwner.size} คำ · ซ้ำข้ามเมนู: ${aliasDupes.length}`);
if (aliasDupes.length) console.log("  (เตือน) " + aliasDupes.slice(0, 20).join(" · "));
console.log("");

if (problems.length) {
  console.log(`❌ ไม่ผ่าน QC — ${problems.length} รายการ:`);
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
console.log("✅ ผ่าน QC ทุกข้อ");
