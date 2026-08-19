/**
 * เติมปฏิทินเมนูล่วงหน้า — ใช้ตอนเริ่มระบบและตอนทดสอบ
 *
 *   node scripts/seed-menu-calendar.js            ดูว่าจะใส่อะไรบ้าง (ไม่เขียน DB)
 *   node scripts/seed-menu-calendar.js --apply    เขียนจริง
 *   node scripts/seed-menu-calendar.js --apply --days 14 --from 2026-08-18
 *   node scripts/seed-menu-calendar.js --remove   ล้างช่วงที่ระบุ
 *
 * 🔴 ไม่ทับช่องที่ admin กรอกไว้แล้ว (เว้นแต่ --force)
 *    งานที่คนทำมือมีค่ากว่าเมนูที่สคริปต์สุ่มมาเสมอ
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TRACKS = {
  standard: [],
  no_seafood: ["กุ้ง", "ปลาหมึก", "หอย", "ปู", "ทะเล", "แซลมอน", "ทูน่า", "ปลา"],
  no_meat: ["หมู", "ไก่", "เนื้อ", "เบคอน", "ไส้กรอก"],
  vegetarian: ["กุ้ง", "ปลาหมึก", "หอย", "ปู", "ทะเล", "แซลมอน", "ทูน่า", "ปลา", "หมู", "ไก่", "เนื้อ", "เบคอน", "ไส้กรอก"],
};
/* มื้อว่างอยู่ในลิสต์ด้วย — หน้าโภชนาการในแอปโชว์ 4 มื้อเสมอ ถ้าปฏิทินไม่มีของว่างการ์ดใบที่ 3 จะโล่ง
   (SOLD_SLOTS ใน lib/program ยังไม่รวมมื้อว่าง = แถบรันเวย์ไม่ขึ้นแดงเพราะของว่างขาด) */
const SLOTS = ["เช้า", "กลางวัน", "ว่าง", "เย็น"];

/** เมนูหมวดไหนเหมาะกับมื้อไหน — โยเกิร์ตเป็นมื้อเย็นคือสิ่งที่ทำให้ลูกค้าเลิกใช้ */
function slotAllows(slot, categorySlug) {
  if (slot === "ว่าง") return categorySlug === "snack";
  if (slot === "เช้า") return categorySlug === "breakfast" || categorySlug === "snack";
  return categorySlug !== "snack" && categorySlug !== "breakfast";
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const bkkToday = () => {
  const b = new Date(Date.now() + 7 * 3600 * 1000);
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
};
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const key = (d) => d.toISOString().slice(0, 10);

async function main() {
  const days = Number(arg("days", 14));
  const from = arg("from") ? new Date(`${arg("from")}T00:00:00Z`) : addDays(bkkToday(), 1);
  const apply = has("apply");
  const force = has("force");

  if (has("remove")) {
    const where = { date: { gte: from, lt: addDays(from, days) } };
    const n = await prisma.menuCalendarItem.count({ where });
    if (apply) {
      await prisma.menuCalendarItem.deleteMany({ where });
      console.log(`ลบแล้ว ${n} มื้อ`);
    } else {
      console.log(`จะลบ ${n} มื้อ (ใส่ --apply เพื่อลบจริง)`);
    }
    return;
  }

  const foods = await prisma.food.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ingredients: true, calories: true, protein: true, category: { select: { slug: true } } },
    orderBy: { name: "asc" },
  });

  const existing = await prisma.menuCalendarItem.findMany({
    where: { date: { gte: from, lt: addDays(from, days) } },
    select: { date: true, track: true, slot: true },
  });
  const taken = new Set(existing.map((e) => `${key(e.date)}|${e.track}|${e.slot}`));

  let planned = 0;
  let skipped = 0;
  const rows = [];

  for (const [track, forbid] of Object.entries(TRACKS)) {
    const pool = foods.filter((f) => {
      const blob = `${f.name} ${(f.ingredients || []).join(" ")}`;
      return !forbid.some((kw) => blob.includes(kw));
    });

    const bySlot = {};
    for (const slot of SLOTS) {
      bySlot[slot] = pool.filter((f) => slotAllows(slot, f.category?.slug));
      if (bySlot[slot].length === 0) console.log(`⚠️ ${track} · ${slot}: ไม่มีเมนูที่ใช้ได้เลย`);
    }

    /*
     * ไล่ทีละวันไม่ใช่ทีละมื้อ เพื่อกัน "กลางวันกับเย็นเป็นจานเดียวกัน"
     * ซึ่งเกิดแน่นอนเมื่อคลังของสายนั้นเล็ก (สายมังสวิรัติมีจานหลักแค่ไม่กี่อย่าง)
     */
    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      const usedToday = new Set();

      for (const slot of SLOTS) {
        const usable = bySlot[slot];
        if (usable.length === 0) continue;

        const k = `${key(date)}|${track}|${slot}`;
        if (taken.has(k) && !force) {
          skipped++;
          continue;
        }

        // เริ่มจากตำแหน่งหมุนตามวัน แล้วเลื่อนต่อจนเจอจานที่ยังไม่ใช้วันนี้
        const start = (i + SLOTS.indexOf(slot) * 3) % usable.length;
        let food = usable[start];
        for (let n = 1; n < usable.length && usedToday.has(food.id); n++) {
          food = usable[(start + n) % usable.length];
        }
        if (usedToday.has(food.id)) {
          console.log(`⚠️ ${track} · ${key(date)} · ${slot}: เมนูในสายนี้ไม่พอ ต้องใช้จานซ้ำกับมื้ออื่นในวันเดียวกัน`);
        }
        usedToday.add(food.id);

        rows.push({ date, track, slot, foodId: food.id, name: food.name });
        planned++;
      }
    }
  }

  console.log(`ช่วง ${key(from)} → ${key(addDays(from, days - 1))} (${days} วัน)`);
  console.log(`จะใส่ ${planned} มื้อ · ข้ามที่มีอยู่แล้ว ${skipped} มื้อ`);

  // ตัวอย่างวันแรกให้เห็นว่าเมนูสมเหตุสมผลไหม
  const first = rows.filter((r) => key(r.date) === key(from));
  for (const t of Object.keys(TRACKS)) {
    const line = SLOTS.map((s) => {
      const hit = first.find((r) => r.track === t && r.slot === s);
      return `${s}: ${hit ? hit.name : "-"}`;
    }).join(" | ");
    console.log(`  ${t.padEnd(12)} ${line}`);
  }

  if (!apply) {
    console.log("\n(ใส่ --apply เพื่อเขียนจริง)");
    return;
  }

  for (const r of rows) {
    await prisma.menuCalendarItem.upsert({
      where: { date_track_slot: { date: r.date, track: r.track, slot: r.slot } },
      create: { date: r.date, track: r.track, slot: r.slot, foodId: r.foodId },
      update: { foodId: r.foodId },
    });
  }
  console.log(`\n✅ เขียนแล้ว ${rows.length} มื้อ`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
