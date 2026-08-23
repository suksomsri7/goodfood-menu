/**
 * เติม metadata ให้ท่าออกกำลังกายที่อยู่ใน DB แล้ว (pattern / กล้ามเนื้อหลัก / loadable / อุปกรณ์ / ความยาก / บันได)
 * รัน: npx tsx scripts/seed-exercise-metadata.ts --dry   (ดูตารางก่อน — ไม่แตะ DB)
 *      npx tsx scripts/seed-exercise-metadata.ts --apply (เขียนจริง)
 *
 * 🔴 --apply อัปเดตเฉพาะแถวที่ pattern ยังว่าง — ของที่แอดมินแก้เองแล้วห้ามทับ
 * 🔴 metadata คือ "ด่านความปลอดภัย" ของทั้งเฟส: ค่าที่ผิดทำให้ระบบจัดท่าแทน/บันไดความยากผิด
 *    → ตั้งแต่ ส.ค. 69 ย้ายไปอยู่ใน src/lib/exerciseCatalog.ts ที่เดียว (เดิมมีตารางซ้ำในไฟล์นี้
 *      พอคลังโตขึ้นก็เริ่มไม่ตรงกัน) ไฟล์นี้เหลือหน้าที่ "เอาลง DB + โชว์ตารางให้คนไล่ตรวจ"
 *    หมายเหตุ: ท่าใหม่ที่ seed-exercises.js สร้าง จะมี metadata ติดไปตั้งแต่ create อยู่แล้ว
 *      ไฟล์นี้จึงเหลือไว้เติมย้อนหลังให้แถวเก่าที่สร้างก่อนมีคอลัมน์เหล่านี้
 *
 * --dry ต้องรันได้แม้คอลัมน์ใหม่ยังไม่ถูก push ขึ้น DB (อ่านแค่ key/name)
 */
import { PrismaClient } from "@prisma/client";
import { EXERCISE_CATALOG } from "../src/lib/exerciseCatalog";

const prisma = new PrismaClient();

/** วงคำศัพท์ที่ engine เฟส B ใช้จับคู่ท่าแทน — ค่านอกลิสต์ = ตกด่านตรวจในสคริปต์นี้ */
const PATTERNS = [
  "squat", "hinge", "push_h", "push_v", "pull_h", "pull_v", "lunge", "core", "carry", "cardio", "mobility",
];
const EQUIPMENT = ["dumbbell", "barbell", "kettlebell", "band", "bench", "pullup_bar", "machine", "treadmill", "bike"];
const MUSCLES = [
  "quads", "hamstrings", "glutes", "calves", "adductors", "hip_flexors",
  "chest", "back", "lats", "traps", "shoulders", "biceps", "triceps", "forearms",
  "core", "obliques", "lower_back", "full_body",
];

interface Meta {
  pattern: string;
  primaryMuscles: string[];
  loadable: boolean;
  equipmentNeeded: string[];
  difficulty: number;
  progressionGroup?: string;
}

/**
 * ตารางนี้ = ภาพสะท้อนของ src/lib/exerciseCatalog.ts (แหล่งความจริงเดียว)
 * กติกาที่ใช้ตัดสินตอนกรอกอยู่ในหัวไฟล์คลังนั้นแล้ว — แก้ค่าให้ไปแก้ที่คลัง ห้ามแก้ที่นี่
 */
const METADATA: Record<string, Meta> = Object.fromEntries(
  EXERCISE_CATALOG.map((e) => [
    e.key,
    {
      pattern: e.pattern,
      primaryMuscles: [...e.primaryMuscles],
      loadable: e.loadable,
      equipmentNeeded: [...e.equipmentNeeded],
      difficulty: e.difficulty,
      ...(e.progressionGroup ? { progressionGroup: e.progressionGroup } : {}),
    },
  ]),
);

