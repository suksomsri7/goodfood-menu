/**
 * เลือกโมเดล AI แบบ 2 ชั้น + ตั้งค่าได้จาก backoffice (ไม่ต้อง deploy)
 *
 * ที่มา (1 ส.ค. 2026): เครดิต OpenRouter หมด ($465 ใช้ครบ) → วิเคราะห์รูปไม่ได้เลย
 * ทดสอบกับรูปอาหารจริงแล้วพบว่าโมเดล "ฟรี" ทำงานแทนได้:
 *   google/gemma-4-26b-a4b-it:free  → "แซลมอนย่าง ข้าวกล้อง บรอกโคลี สลัด" 580-650 kcal (ยิงซ้ำ 3 ครั้งใกล้เคียงกัน)
 *   nvidia/nemotron-nano-12b-v2-vl:free → เห็นแค่ปลา ไม่เห็นข้าว (ตกไป)
 *
 * ชั้น 1 = ฟรี (คิวอาจเต็ม/ช้า) · ชั้น 2 = เสียเงินแต่ถูกมาก (นิ่งกว่า) → เรียกเมื่อชั้น 1 ล้ม
 * เปลี่ยนชื่อโมเดลได้ที่ secret: AI_MODEL_VISION / AI_MODEL_VISION_FALLBACK / AI_MODEL_CHAT / AI_MODEL_CHAT_FALLBACK
 *
 * ⚠️ โมเดล :free ของ OpenRouter อาจนำ prompt ไปเทรน — ก่อนเปิดใช้งานสาธารณะ
 *    ให้สลับ AI_MODEL_VISION เป็นตัวเสียเงิน (แก้ที่ backoffice ได้ทันที ไม่ต้อง build)
 */
import { getSecret } from "@/lib/secrets/store";

export type ModelSlot = "vision" | "chat";

/** ค่าเริ่มต้น — ฟรีก่อน แล้วตกไปตัวถูก */
const DEFAULTS: Record<ModelSlot, { primary: string; fallback: string }> = {
  // รูปอาหาร/ฉลาก
  vision: { primary: "google/gemma-4-26b-a4b-it:free", fallback: "google/gemma-3-12b-it" },
  // แชทโค้ช / วางแผน / งานข้อความอื่น (gpt-4o-mini เดิมยังคุ้มและนิ่งที่สุดสำหรับ JSON)
  chat: { primary: "gpt-4o-mini", fallback: "gpt-4o-mini" },
};

const SECRET_KEYS: Record<ModelSlot, [string, string]> = {
  vision: ["AI_MODEL_VISION", "AI_MODEL_VISION_FALLBACK"],
  chat: ["AI_MODEL_CHAT", "AI_MODEL_CHAT_FALLBACK"],
};

export async function modelsFor(slot: ModelSlot): Promise<{ primary: string; fallback: string }> {
  const [kp, kf] = SECRET_KEYS[slot];
  const [p, f] = await Promise.all([getSecret(kp).catch(() => null), getSecret(kf).catch(() => null)]);
  return {
    primary: (p || DEFAULTS[slot].primary).trim(),
    fallback: (f || DEFAULTS[slot].fallback).trim(),
  };
}

/** โมเดลที่ตั้งชื่อเต็มมาแล้ว (มี "/") ใช้ตรง ๆ · ชื่อสั้นแบบ OpenAI ค่อยให้ aiModel() เติม prefix */
export function isExplicitModel(name: string): boolean {
  return name.includes("/");
}

/** ล้มแบบที่ควรลองชั้นสำรอง: คิวเต็ม เครดิตหมด ผู้ให้บริการล่ม หรือคืนค่าที่ parse ไม่ได้ */
export function shouldFallback(error: any): boolean {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  if ([402, 408, 429, 500, 502, 503, 504].includes(status)) return true;
  return /rate.?limit|temporarily|credits|timeout|unavailable|no response|parse/i.test(String(error?.message || ""));
}
