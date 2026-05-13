import { prisma } from "@/lib/prisma";
import { encryptValue, decryptValue, maskValue } from "./crypto";
import { SECRET_KEY_REGISTRY, isManagedKey, findKeyMeta } from "./keys";

type CacheEntry = { value: string; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

function envFallback(key: string): string | null {
  const v = process.env[key];
  return v && v.length > 0 ? v : null;
}

export async function getSecret(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const row = await prisma.secretSetting.findUnique({ where: { key } });
    if (row) {
      const plain = decryptValue(row.valueEnc);
      cache.set(key, { value: plain, expires: Date.now() + TTL_MS });
      return plain;
    }
  } catch {
    // table missing during initial migration — fall through to env
  }

  const env = envFallback(key);
  if (env) {
    cache.set(key, { value: env, expires: Date.now() + TTL_MS });
    return env;
  }
  return null;
}

export async function setSecret(
  key: string,
  value: string,
  updatedBy?: string,
): Promise<void> {
  if (!isManagedKey(key)) throw new Error(`unknown key: ${key}`);
  if (!value || value.length === 0) throw new Error("value is empty");
  const valueEnc = encryptValue(value);
  await prisma.secretSetting.upsert({
    where: { key },
    create: { key, valueEnc, updatedBy: updatedBy ?? null },
    update: { valueEnc, updatedBy: updatedBy ?? null },
  });
  cache.delete(key);
}

export async function deleteSecret(key: string): Promise<void> {
  await prisma.secretSetting.deleteMany({ where: { key } });
  cache.delete(key);
}

export type SecretListItem = {
  key: string;
  label: string;
  description: string;
  group: string;
  href?: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  masked: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function listSecrets(): Promise<SecretListItem[]> {
  let rows: Array<{
    key: string;
    valueEnc: string;
    updatedAt: Date;
    updatedBy: string | null;
  }> = [];
  try {
    rows = await prisma.secretSetting.findMany();
  } catch {
    rows = [];
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return SECRET_KEY_REGISTRY.map((meta) => {
    const dbRow = byKey.get(meta.key);
    if (dbRow) {
      let masked = "****";
      try {
        masked = maskValue(decryptValue(dbRow.valueEnc));
      } catch {
        masked = "(decrypt failed)";
      }
      return {
        key: meta.key,
        label: meta.label,
        description: meta.description,
        group: meta.group,
        href: meta.href,
        hasValue: true,
        source: "db" as const,
        masked,
        updatedAt: dbRow.updatedAt.toISOString(),
        updatedBy: dbRow.updatedBy,
      };
    }
    const envVal = envFallback(meta.key);
    return {
      key: meta.key,
      label: meta.label,
      description: meta.description,
      group: meta.group,
      href: meta.href,
      hasValue: !!envVal,
      source: envVal ? ("env" as const) : ("none" as const),
      masked: envVal ? maskValue(envVal) : "",
      updatedAt: null,
      updatedBy: null,
    };
  });
}

export { findKeyMeta };
