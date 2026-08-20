/**
 * ย้ายคลังท่าจาก exerciseCatalog.ts เข้าตาราง exercises — รัน: node scripts/seed-exercises.js --apply
 *
 * 🔴 create เฉพาะ key ที่ยังไม่มี — ห้าม update ทับ ไม่งั้นรูป/คลิป/คำอธิบายที่แอดมินแก้ไว้หายหมด
 * รันซ้ำได้ (idempotent) · เพิ่มท่าใหม่ในไฟล์คลังโค้ดแล้วรันซ้ำ = ท่าใหม่เข้า DB เอง
 */
const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  // ดึงคลังจากไฟล์ TS ผ่าน tsx (ไฟล์นั้นเป็น ESM/TS — require ตรง ๆ ไม่ได้)
  const json = execSync(
    `npx tsx -e "import { EXERCISE_CATALOG } from './src/lib/exerciseCatalog'; console.log(JSON.stringify(EXERCISE_CATALOG))"`,
    { cwd: __dirname + "/..", encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  ).trim();
  const catalog = JSON.parse(json.split("\n").pop());

  const existing = new Set((await prisma.exercise.findMany({ select: { key: true } })).map((e) => e.key));
  const missing = catalog.filter((e) => !existing.has(e.key));
  console.log(`คลังโค้ด ${catalog.length} ท่า · ใน DB แล้ว ${existing.size} · จะเพิ่ม ${missing.length}`);
  for (const e of missing) console.log(`  + ${e.key} — ${e.name}`);

  if (!apply) return console.log("\n(ใส่ --apply เพื่อเขียนจริง)");

  for (const e of missing) {
    await prisma.exercise.create({
      data: {
        key: e.key,
        name: e.name,
        kind: e.kind,
        equipment: e.equipment,
        impact: e.impact,
        unit: e.unit,
        met: e.met,
        muscles: e.muscles || null,
        cue: e.cue || null,
        // สื่อเดิมของคลังโค้ด (webp/mp4) ไม่ย้ายมาเป็น images — คนละชนิดสื่อ ให้แอดมินอัปรูปจริงแทน
        isCustom: false,
      },
    });
  }
  console.log(`✅ เพิ่มแล้ว ${missing.length} ท่า`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
