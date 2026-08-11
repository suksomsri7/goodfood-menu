import { NextRequest, NextResponse } from "next/server";
import { runNudges } from "@/lib/nudgeEngine";

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

// GET /api/cron/nudges — ยิงทุก ~30-60 นาที ช่วงตื่น (crontab)
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // ?at=HH = จำลองชั่วโมงไทย (ทดสอบเท่านั้น — ทั้ง route ต้องมี X-Cron-Secret อยู่แล้ว)
    const atRaw = new URL(req.url).searchParams.get("at");
    const at = atRaw != null ? Number(atRaw) : NaN;
    let now = new Date();
    if (Number.isInteger(at) && at >= 0 && at <= 23) {
      const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
      bkk.setUTCHours(at, 0, 0, 0);
      now = new Date(bkk.getTime() - 7 * 3600 * 1000);
    }
    const result = await runNudges(now);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("nudges cron error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
