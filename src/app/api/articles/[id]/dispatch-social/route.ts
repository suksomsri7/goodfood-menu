import { NextRequest, NextResponse } from "next/server";
import { dispatchArticleSocial } from "@/lib/social/dispatch";
import { isArticleWriteAuthorized } from "@/lib/articleAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isArticleWriteAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await dispatchArticleSocial(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
