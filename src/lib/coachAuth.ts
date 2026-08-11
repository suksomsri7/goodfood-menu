/**
 * Coach native app — auth (Apple / Google) + JWT session
 * ใช้ jose ตรวจ identity token ผ่าน JWKS ของ provider แล้วออก session JWT ของเราเอง
 * เก็บ mapping provider→member ใน AuthIdentity (schema.prisma)
 */
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/secrets/store";

const ACCESS_TTL = "1h";
const REFRESH_TTL = "60d";
/**
 * กุญแจของแอปบน Apple Watch — อายุยาว 30 วัน
 *
 * ทำไมต้องมี: นาฬิกาไม่มีทางต่ออายุ token เอง (refresh token อยู่ใน Keychain ของ iPhone)
 * ถ้าส่ง access 1 ชม. ให้ ผ่านไปชั่วโมงเดียวนาฬิกาก็ใช้ไม่ได้แล้ว (บั๊ก build 31)
 *
 * ขอบเขตสิทธิ์: ใช้แทน access ได้ (อ่าน/บันทึกข้อมูลของตัวเอง) แต่ **ห้ามใช้แทน refresh**
 * → ต่ออายุตัวเองไม่ได้ · หมดอายุแล้วต้องเปิดแอปบนมือถือให้ออกใบใหม่
 */
const WATCH_TTL = "30d";
const ISSUER = "coach.app";

// ── session secret ──
async function sessionKey(): Promise<Uint8Array> {
  const s =
    (await getSecret("COACH_JWT_SECRET")) ||
    (await getSecret("NEXTAUTH_SECRET")) ||
    process.env.NEXTAUTH_SECRET ||
    "";
  if (!s) throw new Error("no session secret (set COACH_JWT_SECRET or NEXTAUTH_SECRET)");
  return new TextEncoder().encode(s);
}

export type SessionClaims = { sub: string; typ: "access" | "refresh" | "watch" };
/** typ ที่ถือว่า "ใช้เรียก API ของ member ได้" — refresh ไม่อยู่ในนี้โดยตั้งใจ */
const APP_TYPES = ["access", "watch"];

