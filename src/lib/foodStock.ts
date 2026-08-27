/**
 * คลังอาหารรายคน — แอดมินเพิ่มให้ลูกค้าหลังรับออเดอร์ในแชท ลูกค้ากดบันทึกแล้วตัดยอด
 *
 * กติกาที่เจ้าของเคาะ (26 ส.ค. 69):
 * 🔴 เพิ่มได้เฉพาะ "เมนูของครัว" (Food) เท่านั้น — ไม่ใช่ของนอกร้าน
 * 🔴 ตัดสต๊อกเฉพาะตอนกดจากหัวข้อ "คลังอาหารของฉัน" ในแอป
 *    ถ้าพิมพ์ชื่อเดียวกันจากช่องค้นหา/ที่กินบ่อย = ไม่ตัด (เขาอาจไปกินร้านข้างนอก)
 * 🔴 ลบบันทึกทิ้ง = คืนของเข้าคลัง (กดผิดแล้วของหายฟรีไม่ได้)
 * 🔴 หน่วยนับเลือกจากรายการที่กำหนดไว้ ไม่ให้พิมพ์เอง (จะได้ไม่มี "กล่อง"/"กล่อง " ปนกัน)
 */

/** หน่วยนับที่แอดมินเลือกได้ (dropdown) */
export const STOCK_UNITS = ["กล่อง", "ชาม", "จาน", "ถุง", "ขวด", "แก้ว", "ห่อ", "ชิ้น", "ที่"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const isStockUnit = (v: unknown): v is StockUnit =>
  typeof v === "string" && (STOCK_UNITS as readonly string[]).includes(v);

/** จำนวนต่อครั้งที่ยอมรับ — กันกรอกพลาดเป็นหลักพัน */
export const MAX_STOCK_QTY = 60;

export type StockRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  remaining: number;
  expiresAt: Date | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
};

/** เหลือน้อย/ใกล้หมดอายุ — ใช้ทั้งหลังบ้านและแอปให้เกณฑ์ตรงกัน */
export function stockFlags(row: { remaining: number; expiresAt: Date | null }, now = new Date()) {
  const daysLeft = row.expiresAt ? Math.floor((row.expiresAt.getTime() - now.getTime()) / 86400000) : null;
  return {
    isEmpty: row.remaining <= 0,
    isLow: row.remaining > 0 && row.remaining <= 1,
    /// หมดอายุแล้ว = ไม่ควรให้กดบันทึกต่อ (ครัวต้องรู้ด้วย)
    isExpired: daysLeft !== null && daysLeft < 0,
    /// เหลือ 0–2 วัน = เตือนให้รีบกิน
    isExpiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 2,
    daysLeft,
  };
}

/** ข้อความบอกอายุแบบคนอ่าน — "วันนี้" / "พรุ่งนี้" / "อีก 3 วัน" / "หมดอายุแล้ว" */
export function expiryLabel(expiresAt: Date | null, now = new Date()): string | null {
  if (!expiresAt) return null;
  const d = Math.floor((expiresAt.getTime() - now.getTime()) / 86400000);
  if (d < 0) return "หมดอายุแล้ว";
  if (d === 0) return "กินภายในวันนี้";
  if (d === 1) return "กินภายในพรุ่งนี้";
  return `กินภายใน ${d} วัน`;
}
