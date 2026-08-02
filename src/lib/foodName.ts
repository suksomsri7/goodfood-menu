/**
 * ทำชื่ออาหารให้เทียบกันได้ — แยกไฟล์จาก foodCache.ts เพราะสคริปต์ QC ของคลังอาหาร
 * ต้องเรียกใช้โดยไม่ลาก prisma client เข้ามาด้วย (foodCache.ts import prisma ที่ระดับโมดูล)
 */

/** ตัดช่องว่าง/วรรณยุกต์ซ้ำ/คำบอกปริมาณท้ายชื่อ ให้ชื่อเทียบกันได้ */
export function normaliseFoodName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\d+(\.\d+)?\s*(ไม้|จาน|ชาม|ห่อ|ถ้วย|แก้ว|ชิ้น|ลูก|ml|มล\.|g|กรัม)\s*$/u, "")
    .trim();
}
