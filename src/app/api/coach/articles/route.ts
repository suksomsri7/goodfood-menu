import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { ARTICLE_FEED_SELECT, pickDailyArticles, toFeedItem } from "@/lib/articleFeed";

export const dynamic = "force-dynamic";

/**
 * บทความสุขภาพในแอป Coach
 *
 * GET /api/coach/articles?limit=20
 *   → { items } บทความที่เผยแพร่แล้ว เรียงใหม่→เก่า (พฤติกรรมเดิม ไม่เปลี่ยน)
 *
 * GET /api/coach/articles?daily=1&limit=3   ("บทความสำหรับคุณวันนี้")
 *   → { items, daily:true, dayKey } คัดรายคน: ที่ตรงกับพฤติกรรม (BehaviorInsight) มาก่อน
 *     แล้วเติมด้วยบทความสุขภาพทั่วไป · หมุนเวียนทุกเที่ยงคืนไทยแบบ deterministic
 *     (เรียกซ้ำวันเดียวกัน = ชุดเดิมเป๊ะ) · ไม่เรียก AI
 *
 * ทุก item: url = หน้าเว็บจริง + ?utm_source=coach_app · imageUrl = URL เต็มเสมอ
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const raw = Number(sp.get("limit"));
  const take = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 50) : 20;

  if (sp.get("daily") !== "1") {
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

  // _day = ช่องทดสอบการหมุนเวียนรายวัน — ต้องมี X-Cron-Secret เท่านั้น (ผู้ใช้ทั่วไปสั่งไม่ได้)
  const cronSecret = process.env.ARTICLE_CRON_SECRET;
  const isAdmin = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  const dayOverride = isAdmin ? sp.get("_day") || undefined : undefined;

  const { items, dayKey } = await pickDailyArticles(member, take, new Date(), dayOverride);
  const res = NextResponse.json({ items, daily: true, dayKey });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
