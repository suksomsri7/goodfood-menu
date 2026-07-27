/**
 * Coach native app — auth (Apple / Google) + JWT session
 * ใช้ jose ตรวจ identity token ผ่าน JWKS ของ provider แล้วออก session JWT ของเราเอง
 * เก็บ mapping provider→member ใน AuthIdentity (schema.prisma)
 */
import { NextRequest } from "next/server";
import { SignJWT, jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/secrets/store";

const ACCESS_TTL = "1h";
const REFRESH_TTL = "60d";
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

export type SessionClaims = { sub: string; typ: "access" | "refresh" };

export async function signSession(memberId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const key = await sessionKey();
  const accessToken = await new SignJWT({ typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(key);
  const refreshToken = await new SignJWT({ typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(key);
  return { accessToken, refreshToken };
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

/** ดึง member จาก Authorization: Bearer <accessToken> — null ถ้าไม่ผ่าน / บัญชีถูกปิด */
export async function getAuthedMember(req: NextRequest) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const memberId = await verifySession(h.slice(7), "access");
  if (!memberId) return null;
  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { memberType: true } });
  if (!member || member.isActive === false) return null;
  return member;
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
