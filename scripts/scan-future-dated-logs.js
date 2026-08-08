/**
 * สแกนหาบันทึกที่ "เวลาไทยดิบถูกเขียนลงเป็น UTC" — ลายเซ็นคือ date ≈ createdAt + 7 ชม.
 * (ตอนสร้าง แถวนั้นจะมี timestamp ล้ำอนาคตไป 7 ชม. → ตกไปอยู่หน้าต่างวันไทยของวันถัดไป)
 *
 * ครอบ exercise_logs / meal_logs / water_logs / weight_logs
 * (sleep_logs ไม่รวม — date ของมันเป็น "คีย์วัน BKK" ไม่ใช่ timestamp จริง เทียบแบบนี้ไม่ได้)
 *
 * ใช้: node scripts/scan-future-dated-logs.js          (dry-run — โชว์รายการอย่างเดียว)
 *      node scripts/scan-future-dated-logs.js --apply  (เลื่อนกลับ −7 ชม. เฉพาะแถวที่เข้าลายเซ็น)
 *
 * 🔴 เกณฑ์เข้มโดยตั้งใจ: ต้อง date − createdAt อยู่ระหว่าง +6.5 ถึง +7.5 ชม. เท่านั้น
 *    แถวที่ล้ำอนาคตด้วยเหตุอื่น (นาฬิกาเครื่องเพี้ยน ฯลฯ) จะขึ้นในรายงานแต่ไม่ถูกแก้อัตโนมัติ
 *    — วินิจฉัยไม่ชัด ห้ามเดาแล้วขยับข้อมูลจริง
 */
const { PrismaClient } = require("@prisma/client");

const HOUR = 3600_000;
const SIG_MIN = 6.5 * HOUR;
const SIG_MAX = 7.5 * HOUR;
const FUTURE_TOLERANCE = 1 * HOUR;

const bkk = (d) => new Date(d.getTime() + 7 * HOUR).toISOString().slice(0, 16).replace("T", " ");

const TABLES = [
  { key: "exercise_logs", model: "exerciseLog", label: "ออกกำลังกาย" },
  { key: "meal_logs", model: "mealLog", label: "อาหาร" },
  { key: "water_logs", model: "waterLog", label: "น้ำ" },
  { key: "weight_logs", model: "weightLog", label: "น้ำหนัก" },
];

(async () => {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  let totalFlagged = 0;
  let totalFixed = 0;
  let totalAmbiguous = 0;

  try {
    for (const t of TABLES) {
      const rows = await prisma[t.model].findMany({
        select: { id: true, memberId: true, date: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      const flagged = rows.filter((r) => r.date.getTime() - r.createdAt.getTime() > FUTURE_TOLERANCE);

      console.log(`\n── ${t.label} (${t.key}) — ทั้งหมด ${rows.length} แถว · ล้ำอนาคตตอนสร้าง ${flagged.length} แถว`);
      if (flagged.length === 0) {
        console.log("   ✅ ไม่พบความผิดปกติ");
        continue;
      }

      for (const r of flagged) {
        const diff = r.date.getTime() - r.createdAt.getTime();
        const isSignature = diff >= SIG_MIN && diff <= SIG_MAX;
        totalFlagged++;
        console.log(
          `   ${r.id}  date(BKK) ${bkk(r.date)}  created(BKK) ${bkk(r.createdAt)}  ` +
            `+${(diff / HOUR).toFixed(2)} ชม.  ${isSignature ? "→ เข้าลายเซ็น −7 ชม." : "⚠️ วินิจฉัยไม่ชัด (ไม่แก้อัตโนมัติ)"}`
        );
        if (!isSignature) { totalAmbiguous++; continue; }
        if (apply) {
          await prisma[t.model].update({
            where: { id: r.id },
            data: { date: new Date(r.date.getTime() - 7 * HOUR) },
          });
          totalFixed++;
        }
      }
    }

    console.log(
      `\nสรุป: พบผิดปกติ ${totalFlagged} แถว · วินิจฉัยไม่ชัด ${totalAmbiguous} แถว · ` +
        (apply ? `แก้แล้ว ${totalFixed} แถว` : "dry-run (ใส่ --apply เพื่อแก้จริง)")
    );
  } finally {
    await prisma.$disconnect();
  }
})();
