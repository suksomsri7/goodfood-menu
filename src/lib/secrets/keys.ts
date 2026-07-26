export type SecretKeyMeta = {
  key: string;
  label: string;
  description: string;
  group: "AI" | "LINE" | "Other";
  href?: string;
};

export const SECRET_KEY_REGISTRY: SecretKeyMeta[] = [
  // AI
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    description: "ใช้กับ AI food analysis (ai-analysis, analyze-food, ai-select-menu)",
    group: "AI",
    href: "https://platform.openai.com/api-keys",
  },
  {
    key: "FAL_KEY",
    label: "fal.ai Key",
    description: "ใช้กับ AI cover image generation (Flux/Nano Banana/Seedream ฯลฯ)",
    group: "AI",
    href: "https://fal.ai/dashboard/keys",
  },

  // LINE
  {
    key: "LIFF_ID",
    label: "LIFF ID",
    description: "LINE LIFF app id สำหรับ in-app login flow",
    group: "LINE",
  },
  {
    key: "LINE_CHANNEL_ID",
    label: "LINE Channel ID",
    description: "LINE Login channel id",
    group: "LINE",
  },
  {
    key: "LINE_CHANNEL_SECRET",
    label: "LINE Channel Secret",
    description: "LINE Login channel secret",
    group: "LINE",
  },
  {
    key: "LINE_CHANNEL_ACCESS_TOKEN",
    label: "LINE Channel Access Token",
    description: "LINE Messaging API long-lived token (สำหรับ push/reply)",
    group: "LINE",
  },

  // SHARK Integration (auto-post to FB/IG via SHARK)
  {
    key: "SHARK_URL",
    label: "SHARK Base URL",
    description: "ที่อยู่ SHARK API (default https://shark.guide)",
    group: "Other",
  },
  {
    key: "SHARK_BRAND_ID",
    label: "SHARK Brand ID",
    description: "Brand ID ใน SHARK ที่จะโพสต์",
    group: "Other",
  },
  {
    key: "SHARK_API_KEY",
    label: "SHARK API Key",
    description: "API key ที่สร้างใน SHARK app (Settings → API Keys) ขึ้นต้น sk_brnd_",
    group: "Other",
  },
  {
    key: "SHARK_CHANNEL_IDS",
    label: "SHARK Channel IDs",
    description: "Channel IDs ที่จะโพสต์ (คั่นด้วย comma)",
    group: "Other",
  },
];

export function findKeyMeta(key: string): SecretKeyMeta | undefined {
  return SECRET_KEY_REGISTRY.find((m) => m.key === key);
}

export function isManagedKey(key: string): boolean {
  return SECRET_KEY_REGISTRY.some((m) => m.key === key);
}