/** ด่านตรวจตัวเอง — ค่าหลุดวงคำศัพท์/บันไดปนแรงกระแทก = หยุดก่อนเขียน DB */
function selfCheck(): string[] {
  const errors: string[] = [];
  const catalogKeys = new Set(EXERCISE_CATALOG.map((e) => e.key));

  for (const key of catalogKeys) {
    if (!METADATA[key]) errors.push(`ท่าในคลังโค้ดยังไม่มีในตาราง: ${key}`);
  }
  for (const [key, m] of Object.entries(METADATA)) {
    if (!catalogKeys.has(key)) errors.push(`ตารางมี key ที่ไม่มีในคลังโค้ด: ${key}`);
    if (!PATTERNS.includes(m.pattern)) errors.push(`${key}: pattern ไม่อยู่ในวงคำศัพท์ (${m.pattern})`);
    if (m.difficulty < 1 || m.difficulty > 5) errors.push(`${key}: difficulty ต้องอยู่ 1-5`);
    if (m.primaryMuscles.length === 0) errors.push(`${key}: ไม่ได้ระบุกล้ามเนื้อหลัก`);
    for (const mu of m.primaryMuscles) if (!MUSCLES.includes(mu)) errors.push(`${key}: กล้ามเนื้อ "${mu}" ไม่อยู่ในวงคำศัพท์`);
    for (const eq of m.equipmentNeeded) if (!EQUIPMENT.includes(eq)) errors.push(`${key}: อุปกรณ์ "${eq}" ไม่อยู่ในวงคำศัพท์`);
    // ท่าที่ชื่อบอกว่าถือดัมเบล/บาร์เบล/เคตเทิล ต้อง loadable=true เสมอ (กติกาข้อ 1)
    const name = EXERCISE_CATALOG.find((e) => e.key === key)?.name ?? "";
    const handheld = /ดัมเบล|บาร์เบล|เคตเทิล/.test(name);
    if (handheld && !m.loadable) errors.push(`${key}: ชื่อบอกว่าถือน้ำหนัก แต่ loadable=false`);
    if (m.loadable && m.equipmentNeeded.length === 0) errors.push(`${key}: loadable=true แต่ไม่ได้ระบุอุปกรณ์`);
  }

  // บันไดเดียวกันห้ามปน impact สูง/ต่ำ + ห้ามปนหน่วยนับ (ครั้ง vs นาที) เพราะเทียบความก้าวหน้ากันไม่ได้
  const groups = new Map<string, string[]>();
  for (const [key, m] of Object.entries(METADATA)) {
    if (!m.progressionGroup) continue;
    groups.set(m.progressionGroup, [...(groups.get(m.progressionGroup) ?? []), key]);
  }
  for (const [g, keys] of groups) {
    if (keys.length < 2) errors.push(`บันได "${g}" มีท่าเดียว (${keys[0]}) — บันไดต้องมีอย่างน้อย 2 ขั้น`);
    const impacts = new Set(keys.map((k) => EXERCISE_CATALOG.find((e) => e.key === k)?.impact));
    if (impacts.size > 1) errors.push(`บันได "${g}" ปนแรงกระแทกสูง/ต่ำ: ${keys.join(", ")}`);
    const units = new Set(keys.map((k) => EXERCISE_CATALOG.find((e) => e.key === k)?.unit));
    if (units.size > 1) errors.push(`บันได "${g}" ปนหน่วยนับครั้ง/นาที: ${keys.join(", ")}`);
  }
  return errors;
}

const pad = (s: string, n: number) => {
  // ตัวอักษรไทยกว้างไม่เท่าอังกฤษก็จริง แต่ตารางนี้อ่านด้วยตา — นับตัวอักษรพอ
  const len = [...s].length;
  return s + " ".repeat(Math.max(0, n - len));
};

