/**
 * ซ่อมชื่อ workout เก่าที่เก็บเป็นรหัสตัวเลข (เช่น "52") → ชื่อไทย ("เดิน")
 *
 * ต้นเหตุ: /api/health/sync เดิมเอา HKWorkoutActivityType ดิบมาเป็นชื่อ
 * รันซ้ำได้ (idempotent) — แตะเฉพาะแถว source = healthkit|watch ที่ name เป็นตัวเลขล้วน
 * ไม่แตะ name/field อื่นของแถวจริง
 *
 * ใช้: node scripts/fix-healthkit-workout-names.js          (dry-run ดูก่อน)
 *      node scripts/fix-healthkit-workout-names.js --apply  (แก้จริง)
 *
 * ตารางรหัส→ชื่อ = src/lib/healthkitWorkout.ts (ที่มาของเลข: enum จริงของ
 * @kingstinct/react-native-healthkit ที่แอป coach-app ใช้)
 */
const { PrismaClient } = require("@prisma/client");

const HK_WORKOUT_FALLBACK = "ออกกำลังกาย (Watch)";
const HK_WORKOUT_TH = {
  1: "อเมริกันฟุตบอล", 2: "ยิงธนู", 3: "ออสเตรเลียนฟุตบอล", 4: "แบดมินตัน", 5: "เบสบอล",
  6: "บาสเกตบอล", 7: "โบว์ลิ่ง", 8: "ชกมวย", 9: "ปีนผา", 10: "คริกเก็ต", 11: "ครอสเทรนนิ่ง",
  12: "เคิร์ลลิง", 13: "ปั่นจักรยาน", 14: "เต้น", 15: "เต้นออกกำลังกาย", 16: "เครื่องเดินวงรี",
  17: "ขี่ม้า", 18: "ฟันดาบ", 19: "ตกปลา", 20: "เวทแบบฟังก์ชัน", 21: "กอล์ฟ", 22: "ยิมนาสติก",
  23: "แฮนด์บอล", 24: "เดินป่า", 25: "ฮอกกี้", 26: "ล่าสัตว์", 27: "ลาครอส", 28: "ศิลปะการต่อสู้",
  29: "กายและใจ", 30: "คาร์ดิโอผสม", 31: "พายเรือ/ซัพบอร์ด", 32: "เล่นสนุก", 33: "วอร์มอัพ/คูลดาวน์",
  34: "แร็กเกตบอล", 35: "พายเรือ", 36: "รักบี้", 37: "วิ่ง", 38: "แล่นเรือใบ", 39: "สเกต",
  40: "กีฬาหิมะ", 41: "ฟุตบอล", 42: "ซอฟต์บอล", 43: "สควอช", 44: "เดินขึ้นบันได", 45: "โต้คลื่น",
  46: "ว่ายน้ำ", 47: "เทเบิลเทนนิส", 48: "เทนนิส", 49: "กรีฑา", 50: "เวทเทรนนิ่ง", 51: "วอลเลย์บอล",
  52: "เดิน", 53: "แอโรบิกในน้ำ", 54: "โปโลน้ำ", 55: "กีฬาทางน้ำ", 56: "มวยปล้ำ", 57: "โยคะ",
  58: "บาร์", 59: "เทรนแกนกลางลำตัว", 60: "สกีทางไกล", 61: "สกีลงเขา", 62: "ยืดเหยียด", 63: "HIIT",
  64: "กระโดดเชือก", 65: "คิกบ็อกซิ่ง", 66: "พิลาทิส", 67: "สโนว์บอร์ด", 68: "ขึ้นบันได",
  69: "สเต็ปเทรนนิ่ง", 70: "เข็นวีลแชร์ (เดิน)", 71: "เข็นวีลแชร์ (วิ่ง)", 72: "ไทเก๊ก",
  73: "คาร์ดิโอ", 74: "ปั่นด้วยมือ", 75: "กีฬาจานร่อน", 76: "เกมออกกำลังกาย", 77: "คาร์ดิโอแดนซ์",
  78: "ลีลาศ", 79: "พิกเคิลบอล", 80: "คูลดาวน์", 82: "ไตรกีฬา", 83: "ช่วงเปลี่ยนกีฬา",
  84: "ดำน้ำ", 3000: HK_WORKOUT_FALLBACK,
};

(async () => {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.exerciseLog.findMany({
      where: { source: { in: ["healthkit", "watch"] } },
      select: { id: true, memberId: true, name: true, type: true, date: true },
      orderBy: { date: "desc" },
    });
    const targets = rows.filter((r) => /^\d+$/.test((r.name || "").trim()));

    console.log(`แถว healthkit/watch ทั้งหมด: ${rows.length} · ชื่อเป็นตัวเลขล้วน: ${targets.length}`);
    const plan = targets.map((r) => ({
      id: r.id,
      from: r.name,
      to: HK_WORKOUT_TH[Number(r.name)] ?? HK_WORKOUT_FALLBACK,
      date: r.date.toISOString(),
    }));
    plan.forEach((p) => console.log(`  ${p.date}  "${p.from}" → "${p.to}"`));

    if (!apply) {
      console.log("\n(dry-run — ใส่ --apply เพื่อแก้จริง)");
      return;
    }
    let fixed = 0;
    for (const p of plan) {
      await prisma.exerciseLog.update({ where: { id: p.id }, data: { name: p.to } });
      fixed++;
    }
    console.log(`\n✅ ซ่อมแล้ว ${fixed} แถว`);
  } finally {
    await prisma.$disconnect();
  }
})();
