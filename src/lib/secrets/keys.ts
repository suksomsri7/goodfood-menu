export type SecretKeyMeta = {
  key: string;
  label: string;
  description: string;
  group: "AI" | "LINE" | "Login แอป" | "อุปกรณ์สุขภาพ" | "Other";
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

  // เข้าสู่ระบบในแอป Coach (social login)
  {
    key: "APPLE_CLIENT_ID",
    label: "Apple Client ID (bundle id)",
    description: "bundle id ของแอป เช่น th.in.coach.app — ใส่หลายค่าคั่นด้วยจุลภาคได้",
    group: "Login แอป",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google Client ID",
    description: "OAuth client id ที่ใช้ตรวจ id_token (ใส่ทั้ง iOS/Android/Web คั่นด้วยจุลภาค)",
    href: "https://console.cloud.google.com/apis/credentials",
    group: "Login แอป",
  },
  {
    key: "LINE_LOGIN_CHANNEL_ID",
    label: "LINE Login Channel ID",
    description: "🔴 คนละตัวกับ Messaging API channel — เอาจาก LINE Login channel",
    href: "https://developers.line.biz/console/",
    group: "Login แอป",
  },
  {
    key: "LINE_LOGIN_CHANNEL_SECRET",
    label: "LINE Login Channel Secret",
    description: "ใช้แลก code เป็น token ฝั่งเซิร์ฟเวอร์ (ไม่เก็บในแอป)",
    href: "https://developers.line.biz/console/",
    group: "Login แอป",
  },
  {
    key: "FACEBOOK_APP_ID",
    label: "Facebook App ID",
    description: "แอปที่เปิด product Facebook Login ไว้",
    href: "https://developers.facebook.com/apps/",
    group: "Login แอป",
  },
  {
    key: "FACEBOOK_APP_SECRET",
    label: "Facebook App Secret",
    description: "ใช้แลก code เป็น token ฝั่งเซิร์ฟเวอร์ (ไม่เก็บในแอป)",
    href: "https://developers.facebook.com/apps/",
    group: "Login แอป",
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

  // อุปกรณ์สุขภาพ (ดึงข้อมูลเข้าแอป Coach — ไม่ใช่การล็อกอิน)
  {
    key: "FITBIT_CLIENT_ID",
    label: "Fitbit Client ID",
    description: "ใส่แล้วปุ่ม \"เชื่อม Fitbit\" จะโผล่ในแอปเอง (Fitbit ไม่เขียนลง Apple Health จึงต้องต่อตรง)",
    group: "อุปกรณ์สุขภาพ",
    href: "https://dev.fitbit.com/apps/new",
  },
  {
    key: "FITBIT_CLIENT_SECRET",
    label: "Fitbit Client Secret",
    description: "OAuth 2.0 Client Secret ของแอป Fitbit · ประเภทแอปต้องเป็น Personal ถึงจะขอ intraday ได้",
    group: "อุปกรณ์สุขภาพ",
    href: "https://dev.fitbit.com/apps",
  },
  {
    key: "STRAVA_CLIENT_ID",
    label: "Strava Client ID",
    description: "ใส่แล้วปุ่ม \"เชื่อม Strava\" จะโผล่ในแอปเอง (ดึงกิจกรรมวิ่ง/ปั่นเข้าบันทึกออกกำลังกาย)",
    group: "อุปกรณ์สุขภาพ",
    href: "https://www.strava.com/settings/api",
  },
  {
    key: "STRAVA_CLIENT_SECRET",
    label: "Strava Client Secret",
    description: "Client Secret ของแอป Strava",
    group: "อุปกรณ์สุขภาพ",
    href: "https://www.strava.com/settings/api",
  },

  // บอท Telegram สำหรับคิวตรวจคลิปท่าออกกำลังกาย
  {
    key: "FOODIE_BOT_TOKEN",
    label: "Foodie Bot Token",
    description: "โทเคนของ @Foodie_goodfood_bot — ใช้ส่งการ์ดให้กดผ่าน/ไม่ผ่าน",
    group: "Other",
  },
  {
    key: "FOODIE_BOT_CHAT_ID",
    label: "Foodie Bot Chat ID",
    description: "แชทที่จะรับการ์ด (ของเจ้าของร้าน)",
    group: "Other",
  },
  {
    key: "FOODIE_WEBHOOK_SECRET",
    label: "Foodie Webhook Secret",
    description: "ค่าลับที่ Telegram แนบมาทุก request — กันคนอื่นยิง webhook มั่ว",
    group: "Other",
  },

  {
    key: "YOUTUBE_API_KEY",
    label: "YouTube Data API Key",
    description: "ใช้ค้นคลิปสอนท่าออกกำลังกายให้ครบทั้งคลัง (scripts/seed-exercise-videos.ts) · ฟรี 10,000 หน่วย/วัน = ~100 ท่า/วัน",
    group: "Other",
    href: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  },
];

export function findKeyMeta(key: string): SecretKeyMeta | undefined {
  return SECRET_KEY_REGISTRY.find((m) => m.key === key);
}

export function isManagedKey(key: string): boolean {
  return SECRET_KEY_REGISTRY.some((m) => m.key === key);
}
