// fal.ai model registry — full list ported from siamdive.
// Aspect ratio is fixed to 3:2 for goodfood article covers, but each adapter
// is kept aspect-aware so we can widen later if needed.

import { fal } from "@fal-ai/client";

export type AspectRatio = "16:9" | "3:2" | "1:1" | "4:5";

export type ModelAdapter = {
  id: string;
  endpoint: string;
  label: string;
  blurb: string;
  price: string;
  group: string;
  buildInput: (prompt: string, aspectRatio: AspectRatio) => Record<string, unknown>;
  extract?: (data: unknown) => string | null;
};

function defaultExtract(data: unknown): string | null {
  const d = data as { images?: Array<{ url?: string }> };
  return d?.images?.[0]?.url ?? null;
}

function toImageSizeEnum(ar: AspectRatio): string {
  const map: Record<AspectRatio, string> = {
    "16:9": "landscape_16_9",
    "3:2": "landscape_4_3",
    "1:1": "square_hd",
    "4:5": "portrait_4_3",
  };
  return map[ar];
}

function toWH(ar: AspectRatio, long = 1536): { width: number; height: number } {
  const ratios: Record<AspectRatio, [number, number]> = {
    "16:9": [16, 9],
    "3:2": [3, 2],
    "1:1": [1, 1],
    "4:5": [4, 5],
  };
  const [a, b] = ratios[ar];
  if (a >= b) return { width: long, height: Math.round((long * b) / a / 8) * 8 };
  return { width: Math.round((long * a) / b / 8) * 8, height: long };
}

const withAspect = (prompt: string, ar: AspectRatio) => ({ prompt, aspect_ratio: ar, num_images: 1 });
const withWH = (long = 1536) => (prompt: string, ar: AspectRatio) => ({
  prompt,
  image_size: toWH(ar, long),
  num_images: 1,
});
const withImageSizeEnum = (prompt: string, ar: AspectRatio) => ({
  prompt,
  image_size: toImageSizeEnum(ar),
  num_images: 1,
});

