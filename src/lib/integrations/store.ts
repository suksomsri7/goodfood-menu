/**
 * เก็บ/ต่ออายุ token ของบริการสุขภาพภายนอก
 *
 * 🔴 token เข้ารหัสก่อนลง DB เสมอ (ตัวเดียวกับ secret_settings) — access token ของ Fitbit
 *    เปิดอ่านข้อมูลสุขภาพย้อนหลังได้ทั้งบัญชี ถ้า DB หลุดแล้วเป็น plaintext = หลุดทั้งชีวิตคนไข้
 * 🔴 ต่ออายุก่อนหมดจริง 5 นาที — ไม่งั้น request ที่ยิงพอดีตอนหมดอายุจะ 401 แล้ว cron ทิ้งทั้งรอบ
 */
import { prisma } from "@/lib/prisma";
import { encryptValue, decryptValue } from "@/lib/secrets/crypto";
import { PROVIDER_META, callbackUrl, creds, type Provider } from "./providers";

const EARLY_MS = 5 * 60 * 1000;

export type TokenSet = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scope?: string | null;
  externalId: string;
};

export async function saveConnection(memberId: string, provider: Provider, t: TokenSet) {
  const data = {
    externalId: t.externalId,
    tokenEnc: encryptValue(t.accessToken),
    refreshEnc: t.refreshToken ? encryptValue(t.refreshToken) : null,
    expiresAt: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000) : null,
    scope: t.scope ?? null,
    lastError: null,
  };
  await prisma.healthConnection.upsert({
    where: { memberId_provider: { memberId, provider } },
    update: data,
    create: { memberId, provider, ...data },
  });
}

/** แลก refresh token เป็นใบใหม่ — คืน null ถ้าผู้ให้บริการปฏิเสธ (user เพิกถอนสิทธิ์) */
async function refresh(memberId: string, provider: Provider, refreshToken: string): Promise<string | null> {
  const meta = PROVIDER_META[provider];
  const c = await creds(provider);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  if (meta.basicAuth) {
    headers.Authorization = "Basic " + Buffer.from(`${c.id}:${c.secret}`).toString("base64");
  } else {
    body.set("client_id", c.id);
    body.set("client_secret", c.secret);
  }

  const res = await fetch(meta.tokenUrl, { method: "POST", headers, body });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !j?.access_token) {
    await prisma.healthConnection.update({
      where: { memberId_provider: { memberId, provider } },
      // เขียนเหตุผลไว้ให้คนดูแลเห็น — ของเดิมทั้งระบบล้มเงียบแบบนี้มาแล้วเรื่อง push
      data: { lastError: `ต่ออายุ token ไม่ได้ (${res.status}) — ผู้ใช้อาจเพิกถอนสิทธิ์แล้ว` },
    });
    return null;
  }

  await saveConnection(memberId, provider, {
    accessToken: String(j.access_token),
    refreshToken: (j.refresh_token as string) ?? refreshToken,
    expiresIn: typeof j.expires_in === "number" ? j.expires_in : null,
    scope: (j.scope as string) ?? null,
    externalId:
      (j.user_id as string) ??
      ((j.athlete as { id?: number } | undefined)?.id?.toString() ?? ""),
  });
  return String(j.access_token);
}

/** access token ที่ใช้ได้ตอนนี้ (ต่ออายุให้เองถ้าใกล้หมด) — null = ต่อไม่ได้แล้ว */
export async function accessTokenFor(memberId: string, provider: Provider): Promise<string | null> {
  const row = await prisma.healthConnection.findUnique({
    where: { memberId_provider: { memberId, provider } },
  });
  if (!row) return null;

  const stillGood = !row.expiresAt || row.expiresAt.getTime() - EARLY_MS > Date.now();
  if (stillGood) {
    try {
      return decryptValue(row.tokenEnc);
    } catch {
      return null; // ถอดไม่ออก (เปลี่ยน master key) = ให้ผู้ใช้เชื่อมใหม่ ดีกว่าพังเงียบ
    }
  }
  if (!row.refreshEnc) return null;
  try {
    return await refresh(memberId, provider, decryptValue(row.refreshEnc));
  } catch {
    return null;
  }
}

export async function disconnect(memberId: string, provider: Provider) {
  await prisma.healthConnection.deleteMany({ where: { memberId, provider } });
}

/** ปิดรอบซิงก์ — จดเวลาไว้ให้รอบหน้าดึงต่อจากตรงนี้ */
export async function markSynced(memberId: string, provider: Provider, error?: string) {
  await prisma.healthConnection.updateMany({
    where: { memberId, provider },
    data: { lastSyncAt: new Date(), lastError: error ?? null },
  });
}
