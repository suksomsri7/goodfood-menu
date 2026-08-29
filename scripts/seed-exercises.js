/**
 * ย้ายคลังท่าจาก exerciseCatalog.ts เข้าตาราง exercises — รัน: node scripts/seed-exercises.js --apply
 *   ไม่ใส่ --apply = ซ้อมแห้ง (ตรวจคลัง + บอกว่าจะเพิ่ม/เติมอะไร ไม่เขียน DB)
 *
 * 🔴 create เฉพาะ key ที่ยังไม่มี — ห้าม update ทับ ไม่งั้นรูป/คลิป/คำอธิบายที่แอดมินแก้ไว้หายหมด
 *    ข้อยกเว้นเดียว: nameEn ที่ยังเป็น null (คอลัมน์เพิ่งเพิ่ม แถวเก่าจึงว่างทุกแถว)
 *    → เติมให้เฉพาะแถวที่ว่าง ไม่แตะ field อื่นเลย
 * รันซ้ำได้ (idempotent) · เพิ่มท่าใหม่ในไฟล์คลังโค้ดแล้วรันซ้ำ = ท่าใหม่เข้า DB เอง
 */
const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const prisma = new PrismaClient();

/** วงคำศัพท์ — ต้องตรงกับ src/lib/exerciseAdmin.ts และ scripts/seed-exercise-metadata.ts */
const PATTERNS = ["squat", "hinge", "push_h", "push_v", "pull_h", "pull_v", "lunge", "core", "carry", "cardio", "mobility"];
const EQUIPMENT = [
  // 🔴 ต้องตรงกับ EQUIPMENT_TYPES ใน src/lib/memberEquipment.ts เสมอ
  //    (ขยายเป็น 29 ชนิดเมื่อ 27 ส.ค. 69 แต่ลืมขยายวงคำศัพท์ตรงนี้ → เพิ่มท่าที่ใช้ของใหม่ไม่ได้เลย)
  "dumbbell", "barbell", "ez_bar", "kettlebell", "weight_plate", "sandbag", "ankle_weights",
  "band", "trx", "battle_rope", "jump_rope",
  "bench", "squat_rack", "pullup_bar", "dip_bar",
  "stability_ball", "yoga_mat", "foam_roller", "medicine_ball",
  "machine", "cable", "smith_machine", "leg_press",
  "treadmill", "bike", "rowing_machine", "elliptical", "stair_climber",
];
const MUSCLES = [
  "quads", "hamstrings", "glutes", "calves", "adductors", "hip_flexors",
  "chest", "back", "lats", "traps", "shoulders", "biceps", "triceps", "forearms",
  "core", "obliques", "lower_back", "full_body",
];

/**
 * ด่านตรวจคลัง — ของผิดต้องหยุดตั้งแต่ซ้อมแห้ง ไม่ใช่ไปโผล่ตอนลูกค้าได้แผน
 * ทุกข้อในนี้เคยเป็น (หรือเกือบเป็น) บั๊กจริงของระบบจัดท่าแทน/บันไดความยาก
 */
