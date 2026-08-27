/**
 * บริการสุขภาพภายนอกที่ "ต่อตรง" (ไม่ได้ผ่าน Apple Health / Health Connect)
 *
 * 🔴 ทำไมต้องต่อตรงทั้งที่มี Apple Health อยู่แล้ว:
 *    · Fitbit **ไม่เขียนลง Apple Health** (เป็นของ Google) — คนใช้ Fitbit ไม่มีทางอื่นเลย
 *    · Strava เขียนลง Health ได้ก็จริง แต่คนส่วนใหญ่ไม่เปิด และเราอยากได้ชื่อ/ประเภทกิจกรรมจริง
 *    ที่เหลือ (Garmin / Oura / Whoop / Withings / Xiaomi / เครื่องชั่ง Fitdays ฯลฯ)
 *    เขียนลง Apple Health / Health Connect ได้เอง → **ไม่ต้องต่อตรง** อย่าเพิ่มมาที่นี่โดยไม่จำเป็น
 *
 * 🔴 client secret อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น (secret_settings) — แอปไม่เคยถือ
 * 🔴 redirect_uri ต้องยึด NEXT_PUBLIC_BASE_URL เสมอ ห้ามใช้ origin ของ request
 *    (ในคอนเทนเนอร์จะได้ https://0.0.0.0:3000 แล้ว provider ตีกลับ redirect_uri_mismatch)
 */
import { getSecret } from "@/lib/secrets/store";

export const PROVIDERS = ["fitbit", "strava"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type ProviderMeta = {
  key: Provider;
  label: string;
  /** อธิบายให้ user รู้ว่าเชื่อมแล้วได้อะไร — ขึ้นในแอปตรง ๆ */
  blurb: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  idSecret: string;
  secretSecret: string;
  /** Fitbit ต้องใช้ Basic auth ตอนแลก token · Strava ส่ง client_secret ใน body */
  basicAuth: boolean;
};

export const PROVIDER_META: Record<Provider, ProviderMeta> = {
  fitbit: {
    key: "fitbit",
    label: "Fitbit",
    blurb: "ก้าว · แคลอรี่ · การนอน · น้ำหนัก · % ไขมัน · ชีพจรขณะพัก",
    authUrl: "https://www.fitbit.com/oauth2/authorize",
    tokenUrl: "https://api.fitbit.com/oauth2/token",
    scope: "activity heartrate sleep weight profile",
    idSecret: "FITBIT_CLIENT_ID",
    secretSecret: "FITBIT_CLIENT_SECRET",
    basicAuth: true,
  },
  strava: {
    key: "strava",
    label: "Strava",
    blurb: "กิจกรรมวิ่ง/ปั่น/ว่ายน้ำ เข้าบันทึกออกกำลังกายให้อัตโนมัติ",
    authUrl: "https://www.strava.com/oauth/authorize",
    tokenUrl: "https://www.strava.com/oauth/token",
    scope: "activity:read_all",
    idSecret: "STRAVA_CLIENT_ID",
    secretSecret: "STRAVA_CLIENT_SECRET",
    basicAuth: false,
  },
};

export function isProvider(v: string): v is Provider {
  return (PROVIDERS as readonly string[]).includes(v);
}

export function callbackUrl(provider: Provider): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://goodfood.in.th").replace(/\/$/, "");
  return `${base}/api/integrations/${provider}/callback`;
}

export async function creds(provider: Provider): Promise<{ id: string; secret: string }> {
  const meta = PROVIDER_META[provider];
  const [id, secret] = await Promise.all([getSecret(meta.idSecret), getSecret(meta.secretSecret)]);
  return { id: id?.trim() || "", secret: secret?.trim() || "" };
}

/** provider ไหนใส่กุญแจครบแล้วบ้าง — แอปถามก่อนวาดปุ่ม (ปุ่มที่กดแล้วพังไม่ควรมีอยู่) */
export async function configuredProviders(): Promise<Record<Provider, boolean>> {
  const entries = await Promise.all(
    PROVIDERS.map(async (p) => {
      const c = await creds(p);
      return [p, !!(c.id && c.secret)] as const;
    })
  );
  return Object.fromEntries(entries) as Record<Provider, boolean>;
}
