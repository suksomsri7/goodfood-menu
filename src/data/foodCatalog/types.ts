/**
 * คลังอาหารไทย deterministic — ชนิดข้อมูลกลางของทุกหมวด
 *
 * ทำไมต้องมี: user กรอกอาหารเองบ่อยกว่าถ่ายรูป ถ้าไม่มีคลังนี้ทุกครั้งต้องยิง AI (จ่ายค่า OpenRouter)
 * ค่าโภชนาการ = ค่า "ประมาณ" ต่อ 1 หน่วยบริโภคมาตรฐาน อิงตารางคุณค่าอาหารไทยที่เผยแพร่ทั่วไป
 * (กรมอนามัย / INMU ม.มหิดล) — ไม่ใช่ค่าชั่งจริงของจานตรงหน้า จึง isEstimate = true ทุกรายการ
 */
export interface FoodSeed {
  /** ชื่อไทยมาตรฐาน — unique ในตาราง */
  name: string;
  /** คำสะกดแปร ("กระเพรา"/"กะเพรา") ชื่อเล่น ชื่ออังกฤษที่คนไทยพิมพ์ */
  aliases: string[];
  category: string;
  /** หน่วยบริโภคมาตรฐานภาษาคน — โชว์ในแอปตรง ๆ */
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
}

/** หมวดที่ยกเว้นการตรวจ "มาโครตรงกับแคลอรี่" — แอลกอฮอล์ให้พลังงาน 7 kcal/g ซึ่งไม่นับเป็นมาโคร */
export const ALCOHOL_CATEGORY = "เครื่องดื่มแอลกอฮอล์";

export const CATALOG_SOURCE = "ตารางคุณค่าอาหารไทย กรมอนามัย/INMU โดยประมาณ";
