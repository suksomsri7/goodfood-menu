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
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER });
    if (payload.typ !== typ || !payload.sub) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
}

/** ดึง member จาก Authorization: Bearer <accessToken> — null ถ้าไม่ผ่าน */
export async function getAuthedMember(req: NextRequest) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const memberId = await verifySession(h.slice(7), "access");
  if (!memberId) return null;
  return prisma.member.findUnique({ where: { id: memberId }, include: { memberType: true } });
}

// ── provider verification ──
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

async function allowedAudiences(secretKey: string): Promise<string[] | null> {
  const raw = await getSecret(secretKey);
  if (!raw) return null; // ไม่ตั้งค่า = ข้าม audience check (ต้องตั้งก่อน production)
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export type VerifiedIdentity = { provider: "apple" | "google"; providerId: string; email?: string };

export async function verifyAppleToken(identityToken: string): Promise<VerifiedIdentity> {
  const aud = await allowedAudiences("APPLE_CLIENT_ID");
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    ...(aud ? { audience: aud } : {}),
  });
  if (!payload.sub) throw new Error("apple token missing sub");
  return { provider: "apple", providerId: payload.sub, email: payload.email as string | undefined };
}

export async function verifyGoogleToken(idToken: string): Promise<VerifiedIdentity> {
  const aud = await allowedAudiences("GOOGLE_CLIENT_ID");
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    ...(aud ? { audience: aud } : {}),
  });
  if (!payload.sub) throw new Error("google token missing sub");
  return { provider: "google", providerId: payload.sub, email: payload.email as string | undefined };
}

/** ผูก identity → member (สร้างใหม่ถ้ายังไม่มี) แล้วออก session */
export async function loginWithIdentity(id: VerifiedIdentity, displayName?: string) {
  const existing = await prisma.authIdentity.findUnique({
    where: { provider_providerId: { provider: id.provider, providerId: id.providerId } },
    include: { member: true },
  });

  let member = existing?.member;
  if (!member) {
    // ผูกกับ member เดิมที่ email ตรง (ถ้ามีและยังไม่มี identity provider นี้) มิฉะนั้นสร้างใหม่
    const byEmail = id.email
      ? await prisma.member.findFirst({ where: { email: id.email } })
      : null;
    member =
      byEmail ||
      (await prisma.member.create({
        data: {
          name: displayName || null,
          email: id.email || null,
          isOnboarded: false,
          activityStatus: "inactive",
        },
      }));
    await prisma.authIdentity.create({
      data: { memberId: member.id, provider: id.provider, providerId: id.providerId, email: id.email || null },
    });
  }

  const tokens = await signSession(member.id);
  return { member, tokens, isNew: !member.isOnboarded };
}

export { decodeJwt };
