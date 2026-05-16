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
 * Thai food visual dictionary — AI image models don't recognize romanized Thai
 * names (khao tan, som tam, tom yum). They render wildly wrong subjects.
 * Map common Thai foods → descriptive English phrases (shape/color/texture/method).
 * Keys are Thai substrings to match anywhere in the title/keyword.
 */
const THAI_FOOD_DICT: Array<[RegExp, string]> = [
  [/ข้าวแต๋น/, "a flat round Thai puffed-rice cracker disc the size of a coaster, glazed with caramelized palm sugar on top, golden brown with crackled crispy texture"],
  [/ข้าวหลาม/, "a bamboo tube of sticky rice with coconut, tube split lengthwise revealing sticky rice and black bean filling, charred bamboo exterior"],
  [/ข้าวเหนียวมะม่วง/, "a small woven bamboo basket of white sticky rice beside halved ripe yellow mango on a wooden plate, coconut cream drizzle"],
  [/ส้มตำ/, "green papaya salad in a clay mortar with wooden pestle, shredded green papaya, halved cherry tomatoes, long beans, red chili and lime wedge, crushed peanuts on top"],
  [/ผัดไทย/, "Thai stir-fried rice noodles wrapped in a thin omelette parcel, lime wedge, banana flower, crushed peanuts and bean sprouts visible"],
  [/ต้มยำ/, "clear-red Thai hot-and-sour soup with whole prawns, galangal slices, lemongrass and kaffir lime leaves floating, served in a dark clay bowl"],
  [/ข้าวมันไก่/, "poached chicken slices over fragrant garlic rice on a small white plate, cucumber slices and ginger-chili dipping sauce in a tiny bowl"],
  [/ก๋วยเตี๋ยวเรือ|ก๋วยเตี๋ยว/, "a small narrow bowl of dark Thai boat noodles with pork-blood broth, pork balls, morning glory and fried garlic"],
  [/ลาบ/, "minced spicy Thai meat salad on a flat plate with toasted rice powder, mint leaves, red chili flakes and lime wedge, sticky rice ball on the side"],
  [/น้ำพริก/, "Thai chili dip in a small mortar with cucumber sticks and steamed vegetables arranged around"],
  [/ข้าวกล้อง/, "unpolished brown rice grains in a small white bowl, visible bran texture, slightly red-brown tint"],
  [/ข้าวขาว|ข้าวสวย/, "steamed white jasmine rice in a small white bowl, fluffy texture with individual grains visible"],
  [/ขนมไทย/, "small colorful traditional Thai coconut-and-pandan desserts on a banana leaf plate"],
  [/โจ๊ก/, "Thai rice congee in a deep bowl with minced pork, century egg, ginger threads and fried dough stick on the side"],
  [/อกไก่/, "a single seared chicken breast sliced into medallions on a white plate, juices visible, simple herb garnish"],
  [/ทูน่า/, "an open can or fillet of tuna in olive oil on a white plate, capers and lemon wedge beside it"],
  [/อาหารคลีน/, "grilled lean protein with brown rice and steamed vegetables on a single white plate, no sauce drizzle"],
  [/เซเว่น|7-11|seven|สะดวกซื้อ/i, "a single Thai convenience-store snack-aisle shelf row with several branded plastic packets visible, one front packet in sharp focus and the rest softly blurred down the shelf"],
];

/**
 * Map Thai food terms in raw text → descriptive English phrases.
 * Returns the first matching phrase, or null if no match.
 */
function matchThaiFood(raw: string): string | null {
  for (const [regex, phrase] of THAI_FOOD_DICT) {
    if (regex.test(raw)) return phrase;
  }
  return null;
}

/**
 * Try to derive a hero food subject from the focus keyword / title.
 * Returns a short English subject phrase suitable for prompt insertion.
 * Default = single hero. Comparison ONLY when title explicitly contains vs/เปรียบเทียบ.
 */
function deriveSubject(title: string, focusKeyword: string | null | undefined): string {
  const raw = (focusKeyword || title || "").trim();
  if (!raw) return "a beautifully composed single plate of seasonal Thai food as the hero subject";

  // Detect explicit "X vs Y" comparison — tightened: only "vs/versus/เปรียบเทียบ/ดีกว่า/ต่างกัน"
  // Removed loose "กับ" which is too common in non-comparison titles.
  const vs = raw.match(/(.+?)\s*(?:vs|versus|เปรียบเทียบ|ดีกว่า|ต่างกัน|ต่างกันยังไง)\s*(.+)/i);
  if (vs) {
    const aRaw = vs[1].replace(/[:!?.,]/g, "").trim();
    const bRaw = vs[2].replace(/[:!?.,]/g, "").trim();
    const a = matchThaiFood(aRaw) || aRaw;
    const b = matchThaiFood(bRaw) || bRaw;
    return `${a} and ${b} side by side in identical bowls on a clean surface, exactly two subjects framed for direct visual comparison, no third subject`;
  }

  // Single hero — prefer Thai food dictionary translation
  const dictMatch = matchThaiFood(raw);
  if (dictMatch) {
    return `${dictMatch}, photographed as the single hero subject filling most of the frame`;
  }

  // Fallback: clean keyword phrase (likely English or generic concept)
  const cleaned = raw.replace(/[:!?.,]/g, "").replace(/\s+/g, " ").trim();
  return `${cleaned}, photographed as the single hero subject filling most of the frame`;
}

/**
 * Detect a context/scene cue from title (convenience store, office, market, gym, home).
 * Returns a setting phrase to inject into the prompt, or null if no specific scene.
 */
function deriveScene(title: string): string | null {
  const text = title.toLowerCase();
  if (/เซเว่น|7-?11|seven|สะดวกซื้อ|โลตัส|บิ๊กซี/i.test(title)) {
    return "scene set inside a Thai convenience store snack aisle with retail fluorescent lighting and branded plastic packaging visible";
  }
  if (/ออฟฟิศ|ทำงาน|โต๊ะทำงาน|พนักงาน/.test(text)) {
    return "scene set on a wooden office desk with a laptop edge softly blurred and a coffee cup in the background";
  }
  if (/ตลาด|สตรีท|แผงลอย|รถเข็น/.test(text)) {
    return "scene set at an outdoor Thai market vendor cart with brass utensils and banana leaf liner under ambient daylight";
  }
  if (/ฟิตเนส|ยิม|หลังออกกำลังกาย|เวท|กล้าม/.test(text)) {
    return "scene set beside a gym water bottle and protein shaker, towel softly blurred in background";
  }
  if (/โรงเรียน|เด็ก|ลูก|กล่องข้าว/.test(text)) {
    return "scene set as a single portion in a small lunchbox on a clean surface, minimal child-friendly styling";
  }
  if (/บ้าน|ครัว|ทำกินเอง|มื้อเย็น/.test(text)) {
    return "scene set on a home kitchen counter with a wooden cutting board and soft natural window light";
  }
  return null;
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
  const scene = deriveScene(input.title);

  // If we have a specific scene cue (convenience store / office / market / gym / home),
  // it overrides the generic category composition surface — otherwise a "7-Eleven snacks"
  // title would still render on the category default "wooden table" or "concrete".
  const compositionLine = scene
    ? `${scene}, single hero subject filling most of the frame, restrained supporting props only`
    : `${style.subject}, ${style.composition}`;

  const parts = [
    subject,
    compositionLine,
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
