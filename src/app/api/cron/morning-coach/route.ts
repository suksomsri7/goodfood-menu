import { NextRequest, NextResponse } from "next/server";
import { runMorningCoach } from "@/lib/morningCoach";

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
  if (queryToken && queryToken === expected) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1"; // เทสด้วยมือ: ข้ามเช็คเวลา
    const onlyMemberId = url.searchParams.get("memberId") || undefined;
    const result = await runMorningCoach({ force, onlyMemberId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("morning-coach cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
