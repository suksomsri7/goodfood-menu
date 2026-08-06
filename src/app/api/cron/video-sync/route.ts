import { NextRequest, NextResponse } from "next/server";
import { syncCoachVideos } from "@/lib/youtubeSync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-cron-secret");
  if (header && header === expected) return true;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) return true;
  const queryToken = new URL(req.url).searchParams.get("secret");
  return !!queryToken && queryToken === expected;
}

// GET /api/cron/video-sync — ยิงวันละครั้ง 05:10 น. ไทย (crontab = 22:10 UTC)
// ดึงคลิปจากช่อง YouTube ของ GoodFood → upsert ลง coach_videos ให้ /api/coach/videos อ่าน
// 🔴 วันละครั้งพอ (ช่องลงคลิปสัปดาห์ละ 1 คลิป) — ห้ามยิงต่อ request ของผู้ใช้
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncCoachVideos();
    return NextResponse.json(result);
  } catch (e) {
    console.error("video-sync cron error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
