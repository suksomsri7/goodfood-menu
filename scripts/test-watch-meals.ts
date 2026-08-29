/**
 * ข้อสอบ: "มื้อไหนกินไปแล้ว" บนแอปนาฬิกา (src/lib/watchMealDone.ts)
 *
 * ทำไมต้องมี: กติกานี้ตัดสินว่าการ์ดมื้อบนนาฬิกาหายหรือไม่หาย
 * ผิดทางหนึ่ง = user กดติ๊กซ้ำ → **นับแคลอรี่ซ้ำ**
 * ผิดอีกทาง = มื้อที่ยังไม่ได้กินหายไปเงียบ ๆ → user ไม่ได้กิน แต่ระบบคิดว่ากินแล้ว
 * ทั้งสองแบบ user มองไม่เห็นว่าพัง จนกว่าตัวเลขจะเพี้ยนสะสม
 */
import { applyLoggedMeals } from "../src/lib/watchMealDone";

const hm = (h: number, m = 0) => h * 60 + m;
type Meal = { slot: string; done: boolean };
const plan = (...slots: string[]): Meal[] => slots.map((slot) => ({ slot, done: false }));

let pass = 0;
const fails: string[] = [];

function check(name: string, meals: Meal[], logs: number[], expect: boolean[]) {
  applyLoggedMeals(meals, logs);
  const got = meals.map((m) => m.done);
  const ok = got.length === expect.length && got.every((v, i) => v === expect[i]);
  if (ok) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fails.push(name);
    console.log(`✗ ${name}\n   คาดว่า ${JSON.stringify(expect)}\n   ได้    ${JSON.stringify(got)}`);
  }
}

console.log("── บันทึกจริงปิดมื้อในแผน ──");

check("ยังไม่บันทึกอะไรเลย = ไม่มีมื้อไหนถูกปิด",
  plan("เช้า", "กลางวัน", "เย็น"), [], [false, false, false]);

check("บันทึกตอน 8 โมง = ปิดมื้อเช้า มื้ออื่นไม่แตะ",
  plan("เช้า", "กลางวัน", "เย็น"), [hm(8)], [true, false, false]);

check("บันทึกตอนเที่ยงครึ่ง = ปิดมื้อกลางวัน",
  plan("เช้า", "กลางวัน", "เย็น"), [hm(12, 30)], [false, true, false]);

check("บันทึกตอน 19 น. = ปิดมื้อเย็น",
  plan("เช้า", "กลางวัน", "เย็น"), [hm(19)], [false, false, true]);

check("บันทึกครบ 3 มื้อ = ปิดหมด",
  plan("เช้า", "กลางวัน", "เย็น"), [hm(8), hm(12), hm(19)], [true, true, true]);

console.log("\n── 🔴 บันทึก 1 ใบ ต้องปิดได้แค่ 1 มื้อ (กันปิดยกช่วง) ──");

check("ช่วงบ่ายมี 'ว่าง' กับ 'ว่างบ่าย' สองมื้อ · บันทึกใบเดียว = ปิดแค่ใบแรก",
  plan("ว่าง", "ว่างบ่าย"), [hm(15)], [true, false]);

check("ช่วงบ่ายสองมื้อ · บันทึกสองใบ = ปิดทั้งคู่",
  plan("ว่าง", "ว่างบ่าย"), [hm(15), hm(16, 30)], [true, true]);

check("บันทึกของว่างบ่าย ไม่ควรไปปิดมื้อเย็น",
  plan("กลางวัน", "ว่างบ่าย", "เย็น"), [hm(15)], [false, true, false]);

console.log("\n── mealsDone (ติ๊กเองไว้) ต้องชนะเสมอ ──");

{
  const meals: Meal[] = [{ slot: "เช้า", done: true }, { slot: "กลางวัน", done: false }];
  check("ติ๊กมื้อเช้าไว้แล้ว + บันทึกตอนเช้า 1 ใบ → ใบนั้นไม่ถูกใช้ปิดมื้อเช้าซ้ำ",
    meals, [hm(8)], [true, false]);
}

{
  const meals: Meal[] = [{ slot: "เช้า", done: true }, { slot: "ว่างเช้า", done: false }];
  check("ติ๊กเช้าไว้ + บันทึกช่วงเช้า 1 ใบ → โควตาเหลือไปปิด 'ว่างเช้า' ได้",
    meals, [hm(9)], [true, true]);
}

console.log("\n── ขอบเขตของช่วงเวลา (เส้นแบ่งตาม MEAL_WINDOWS) ──");

check("10:29 ยังเป็นช่วงเช้า",
  plan("เช้า", "กลางวัน"), [hm(10, 29)], [true, false]);

check("10:30 ข้ามเป็นช่วงกลางวันแล้ว",
  plan("เช้า", "กลางวัน"), [hm(10, 30)], [false, true]);

check("มื้อดึกคร่อมเที่ยงคืน — บันทึกตี 2 ต้องเข้าช่วง 'ว่างดึก'",
  plan("ว่างดึก"), [hm(2)], [true]);

console.log("\n── กรณีชายขอบ ──");

check("slot ที่ระบบไม่รู้จัก = ไม่ถูกปิดโดยบันทึกใด ๆ (ดีกว่าเดาผิด)",
  plan("มื้อพิเศษ"), [hm(8), hm(12), hm(19)], [false]);

/* 🔴 "เพิ่ม" มีอยู่จริงในแผน production (เจอ 2 ครั้งใน 42 วัน) — มื้อเสริมที่ AI แถมมา
   ตอนแคลอรี่ยังไม่ถึงเป้า ไม่ผูกกับเวลาไหน → ห้ามให้มันไปกินโควตาบันทึกของมื้อหลัก */
check("มื้อ 'เพิ่ม' ต้องไม่แย่งบันทึกของมื้อกลางวัน",
  plan("เพิ่ม", "กลางวัน"), [hm(12, 30)], [false, true]);

check("บันทึกเยอะกว่ามื้อในแผน = ไม่พัง ปิดได้เท่าที่มี",
  plan("กลางวัน"), [hm(12), hm(12, 30), hm(13)], [true]);

console.log(`\n${fails.length === 0 ? "✅" : "❌"} ผ่าน ${pass}/${pass + fails.length} เคส`);
if (fails.length) {
  console.log("ตก:", fails.join(" · "));
  process.exit(1);
}
