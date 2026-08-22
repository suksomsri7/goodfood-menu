/**
 * Session ของลูกค้าฝั่ง LIFF — คุกกี้ httpOnly ที่เซ็นด้วย JWT
 *
 * 🔴 ทำไมต้องมี: เส้น API ฝั่ง LIFF เดิมเชื่อ `?lineUserId=` ที่ client ส่งมาตรง ๆ
 *    ใครรู้ (หรือเดาถูก) lineUserId ของคนอื่น ก็อ่าน/แก้/ลบ ข้อมูลสุขภาพ ที่อยู่ ตะกร้า ออเดอร์ ของคนนั้นได้ทันที
 *    ตัวตนจึงต้องมาจากสิ่งที่ LINE เซ็นให้ (id token / access token) ไม่ใช่จากพารามิเตอร์ที่ client พิมพ์เอง
 *
 * ทางเดินของตัวตนหลังแก้ (เรียงลำดับที่ยอมรับ):
 *   1. `Authorization: Bearer` (แอป native) — ของเดิม ไม่กระทบ
 *   2. คุกกี้ `gf_member` (LIFF แลกมาจาก /api/auth/liff ตอนเปิดหน้า)
 *   3. `?lineUserId=` — ปิดแล้ว เปิดคืนได้ชั่วคราวด้วย env LIFF_ALLOW_LEGACY_ID=1 (ต้อง build ใหม่)
 */
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "@/lib/secrets/store";

const COOKIE = "gf_member";
const ISSUER = "goodfood.liff";
const TTL_SECONDS = 30 * 24 * 60 * 60; // เปิด LIFF ทีนึงแล้วใช้ได้ยาว ๆ (ทุกครั้งที่เปิดจะต่ออายุให้เอง)

async function key(): Promise<Uint8Array> {
  const s = (await getSecret("NEXTAUTH_SECRET")) || process.env.NEXTAUTH_SECRET || "";
  if (!s) throw new Error("no session secret (set NEXTAUTH_SECRET)");
  return new TextEncoder().encode(s);
}

export interface LiffClaims {
  /** lineUserId ที่ LINE ยืนยันแล้ว */
  sub: string;
}

export async function issueMemberCookie(res: NextResponse, lineUserId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(lineUserId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(await key());

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function clearMemberCookie(res: NextResponse): void {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** lineUserId จากคุกกี้ (ยืนยันลายเซ็นแล้ว) — ไม่มี/ใช้ไม่ได้ = null */
export async function lineUserIdFromCookie(req: NextRequest): Promise<string | null> {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, await key(), { issuer: ISSUER, algorithms: ["HS256"] });
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

/**
 * ยังยอมให้เชื่อ `?lineUserId=` อยู่ไหม
 * 🔴 ค่าปริยาย = ไม่ · เปิดคืนเฉพาะตอนฉุกเฉิน (LIFF ของจริงพังหลัง deploy) ด้วย LIFF_ALLOW_LEGACY_ID=1
 *    แล้ว `docker compose up -d --build web` ใหม่ (env ถูกฝังตอน build)
 */
export function legacyLineUserIdAllowed(): boolean {
  return process.env.LIFF_ALLOW_LEGACY_ID === "1";
}

// ── ยืนยันตัวตนกับ LINE ──

/** channel id ของ LINE Login ที่ LIFF นี้อยู่ (คำนำหน้าของ LIFF ID: "2010189817-as2J0plj") */
function loginChannelId(): string {
  const explicit = process.env.LINE_LOGIN_CHANNEL_ID;
  if (explicit) return explicit;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID_CAL || "";
  return liffId.split("-")[0] || "";
}

/**
 * id token จาก `liff.getIDToken()` → lineUserId
 * ให้ LINE เป็นคนตรวจลายเซ็น (เราไม่ต้องถือ public key เอง) และผูกกับ channel ของเราเท่านั้น
 */
export async function verifyLineIdToken(idToken: string): Promise<string | null> {
  const clientId = loginChannelId();
  if (!clientId || !idToken) return null;
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sub?: string; aud?: string };
    if (!data.sub) return null;
    if (data.aud && data.aud !== clientId) return null;
    return data.sub;
  } catch {
    return null;
  }
}

/**
 * access token จาก `liff.getAccessToken()` → lineUserId
 * ทางสำรองตอน LIFF ไม่ได้ขอ scope openid (getIDToken คืน null)
 */
export async function verifyLineAccessToken(accessToken: string): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const clientId = loginChannelId();
    // ต้องเช็คก่อนว่า token นี้ออกให้ channel ของเรา ไม่งั้นใครถือ token จาก LIFF อื่นก็สวมได้
    const v = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!v.ok) return null;
    const info = (await v.json()) as { client_id?: string; expires_in?: number };
    if (!info.client_id || (clientId && info.client_id !== clientId)) return null;
    if ((info.expires_in ?? 0) <= 0) return null;

    const res = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const profile = (await res.json()) as { userId?: string };
    return profile.userId ?? null;
  } catch {
    return null;
  }
}