async function main() {
  const apply = process.argv.includes("--apply");
  const errors = selfCheck();
  if (errors.length) {
    console.error("❌ ตาราง metadata ไม่ผ่านด่านตรวจ:");
    for (const e of errors) console.error("   - " + e);
    process.exitCode = 1;
    return;
  }

  // อ่านแค่ key/name → --dry รันได้แม้คอลัมน์ใหม่ยังไม่ขึ้น DB
  let dbRows: { key: string; name: string }[] = [];
  try {
    dbRows = await prisma.exercise.findMany({ select: { key: true, name: true }, orderBy: { key: "asc" } });
  } catch (e) {
    console.warn("⚠️  อ่านตาราง exercises ไม่ได้ — แสดงตารางจากไฟล์อย่างเดียว", (e as Error).message);
  }
  const dbByKey = new Map(dbRows.map((r) => [r.key, r]));

  /* แถวที่แอดมินกรอก pattern ไว้แล้ว = ห้ามทับ
     คอลัมน์ pattern อาจยังไม่มีใน DB (schema ยังไม่ push) → ถือว่ายังไม่มีใครกรอก */
  let alreadySet = new Set<string>();
  try {
    const rows = await prisma.$queryRawUnsafe<{ key: string }[]>(
      `SELECT "key" FROM "exercises" WHERE "pattern" IS NOT NULL`
    );
    alreadySet = new Set(rows.map((r) => r.key));
  } catch {
    console.warn("⚠️  ยังไม่มีคอลัมน์ pattern ใน DB — ถือว่าทุกแถวยังว่าง (ต้อง push schema ก่อน --apply)");
  }

  const keys = EXERCISE_CATALOG.map((e) => e.key);
  console.log(`\nท่าในตาราง ${keys.length} ท่า · อยู่ใน DB ${dbRows.length} แถว\n`);
  console.log(
    pad("key", 18) + pad("ชื่อ", 24) + pad("pattern", 10) + pad("กล้ามเนื้อหลัก", 34) +
    pad("โหลด", 6) + pad("อุปกรณ์", 18) + pad("ยาก", 5) + pad("บันได", 10) + "สถานะ"
  );
  console.log("─".repeat(130));

  for (const key of keys) {
    const m = METADATA[key];
    const cat = EXERCISE_CATALOG.find((e) => e.key === key)!;
    const status = !dbByKey.has(key)
      ? "ไม่มีใน DB"
      : alreadySet.has(key)
        ? "มีค่าแล้ว-ข้าม"
        : "จะเติม";
    console.log(
      pad(key, 18) + pad(cat.name, 24) + pad(m.pattern, 10) + pad(m.primaryMuscles.join(","), 34) +
      pad(m.loadable ? "ใช่" : "-", 6) + pad(m.equipmentNeeded.join(",") || "ตัวเปล่า", 18) +
      pad(String(m.difficulty), 5) + pad(m.progressionGroup ?? "-", 10) + status
    );
  }

  const todo = keys.filter((k) => dbByKey.has(k) && !alreadySet.has(k));
  console.log(`\nสรุป: จะเติม ${todo.length} แถว · ข้าม (แอดมินกรอกแล้ว) ${keys.filter((k) => alreadySet.has(k)).length} · ไม่มีใน DB ${keys.filter((k) => !dbByKey.has(k)).length}`);

  if (!apply) {
    console.log("(ใส่ --apply เพื่อเขียนจริง — ต้อง push schema ขึ้น DB ก่อน)");
    return;
  }

  let written = 0;
  for (const key of todo) {
    const m = METADATA[key];
    // where pattern:null อีกชั้น — กันเคสแอดมินกรอกคั่นระหว่างที่สคริปต์กำลังรัน
    const res = await prisma.exercise.updateMany({
      where: { key, pattern: null },
      data: {
        pattern: m.pattern,
        primaryMuscles: m.primaryMuscles,
        loadable: m.loadable,
        equipmentNeeded: m.equipmentNeeded,
        difficulty: m.difficulty,
        progressionGroup: m.progressionGroup ?? null,
      },
    });
    written += res.count;
  }
  console.log(`✅ เติมแล้ว ${written} แถว`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
