import { NextRequest, NextResponse } from "next/server";
import { dispatchPendingArticles } from "@/lib/social/dispatch";

export const dynamic = "force-dynamic";

function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-cron-secret");
  if (header && header === expected) return true;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) return true;
  const queryToken = new URL(req.url).searchParams.get("secret");
  if (queryToken && queryToken === expected) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const limitParam = new URL(req.url).searchParams.get("limit");
    const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam))) : 5;
    const summary = await dispatchPendingArticles(limit);
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "dispatch failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
