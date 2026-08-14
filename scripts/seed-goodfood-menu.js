/**
 * สร้างเมนูตั้งต้นของ goodfood 30 รายการ (14 ส.ค. 2026)
 *
 * 🔴 โภชนาการ "ไม่ได้แต่งเอง" — คำนวณจากตาราง food_catalog (คลังอาหารไทย 856 รายการ
 *    ที่ผ่าน QC gate มาแล้ว: ช่วงค่าสมเหตุผล + |4P+4C+9F−kcal| ≤ 35%)
 *    แต่ละกล่อง = ผลรวมของวัตถุดิบจริงที่ระบุไว้ → ตรวจย้อนกลับได้ทุกตัวเลข
 *
 * รันซ้ำได้ (idempotent): upsert ด้วย sku · ไม่ลบของที่แอดมินแก้เอง
 *   node scripts/seed-goodfood-menu.js            # ดูอย่างเดียว
 *   node scripts/seed-goodfood-menu.js --apply    # เขียนจริง
 *   node scripts/seed-goodfood-menu.js --remove   # ลบเฉพาะที่สคริปต์นี้สร้าง (sku ขึ้นต้น GF-)
 *
 * ⚠️ ราคาเป็นค่าตั้งต้นจากสูตร (ฐาน + แคลอรี่ + โปรตีน) — แอดมินต้องรีวิวก่อนขายจริง
 * ⚠️ รูปภาพยังว่าง (imageUrl = null) — ต้องอัปเองในหลังบ้าน
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");

/** หมวดสินค้าที่จะสร้าง (slug ใช้เป็นคีย์ upsert) */
const CATEGORIES = [
  { slug: "breakfast", name: "มื้อเช้า", color: "#f59e0b", order: 1 },
  { slug: "rice-bowl", name: "จานเดียว", color: "#3b82f6", order: 2 },
  { slug: "high-protein", name: "โปรตีนสูง", color: "#a78bfa", order: 3 },
  { slug: "plant-based", name: "มังสวิรัติ", color: "#34d399", order: 4 },
  { slug: "snack", name: "ของว่าง", color: "#38bdf8", order: 5 },
];

/**
 * 30 กล่อง — [sku, ชื่อ, หมวด, [[ชื่อวัตถุดิบในคลัง, จำนวน], ...], คำอธิบาย]
 * จัดสัดส่วนไว้ 3 ช่วงแคลอรี่ เพื่อให้ระบบจัดแผนเลือกได้ครบทุกมื้อ:
 *   เบา ~250-420 (มื้อเช้า/ว่าง) · กลาง ~420-580 (กลางวัน/เย็น) · สูง ≥580 หรือโปรตีน ≥40 ก.
 */
