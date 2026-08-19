/**
 * รูปอาหารที่สร้างด้วย AI — ใช้ตอนที่ครัวยังไม่ได้ถ่ายรูปจริง
 *
 * 🔴 รูปพวกนี้ "ไม่ใช่ภาพถ่ายกล่องจริง" — ทุกที่ที่เอาไปโชว์ต้องติดป้าย "ภาพตัวอย่าง"
 *    (Food.imageIsAi) ไม่งั้นเป็นการโฆษณาเกินจริงกับอาหารที่ขายจริง
 *    พอครัวอัปรูปจริงทับ ระบบจะเคลียร์ธงนี้ให้เอง
 * 🔴 prompt เขียนภาษาอังกฤษ — ไทยกิน token ~4 เท่า และโมเดลรูปเข้าใจอังกฤษดีกว่า
 */
import { getSecret } from "@/lib/secrets/store";
import { buildOpenAI } from "@/lib/aiClient";
import { shouldFallback } from "@/lib/aiModels";

const DEFAULT_MODEL = "google/gemini-3.1-flash-image";
const DEFAULT_FALLBACK = "google/gemini-2.5-flash-image";

export async function imageModels(): Promise<{ primary: string; fallback: string }> {
  const [p, f] = await Promise.all([
    getSecret("AI_MODEL_IMAGE").catch(() => null),
    getSecret("AI_MODEL_IMAGE_FALLBACK").catch(() => null),
  ]);
  return { primary: (p || DEFAULT_MODEL).trim(), fallback: (f || DEFAULT_FALLBACK).trim() };
}

export interface FoodForImage {
  name: string;
  description?: string | null;
  ingredients?: string[];
  calories?: number | null;
  categoryName?: string | null;
}

/**
 * บรีฟช่างภาพ 1 ใบ — ล็อกสไตล์ให้ทุกเมนูออกมาเป็นชุดเดียวกัน
 * (กล่อง meal-prep พื้นเรียบ แสงธรรมชาติ มุม 45 องศา) ไม่งั้นแต่ละใบคนละอารมณ์ หน้าแอปจะดูมั่ว
 */
export function foodImagePrompt(food: FoodForImage): string {
  const parts = [
    `A single serving of Thai healthy meal-prep food: "${food.name}".`,
    food.description ? `Dish notes: ${food.description}.` : "",
    /* 🔴 ต้องสั่งห้ามเติมของ — รอบแรกโมเดลใส่บลูเบอร์รี/อัลมอนด์ลงกรีกโยเกิร์ตที่มีแค่โยเกิร์ต+เมล็ดเจีย
       ลูกค้าเห็นรูปแล้วสั่ง พอเปิดกล่องไม่มีของพวกนั้น = รูปโกหก */
    food.ingredients?.length
      ? `Show exactly these ingredients and nothing else — no extra fruit, nuts, garnish, sauce or side dish: ${food.ingredients.slice(0, 10).join(", ")}.`
      : "",
    food.calories ? `Portion size looks like about ${Math.round(food.calories)} kcal — realistic home portion, not oversized.` : "",
    "Served in a clean white ceramic bowl or a simple meal-prep container on a light neutral background.",
    "Shot from a 45-degree angle, soft natural daylight from the side, shallow depth of field, no hands, no people.",
    "Fresh and appetizing but honest — real everyday Thai food, not glossy advertising styling.",
    "Square 1:1 framing. No text, no logo, no watermark, no cutlery branding.",
  ];
  return parts.filter(Boolean).join(" ");
}

/** ดึงรูปจากคำตอบ — OpenRouter คืนได้ทั้งใน message.images และ content ที่เป็น array */
function extractImage(message: any): string | null {
  const imgs = message?.images;
  if (Array.isArray(imgs)) {
    for (const im of imgs) {
      const url = im?.image_url?.url ?? im?.url ?? (typeof im === "string" ? im : null);
      if (typeof url === "string" && url.startsWith("data:image")) return url;
    }
  }
  const content = message?.content;
  if (Array.isArray(content)) {
    for (const c of content) {
      const url = c?.image_url?.url ?? (c?.type === "image" ? c?.source?.data : null);
      if (typeof url === "string" && url.startsWith("data:image")) return url;
    }
  }
  return null;
}

async function callModel(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = buildOpenAI(apiKey);
  const res: any = await client.chat.completions.create({
    model,
    modalities: ["image", "text"],
    messages: [{ role: "user", content: prompt }],
  } as any);
  const dataUrl = extractImage(res?.choices?.[0]?.message);
  if (!dataUrl) throw new Error("no image in response");
  return dataUrl;
}

/**
 * สร้างรูป 1 ใบ → คืน data URL (base64) ให้ปลายทางเอาไปเก็บเอง
 * ชั้นสำรองทำงานเฉพาะกรณีที่ควรลองใหม่จริง ๆ (เครดิต/คิว/ผู้ให้บริการล่ม) ตามกฎเดียวกับโมเดลอื่น
 */
export async function generateFoodImage(food: FoodForImage): Promise<{ dataUrl: string; model: string }> {
  const apiKey = await getSecret("OPENAI_API_KEY");
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งคีย์ AI (OPENAI_API_KEY)");

  const { primary, fallback } = await imageModels();
  const prompt = foodImagePrompt(food);
  try {
    return { dataUrl: await callModel(apiKey, primary, prompt), model: primary };
  } catch (e) {
    if (!shouldFallback(e) || fallback === primary) throw e;
    return { dataUrl: await callModel(apiKey, fallback, prompt), model: fallback };
  }
}
