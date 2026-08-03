import { NextRequest, NextResponse } from "next/server";
import { runArticlePush } from "@/lib/articlePush";

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

// GET /api/cron/article-push — ยิงวันละครั้ง 19:30 น. ไทย (crontab = 12:30 UTC)
// ?force=1 ข้ามเช็คเวลาเงียบ (ใช้ตอนทดสอบเท่านั้น)
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const result = await runArticlePush(new Date(), { force });
    return NextResponse.json(result);
  } catch (e) {
    console.error("article-push cron error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