function selfCheck(catalog) {
  const errors = [];
  const seenKey = new Set();
  const seenName = new Map();

  for (const e of catalog) {
    const at = `${e.key}`;
    if (seenKey.has(e.key)) errors.push(`key ซ้ำ: ${e.key}`);
    seenKey.add(e.key);
    // ชื่อไทยซ้ำ = matchExercise() จับคู่ท่าจาก AI ผิดตัวแบบเงียบ ๆ
    if (seenName.has(e.name)) errors.push(`ชื่อไทยซ้ำ: "${e.name}" (${seenName.get(e.name)} กับ ${e.key})`);
    seenName.set(e.name, e.key);

    if (!e.nameEn) errors.push(`${at}: ไม่มีชื่ออังกฤษ (nameEn)`);
    if (!PATTERNS.includes(e.pattern)) errors.push(`${at}: pattern ไม่อยู่ในวงคำศัพท์ (${e.pattern})`);
    if (!(e.difficulty >= 1 && e.difficulty <= 5)) errors.push(`${at}: difficulty ต้องอยู่ 1-5`);
    if (!e.primaryMuscles?.length) errors.push(`${at}: ไม่ได้ระบุกล้ามเนื้อหลัก`);
    for (const m of e.primaryMuscles ?? []) if (!MUSCLES.includes(m)) errors.push(`${at}: กล้ามเนื้อ "${m}" ไม่อยู่ในวงคำศัพท์`);
    for (const q of e.equipmentNeeded ?? []) if (!EQUIPMENT.includes(q)) errors.push(`${at}: อุปกรณ์ "${q}" ไม่อยู่ในวงคำศัพท์`);
    if (!(e.met > 0)) errors.push(`${at}: MET ต้องมากกว่า 0`);

    // ชื่อบอกว่าถือน้ำหนัก = ต้อง loadable (ไม่งั้น progression สั่งขึ้นกิโลไม่ได้ทั้งที่ขึ้นได้)
    if (/ดัมเบล|บาร์เบล|เคตเทิล/.test(e.name) && !e.loadable) errors.push(`${at}: ชื่อบอกว่าถือน้ำหนัก แต่ loadable=false`);
    // ขึ้นน้ำหนักได้แต่ไม่บอกว่าใช้อุปกรณ์อะไร = เลือกก้าวกิโลจากคลังอุปกรณ์ของสมาชิกไม่ได้
    if (e.loadable && !(e.equipmentNeeded ?? []).length) errors.push(`${at}: loadable=true แต่ไม่ได้ระบุอุปกรณ์`);
    // ยืดเหยียดที่มีแรงกระแทกสูง = ขัดกันเอง (ท่าฟื้นฟูต้องไม่กระแทก)
    if (e.impact === "high" && e.kind === "mobility") errors.push(`${at}: ท่ายืดเหยียดต้องไม่ใช่ impact สูง`);
  }

  // ── บันไดความยาก ──
  const groups = new Map();
  for (const e of catalog) {
    if (!e.progressionGroup) continue;
    groups.set(e.progressionGroup, [...(groups.get(e.progressionGroup) ?? []), e]);
  }
  for (const [g, list] of groups) {
    if (list.length < 2) errors.push(`บันได "${g}" มีท่าเดียว (${list[0].key}) — บันไดต้องมีอย่างน้อย 2 ขั้น`);
    // ปนหน่วยนับ = เทียบความก้าวหน้ากันไม่ได้ (30 วิ ยากกว่า 12 ครั้งไหม ไม่มีใครรู้)
    if (new Set(list.map((e) => e.unit)).size > 1) errors.push(`บันได "${g}" ปนหน่วยนับครั้ง/นาที: ${list.map((e) => e.key).join(", ")}`);
    // ปนแรงกระแทก = คนเข่าไม่ดีถูกดันขึ้นขั้นถัดไปที่เป็นท่ากระโดด
    if (new Set(list.map((e) => e.impact)).size > 1) errors.push(`บันได "${g}" ปนแรงกระแทกสูง/ต่ำ: ${list.map((e) => e.key).join(", ")}`);
    // ความยากซ้ำกัน = ลำดับขั้นไม่แน่นอน (ตัดสินด้วย key แทน = ขึ้นบันไดมั่ว)
    const diffs = list.map((e) => e.difficulty);
    if (new Set(diffs).size !== diffs.length) {
      errors.push(`บันได "${g}" ความยากซ้ำกัน: ${list.map((e) => `${e.key}=${e.difficulty}`).join(", ")}`);
    }
  }
  return { errors, groups };
}

