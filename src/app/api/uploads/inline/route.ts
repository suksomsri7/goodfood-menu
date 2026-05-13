import { NextRequest, NextResponse } from "next/server";
import { isArticleWriteAuthorized } from "@/lib/articleAuth";
import { uploadToBunny } from "@/lib/bunny";

export const dynamic = "force-dynamic";

// POST { dataUrl: string, folder?: string }  → { url }
// Used by the rich-text editor to upload inline content images.
export async function POST(req: NextRequest) {
  if (!isArticleWriteAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { dataUrl?: string; folder?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.dataUrl || !body.dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
  }
  try {
    const url = await uploadToBunny(body.dataUrl, body.folder || "articles/content", "inline.jpg");
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