const BOXES = [
  // ── มื้อเช้า / เบา ──
  ["GF-01", "ข้าวต้มอกไก่ผักรวม", "breakfast",
    [["ข้าวกล้อง 1 ทัพพี", 1], ["อกไก่ต้ม 100 กรัม", 1], ["ผักลวกรวม", 1]],
    "ข้าวกล้องต้มกับอกไก่ฉีก เสิร์ฟผักลวกรวม ย่อยง่าย เหมาะเริ่มวัน"],
  ["GF-02", "ข้าวโอ๊ตนมกล้วยหอม", "breakfast",
    [["ข้าวโอ๊ตต้มนม", 1], ["กล้วยหอม", 1]],
    "ข้าวโอ๊ตต้มนมจืด ท็อปกล้วยหอม ให้พลังงานค่อย ๆ ปล่อย อิ่มยาวถึงเที่ยง"],
  ["GF-03", "กรีกโยเกิร์ตเมล็ดเจียกล้วย", "breakfast",
    [["กรีกโยเกิร์ตไม่หวาน", 1], ["เมล็ดเจีย 1 ช้อนโต๊ะ", 1], ["กล้วยหอม", 1]],
    "กรีกโยเกิร์ตไม่เติมน้ำตาล โปรตีนสูง ใยอาหารจากเมล็ดเจีย"],
  ["GF-04", "สลัดไข่ต้มขนมปังโฮลวีต", "breakfast",
    [["สลัดไข่ต้มโฮลวีต", 1]],
    "สลัดผักสดกับไข่ต้มและขนมปังโฮลวีต มื้อเช้าเบาแต่อยู่ท้อง"],
  ["GF-05", "ข้าวไรซ์เบอร์รีสลัดอกไก่", "breakfast",
    [["สลัดอกไก่", 1], ["ข้าวไรซ์เบอร์รี 1 ทัพพี", 1]],
    "อกไก่ย่างบนสลัดผัก คู่ข้าวไรซ์เบอร์รี ดัชนีน้ำตาลต่ำ"],
  ["GF-06", "ข้าวกล้องไข่ขาวผักลวก", "breakfast",
    [["ไข่ขาวต้ม 3 ฟอง", 1], ["ข้าวกล้อง 1 ทัพพี", 1], ["ผักลวกรวม", 1]],
    "ไขมันต่ำมาก โปรตีนจากไข่ขาวล้วน เหมาะช่วงคุมแคลอรี่เข้ม"],
  ["GF-07", "เต้าหู้นึ่งข้าวไรซ์เบอร์รี", "plant-based",
    [["เต้าหู้ขาวนึ่ง", 1], ["ผักลวกรวม", 1], ["ข้าวไรซ์เบอร์รี 1 ทัพพี", 1]],
    "มังสวิรัติ ไม่มีเนื้อสัตว์ โปรตีนจากเต้าหู้ ย่อยง่าย"],
  ["GF-08", "มันหวานญี่ปุ่นไข่ต้มบรอกโคลี", "breakfast",
    [["มันหวานญี่ปุ่นนึ่ง", 1], ["ไข่ต้ม 2 ฟอง", 1], ["บรอกโคลีลวก", 1]],
    "คาร์บเชิงซ้อนจากมันหวาน คู่ไข่ต้มและบรอกโคลี"],

  // ── จานเดียว กลางวัน/เย็น ──
  ["GF-09", "โบว์ลข้าวกล้องอกไก่", "rice-bowl",
    [["โบว์ลข้าวกล้องอกไก่", 1]],
    "ข้าวกล้อง อกไก่ย่าง ผักรวม ครบในกล่องเดียว เมนูขายดีพื้นฐาน"],
  ["GF-10", "สเต๊กอกไก่ข้าวกล้องผักนึ่ง", "high-protein",
    [["สเต๊กอกไก่ + ผักนึ่ง", 1], ["ข้าวกล้อง 1 ทัพพี", 1]],
    "อกไก่ย่างชิ้นใหญ่ ผักนึ่ง ข้าวกล้อง โปรตีนสูงไขมันต่ำ"],
  ["GF-11", "ปลาอบข้าวกล้องผักลวก", "rice-bowl",
    [["ปลาอบ 100 กรัม", 1], ["ข้าวกล้อง 1 ทัพพี", 1], ["ผักลวกรวม", 1], ["น้ำมันมะกอก 1 ช้อนโต๊ะ", 1]],
    "ปลาอบราดน้ำมันมะกอก ไขมันดี โซเดียมต่ำ"],
  ["GF-12", "ปลาทูนึ่งข้าวไรซ์เบอร์รี", "rice-bowl",
    [["ปลาทูนึ่ง", 1], ["ข้าวไรซ์เบอร์รี 1 ทัพพี", 2], ["ผักลวกรวม", 1]],
    "ปลาทูนึ่งเนื้อแน่น โอเมกา 3 สูง คู่ข้าวไรซ์เบอร์รี"],
  ["GF-13", "ผัดบรอกโคลีกุ้งข้าวกล้อง", "rice-bowl",
    [["ผัดบรอกโคลีกุ้ง", 1], ["ข้าวกล้อง 1 ทัพพี", 1], ["ผักลวกรวม", 1]],
    "กุ้งผัดบรอกโคลีน้ำมันน้อย เสิร์ฟข้าวกล้อง"],
  ["GF-14", "ข้าวกล้องผัดไข่ขาวอกไก่ย่าง", "high-protein",
    [["ข้าวกล้องผัดไข่ขาว", 1], ["อกไก่ย่าง 100 กรัม", 1]],
    "ข้าวผัดไข่ขาวไขมันต่ำ เพิ่มอกไก่ย่าง โปรตีนแน่น"],
  ["GF-15", "ทูน่าสเต๊กข้าวไรซ์เบอร์รี", "high-protein",
    [["ปลาทูน่าสเต๊ก", 1], ["ข้าวไรซ์เบอร์รี 1 ทัพพี", 2], ["ผักลวกรวม", 1]],
    "ทูน่าสเต๊กย่าง โปรตีนสูงมาก ไขมันต่ำ"],
  ["GF-16", "ควินัวสลัดอกไก่", "high-protein",
    [["ควินัวสุก 1 ถ้วย", 1], ["สลัดอกไก่", 1]],
    "ควินัวโปรตีนครบถ้วน คู่สลัดอกไก่ย่าง"],
  ["GF-17", "ต้มยำกุ้งน้ำใสข้าวกล้อง", "rice-bowl",
    [["ต้มยำกุ้งน้ำใส", 1], ["ข้าวกล้อง 1 ทัพพี", 2], ["ผักลวกรวม", 1]],
    "ต้มยำน้ำใสไม่ใส่กะทิ เผ็ดกลาง กุ้งเนื้อแน่น"],
  ["GF-18", "ปลานึ่งซีอิ๊วข้าวกล้อง", "rice-bowl",
    [["ปลานึ่งซีอิ๊ว", 1], ["ข้าวกล้อง 1 ทัพพี", 1]],
    "ปลานึ่งซีอิ๊วเนื้อนุ่ม โปรตีนสูง (โซเดียมค่อนข้างสูง)"],
  ["GF-19", "ผัดถั่วงอกเต้าหู้ข้าวไรซ์เบอร์รี", "plant-based",
    [["ผัดถั่วงอกเต้าหู้", 1], ["ข้าวไรซ์เบอร์รี 1 ทัพพี", 2], ["ผักลวกรวม", 1]],
    "มังสวิรัติ โปรตีนจากเต้าหู้ ผักสด ๆ เต็มกล่อง"],
  ["GF-20", "ข้าวกล้องถั่วแดงบรอกโคลี", "plant-based",
    [["ข้าวกล้อง 1 ทัพพี", 2], ["ถั่วแดงต้ม", 1], ["บรอกโคลีลวก", 1], ["น้ำมันมะกอก 1 ช้อนโต๊ะ", 1]],
    "วีแกน 100% โปรตีนจากถั่วแดง ใยอาหารสูง"],
  ["GF-21", "สเต๊กแซลมอนผักลวก", "high-protein",
    [["สเต๊กปลาแซลมอน", 1], ["ผักลวกรวม", 1]],
    "แซลมอนย่าง โอเมกา 3 สูง คาร์บต่ำ เหมาะมื้อเย็น"],
  ["GF-22", "อกไก่พริกไทยดำข้าวกล้อง", "rice-bowl",
    [["อกไก่ผัดพริกไทยดำคลีน", 1], ["ข้าวกล้อง 1 ทัพพี", 1], ["ผักลวกรวม", 1]],
    "อกไก่ผัดพริกไทยดำ รสกลมกล่อม ไม่เผ็ด"],

  // ── โปรตีนสูง ──
  ["GF-23", "อกไก่ย่างชิ้นใหญ่ข้าวกล้อง", "high-protein",
    [["อกไก่ย่างชิ้นใหญ่ 150 กรัม", 1], ["ข้าวกล้อง 1 ทัพพี", 2], ["บรอกโคลีลวก", 1]],
    "อกไก่ย่าง 150 กรัม โปรตีนสูงสุดในเมนู เหมาะวันเล่นเวท"],
  ["GF-24", "ทูน่าควินัวสลัด", "high-protein",
    [["ปลาทูน่าสเต๊ก", 1], ["ควินัวสุก 1 ถ้วย", 1], ["สลัดผักน้ำใส", 1]],
    "ทูน่าย่างกับควินัวและสลัดน้ำใส คาร์บดี โปรตีนแน่น"],
  ["GF-25", "กุ้งเผาข้าวกล้องผักลวก", "high-protein",
    [["กุ้งเผา 5 ตัว", 1], ["ข้าวกล้อง 1 ทัพพี", 2], ["ผักลวกรวม", 1]],
    "กุ้งเผาสด ไม่ผ่านน้ำมัน ไขมันต่ำมาก"],
  ["GF-26", "อกไก่ฉีกข้าวโพดข้าวไรซ์เบอร์รี", "high-protein",
    [["อกไก่ฉีกกับข้าวโพด", 1], ["ข้าวไรซ์เบอร์รี 1 ทัพพี", 2]],
    "อกไก่ฉีกคลุกข้าวโพดหวาน คู่ข้าวไรซ์เบอร์รี"],
  ["GF-27", "ซาชิมิแซลมอนข้าวสวยสลัด", "high-protein",
    [["ซาชิมิแซลมอน 5 ชิ้น", 1], ["ข้าวสวย", 1], ["สลัดผักน้ำใส", 1]],
    "แซลมอนดิบเกรดซาชิมิ คู่ข้าวสวยและสลัดน้ำใส"],
  ["GF-28", "สลัดทูน่าควินัว", "high-protein",
    [["สลัดทูน่า", 1], ["ควินัวสุก 1 ถ้วย", 1]],
    "สลัดทูน่าเนื้อแน่น เพิ่มควินัวให้อยู่ท้อง"],

  // ── ของว่าง ──
  ["GF-29", "กรีกโยเกิร์ตเมล็ดเจีย", "snack",
    [["กรีกโยเกิร์ตไม่หวาน", 1], ["เมล็ดเจีย 1 ช้อนโต๊ะ", 1]],
    "ของว่างโปรตีนสูง ไม่เติมน้ำตาล"],
  ["GF-30", "กล้วยหอมเนยถั่ว", "snack",
    [["กล้วยหอม", 1], ["เนยถั่ว 1 ช้อนโต๊ะ", 1]],
    "ของว่างก่อนออกกำลังกาย พลังงานพร้อมใช้"],
];

