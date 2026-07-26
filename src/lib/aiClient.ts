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
