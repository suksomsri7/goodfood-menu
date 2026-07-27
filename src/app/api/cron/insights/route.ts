import { NextRequest, NextResponse } from "next/server";
import { runInsights } from "@/lib/insightEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-cron-secret");
  if (header && header === expected) return true;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return !!q && q === expected;
}

// GET /api/cron/insights — รันวันละครั้ง (เช้า) สรุป trend + สกัด memory
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runInsights();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("insights cron error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