/**
 * แพ็กเกจผูกปิ่นโต — ราคาจริงคิดจาก "เมนูที่ลูกค้าเลือกจริง" (user เคาะ 14 ส.ค.)
 * ราคาในตารางนี้จึงเป็นแค่ "ราคาโดยประมาณ" ไว้โชว์ตอนเลือกแพ็กเกจ
 */
const PACKAGES = [
  { name: "ผูกปิ่นโต 7 วัน", days: 7, mealsPerDay: 3 },
  { name: "ผูกปิ่นโต 14 วัน", days: 14, mealsPerDay: 3 },
  { name: "ผูกปิ่นโต 30 วัน", days: 30, mealsPerDay: 3 },
];

/** ราคาตั้งต้น = ฐาน + ตามแคลอรี่ + ตามโปรตีน แล้วปัดขึ้นหลัก 5 (แอดมินแก้ทีหลังได้) */
function suggestPrice(kcal, protein) {
  const raw = 45 + kcal * 0.06 + protein * 0.9;
  return Math.ceil(raw / 5) * 5;
}

async function main() {
  if (REMOVE) {
    const del = await prisma.food.deleteMany({ where: { sku: { startsWith: "GF-" } } });
    console.log(`ลบเมนูที่สคริปต์สร้างไว้ ${del.count} รายการ`);
    return;
  }

  const catalog = await prisma.foodCatalog.findMany({
    select: { name: true, portion: true, calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true },
  });
  const byName = new Map(catalog.map((c) => [c.name, c]));

  // ตรวจก่อนว่าวัตถุดิบทุกตัวมีจริงในคลัง — ขาดแม้ตัวเดียวต้องหยุด ไม่ใช่เดาค่าแทน
  const missing = new Set();
  for (const [, , , parts] of BOXES) {
    for (const [name] of parts) if (!byName.has(name)) missing.add(name);
  }
  if (missing.size) {
    console.error("🔴 ไม่พบวัตถุดิบในคลัง:", [...missing].join(" · "));
    process.exit(1);
  }

  const rows = BOXES.map(([sku, name, catSlug, parts, description]) => {
    const sum = { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, sugar: 0 };
    const ingredients = [];
    for (const [n, qty] of parts) {
      const c = byName.get(n);
      sum.calories += c.calories * qty;
      sum.protein += c.protein * qty;
      sum.carbs += c.carbs * qty;
      sum.fat += c.fat * qty;
      sum.sodium += (c.sodium ?? 0) * qty;
      sum.sugar += (c.sugar ?? 0) * qty;
      ingredients.push(qty > 1 ? `${n} ×${qty}` : n);
    }
    const r = (x) => Math.round(x);
    return {
      sku, name, catSlug, description, ingredients,
      calories: r(sum.calories), protein: r(sum.protein), carbs: r(sum.carbs),
      fat: r(sum.fat), sodium: r(sum.sodium), sugar: r(sum.sugar),
      price: suggestPrice(sum.calories, sum.protein),
    };
  });

  // สรุปให้ดูก่อนเขียน — ต้องเห็นว่ากระจายครบ 3 ช่วงแคลอรี่จริง
  const band = (k) => (k < 420 ? "เบา" : k < 580 ? "กลาง" : "สูง");
  const counts = {};
  for (const r of rows) counts[band(r.calories)] = (counts[band(r.calories)] ?? 0) + 1;
  console.log(`\nเมนูทั้งหมด ${rows.length} รายการ · ช่วงแคลอรี่:`,
    Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log(`โปรตีน ≥35 ก.: ${rows.filter((r) => r.protein >= 35).length} เมนู · ` +
              `โซเดียม >1,000 มก.: ${rows.filter((r) => r.sodium > 1000).length} เมนู`);
  console.table(rows.map((r) => ({
    sku: r.sku, ชื่อ: r.name, kcal: r.calories, P: r.protein, C: r.carbs, F: r.fat,
    Na: r.sodium, ราคา: r.price,
  })));

  if (!APPLY) {
    console.log("\n(ดูอย่างเดียว — ใส่ --apply เพื่อเขียนลงฐานข้อมูล)");
    return;
  }

  const cats = {};
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, color: c.color, order: c.order, isActive: true },
      create: { slug: c.slug, name: c.name, color: c.color, order: c.order },
    });
    cats[c.slug] = row.id;
  }

  let created = 0;
  let updated = 0;
  for (const [i, r] of rows.entries()) {
    const exists = await prisma.food.findFirst({ where: { sku: r.sku }, select: { id: true } });
    const data = {
      sku: r.sku, name: r.name, description: r.description, ingredients: r.ingredients,
      price: r.price, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat,
      sodium: r.sodium, sugar: r.sugar, categoryId: cats[r.catSlug],
      servingSize: 1, servingUnit: "กล่อง", isActive: true, order: i + 1,
    };
    if (exists) {
      await prisma.food.update({ where: { id: exists.id }, data });
      updated++;
    } else {
      await prisma.food.create({ data });
      created++;
    }
  }
  // แพ็กเกจ — ราคาโดยประมาณคิดจากค่าเฉลี่ยของเมนูจริงที่เพิ่งเขียนลงไป
  const mains = rows.filter((r) => r.catSlug !== "snack");
  const avgMeal = mains.reduce((a, r) => a + r.price, 0) / Math.max(1, mains.length);
  for (const [i, pk] of PACKAGES.entries()) {
    const approx = Math.round((avgMeal * pk.mealsPerDay * pk.days) / 10) * 10;
    const exists = await prisma.package.findFirst({ where: { name: pk.name }, select: { id: true } });
    const data = {
      name: pk.name, days: pk.days, mealsPerDay: pk.mealsPerDay, price: approx, isActive: true, order: i + 1,
      description: `จัดเมนูให้ครบ ${pk.mealsPerDay} มื้อ/วัน ${pk.days} วัน ตามเป้าโภชนาการรายบุคคล — ราคาจริงคิดตามเมนูที่เลือก`,
    };
    if (exists) await prisma.package.update({ where: { id: exists.id }, data });
    else await prisma.package.create({ data });
  }

  console.log(`\n✅ เขียนแล้ว — สร้างใหม่ ${created} · อัปเดต ${updated} · หมวด ${CATEGORIES.length} · แพ็กเกจ ${PACKAGES.length}`);
  console.log("⚠️ ราคาเป็นค่าตั้งต้นจากสูตร และยังไม่มีรูป — รีวิวในหลังบ้านก่อนเปิดขาย");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
