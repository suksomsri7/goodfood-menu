// fal.ai model registry — curated for goodfood food-cover use case.
// Ported from /root/projects/siamdive/src/app/api/blog-images/generate/models.ts
// (subset only — 6 models that work well for food photography).

import { fal } from "@fal-ai/client";

export type AspectRatio = "16:9" | "3:2" | "1:1" | "4:5";

export type ModelAdapter = {
  id: string;
  endpoint: string;
  label: string;
  blurb: string;
  price: string;
  defaultAspect: AspectRatio;
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
  {
    id: "nano-banana-pro",
    endpoint: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro (Google)",
    price: "$0.15",
    blurb: "Google SOTA — เหมาะถ่ายอาหารระดับ NatGeo / Bon Appétit",
    defaultAspect: "3:2",
    buildInput: withAspect,
  },
  {
    id: "flux-1.1-ultra-raw",
    endpoint: "fal-ai/flux-pro/v1.1-ultra",
    label: "FLUX 1.1 Ultra (raw)",
    price: "$0.06",
    blurb: "Photorealistic raw mode — ฟิล์มกล้องดิจิทัล",
    defaultAspect: "3:2",
    buildInput: (prompt, ar) => ({
      ...withAspect(prompt, ar),
      raw: true,
      safety_tolerance: "2",
      enable_safety_checker: true,
    }),
  },
  {
    id: "flux-pro-v1.1",
    endpoint: "fal-ai/flux-pro/v1.1",
    label: "FLUX 1.1 Pro",
    price: "$0.04",
    blurb: "มาตรฐาน — improved composition",
    defaultAspect: "3:2",
    buildInput: withImageSizeEnum,
  },
  {
    id: "seedream-v4",
    endpoint: "fal-ai/bytedance/seedream/v4/text-to-image",
    label: "Seedream 4.0",
    price: "$0.03",
    blurb: "Photoreal + detail — ราคาประหยัด",
    defaultAspect: "3:2",
    buildInput: withWH(2048),
  },
  {
    id: "imagen4-ultra",
    endpoint: "fal-ai/imagen4/preview/ultra",
    label: "Imagen 4 Ultra (Google)",
    price: "$0.06",
    blurb: "Google Imagen รุ่นคุณภาพสูงสุด",
    defaultAspect: "3:2",
    buildInput: withAspect,
  },
  {
    id: "flux-schnell",
    endpoint: "fal-ai/flux/schnell",
    label: "FLUX Schnell (เร็ว ถูก)",
    price: "$0.003",
    blurb: "ทดสอบ prompt — 1-4 steps",
    defaultAspect: "3:2",
    buildInput: withImageSizeEnum,
  },
];

export const VALID_ASPECTS = new Set<AspectRatio>(["16:9", "3:2", "1:1", "4:5"]);

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
