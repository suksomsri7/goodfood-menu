import { NextRequest, NextResponse } from "next/server";
import { isArticleWriteAuthorized } from "@/lib/articleAuth";
import { MODELS, VALID_ASPECTS, getModel, generateImage, type AspectRatio } from "@/lib/imageGen/models";
import { buildFoodPrompt } from "@/lib/imageGen/foodPrompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — return curated model list for the picker UI.
export async function GET(req: NextRequest) {
  if (!isArticleWriteAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    models: MODELS.map((m) => ({ id: m.id, label: m.label, blurb: m.blurb, price: m.price })),
    aspects: ["16:9", "3:2", "1:1", "4:5"],
    defaultModel: MODELS[0].id,
    defaultAspect: "3:2",
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

  const aspectRatio: AspectRatio = VALID_ASPECTS.has(body.aspectRatio as AspectRatio)
    ? (body.aspectRatio as AspectRatio)
    : "3:2";

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
    const buf = Buffer.from(await fetched.arrayBuffer());
    const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;

    return NextResponse.json({
      dataUrl,
      prompt,
      model: model.id,
      aspectRatio,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
