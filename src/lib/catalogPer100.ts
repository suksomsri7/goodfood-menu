/**
 * ช่วยครัวกรอกคลังวัตถุดิบ — แปลงแถวใน `food_catalog` (เก็บ "ต่อหน่วยบริโภค")
 * ให้เป็น "ต่อ 100 ก./มล." ซึ่งเป็นฐานเดียวที่ตัวคิดสูตรใช้
 *
 * 🔴 นี่คือ "ตัวช่วยกรอก" ไม่ใช่แหล่งความจริง — ครัวต้องกดยืนยันเสมอ
 *    เพราะน้ำหนักในคลังเป็นค่าประมาณ (~350 ก.) และหลายแถวเป็น "จานสำเร็จ" ไม่ใช่วัตถุดิบเดี่ยว
 *    ค่าที่ได้จึงบันทึกด้วย isEstimate = true จนกว่าครัวจะแก้เอง
 */

/** ดึงน้ำหนัก/ปริมาตรออกจากข้อความหน่วยบริโภค เช่น "1 จาน (~350 ก.)" → 350 */
export function portionGrams(portion: string | null | undefined): { grams: number; unit: "g" | "ml" } | null {
  if (!portion) return null;
  const g = portion.match(/(\d+(?:\.\d+)?)\s*(?:ก\.|กรัม|g\b)/);
  if (g) {
    const n = parseFloat(g[1]);
    return n > 0 ? { grams: n, unit: "g" } : null;
  }
  const ml = portion.match(/(\d+(?:\.\d+)?)\s*(?:มล\.|ml\b)/);
  if (ml) {
    const n = parseFloat(ml[1]);
    // ของเหลวในครัวคิด 1 มล. ≈ 1 ก. ได้ (นม/น้ำ/ซุป) — ตัวคิดสูตรใช้ฐาน 100 เท่ากัน
    return n > 0 ? { grams: n, unit: "ml" } : null;
  }
  return null;
}

export interface CatalogRow {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number | null;
  sugar?: number | null;
}

export interface Per100Suggestion {
  name: string;
  unit: "g" | "ml";
  /** น้ำหนักหน่วยบริโภคที่แกะได้ — โชว์ให้ครัวเห็นว่าหารด้วยอะไร */
  portionGrams: number;
  portionText: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
  source: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** null = แกะน้ำหนักไม่ออก (เช่น "1 ชุด (ตำ+ไก่ 1/4 ตัว)") → ครัวต้องกรอกเอง ห้ามเดาให้ */
export function toPer100(row: CatalogRow): Per100Suggestion | null {
  const p = portionGrams(row.portion);
  if (!p) return null;
  const k = 100 / p.grams;
  return {
    name: row.name,
    unit: p.unit,
    portionGrams: p.grams,
    portionText: row.portion,
    calories: Math.round(row.calories * k),
    protein: r1(row.protein * k),
    carbs: r1(row.carbs * k),
    fat: r1(row.fat * k),
    sodium: row.sodium != null ? Math.round(row.sodium * k) : null,
    sugar: row.sugar != null ? r1(row.sugar * k) : null,
    source: `คลังอาหาร: ${row.name} (${row.portion})`,
  };
}
