import sharp from "sharp";
import { uploadBufferToBunny } from "./bunny";

export interface ArticleImageVariants {
  coverImage: string;
  ogImage: string;
}

function baseFileName(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function decodeBase64(input: string): Buffer {
  const stripped = input.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(stripped, "base64");
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function loadSource(input: string): Promise<Buffer> {
  if (input.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(input.slice(0, 32))) {
    return decodeBase64(input);
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return fetchAsBuffer(input);
  }
  throw new Error("Unsupported image source");
}

export async function generateArticleImages(
  source: string,
  folder: string = "articles"
): Promise<ArticleImageVariants> {
  const srcBuffer = await loadSource(source);
  const name = baseFileName();

  const coverBuffer = await sharp(srcBuffer)
    .resize(1200, 800, { fit: "cover", position: "attention" })
    .webp({ quality: 85 })
    .toBuffer();

  const ogBuffer = await sharp(srcBuffer)
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const [coverImage, ogImage] = await Promise.all([
    uploadBufferToBunny(coverBuffer, folder, `${name}-cover.webp`, "image/webp"),
    uploadBufferToBunny(ogBuffer, folder, `${name}-og.jpg`, "image/jpeg"),
  ]);

  return { coverImage, ogImage };
}
