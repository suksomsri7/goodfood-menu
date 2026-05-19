import sharp from "sharp";
import { uploadBufferToBunny } from "../bunny";

export type ImageText = { line1: string; line2: string };

// Canvas: 1080×1350 portrait (Instagram-friendly, also fine on FB feed).
// Composition: National Geographic editorial — subject fills upper 2/3, headline
// lower-left aligned with a yellow accent bar (Nat Geo signature mark). Drop shadow
// on text instead of a heavy dark panel — keeps the photo dominant.
const CANVAS_W = 1080;
const CANVAS_H = 1350;
const TEXT_LEFT = 72;                   // Left-align headline (Nat Geo editorial layout)
const ACCENT_BAR_Y = 980;               // Yellow accent bar Y position
const ACCENT_BAR_W = 64;                // Width of yellow accent bar
const ACCENT_BAR_H = 8;                 // Thickness of yellow accent bar
const LINE1_Y = 1080;                   // Headline baseline
const LINE2_Y = 1175;                   // Subheadline baseline
const WATERMARK_BOTTOM_MARGIN = 48;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Nat Geo-style overlay:
//   - Yellow accent bar (#FFCC00) — signature National Geographic mark
//   - Bold Prompt headline left-aligned (no center, no stroke, no panel)
//   - Subtle drop shadow on text so it reads on any background
//   - Light gradient at the very bottom 1/4 — just enough to anchor text, not a wall
function overlaySvg(text: ImageText): Buffer {
  const line1 = escapeXml(text.line1 || "");
  const line2 = escapeXml(text.line2 || "");

  // Prompt is installed in /usr/share/fonts/prompt/ (see Dockerfile). libfontconfig
  // resolves "Prompt" to the bundled .ttf. Sarabun/Noto Thai listed as fallback
  // in case the font cache is cold during local dev.
  const FONT = "'Prompt','Noto Sans Thai','Sarabun',DejaVu Sans,sans-serif";

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <defs>
    <linearGradient id="anchor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.65"/>
    </linearGradient>
    <filter id="softshadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect x="0" y="900" width="${CANVAS_W}" height="${CANVAS_H - 900}" fill="url(#anchor)"/>

  <rect x="${TEXT_LEFT}" y="${ACCENT_BAR_Y}" width="${ACCENT_BAR_W}" height="${ACCENT_BAR_H}" fill="#FFCC00"/>

  <text x="${TEXT_LEFT}" y="${LINE1_Y}"
        text-anchor="start"
        font-family="${FONT}"
        font-size="76"
        font-weight="900"
        fill="#FFFFFF"
        filter="url(#softshadow)">${line1}</text>

  <text x="${TEXT_LEFT}" y="${LINE2_Y}"
        text-anchor="start"
        font-family="${FONT}"
        font-size="30"
        font-weight="400"
        fill="#FFFFFF"
        opacity="0.92"
        filter="url(#softshadow)">${line2}</text>

  <text x="${CANVAS_W - 48}" y="${CANVAS_H - WATERMARK_BOTTOM_MARGIN}"
        text-anchor="end"
        font-family="${FONT}"
        font-size="26"
        font-weight="700"
        opacity="0.82"
        letter-spacing="0.6"
        filter="url(#softshadow)"><tspan fill="#ffffff">Good</tspan><tspan fill="#FFCC00">Food</tspan></text>
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
