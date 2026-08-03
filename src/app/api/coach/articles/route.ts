import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { ARTICLE_FEED_SELECT, toFeedItem } from "@/lib/articleFeed";

export const dynamic = "force-dynamic";

/**
 * บทความสุขภาพในแอป Coach
 * GET /api/coach/articles?limit=20 → { items: [{ id, title, excerpt, imageUrl, url, category, publishedAt }] }
 * เฉพาะที่เผยแพร่แล้ว เรียงใหม่→เก่า · url = หน้าเว็บจริง + ?utm_source=coach_app (แอปเปิดใน webview)
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const take = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 50) : 20;

  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED", publishedAt: { not: null, lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take,
    select: ARTICLE_FEED_SELECT,
  });

  const res = NextResponse.json({ items: rows.map(toFeedItem) });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
