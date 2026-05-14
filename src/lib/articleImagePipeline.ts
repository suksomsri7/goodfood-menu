import sharp from "sharp";
import { uploadBufferToBunny } from "./bunny";

export interface ArticleImageVariants {
  coverImage: string;
  ogImage: string;
}

export interface ImagePipelineOptions {
  watermark?: boolean;
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
  if (input.startsWith("data:image/")) return decodeBase64(input);
  if (input.startsWith("http://") || input.startsWith("https://")) return fetchAsBuffer(input);
  // raw base64 without data: prefix
  if (/^[A-Za-z0-9+/=]+$/.test(input.slice(0, 32))) return decodeBase64(input);
  throw new Error("Unsupported image source");
}

// "GoodFood" SVG watermark — anchored bottom-right with subtle drop shadow.
// Sized proportionally to the canvas (we scale at composite time).
function watermarkSvg(canvasWidth: number): Buffer {
  const fontSize = Math.max(18, Math.round(canvasWidth * 0.035));
  const padX = Math.round(fontSize * 0.6);
  const padY = Math.round(fontSize * 0.4);
  const text = "GoodFood";
  const approxTextW = Math.round(fontSize * text.length * 0.55);
  const w = approxTextW + padX * 2;
  const h = fontSize + padY * 2;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w / 2}" y="${padY + fontSize * 0.82}"
        text-anchor="middle"
        font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        opacity="0.8"
        letter-spacing="0.5"><tspan fill="#ffffff">Good</tspan><tspan fill="#E53935">Food</tspan></text>
</svg>`;
  return Buffer.from(svg);
}

async function applyWatermark(srcBuf: Buffer): Promise<Buffer> {
  const meta = await sharp(srcBuf).metadata();
  const W = meta.width ?? 1200;
  const H = meta.height ?? 800;
  const rasterWm = await sharp(watermarkSvg(W)).png().toBuffer();
  const wmMeta = await sharp(rasterWm).metadata();
  const ww = wmMeta.width ?? 0;
  const wh = wmMeta.height ?? 0;
  const margin = Math.max(16, Math.round(W * 0.025));
  return sharp(srcBuf)
    .composite([{ input: rasterWm, top: Math.max(0, H - wh - margin), left: Math.max(0, W - ww - margin) }])
    .toBuffer();
}

export async function generateArticleImages(
  source: string,
  folder: string = "articles",
  opts: ImagePipelineOptions = {},
): Promise<ArticleImageVariants> {
  const srcBuffer = await loadSource(source);
  const name = baseFileName();

  let coverIntermediate = await sharp(srcBuffer)
    .resize(1200, 800, { fit: "cover", position: "attention" })
    .toBuffer();
  let ogIntermediate = await sharp(srcBuffer)
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .toBuffer();

  // Default to watermark=true for goodfood. The resize step above wipes any
  // pre-stamped watermark via attention-crop, so we always re-stamp here on
  // the final dimensions so the badge sits at the exact corner of the saved
  // image regardless of what the caller did upstream.
  const watermark = opts.watermark !== false;
  if (watermark) {
    coverIntermediate = await applyWatermark(coverIntermediate);
    ogIntermediate = await applyWatermark(ogIntermediate);
  }

  const coverBuffer = await sharp(coverIntermediate).webp({ quality: 85 }).toBuffer();
  const ogBuffer = await sharp(ogIntermediate).jpeg({ quality: 88, mozjpeg: true }).toBuffer();

  const [coverImage, ogImage] = await Promise.all([
    uploadBufferToBunny(coverBuffer, folder, `${name}-cover.webp`, "image/webp"),
    uploadBufferToBunny(ogBuffer, folder, `${name}-og.jpg`, "image/jpeg"),
  ]);

  return { coverImage, ogImage };
}
