import OpenAI from "openai";

/**
 * รองรับทั้ง OpenAI key ตรง (sk-... / sk-proj-...) และ OpenRouter key (sk-or-...)
 * - OpenRouter: ต่อผ่าน baseURL ของ OpenRouter + ต้องใส่ provider prefix ให้ชื่อโมเดล
 * - OpenAI ตรง: ใช้ default (api.openai.com) + ชื่อโมเดลเดิม
 */
function isOpenRouterKey(apiKey: string): boolean {
  return apiKey.startsWith("sk-or-");
}

export function buildOpenAI(apiKey: string): OpenAI {
  if (isOpenRouterKey(apiKey)) {
    return new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://goodfood.in.th",
        "X-Title": "GoodFood Coach",
      },
    });
  }
  return new OpenAI({ apiKey });
}

/** map ชื่อโมเดล OpenAI ("gpt-4o-mini") → OpenRouter ("openai/gpt-4o-mini") เมื่อใช้ OpenRouter key */
export function aiModel(apiKey: string, model: string): string {
  if (isOpenRouterKey(apiKey) && !model.includes("/")) {
    return `openai/${model}`;
  }
  return model;
}

/**
 * แยก "AI ใช้ไม่ได้ชั่วคราว" (เครดิตหมด/คีย์ผิด/โดน rate limit/ผู้ให้บริการล่ม)
 * ออกจาก "วิเคราะห์แล้วไม่เจออะไร" — คนละเรื่องกันสำหรับ user
 * (1 ส.ค. 2026: เครดิต OpenRouter หมด → แอปขึ้น "ถ่ายใหม่ให้ชัดขึ้น" ทำให้ user ถ่ายซ้ำอยู่นั่น)
 */
export function aiOutageReason(error: any): { code: string; message: string } | null {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const raw = String(error?.message || "");
  if (status === 402 || /more credits|insufficient|quota|billing/i.test(raw)) {
    return { code: "ai_no_credit", message: "ระบบ AI ใช้เครดิตหมดชั่วคราว — แจ้งผู้ดูแลแล้วครับ ระหว่างนี้บอกโค้ชด้วยเสียงหรือพิมพ์ได้เลย" };
  }
  if (status === 401 || status === 403) {
    return { code: "ai_auth", message: "ระบบ AI ยังไม่พร้อมใช้งาน (สิทธิ์เข้าถึงมีปัญหา) — แจ้งผู้ดูแลแล้วครับ" };
  }
  if (status === 429) {
    return { code: "ai_rate_limit", message: "ระบบ AI แน่นอยู่ ลองใหม่อีกครั้งในสักครู่นะครับ" };
  }
  if (status >= 500) {
    return { code: "ai_upstream", message: "ผู้ให้บริการ AI ขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  }
  return null;
}
