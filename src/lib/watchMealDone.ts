/**
 * "มื้อไหนกินไปแล้ว" ของแอปนาฬิกา — ตัดสินจาก **บันทึกจริง** ไม่ใช่จากปุ่มติ๊ก
 *
 * 🔴 29 ส.ค. 69 เจ้าของเคาะ "ข้อ ก": บันทึกจริงคือความจริงเดียว แผนเป็นแค่คำแนะนำ
 *    ของเดิมนาฬิกาอ่าน DailyPlan.mealsDone อย่างเดียว ส่วนแอปอ่าน MealLog
 *    → บันทึกอาหารในแอปแล้วการ์ดมื้อนั้นบนนาฬิกาไม่หาย user กดติ๊กซ้ำ = **นับแคลอรี่ซ้ำ**
 *
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพราะกติกาจับคู่มันเดาง่ายแต่ผิดง่าย — ต้องมีข้อสอบคุม
 * (scripts/test-watch-meals.ts)
 */
import { MEAL_WINDOWS, mealWindowAt } from "@/lib/foodCache";

/**
 * slot ในแผน → ช่วงเวลาของวันที่มันควรถูกกิน (คีย์เดียวกับ MEAL_WINDOWS)
 *
 * 🔴 รายชื่อนี้ไม่ได้เดา — ไล่จากแผนจริง 42 วันใน DB (29 ส.ค. 69) เจอ 5 แบบ:
 *      เช้า 42 · กลางวัน 42 · เย็น 42 · ว่าง 42 · "เพิ่ม" 2
 *    "เพิ่ม" คือมื้อเสริมที่ AI แถมมาเวลาแคลอรี่ยังไม่ถึงเป้า ไม่ผูกกับเวลาไหนเลย
 *    → ตั้งใจ **ไม่ใส่** ในตารางนี้ ปล่อยให้ปิดได้ด้วยการติ๊กเองเท่านั้น
 *      (ถ้าจับให้มันไปกินโควตาของช่วงใดช่วงหนึ่ง มื้อหลักของช่วงนั้นจะไม่ถูกปิด = ผิดหนักกว่า)
 *    ที่เหลือ (ว่างเช้า/ว่างบ่าย/ว่างดึก) เผื่อไว้สำหรับแผนรุ่นหลังที่แยกละเอียดกว่านี้
 */
export const SLOT_WINDOW: Record<string, string> = {
  เช้า: "breakfast",
  ว่างเช้า: "breakfast",
  กลางวัน: "lunch",
  ว่าง: "snack",
  ว่างบ่าย: "snack",
  เย็น: "dinner",
  ว่างดึก: "late",
};

/** กันพิมพ์คีย์ผิดเงียบ ๆ — SLOT_WINDOW ต้องชี้ไปยัง window ที่มีจริงเท่านั้น */
const KNOWN = new Set(MEAL_WINDOWS.map((w) => w.key));
for (const [slot, win] of Object.entries(SLOT_WINDOW)) {
  if (!KNOWN.has(win)) throw new Error(`SLOT_WINDOW["${slot}"] ชี้ไปที่ช่วง "${win}" ที่ไม่มีใน MEAL_WINDOWS`);
}

/**
 * ปิดมื้อในแผนตามจำนวนบันทึกจริงของแต่ละช่วงเวลา
 *
 * @param meals       มื้อในแผน **เรียงตามเวลาแล้ว** (ตัวที่ done มาแล้วจะไม่ถูกแตะ)
 * @param logMinutes  นาทีจากเที่ยงคืน (เวลาท้องถิ่นของเครื่อง) ของบันทึกอาหารวันนี้ทุกใบ
 *
 * ⚠️ นับจำนวน ไม่ใช่ "มีสักใบในช่วง = ปิดทั้งช่วง"
 *    บันทึก 1 ใบต้องปิดได้แค่ 1 มื้อ ไม่งั้นคนกินข้าวเที่ยงมื้อเดียวจะถูกนับว่ากินของว่างด้วย
 * ⚠️ mealsDone ชนะเสมอ (มาเป็น done = true อยู่แล้ว) — ติ๊กเองไว้ห้ามเด้งกลับ
 */
export function applyLoggedMeals<T extends { slot: string; done: boolean }>(
  meals: T[],
  logMinutes: number[],
): T[] {
  const left = new Map<string, number>();
  for (const m of logMinutes) {
    const key = mealWindowAt(m).key;
    left.set(key, (left.get(key) ?? 0) + 1);
  }
  for (const meal of meals) {
    if (meal.done) continue; // ติ๊กไว้แล้ว ไม่ต้องใช้โควตาบันทึก
    const win = SLOT_WINDOW[meal.slot];
    const n = win ? (left.get(win) ?? 0) : 0;
    if (n > 0) {
      meal.done = true;
      left.set(win, n - 1);
    }
  }
  return meals;
}
