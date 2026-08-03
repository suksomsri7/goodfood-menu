/**
 * ราคาเครดิต AI ต่อ action (โหมด aiLimitMode = "combined")
 *
 * ทำไมต้องมี: เดิมโหมด combined นับ "จำนวนครั้ง" เท่ากันหมด — ถ่ายรูป (แพงสุด) กับพิมพ์แชท (ถูกสุด)
 * หักเท่ากัน 1 ครั้ง ทำให้ต้นทุน OpenRouter จริงไม่สัมพันธ์กับโควตาที่ตั้งไว้
 * ตอนนี้เป็น "กระเป๋าเครดิตรวมต่อวัน" หักตามน้ำหนักของแต่ละ action
 *
 * เก็บค่าไว้ที่ SystemSetting.aiCreditCosts (ตาราง system_settings — ของ non-secret)
 * แอดมินแก้ได้ที่ /backoffice/settings → การ์ด "เครดิต AI" (PATCH /api/settings/ai-coach)
 * ถ้ายังไม่เคยตั้ง → ใช้ DEFAULT_CREDIT_COSTS ข้างล่างนี้
 */
import { prisma } from "@/lib/prisma";

export const DEFAULT_CREDIT_COSTS = {
  chat: 1,
  photo: 3,
  plan: 5,
  barcode: 1,
  textAnalysis: 1,
  exerciseAnalysis: 1,
  recommend: 2,
  menuSelect: 1,
} as const;

export type CreditKey = keyof typeof DEFAULT_CREDIT_COSTS;
export type CreditCosts = Record<CreditKey, number>;

export const CREDIT_KEYS = Object.keys(DEFAULT_CREDIT_COSTS) as CreditKey[];

/** ป้ายภาษาไทยของแต่ละ action — ใช้ในหน้า backoffice */
export const CREDIT_LABELS: Record<CreditKey, string> = {
  chat: "คุยกับโค้ช (ข้อความ/เสียง)",
  photo: "ถ่ายรูปอาหารให้ AI วิเคราะห์",
  plan: "สร้างแผน 7 วัน",
  barcode: "สแกนบาร์โค้ด/ฉลาก",
  textAnalysis: "วิเคราะห์อาหารจากข้อความ",
  exerciseAnalysis: "วิเคราะห์การออกกำลังกาย",
  recommend: "คำแนะนำ AI",
  menuSelect: "AI เลือกเมนู",
};

// แคชสั้น ๆ — ราคาเครดิตแทบไม่เปลี่ยน แต่ถูกอ่านทุกครั้งที่ยิง AI
let cache: { value: CreditCosts; expires: number } | null = null;
const TTL_MS = 60_000;

function sanitize(raw: unknown): CreditCosts {
  const out = { ...DEFAULT_CREDIT_COSTS } as CreditCosts;
  if (raw && typeof raw === "object") {
    for (const k of CREDIT_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      const n = typeof v === "number" ? v : Number(v);
      // 0 = ไม่หักเครดิต (ให้แอดมินยกเว้น action ได้) · กันค่าติดลบ/เพี้ยน
      if (Number.isFinite(n) && n >= 0 && n <= 1000) out[k] = Math.round(n);
    }
  }
  return out;
}

export async function getCreditCosts(): Promise<CreditCosts> {
  if (cache && cache.expires > Date.now()) return cache.value;
  let value: CreditCosts = { ...DEFAULT_CREDIT_COSTS };
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { id: "system" },
      select: { aiCreditCosts: true },
    });
    value = sanitize(row?.aiCreditCosts);
  } catch {
    // DB ล่ม/คอลัมน์ยังไม่มี → ใช้ค่าเริ่มต้น อย่าให้ user ใช้ AI ไม่ได้
  }
  cache = { value, expires: Date.now() + TTL_MS };
  return value;
}

/** แอดมินบันทึกราคาใหม่ — sanitize แล้วล้างแคชทันที */
export async function setCreditCosts(raw: unknown): Promise<CreditCosts> {
  const value = sanitize(raw);
  await prisma.systemSetting.upsert({
    where: { id: "system" },
    create: { id: "system", aiCreditCosts: value },
    update: { aiCreditCosts: value },
  });
  cache = null;
  return value;
}

export function clearCreditCostsCache() {
  cache = null;
}
