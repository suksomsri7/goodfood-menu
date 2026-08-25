import { getSecret } from "@/lib/secrets/store";
import type { VerifiedIdentity } from "@/lib/coachAuth";

/**
 * เข้าสู่ระบบด้วย LINE / Facebook สำหรับแอป Coach
 *
 * 🔴 การแลก code เป็น token ทำที่เซิร์ฟเวอร์เท่านั้น เพราะต้องใช้ "channel secret / app secret"
 *    ถ้าฝังความลับพวกนี้ในแอป ใครแกะไฟล์แอปก็สวมเป็นแอปเราได้ทั้งหมด
 *
 * 🔴 ทั้ง LINE และ Facebook ไม่ยอมให้ redirect กลับเข้า custom scheme ของแอปตรง ๆ
 *    (ต้องเป็น https) → ใช้เว็บเราเป็นสะพาน: provider ยิงกลับมาที่
 *    /api/auth/native/<provider>/callback แล้วเราค่อย 302 ต่อเข้า coach://oauth ของแอป
 *
 * 🔴 LINE Login channel ≠ Messaging API channel — ใช้ id/secret ของ "Login channel" เท่านั้น
 *    (ของเดิมในระบบคือ Messaging API channel 2010189036 ซึ่งใช้ตรงนี้ไม่ได้)
 */

export const APP_REDIRECT_SCHEME = "coach://oauth";

/**
 * URL ปลายทางที่ต้องไปลงทะเบียนในคอนโซลของแต่ละเจ้า
 *
 * 🔴 ห้ามใช้ origin ของ request ตรง ๆ — แอปรันในคอนเทนเนอร์หลัง nginx
 *    new URL(req.url).origin จะได้ "https://0.0.0.0:3000" (ที่อยู่ภายใน) แล้ว provider จะตีกลับ
 *    redirect_uri_mismatch ทันที · ต้องยึด NEXT_PUBLIC_BASE_URL ซึ่งเป็นชื่อจริงที่ลูกค้าเห็น
 * 🔴 ค่านี้ต้องตรงเป๊ะทั้งตอนขอ authorize และตอนแลก token ไม่งั้น provider ปฏิเสธ
 */
export function callbackUrl(provider: "line" | "facebook"): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://goodfood.in.th").replace(/\/$/, "");
  return `${base}/api/auth/native/${provider}/callback`;
}

async function creds(provider: "line" | "facebook") {
  if (provider === "line") {
    const [id, secret] = await Promise.all([
      getSecret("LINE_LOGIN_CHANNEL_ID"),
      getSecret("LINE_LOGIN_CHANNEL_SECRET"),
    ]);
    return { id: id?.trim() || "", secret: secret?.trim() || "" };
  }
  const [id, secret] = await Promise.all([getSecret("FACEBOOK_APP_ID"), getSecret("FACEBOOK_APP_SECRET")]);
  return { id: id?.trim() || "", secret: secret?.trim() || "" };
}

/** แอปถามก่อนว่าจอ login ควรโชว์ปุ่มไหนบ้าง — ปุ่มที่กดแล้วพังไม่ควรมีอยู่ */
export async function configuredProviders(): Promise<Record<string, boolean>> {
  const [apple, google, lineId, lineSecret, fbId, fbSecret] = await Promise.all([
    getSecret("APPLE_CLIENT_ID"),
    getSecret("GOOGLE_CLIENT_ID"),
    getSecret("LINE_LOGIN_CHANNEL_ID"),
    getSecret("LINE_LOGIN_CHANNEL_SECRET"),
    getSecret("FACEBOOK_APP_ID"),
    getSecret("FACEBOOK_APP_SECRET"),
  ]);
  return {
    apple: !!apple?.trim(),
    google: !!google?.trim(),
    line: !!(lineId?.trim() && lineSecret?.trim()),
    facebook: !!(fbId?.trim() && fbSecret?.trim()),
  };
}

