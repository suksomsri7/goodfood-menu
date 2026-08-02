import type { FoodSeed } from "./types";
import { ALCOHOL_CATEGORY } from "./types";

/**
 * เครื่องดื่มแอลกอฮอล์ — แยกหมวดเพราะพลังงานมาจากเอทานอล (7 kcal/g)
 * ซึ่งไม่ถูกนับเป็นโปรตีน/คาร์บ/ไขมัน → ตรวจ "มาโครตรงกับแคลอรี่" ไม่ได้ (QC ยกเว้นหมวดนี้)
 */
const CAT = ALCOHOL_CATEGORY;

export const alcohol: FoodSeed[] = [
  { name: "เบียร์ 1 กระป๋อง", aliases: ["เบียร์กระป๋อง", "beer", "เบียร์ช้าง", "เบียร์สิงห์", "ลีโอ"], category: CAT, portion: "1 กระป๋อง (330 มล.)", calories: 145, protein: 1.5, carbs: 11, fat: 0, sodium: 15, sugar: 0 },
  { name: "เบียร์ 1 ขวดใหญ่", aliases: ["เบียร์ขวดใหญ่", "เบียร์ 620 มล."], category: CAT, portion: "1 ขวดใหญ่ (620 มล.)", calories: 270, protein: 2.8, carbs: 21, fat: 0, sodium: 25, sugar: 0 },
  { name: "เบียร์สด 1 แก้ว", aliases: ["draft beer", "เบียร์วุ้น"], category: CAT, portion: "1 แก้ว (350 มล.)", calories: 155, protein: 1.6, carbs: 12, fat: 0, sodium: 15, sugar: 0 },
  { name: "เบียร์ไลท์ 1 กระป๋อง", aliases: ["light beer", "เบียร์แคลต่ำ"], category: CAT, portion: "1 กระป๋อง (330 มล.)", calories: 100, protein: 1, carbs: 5, fat: 0, sodium: 15, sugar: 0 },
  { name: "ไวน์แดง 1 แก้ว", aliases: ["red wine", "ไวน์แดง"], category: CAT, portion: "1 แก้ว (150 มล.)", calories: 125, protein: 0.1, carbs: 4, fat: 0, sodium: 6, sugar: 1 },
  { name: "ไวน์ขาว 1 แก้ว", aliases: ["white wine", "ไวน์ขาว"], category: CAT, portion: "1 แก้ว (150 มล.)", calories: 120, protein: 0.1, carbs: 4, fat: 0, sodium: 6, sugar: 1.5 },
  { name: "สปาร์กลิงไวน์ 1 แก้ว", aliases: ["แชมเปญ", "champagne", "prosecco"], category: CAT, portion: "1 แก้ว (150 มล.)", calories: 120, protein: 0.1, carbs: 4, fat: 0, sodium: 10, sugar: 2 },
  { name: "วิสกี้ 1 ช็อต", aliases: ["whisky", "เหล้าขาว 1 ช็อต", "วิสกี้เพียว"], category: CAT, portion: "1 ช็อต (30 มล.)", calories: 70, protein: 0, carbs: 0, fat: 0, sodium: 1, sugar: 0 },
  { name: "วิสกี้โซดา 1 แก้ว", aliases: ["เหล้าโซดา", "whisky soda"], category: CAT, portion: "1 แก้ว (วิสกี้ 45 มล. + โซดา)", calories: 110, protein: 0, carbs: 0, fat: 0, sodium: 25, sugar: 0 },
  { name: "วิสกี้โค้ก 1 แก้ว", aliases: ["เหล้าผสมโค้ก", "whisky coke"], category: CAT, portion: "1 แก้ว (วิสกี้ 45 มล. + โค้ก 150 มล.)", calories: 175, protein: 0, carbs: 16, fat: 0, sodium: 20, sugar: 16 },
  { name: "เหล้าขาว 1 ก๊ง", aliases: ["เหล้าขาว 40 ดีกรี", "ยาดอง 1 ก๊ง"], category: CAT, portion: "1 ก๊ง (~40 มล.)", calories: 95, protein: 0, carbs: 0, fat: 0, sodium: 1, sugar: 0 },
  { name: "ว็อดก้า 1 ช็อต", aliases: ["vodka"], category: CAT, portion: "1 ช็อต (30 มล.)", calories: 70, protein: 0, carbs: 0, fat: 0, sodium: 1, sugar: 0 },
  { name: "เตกีล่า 1 ช็อต", aliases: ["tequila"], category: CAT, portion: "1 ช็อต (30 มล.)", calories: 70, protein: 0, carbs: 0, fat: 0, sodium: 1, sugar: 0 },
  { name: "ยิน 1 ช็อต", aliases: ["gin", "จิน"], category: CAT, portion: "1 ช็อต (30 มล.)", calories: 70, protein: 0, carbs: 0, fat: 0, sodium: 1, sugar: 0 },
  { name: "รัม 1 ช็อต", aliases: ["rum", "เหล้ารัม"], category: CAT, portion: "1 ช็อต (30 มล.)", calories: 70, protein: 0, carbs: 0, fat: 0, sodium: 1, sugar: 0 },
  { name: "จินโทนิก 1 แก้ว", aliases: ["gin tonic", "จิน & โทนิค"], category: CAT, portion: "1 แก้ว (~250 มล.)", calories: 180, protein: 0, carbs: 16, fat: 0, sodium: 20, sugar: 16 },
  { name: "ม็อกฮิโต้", aliases: ["mojito", "โมฮิโต"], category: CAT, portion: "1 แก้ว (~250 มล.)", calories: 220, protein: 0, carbs: 24, fat: 0, sodium: 20, sugar: 22 },
  { name: "มาร์การิต้า", aliases: ["margarita"], category: CAT, portion: "1 แก้ว (~200 มล.)", calories: 250, protein: 0, carbs: 24, fat: 0, sodium: 300, sugar: 22 },
  { name: "ปิญ่าโคลาด้า", aliases: ["pina colada"], category: CAT, portion: "1 แก้ว (~250 มล.)", calories: 420, protein: 2, carbs: 50, fat: 12, sodium: 40, sugar: 44 },
  { name: "โซจู 1 ขวด", aliases: ["soju", "โซจูเกาหลี"], category: CAT, portion: "1 ขวด (360 มล.)", calories: 400, protein: 0, carbs: 12, fat: 0, sodium: 10, sugar: 12 },
  { name: "สาเก 1 แก้ว", aliases: ["sake", "เหล้าสาเก"], category: CAT, portion: "1 แก้ว (100 มล.)", calories: 135, protein: 0.5, carbs: 5, fat: 0, sodium: 2, sugar: 0 },
  { name: "ไซเดอร์ 1 ขวด", aliases: ["cider", "แอปเปิลไซเดอร์แอลกอฮอล์"], category: CAT, portion: "1 ขวด (330 มล.)", calories: 180, protein: 0, carbs: 22, fat: 0, sodium: 15, sugar: 20 },
  { name: "เบียร์ไม่มีแอลกอฮอล์", aliases: ["non-alcoholic beer", "เบียร์ 0%"], category: CAT, portion: "1 กระป๋อง (330 มล.)", calories: 65, protein: 0.5, carbs: 14, fat: 0, sodium: 15, sugar: 8 },
  { name: "ค็อกเทลผลไม้", aliases: ["fruit cocktail", "ค็อกเทล"], category: CAT, portion: "1 แก้ว (~250 มล.)", calories: 280, protein: 0.5, carbs: 34, fat: 0, sodium: 30, sugar: 32 },
  { name: "ไวน์คูลเลอร์ 1 ขวด", aliases: ["wine cooler", "สปาย", "spy"], category: CAT, portion: "1 ขวด (275 มล.)", calories: 200, protein: 0, carbs: 26, fat: 0, sodium: 20, sugar: 25 },
];
