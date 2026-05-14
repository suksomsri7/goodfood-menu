// Build a NatGeo-grade food photography prompt from article metadata.
// Goal: a professional, editorial image that reflects the mood of the article —
// never a cartoon, never CGI, never stock-photo gloss.
//
// Inputs: title, excerpt, focusKeyword, optional content + category slug.

const CATEGORY_STYLE: Record<
  string,
  { subject: string; composition: string; light: string; photographer: string }
> = {
  "weight-loss-food": {
    subject: "a portion-controlled bowl with measuring tools or fresh ingredients in frame",
    composition: "overhead flatlay, negative space, restrained palette, morning energy",
    light: "diffused morning daylight, cool clean tones, no heavy shadows",
    photographer: "in the style of Ditte Isager — Scandinavian food editorial",
  },
  "healthy-food": {
    subject: "a colorful spread of whole foods straight from a market or farm",
    composition: "rustic overhead flatlay on aged wood, abundance not perfection",
    light: "natural afternoon daylight, soft golden warmth, organic shadows",
    photographer: "in the style of Penny De Los Santos — National Geographic food",
  },
  "weight-loss-tips": {
    subject: "a notebook, tape measure, or kitchen scale next to a balanced plate — a tool-of-method tableau",
    composition: "overhead flatlay with restrained props, instructional clarity, generous negative space",
    light: "bright clean morning daylight, neutral white balance, soft even fill",
    photographer: "in the style of Gentl & Hyers — Real Simple / Bon Appétit instructional",
  },
  "nutrition-calories": {
    subject: "the key ingredient sliced or cross-sectioned to reveal interior detail",
    composition: "close-up on neutral linen or marble, scientific clarity, single subject",
    light: "single overhead softbox with subtle shadow, clean editorial lighting",
    photographer: "in the style of Andrew Scrivani — food science editorial",
  },
  "eating-tips": {
    subject: "a hand interacting with food mid-action (holding a fork, lifting a bite, plating)",
    composition: "intimate close-up, shallow depth of field, human element visible",
    light: "moody side light from a single window, deep shadows allowed",
    photographer: "in the style of Christopher Testani — editorial food storytelling",
  },
  "food-trends": {
    subject: "a single hero product or dish styled like an editorial product shot",
    composition: "centered minimalist composition with strong negative space",
    light: "dramatic single-source studio light, sharp shadow as design element",
    photographer: "in the style of Bobby Doherty — Bon Appétit / WIRED food editorial",
  },
  "clean-recipes": {
    subject: "a clean, whole-food dish plated naturally with vibrant unprocessed ingredients visible",
    composition: "overhead 45-degree angle on a worn wooden table with linen napkin",
    light: "soft natural window light from upper left, gentle falloff, fresh tone",
    photographer: "in the style of David Loftus or Romulo Yanes — NYT Cooking / Bon Appétit",
  },
  "keto-recipes": {
    subject: "a keto-style plate — fats, protein and leafy greens — visibly low-carb with butter/oil sheen",
    composition: "moody 30-degree angle on dark slate or cast iron, rich textural contrast",
    light: "directional warm side light, deeper shadows, savory chiaroscuro",
    photographer: "in the style of Aubrie Pick — Bon Appétit / dark-board savory editorial",
  },
  "exercise-health": {
    subject: "post-workout meal or hydration setup with a subtle athletic prop (towel, water bottle, dumbbell out of focus)",
    composition: "lifestyle three-quarter view, gym-to-kitchen storytelling, mid-action mood",
    light: "energetic morning daylight, cool clean tones with a warm subject highlight",
    photographer: "in the style of Linda Pugliese — active lifestyle food editorial",
  },
};

const DEFAULT_STYLE = CATEGORY_STYLE["healthy-food"];

const CAMERA_ANCHOR =
  "shot on Phase One IQ4 medium format with 80mm Schneider lens at f/4, ISO 100, fine grain, faithful color, honest exposure";

