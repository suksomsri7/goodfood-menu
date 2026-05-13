// Client-safe image helpers (no Node fs/promises).
// Server code uses bunny.ts for the actual writes; these helpers just inspect strings.

export function isBase64Image(str: string): boolean {
  if (!str) return false;
  return str.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(str);
}

export function isLocalUploadUrl(str: string): boolean {
  if (!str) return false;
  return str.startsWith("/uploads") || str.startsWith("https://") || str.startsWith("http://");
}
