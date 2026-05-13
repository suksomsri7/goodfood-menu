// Local VPS-disk image storage (replaces Bunny CDN).
//
// Files are written to /app/public/uploads inside the container, which Docker
// Compose maps to a host volume so uploads survive rebuilds. Next.js serves
// `public/` automatically at the root, so a file saved to
// `public/uploads/articles/foo.webp` is fetchable at `/uploads/articles/foo.webp`.
//
// Callers stay on the original Bunny-style API (uploadToBunny / uploadBufferToBunny /
// deleteFromBunny / isBunnyCdnUrl) so the surrounding code didn't need to change.

import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

const UPLOAD_ROOT = process.env.UPLOAD_DIR || join(process.cwd(), "public", "uploads");
const PUBLIC_PREFIX = "/uploads";

function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
  return `${timestamp}-${random}.${ext}`;
}

function safeFolder(folder: string): string {
  return folder.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "misc";
}

async function ensureDir(absDir: string): Promise<void> {
  await mkdir(absDir, { recursive: true });
}

export function extractFileNameFromUrl(url: string): string | null {
  if (!url) return null;
  if (!url.includes(PUBLIC_PREFIX)) return null;
  const parts = url.split("/");
  return parts[parts.length - 1];
}

async function writeBufferToUploads(buf: Buffer, folder: string, filename: string): Promise<string> {
  const cleanFolder = safeFolder(folder);
  const dir = join(UPLOAD_ROOT, cleanFolder);
  await ensureDir(dir);
  await writeFile(join(dir, filename), buf);
  return `${PUBLIC_PREFIX}/${cleanFolder}/${filename}`;
}

export async function uploadToBunny(
  base64Image: string,
  folder: string = "foods",
  originalFileName: string = "image.jpg",
): Promise<string> {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const fileName = generateFileName(originalFileName);
  return writeBufferToUploads(buffer, folder, fileName);
}

export async function uploadBufferToBunny(
  buffer: Buffer,
  folder: string,
  fileName: string,
  _contentType: string = "application/octet-stream",
): Promise<string> {
  return writeBufferToUploads(buffer, folder, fileName);
}

export async function deleteFromBunny(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl || !imageUrl.startsWith(PUBLIC_PREFIX)) return false;
    const relativePath = imageUrl.replace(PUBLIC_PREFIX, "").replace(/^\/+/, "");
    const absPath = join(UPLOAD_ROOT, relativePath);
    await unlink(absPath).catch(() => undefined);
    return true;
  } catch (error) {
    console.error("Error deleting upload:", error);
    return false;
  }
}

export async function uploadMultipleToBunny(
  base64Images: string[],
  folder: string = "foods",
): Promise<string[]> {
  return Promise.all(base64Images.map((img, i) => uploadToBunny(img, folder, `image-${i}.jpg`)));
}

export async function deleteMultipleFromBunny(imageUrls: string[]): Promise<void> {
  await Promise.all(imageUrls.map((u) => deleteFromBunny(u)));
}

export function isBase64Image(str: string): boolean {
  return str.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(str);
}

export function isBunnyCdnUrl(str: string): boolean {
  return (
    str.startsWith(PUBLIC_PREFIX) ||
    str.startsWith("https://") ||
    str.startsWith("http://")
  );
}