export const MODELS: ModelAdapter[] = [
  // ── Google ─────────────────────────────────────────────────────────────
  { id: "nano-banana-pro", endpoint: "fal-ai/nano-banana-pro", group: "Google",
    label: "Nano Banana Pro", price: "$0.15",
    blurb: "Google SOTA — realism + typography. แนะนำสำหรับ NatGeo",
    buildInput: withAspect },
  { id: "nano-banana-2", endpoint: "fal-ai/nano-banana-2", group: "Google",
    label: "Nano Banana 2", price: "$0.04",
    blurb: "Google SOTA fast — cheaper version",
    buildInput: withAspect },
  { id: "nano-banana", endpoint: "fal-ai/nano-banana", group: "Google",
    label: "Nano Banana", price: "$0.04",
    blurb: "Google original Nano Banana",
    buildInput: withAspect },
  { id: "imagen4-ultra", endpoint: "fal-ai/imagen4/preview/ultra", group: "Google",
    label: "Imagen 4 Ultra", price: "$0.06",
    blurb: "Google Imagen รุ่นคุณภาพสูงสุด",
    buildInput: withAspect },
  { id: "imagen4", endpoint: "fal-ai/imagen4/preview", group: "Google",
    label: "Imagen 4", price: "$0.04",
    blurb: "Google Imagen รุ่น standard",
    buildInput: withAspect },

  // ── FLUX family ────────────────────────────────────────────────────────
  { id: "flux-2-pro", endpoint: "fal-ai/flux-2-pro", group: "FLUX",
    label: "FLUX.2 Pro", price: "$0.045",
    blurb: "Flux 2 — $0.03 first MP + $0.015/extra MP",
    buildInput: withAspect },
  { id: "flux-1.1-ultra-raw", endpoint: "fal-ai/flux-pro/v1.1-ultra", group: "FLUX",
    label: "FLUX 1.1 Ultra (raw)", price: "$0.06",
    blurb: "Photorealistic raw mode — ฟิล์มกล้องดิจิทัล",
    buildInput: (prompt, ar) => ({ ...withAspect(prompt, ar), raw: true, safety_tolerance: "2", enable_safety_checker: true }) },
  { id: "flux-pro-v1.1", endpoint: "fal-ai/flux-pro/v1.1", group: "FLUX",
    label: "FLUX 1.1 Pro", price: "$0.04",
    blurb: "มาตรฐาน — improved composition",
    buildInput: withImageSizeEnum },
  { id: "flux-dev", endpoint: "fal-ai/flux/dev", group: "FLUX",
    label: "FLUX.1 [dev]", price: "$0.025",
    blurb: "Flux 12B — personal + commercial use",
    buildInput: withImageSizeEnum },
  { id: "flux-schnell", endpoint: "fal-ai/flux/schnell", group: "FLUX",
    label: "FLUX Schnell (เร็ว ถูก)", price: "$0.003",
    blurb: "ทดสอบ prompt — 1-4 steps",
    buildInput: withImageSizeEnum },
  { id: "flux-lora", endpoint: "fal-ai/flux-lora", group: "FLUX",
    label: "FLUX LoRA", price: "$0.025",
    blurb: "FLUX dev + LoRA support",
    buildInput: withImageSizeEnum },
  { id: "flux-krea-lora", endpoint: "fal-ai/flux-krea-lora/stream", group: "FLUX",
    label: "FLUX Krea LoRA", price: "$0.025",
    blurb: "Fast FLUX dev + Krea LoRA",
    buildInput: withImageSizeEnum },

  // ── ByteDance Seedream ────────────────────────────────────────────────
  { id: "seedream-v4", endpoint: "fal-ai/bytedance/seedream/v4/text-to-image", group: "ByteDance",
    label: "Seedream 4.0", price: "$0.03",
    blurb: "Photoreal + detail — cost-effective",
    buildInput: withWH(2048) },
  { id: "seedream-v5-lite", endpoint: "fal-ai/bytedance/seedream/v5/lite/text-to-image", group: "ByteDance",
    label: "Seedream 5.0 Lite", price: "$0.035",
    blurb: "Seedream รุ่นใหม่สุด — flat $0.035 ทุกขนาดถึง 3K",
    buildInput: withWH(2048) },

  // ── Ideogram ──────────────────────────────────────────────────────────
  { id: "ideogram-v3", endpoint: "fal-ai/ideogram/v3", group: "Ideogram",
    label: "Ideogram V3", price: "$0.08",
    blurb: "Photoreal + complex prompt understanding",
    buildInput: (prompt, ar) => ({ ...withAspect(prompt, ar), rendering_speed: "QUALITY" }) },

  // ── Recraft ───────────────────────────────────────────────────────────
  { id: "recraft-v4-pro", endpoint: "fal-ai/recraft/v4/pro/text-to-image", group: "Recraft",
    label: "Recraft V4 Pro", price: "$0.08",
    blurb: "Production-quality, brand systems",
    buildInput: (prompt, ar) => ({ ...withWH(1536)(prompt, ar), style: "realistic_image" }) },
  { id: "recraft-v3", endpoint: "fal-ai/recraft/v3/text-to-image", group: "Recraft",
    label: "Recraft V3", price: "$0.04",
    blurb: "Production-quality, style consistency",
    buildInput: (prompt, ar) => ({ ...withWH(1536)(prompt, ar), style: "realistic_image" }) },

  // ── Alibaba / Baidu ───────────────────────────────────────────────────
  { id: "qwen-image", endpoint: "fal-ai/qwen-image", group: "Alibaba/Baidu",
    label: "Qwen Image (Alibaba)", price: "$0.03",
    blurb: "Alibaba — complex text rendering",
    buildInput: withImageSizeEnum },
  { id: "ernie-image-turbo", endpoint: "fal-ai/ernie-image/turbo", group: "Alibaba/Baidu",
    label: "ERNIE Image Turbo (Baidu)", price: "$0.02",
    blurb: "Baidu — fast, EN/CN/JP support",
    buildInput: withAspect },
  { id: "ernie-image", endpoint: "fal-ai/ernie-image", group: "Alibaba/Baidu",
    label: "ERNIE Image (Baidu)", price: "$0.04",
    blurb: "Baidu high-quality T2I",
    buildInput: withAspect },

  // ── WAN ───────────────────────────────────────────────────────────────
  { id: "wan-2.7-pro", endpoint: "fal-ai/wan/v2.7/pro/text-to-image", group: "WAN",
    label: "WAN 2.7 Pro", price: "$0.05",
    blurb: "Enhanced detail + composition",
    buildInput: withAspect },
  { id: "wan-2.7", endpoint: "fal-ai/wan/v2.7/text-to-image", group: "WAN",
    label: "WAN 2.7", price: "$0.03",
    blurb: "Advanced prompt understanding",
    buildInput: withAspect },

  // ── Others ────────────────────────────────────────────────────────────
  { id: "gpt-image-1.5", endpoint: "fal-ai/gpt-image-1.5/edit", group: "Other",
    label: "GPT Image 1.5 (OpenAI)", price: "$0.10",
    blurb: "OpenAI — high fidelity + strong prompt adherence",
    buildInput: withImageSizeEnum },
  { id: "grok-imagine", endpoint: "xai/grok-imagine-image/edit", group: "Other",
    label: "Grok Imagine (xAI)", price: "$0.06",
    blurb: "xAI Grok image generation",
    buildInput: withAspect },
  { id: "imagineart-1.5", endpoint: "imagineart/imagineart-1.5-preview/text-to-image", group: "Other",
    label: "ImagineArt 1.5", price: "$0.04",
    blurb: "Professional-grade visuals with readable text",
    buildInput: withAspect },
  { id: "bria-fibo", endpoint: "bria/fibo/generate", group: "Other",
    label: "BRIA FIBO", price: "$0.04",
    blurb: "SOTA open-source, commercial-safe licensed data",
    buildInput: withAspect },
];

export const VALID_ASPECTS = new Set<AspectRatio>(["16:9", "3:2", "1:1", "4:5"]);
export const DEFAULT_ASPECT: AspectRatio = "3:2";

export function getModel(id: string | undefined): ModelAdapter {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

const FAL_KEY = process.env.FAL_KEY;
if (FAL_KEY) fal.config({ credentials: FAL_KEY });

export async function generateImage(
  model: ModelAdapter,
  prompt: string,
  aspectRatio: AspectRatio,
): Promise<string> {
  if (!FAL_KEY) throw new Error("FAL_KEY not configured");
  const input = model.buildInput(prompt, aspectRatio);
  const result = await fal.subscribe(model.endpoint, { input, logs: false });
  const extract = model.extract ?? defaultExtract;
  const url = extract(result.data);
  if (!url) {
    throw new Error(
      `Model ${model.id} returned no image — raw: ${JSON.stringify(result.data).slice(0, 200)}`,
    );
  }
  return url;
}
