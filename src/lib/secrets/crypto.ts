import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function masterKey(): Buffer {
  const hex = process.env.SECRETS_MASTER_KEY;
  if (!hex) throw new Error("SECRETS_MASTER_KEY is not set");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("SECRETS_MASTER_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encryptValue(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptValue(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("malformed encrypted value");
  const [ivHex, cipherHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}