/** ข้อมูลที่แอปต้องใช้เปิดหน้า login ของ provider (แอปไม่ต้องรู้ secret) */
export async function authorizeInfo(provider: "line" | "facebook") {
  const { id, secret } = await creds(provider);
  if (!id || !secret) return null;
  return {
    clientId: id,
    redirectUri: callbackUrl(provider),
    authorizeEndpoint:
      provider === "line"
        ? "https://access.line.me/oauth2/v2.1/authorize"
        : "https://www.facebook.com/v21.0/dialog/oauth",
    scope: provider === "line" ? "profile openid email" : "public_profile,email",
  };
}

async function post(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${url} → ${res.status} ${JSON.stringify(json).slice(0, 160)}`);
  return json as Record<string, unknown>;
}

/** LINE: code → token → ตรวจ id_token กับ LINE เอง (ไม่ถอด JWT เอง) */
export async function exchangeLineCode(code: string): Promise<VerifiedIdentity> {
  const { id, secret } = await creds("line");
  if (!id || !secret) throw new Error("LINE Login ยังไม่ได้ตั้งค่า");

  const token = await post("https://api.line.me/oauth2/v2.1/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl("line"),
    client_id: id,
    client_secret: secret,
  });

  const idToken = token.id_token as string | undefined;
  if (!idToken) throw new Error("LINE ไม่ได้ส่ง id_token กลับมา (ขาด scope openid?)");

  // 🔴 ต้องตรวจกับ LINE พร้อมส่ง client_id ไปด้วย — กัน token ที่ออกให้แอปอื่นเอามาสวม
  const verified = await post("https://api.line.me/oauth2/v2.1/verify", { id_token: idToken, client_id: id });
  const sub = verified.sub as string | undefined;
  if (!sub) throw new Error("LINE token ไม่มี sub");

  return {
    provider: "line",
    providerId: sub,
    email: (verified.email as string | undefined) || undefined,
    // LINE ให้อีเมลเฉพาะแอปที่ขอสิทธิ์ผ่านแล้ว และยืนยันตัวตนมาให้ในตัว
    emailVerified: !!verified.email,
  };
}

/** Facebook: code → token → ตรวจว่า token เป็นของแอปเราจริง แล้วค่อยดึงโปรไฟล์ */
export async function exchangeFacebookCode(code: string): Promise<VerifiedIdentity> {
  const { id, secret } = await creds("facebook");
  if (!id || !secret) throw new Error("Facebook Login ยังไม่ได้ตั้งค่า");

  const tokenRes = await fetch(
    "https://graph.facebook.com/v21.0/oauth/access_token?" +
      new URLSearchParams({
        client_id: id,
        client_secret: secret,
        redirect_uri: callbackUrl("facebook"),
        code,
      }),
  );
  const token = (await tokenRes.json()) as { access_token?: string; error?: unknown };
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(`facebook token error: ${JSON.stringify(token).slice(0, 160)}`);
  }

  /* 🔴 debug_token คือด่านที่ห้ามข้าม — token ที่ผู้ใช้ส่งมาอาจเป็นของแอปอื่น
     ถ้าไม่ตรวจ app_id ใครก็เอา token จากแอปตัวเองมาสวมเป็นสมาชิกเราได้ */
  const dbg = await fetch(
    "https://graph.facebook.com/debug_token?" +
      new URLSearchParams({ input_token: token.access_token, access_token: `${id}|${secret}` }),
  ).then((r) => r.json() as Promise<{ data?: { app_id?: string; is_valid?: boolean; user_id?: string } }>);

  if (!dbg?.data?.is_valid || dbg.data.app_id !== id || !dbg.data.user_id) {
    throw new Error("facebook token ไม่ผ่านการตรวจ (คนละแอป/หมดอายุ)");
  }

  const me = (await fetch(
    "https://graph.facebook.com/v21.0/me?" +
      new URLSearchParams({ fields: "id,name,email", access_token: token.access_token }),
  ).then((r) => r.json())) as { id?: string; name?: string; email?: string };

  if (!me?.id || me.id !== dbg.data.user_id) throw new Error("facebook profile ไม่ตรงกับ token");

  return {
    provider: "facebook",
    providerId: me.id,
    email: me.email,
    // อีเมลจาก Facebook ยืนยันแล้วเสมอถ้าส่งมา (บัญชีที่ยังไม่ยืนยันจะไม่ส่งฟิลด์นี้)
    emailVerified: !!me.email,
    displayName: me.name,
  };
}
