/**
 * ตัวรันข้อสอบทั้งหมด — รัน: pnpm test:engines
 *
 * ทำไมต้อง auto-discover: ก่อนหน้านี้ package.json ลิสต์ชื่อไฟล์ทีละตัว
 * → เขียนเทสใหม่แล้วลืมผูก = ข้อสอบที่ไม่มีใครรัน (เคยค้าง 5 ชุด)
 * ตัวนี้กวาด scripts/test-*.ts ทั้งโฟลเดอร์เอง ไฟล์ใหม่เข้าอัตโนมัติ
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname);
const files = readdirSync(dir)
  .filter((f) => /^test-.+\.ts$/.test(f))
  .sort();

if (files.length === 0) {
  console.error("❌ ไม่พบไฟล์เทสเลยใน scripts/ — ผิดปกติ");
  process.exit(1);
}

console.log(`▶ พบข้อสอบ ${files.length} ชุด\n`);

const failed: string[] = [];
for (const f of files) {
  console.log(`\n════════ ${f} ════════`);
  const r = spawnSync("npx", ["tsx", path.join(dir, f)], { stdio: "inherit" });
  if (r.status !== 0) failed.push(f);
}

console.log(`\n════════ สรุป ════════`);
console.log(`ชุดทั้งหมด ${files.length} · ผ่าน ${files.length - failed.length} · ตก ${failed.length}`);
if (failed.length) {
  for (const f of failed) console.log(`  ❌ ${f}`);
  process.exit(1);
}
console.log("✅ ผ่านครบทุกชุด");
