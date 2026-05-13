import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isArticleWriteAuthorized } from "@/lib/articleAuth";
import { MODELS, DEFAULT_ASPECT, getModel, generateImage } from "@/lib/imageGen/models";
import { buildFoodPrompt } from "@/lib/imageGen/foodPrompt";

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
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <text x="${w / 2}" y="${padY + fontSize * 0.82}"
        text-anchor="middle"
        font-family="DejaVu Sans, FreeSans, sans-serif"
        font-size="${fontSize}" font-weight="700" fill="#ffffff" opacity="0.85"
        filter="url(#s)" letter-spacing="0.5">${text}</text>
</svg>`;
  return Buffer.from(svg);
}

async function stampWatermark(jpegBuf: Buffer): Promise<Buffer> {
  const meta = await sharp(jpegBuf).metadata();
  const canvasW = meta.width ?? 1200;
  return sharp(jpegBuf)
    .composite([{ input: watermarkSvg(canvasW), gravity: "southeast" }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — return full model list for the dropdown UI (grouped by provider).
export async function GET(req: NextRequest) {
  if (!isArticleWriteAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    models: MODELS.map((m) => ({ id: m.id, label: m.label, blurb: m.blurb, price: m.price, group: m.group })),
    defaultModel: MODELS[0].id,
  });
}

// POST — body:
//   { title, excerpt?, focusKeyword?, categorySlug?, prompt? (override),
//     model?, aspectRatio?, previewOnly? }
// previewOnly=true returns just the resolved prompt without spending fal credits.
// Otherwise returns { dataUrl (base64 jpeg), prompt, model }.
export async function POST(req: NextRequest) {
  if (!isArticleWriteAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const excerpt = typeof body.excerpt === "string" ? body.excerpt : null;
  const focusKeyword = typeof body.focusKeyword === "string" ? body.focusKeyword : null;
  const categorySlug = typeof body.categorySlug === "string" ? body.categorySlug : null;

  const promptOverride = typeof body.prompt === "string" && body.prompt.trim().length > 30
    ? body.prompt.trim()
    : null;
  const prompt = promptOverride ?? buildFoodPrompt({ title, excerpt, focusKeyword, categorySlug });

  const aspectRatio = DEFAULT_ASPECT; // fixed 3:2 for article covers

  const model = getModel(typeof body.model === "string" ? body.model : undefined);

  if (body.previewOnly === true) {
    return NextResponse.json({ prompt, model: model.id, aspectRatio });
  }

  try {
    const imageUrl = await generateImage(model, prompt, aspectRatio);
    const fetched = await fetch(imageUrl);
    if (!fetched.ok) {
      return NextResponse.json({ error: `download failed: ${fetched.status}` }, { status: 502 });
    }
    const rawBuf = Buffer.from(await fetched.arrayBuffer());
    const stamped = await stampWatermark(rawBuf);
    const dataUrl = `data:image/jpeg;base64,${stamped.toString("base64")}`;

    return NextResponse.json({
      dataUrl,
      prompt,
      model: model.id,
      aspectRatio,
      modelLabel: model.label,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