const HARD_NEGATIVES =
  "no illustration, no cartoon, no 3d render, no CGI, no anime, no painting, no watercolor, no digital art, " +
  "no oversaturation, no HDR, no fake gloss, no plastic-looking food, no clipart, no stock-photo cliche, " +
  "no teal-and-orange grade, no instagram filter, no airbrushed surfaces, no text, no logo, no watermark";

/**
 * Strip Midjourney-style flags so they don't end up as literal text in fal.ai prompts.
 */
export function stripMjFlags(prompt: string): string {
  return prompt
    .replace(/--no\s+[^-]+?(?=--|$)/gi, "")
    .replace(/--\w+(\s+[\w:.-]+)?/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*,+/g, ",")
    .trim()
    .replace(/[,\s]+$/, "");
}

/**
 * Try to derive a hero food subject from the focus keyword / title.
 * Returns a short English subject phrase suitable for prompt insertion.
 */
function deriveSubject(title: string, focusKeyword: string | null | undefined): string {
  const raw = (focusKeyword || title || "").trim();
  if (!raw) return "a beautifully composed plate of seasonal Thai food";

  // Detect "X vs Y" comparison structure
  const vs = raw.match(/(.+?)\s*(?:vs|กับ|เปรียบเทียบ|versus)\s*(.+)/i);
  if (vs) {
    const a = vs[1].replace(/[:!?.,]/g, "").trim();
    const b = vs[2].replace(/[:!?.,]/g, "").trim();
    return `${a} and ${b} side by side in matching bowls or on identical plates, the two subjects framed for direct visual comparison`;
  }

  // Otherwise: subject is the keyword phrase
  const cleaned = raw.replace(/[:!?.,]/g, "").replace(/\s+/g, " ").trim();
  return `${cleaned}, photographed as the single hero subject`;
}

/**
 * Detect a dominant emotion / mood from title + excerpt to bias the lighting choice.
 */
function deriveMoodModifier(title: string, excerpt: string | null | undefined): string {
  const text = `${title} ${excerpt || ""}`.toLowerCase();
  if (/วิกฤต|อันตราย|เสี่ยง|ระวัง|พิษ|ทำลาย/.test(text)) {
    return "cooler temperature, more shadow, a quiet warning tone";
  }
  if (/สดใหม่|ฟิต|แข็งแรง|ลด|เผาผลาญ|สุขภาพ/.test(text)) {
    return "bright clean energy, fresh and inviting";
  }
  if (/อร่อย|หอม|กรอบ|นุ่ม|ผัด|ทอด|ย่าง|เผา/.test(text)) {
    return "warm appetite-driving tone, the kind of light that says \"come closer\"";
  }
  if (/วิจัย|ตัวเลข|เปรียบเทียบ|ดัชนี|สาร/.test(text)) {
    return "clean editorial neutrality, focus on accurate color reproduction";
  }
  return "honest natural ambient tone";
}

export type FoodPromptInput = {
  title: string;
  excerpt?: string | null;
  focusKeyword?: string | null;
  categorySlug?: string | null;
};

/**
 * Build a single-string prompt for fal.ai. Keeps the structure that worked
 * for siamdive's NatGeo prompts: subject → composition → light → camera → photographer → negatives.
 */
export function buildFoodPrompt(input: FoodPromptInput): string {
  const style = CATEGORY_STYLE[input.categorySlug || ""] || DEFAULT_STYLE;
  const subject = deriveSubject(input.title, input.focusKeyword);
  const mood = deriveMoodModifier(input.title, input.excerpt);

  const parts = [
    subject,
    `${style.subject}`,
    `${style.composition}`,
    `${style.light}, ${mood}`,
    style.photographer,
    CAMERA_ANCHOR,
    "editorial food photography, documentary realism, unposed natural styling, " +
      "suspended steam or particulate where appropriate, imperfections allowed, " +
      "shallow but honest depth of field, color-accurate, magazine-grade composition",
    HARD_NEGATIVES,
  ];

  return stripMjFlags(parts.join(", "));
}
