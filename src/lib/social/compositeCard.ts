import sharp from "sharp";
import { uploadBufferToBunny } from "../bunny";

export type ImageText = { line1: string; line2: string };

// Canvas: 1080×1350 portrait (Instagram-friendly, also fine on FB feed).
// Composition: subject in upper 2/3, text overlay in lower 1/3.
// The skill is responsible for asking the image-gen model to leave the lower
// third as clean negative space — this overlay is the safety net.
const CANVAS_W = 1080;
const CANVAS_H = 1350;
const TEXT_PANEL_TOP = 810;   // y where gradient overlay starts (60% down)
const LINE1_Y = 1015;
const LINE2_Y = 1115;
const WATERMARK_BOTTOM_MARGIN = 36;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// SVG overlay = gradient panel (transparent → black) + 2 lines of text + watermark.
// Rendered at canvas size and composited on top of the resized cover.
function overlaySvg(text: ImageText): Buffer {
  const line1 = escapeXml(text.line1 || "");
  const line2 = escapeXml(text.line2 || "");

  // Font stack uses generic families so the container's libfontconfig picks up
  // a Thai-capable font (DejaVu/FreeSans/Noto) without us pinning a path.
  const FONT = "'Noto Sans Thai','Sarabun','Prompt','Sukhumvit Set',DejaVu Sans,Arial,sans-serif";

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0"/>
      <stop offset="35%" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${TEXT_PANEL_TOP}" width="${CANVAS_W}" height="${CANVAS_H - TEXT_PANEL_TOP}" fill="url(#fade)"/>
  <text x="${CANVAS_W / 2}" y="${LINE1_Y}"
        text-anchor="middle"
        font-family="${FONT}"
        font-size="72"
        font-weight="900"
        fill="#4CAF50"
        stroke="#0a3d12"
        stroke-width="1.5"
        paint-order="stroke">${line1}</text>
  <text x="${CANVAS_W / 2}" y="${LINE2_Y}"
        text-anchor="middle"
        font-family="${FONT}"
        font-size="34"
        font-weight="500"
        fill="#FFFFFF"
        opacity="0.95">${line2}</text>
  <text x="${CANVAS_W - 36}" y="${CANVAS_H - WATERMARK_BOTTOM_MARGIN}"
        text-anchor="end"
        font-family="${FONT}"
        font-size="28"
        font-weight="800"
        opacity="0.85"
        letter-spacing="0.5"><tspan fill="#ffffff">Good</tspan><tspan fill="#10B981">Food</tspan></text>
</svg>`);
}

export interface CompositeOptions {
  baseImageBuffer: Buffer;
  imageText: ImageText;
}

/**
 * Take a base cover image, resize-cover to 1080×1350, then composite the
 * gradient + 2-line headline + GoodFood watermark on top. Returns the final
 * webp buffer ready to upload.
 */
export async function compositeSocialCard({
  baseImageBuffer,
  imageText,
}: CompositeOptions): Promise<Buffer> {
  // Anchor on top so face/food in the upper half stays visible; the lower
  // third becomes our text zone.
  const base = await sharp(baseImageBuffer)
    .resize(CANVAS_W, CANVAS_H, { fit: "cover", position: "top" })
    .toBuffer();

  const overlay = await sharp(overlaySvg(imageText)).png().toBuffer();

  const out = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 88 })
    .toBuffer();

  return out;
}

/**
 * End-to-end: load image from URL/base64 → composite → upload to local storage.
 * Returns the public URL (e.g. `/uploads/social/<id>.webp`).
 */
export async function buildAndUploadSocialCard(
  source: string,
  imageText: ImageText,
  fileNameBase: string,
): Promise<string> {
  const baseImageBuffer = await loadSource(source);
  const buf = await compositeSocialCard({ baseImageBuffer, imageText });
  return uploadBufferToBunny(buf, "social", `${fileNameBase}.webp`, "image/webp");
}

async function loadSource(input: string): Promise<Buffer> {
  if (input.startsWith("data:image/")) {
    return Buffer.from(input.replace(/^data:image\/\w+;base64,/, ""), "base64");
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (input.startsWith("/uploads/")) {
    const fs = await import("fs/promises");
    const path = await import("path");
    const root = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    const rel = input.replace(/^\/uploads\//, "");
    return fs.readFile(path.join(root, rel));
  }
  throw new Error("Unsupported image source");
}
