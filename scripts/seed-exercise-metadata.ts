/**
 * เติม metadata ให้ท่าออกกำลังกาย 46 ท่า (pattern / กล้ามเนื้อหลัก / loadable / อุปกรณ์ / ความยาก / บันได)
 * รัน: npx tsx scripts/seed-exercise-metadata.ts --dry   (ดูตารางก่อน — ไม่แตะ DB)
 *      npx tsx scripts/seed-exercise-metadata.ts --apply (เขียนจริง)
 *
 * 🔴 --apply อัปเดตเฉพาะแถวที่ pattern ยังว่าง — ของที่แอดมินแก้เองแล้วห้ามทับ
 * 🔴 ตารางข้างล่างคือ "ด่านความปลอดภัย" ของทั้งเฟส: ค่าที่ผิดทำให้ระบบจัดท่าแทน/บันไดความยากผิด
 *    → hardcode ไว้ในไฟล์นี้ให้คนไล่อ่านทีละแถวได้ ไม่ให้ AI เดาตอนรัน
 *
 * --dry ต้องรันได้แม้คอลัมน์ใหม่ยังไม่ถูก push ขึ้น DB (อ่านแค่ key/name) — ตารางมาจากไฟล์นี้ล้วน ๆ
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
 * กติกาที่ใช้ตัดสินตอนกรอกตารางนี้
 *  1. loadable = true เฉพาะท่าที่ "ถือดัมเบล/บาร์เบล/เคตเทิล" เท่านั้น
 *     เครื่องฟิตเนสใส่น้ำหนักได้ก็จริง แต่เราไม่รู้ก้าวของ pin stack ของยิมแต่ละที่ → สั่งกิโลไปก็เชื่อไม่ได้
 *  2. progressionGroup ใส่เฉพาะที่มีบันไดจริง (pushup / squat_bw / plank / row) — ท่าที่ขึ้นน้ำหนักได้ไม่ต้องมีบันได
 *  3. ห้ามปนท่า impact สูง (กระโดด/วิ่ง) กับ impact ต่ำในบันไดเดียวกัน — คนเข่าไม่ดีต้องไม่ถูกดันขึ้นท่ากระโดด
 *     (มีด่านตรวจอัตโนมัติท้ายไฟล์ อ่าน impact จาก exerciseCatalog.ts)
 *  4. ท่าเสริมกล้ามเล็ก (น่อง/แขน) จัด pattern ตามวันที่มันอยู่จริงในโปรแกรม push/pull/legs
 *     — calf_raise=squat(วันขา) · db_curl=pull_h(วันดึง) · db_tricep=push_h(วันดัน)
 */
const METADATA: Record<string, Meta> = {
  // ── ตัวเปล่า: คาร์ดิโอ ──
  walk_fast:        { pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  jog_light:        { pattern: "cardio", primaryMuscles: ["quads", "hamstrings", "calves"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  stair_step:       { pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  jumping_jack:     { pattern: "cardio", primaryMuscles: ["full_body", "calves", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  mountain_climber: { pattern: "cardio", primaryMuscles: ["core", "hip_flexors", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  burpee:           { pattern: "cardio", primaryMuscles: ["full_body", "quads", "chest"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  shadow_box:       { pattern: "cardio", primaryMuscles: ["shoulders", "core", "back"], loadable: false, equipmentNeeded: [], difficulty: 2 },

  // ── ตัวเปล่า: กำลัง ──
  // บันได squat_bw: สควอทสองขา(2) → สเต็ปอัพขาเดียว(3) → ลันจ์(4) ทั้งหมด impact ต่ำ นับครั้งเหมือนกัน
  squat_bw:      { pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "squat_bw" },
  // นั่งพิงกำแพงเป็นท่าค้างจับเวลา (คนละหน่วยกับบันไดที่นับครั้ง) → ไม่เข้าบันได
  wall_sit:      { pattern: "squat", primaryMuscles: ["quads"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  lunge:         { pattern: "lunge", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "squat_bw" },
  glute_bridge:  { pattern: "hinge", primaryMuscles: ["glutes", "hamstrings", "lower_back"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  pushup:        { pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "pushup" },
  pushup_knee:   { pattern: "push_h", primaryMuscles: ["chest", "triceps", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "pushup" },
  plank:         { pattern: "core", primaryMuscles: ["core", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "plank" },
  side_plank:    { pattern: "core", primaryMuscles: ["obliques", "core"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "plank" },
  crunch:        { pattern: "core", primaryMuscles: ["core"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  bicycle_crunch:{ pattern: "core", primaryMuscles: ["core", "obliques"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  superman:      { pattern: "core", primaryMuscles: ["lower_back", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  bird_dog:      { pattern: "core", primaryMuscles: ["core", "lower_back", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  calf_raise:    { pattern: "squat", primaryMuscles: ["calves"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  step_up:       { pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "squat_bw" },

  // ── ตัวเปล่า: ยืดเหยียด/ฟื้นฟู ──
  stretch_full: { pattern: "mobility", primaryMuscles: ["full_body"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  yoga_basic:   { pattern: "mobility", primaryMuscles: ["full_body", "core"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  cat_cow:      { pattern: "mobility", primaryMuscles: ["lower_back", "core"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  hip_stretch:  { pattern: "mobility", primaryMuscles: ["hip_flexors", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },

  // ── ดัมเบล / ยางยืด (home) ──
  db_squat:        { pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  db_row:          { pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3, progressionGroup: "row" },
  db_press:        { pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  db_curl:         { pattern: "pull_h", primaryMuscles: ["biceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  db_tricep:       { pattern: "push_h", primaryMuscles: ["triceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  db_rdl:          { pattern: "hinge", primaryMuscles: ["hamstrings", "glutes", "lower_back"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  // ยางยืดไม่ได้ชั่งเป็นกิโล (แรงต้านขึ้นกับเส้น/ระยะยืด) → loadable=false เดินหน้าด้วยจำนวนครั้ง/เส้นที่หนักขึ้น
  band_row:        { pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2, progressionGroup: "row" },
  band_pull_apart: { pattern: "pull_h", primaryMuscles: ["shoulders", "traps", "back"], loadable: false, equipmentNeeded: ["band"], difficulty: 1 },
  farmer_walk:     { pattern: "carry", primaryMuscles: ["forearms", "traps", "core"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },

  // ── ฟิตเนส (gym) ──
  treadmill:       { pattern: "cardio", primaryMuscles: ["quads", "hamstrings", "calves"], loadable: false, equipmentNeeded: ["treadmill"], difficulty: 2 },
  stationary_bike: { pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: ["bike"], difficulty: 1 },
  elliptical:      { pattern: "cardio", primaryMuscles: ["full_body", "quads"], loadable: false, equipmentNeeded: ["machine"], difficulty: 1 },
  rowing_machine:  { pattern: "cardio", primaryMuscles: ["back", "quads", "lats"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
  lat_pulldown:    { pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  chest_press:     { pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  leg_press:       { pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  leg_curl:        { pattern: "hinge", primaryMuscles: ["hamstrings"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  cable_row:       { pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 4, progressionGroup: "row" },
  barbell_bench:   { pattern: "push_h", primaryMuscles: ["chest", "triceps", "shoulders"], loadable: true, equipmentNeeded: ["barbell", "bench"], difficulty: 4 },
  barbell_squat:   { pattern: "squat", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 4 },
  pullup_assist:   { pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
};

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