async function main() {
  const apply = process.argv.includes("--apply");

  // ดึงคลังจากไฟล์ TS ผ่าน tsx (ไฟล์นั้นเป็น ESM/TS — require ตรง ๆ ไม่ได้)
  const json = execSync(
    `npx tsx -e "import { EXERCISE_CATALOG } from './src/lib/exerciseCatalog'; console.log(JSON.stringify(EXERCISE_CATALOG))"`,
    { cwd: __dirname + "/..", encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  ).trim();
  const catalog = JSON.parse(json.split("\n").pop());

  const { errors, groups } = selfCheck(catalog);
  if (errors.length) {
    console.error(`❌ คลังไม่ผ่านด่านตรวจ ${errors.length} ข้อ:`);
    for (const e of errors) console.error("   - " + e);
    process.exitCode = 1;
    return;
  }
  console.log(`✅ ด่านตรวจผ่าน — ${catalog.length} ท่า · บันไดความยาก ${groups.size} กลุ่ม`);
  for (const [g, list] of [...groups].sort()) {
    const steps = [...list].sort((a, b) => a.difficulty - b.difficulty).map((e) => `${e.key}(${e.difficulty})`);
    console.log(`   ${g}: ${steps.join(" → ")}`);
  }

  const rows = await prisma.exercise.findMany({ select: { key: true } });
  const existing = new Set(rows.map((r) => r.key));
  const missing = catalog.filter((e) => !existing.has(e.key));

  /* แถวเก่าที่ยังไม่มีชื่ออังกฤษ — เติมได้อย่างเดียว ห้ามทับของที่แอดมินพิมพ์เอง
     คอลัมน์ nameEn อาจยังไม่ถูก push ขึ้น DB → ซ้อมแห้งต้องรันผ่านอยู่ดี (ด่านตรวจคลังคือของสำคัญ) */
  let needEn = [];
  let columnReady = true;
  try {
    const blank = await prisma.$queryRawUnsafe(`SELECT "key" FROM "exercises" WHERE "nameEn" IS NULL`);
    const blankKeys = new Set(blank.map((r) => r.key));
    needEn = catalog.filter((e) => blankKeys.has(e.key));
  } catch {
    columnReady = false;
    console.warn("⚠️  ยังไม่มีคอลัมน์ nameEn ใน DB — ต้อง push schema ก่อน --apply");
  }

  console.log(
    `\nคลังโค้ด ${catalog.length} ท่า · ใน DB แล้ว ${existing.size} · จะเพิ่ม ${missing.length} · ` +
    (columnReady ? `เติมชื่ออังกฤษ ${needEn.length}` : "เติมชื่ออังกฤษ (รอ push schema)")
  );
  for (const e of missing) console.log(`  + ${e.key} — ${e.name} (${e.nameEn})`);

  if (!apply) return console.log("\n(ใส่ --apply เพื่อเขียนจริง)");
  if (!columnReady) {
    console.error("❌ ยังไม่มีคอลัมน์ nameEn ใน DB — รัน prisma db push ก่อน แล้วค่อย --apply");
    process.exitCode = 1;
    return;
  }

  for (const e of missing) {
    await prisma.exercise.create({
      data: {
        key: e.key,
        name: e.name,
        nameEn: e.nameEn,
        kind: e.kind,
        equipment: e.equipment,
        impact: e.impact,
        unit: e.unit,
        met: e.met,
        muscles: e.muscles || null,
        cue: e.cue || null,
        // metadata ระบบเทรนติดไปตั้งแต่แรก — ไม่ต้องรอ seed-exercise-metadata.ts มาเติมทีหลัง
        pattern: e.pattern,
        primaryMuscles: e.primaryMuscles ?? [],
        loadable: !!e.loadable,
        equipmentNeeded: e.equipmentNeeded ?? [],
        difficulty: e.difficulty,
        progressionGroup: e.progressionGroup ?? null,
        // สื่อเดิมของคลังโค้ด (webp/mp4) ไม่ย้ายมาเป็น images — คนละชนิดสื่อ ให้แอดมินอัปรูปจริงแทน
        isCustom: false,
      },
    });
  }

  let filled = 0;
  for (const e of needEn) {
    // where nameEn:null อีกชั้น — กันเคสแอดมินพิมพ์คั่นระหว่างที่สคริปต์กำลังรัน
    const res = await prisma.exercise.updateMany({ where: { key: e.key, nameEn: null }, data: { nameEn: e.nameEn } });
    filled += res.count;
  }
  console.log(`✅ เพิ่มแล้ว ${missing.length} ท่า · เติมชื่ออังกฤษ ${filled} แถว`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