/** ออกกุญแจให้แอปนาฬิกา (เรียกได้เฉพาะเจ้าของ session ปกติ — ดู /api/auth/native/watch-token) */
export async function signWatchToken(memberId: string): Promise<{ watchToken: string; expiresAt: string }> {
  const key = await sessionKey();
  // ผูก epoch ปัจจุบันไว้ในกุญแจ — พอ logout แล้ว epoch ขยับ กุญแจใบเก่าจะใช้ไม่ได้ทันที
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { sessionEpoch: true } });
  const watchToken = await new SignJWT({ typ: "watch", epoch: m?.sessionEpoch ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(WATCH_TTL)
    .sign(key);
  return { watchToken, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() };
}

export async function signSession(memberId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const key = await sessionKey();
  const accessToken = await new SignJWT({ typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(key);

  // S3: refresh มี jti + แถวใน DB → rotate/เพิกถอนได้ (เดิม stateless หลุดแล้วใช้ได้ยาว 60 วัน)
  const jti = randomUUID();
  await prisma.refreshToken.create({
    data: { id: jti, memberId, expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000) },
  });
  const refreshToken = await new SignJWT({ typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(key);
  return { accessToken, refreshToken };
}

/** อ่าน refresh token แบบละเอียด — jti = null คือ token รุ่นเก่า (ก่อนมี rotation) */
export async function verifyRefreshDetailed(
  token: string
): Promise<{ memberId: string; jti: string | null } | null> {
  try {
    const key = await sessionKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    if (payload.typ !== "refresh" || !payload.sub) return null;
    return { memberId: payload.sub as string, jti: (payload.jti as string) || null };
  } catch {
    return null;
  }
}

export async function verifySession(token: string, typ: "access" | "refresh" = "access"): Promise<string | null> {
  try {
    const key = await sessionKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    if (payload.typ !== typ || !payload.sub) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
}

/** ยืนยัน token ตาม typ ที่อนุญาต → { memberId, typ, epoch } (refresh ไม่เคยอยู่ในรายการที่อนุญาต) */
async function verifyTypedToken(
  token: string,
  types: string[]
): Promise<{ memberId: string; typ: string; epoch: number | null } | null> {
  try {
    const key = await sessionKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    if (typeof payload.typ !== "string" || !types.includes(payload.typ) || !payload.sub) return null;
    return {
      memberId: payload.sub as string,
      typ: payload.typ,
      epoch: typeof payload.epoch === "number" ? payload.epoch : null,
    };
  } catch {
    return null;
  }
}

/** ดึง member จาก Bearer โดยจำกัดชนิดของ token ที่ยอมรับ */
async function memberFromBearer(req: NextRequest, types: string[]) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const parsed = await verifyTypedToken(h.slice(7), types);
  if (!parsed) return null;
  const member = await prisma.member.findUnique({
    where: { id: parsed.memberId },
    include: { memberType: true },
  });
  if (!member || member.isActive === false) return null;
  // watch token ไม่มีแถวใน DB (ต่างจาก refresh) → เพิกถอนด้วย epoch แทน
  // ไม่มี epoch ในกุญแจ = ใบที่ออกก่อนมีระบบนี้ → ถือว่าใช้ไม่ได้ ให้จับคู่กับแอปใหม่
  // (ไม่ใช้ query เพิ่ม — member ถูกโหลดอยู่แล้วบรรทัดบน)
  if (parsed.typ === "watch" && parsed.epoch !== member.sessionEpoch) return null;
  return member;
}

/** ดึง member จาก Authorization: Bearer <access|watch token> — null ถ้าไม่ผ่าน / บัญชีถูกปิด
 *  (ปิดบัญชีใน backoffice = ตัดทั้ง access และ watch token ทันที = kill switch ที่มีอยู่จริง) */
export async function getAuthedMember(req: NextRequest) {
  return memberFromBearer(req, APP_TYPES);
}

/** เฉพาะ access token แท้ ๆ เท่านั้น — ใช้กับ endpoint ที่ "ออกกุญแจใบใหม่"
 *  กัน watch token (30 วัน) เอาไปต่ออายุตัวเองวนไปเรื่อย ๆ */
export async function getAuthedMemberAccessOnly(req: NextRequest) {
  return memberFromBearer(req, ["access"]);
}

// ── provider verification ──
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** fail-closed: ต้องตั้ง client id เสมอ ไม่งั้น throw (กัน token จากแอปอื่นในโลกยิงเข้ามา) */
async function requiredAudiences(secretKey: string): Promise<string[]> {
  const raw = await getSecret(secretKey);
  const list = (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    throw new Error(`${secretKey} not configured — ตั้งค่าใน /backoffice/settings/api-keys ก่อนเปิดใช้ auth`);
  }
  return list;
}

export type VerifiedIdentity = { provider: "apple" | "google"; providerId: string; email?: string; emailVerified: boolean };

export async function verifyAppleToken(identityToken: string): Promise<VerifiedIdentity> {
  const aud = await requiredAudiences("APPLE_CLIENT_ID");
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: aud,
    algorithms: ["RS256"],
  });
  if (!payload.sub) throw new Error("apple token missing sub");
  // Apple ส่ง email_verified เป็น boolean หรือ "true"
  const ev = (payload as any).email_verified;
  return {
    provider: "apple",
    providerId: payload.sub,
    email: payload.email as string | undefined,
    emailVerified: ev === true || ev === "true",
  };
}

export async function verifyGoogleToken(idToken: string): Promise<VerifiedIdentity> {
  const aud = await requiredAudiences("GOOGLE_CLIENT_ID");
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: aud,
    algorithms: ["RS256"],
  });
  if (!payload.sub) throw new Error("google token missing sub");
  const ev = (payload as any).email_verified;
  return {
    provider: "google",
    providerId: payload.sub,
    email: payload.email as string | undefined,
    emailVerified: ev === true || ev === "true",
  };
}

/**
 * ผูก identity → member แล้วออก session
 * ปลอดภัย: ผูกด้วย (provider, providerId) ที่ provider ยืนยันเท่านั้น
 * ไม่ auto-link ด้วย email (กัน account takeover — Member.email ในระบบเราไม่เคย verify)
 * การรวมบัญชี LINE เดิมเข้ากับ Apple/Google = flow ยืนยันตัวตนแยกภายหลัง
 */
export async function loginWithIdentity(id: VerifiedIdentity, displayName?: string) {
  const find = () =>
    prisma.authIdentity.findUnique({
      where: { provider_providerId: { provider: id.provider, providerId: id.providerId } },
      include: { member: { include: { memberType: true } } },
    });

  let existing = await find();
  if (!existing) {
    try {
      const member = await prisma.member.create({
        data: {
          name: displayName || null,
          // เก็บ email ไว้อ้างอิงเท่านั้น (ไม่ใช้ match/ผูกบัญชี)
          email: id.emailVerified ? id.email || null : null,
          isOnboarded: false,
          activityStatus: "inactive",
        },
      });
      await prisma.authIdentity.create({
        data: { memberId: member.id, provider: id.provider, providerId: id.providerId, email: id.email || null },
      });
      existing = await find();
    } catch {
      // race: อีก request สร้าง identity นี้ไปแล้ว → อ่านซ้ำ
      existing = await find();
    }
  }
  if (!existing?.member) throw new Error("login failed");

  const member = existing.member;
  const tokens = await signSession(member.id);
  return { member, tokens, isNew: !member.isOnboarded };
}

export { decodeJwt };
