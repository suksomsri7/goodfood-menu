import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { VIDEO_FEED_SELECT, pickDailyVideos, toVideoItem } from "@/lib/videoFeed";

export const dynamic = "force-dynamic";

/**
 * คลิปสั้นสุขภาพ (ช่อง YouTube ของ GoodFood) ในแอป Coach
 *
 * GET /api/coach/videos?limit=20
 *   → { items } คลิปที่ยังเผยแพร่อยู่ เรียงใหม่→เก่า
 *
 * GET /api/coach/videos?daily=1&limit=2   ("คลิปสำหรับคุณวันนี้")
 *   → { items, daily:true, dayKey } คัดรายคน: ที่ตรงกับพฤติกรรม (BehaviorInsight) มาก่อน
 *     แล้วเติมด้วยคลิปทั่วไป · หมุนเวียนทุกเที่ยงคืนไทยแบบ deterministic
 *     (เรียกซ้ำวันเดียวกัน = ชุดเดิมเป๊ะ) · ไม่เรียก AI · ไม่ยิง YouTube (อ่านจาก DB ที่ cron เติม)
 *
 * ทุก item: url = https://www.youtube.com/watch?v=<videoId>
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const raw = Number(sp.get("limit"));
  const take = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 50) : 20;

  if (sp.get("daily") !== "1") {
    const rows = await prisma.coachVideo.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: "desc" },
      take,
      select: VIDEO_FEED_SELECT,
    });
    const res = NextResponse.json({ items: rows.map(toVideoItem) });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  }

  // _day = ช่องทดสอบการหมุนเวียนรายวัน — ต้องมี X-Cron-Secret เท่านั้น (ผู้ใช้ทั่วไปสั่งไม่ได้)
  const cronSecret = process.env.ARTICLE_CRON_SECRET;
  const isAdmin = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  const dayOverride = isAdmin ? sp.get("_day") || undefined : undefined;

  const { items, dayKey } = await pickDailyVideos(member, take, new Date(), dayOverride);
  const res = NextResponse.json({ items, daily: true, dayKey });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
