import { NextRequest, NextResponse } from "next/server";
import { runPtAlerts } from "@/lib/ptAlerts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-cron-secret");
  if (header && header === expected) return true;
  if (req.headers.get("authorization") === `Bearer ${expected}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return !!q && q === expected;
}

/**
 * GET /api/cron/pt-alerts — กวาดวันละครั้ง (เช้า) หาเรื่องที่แอดมินต้องรู้ก่อนลูกค้าบ่น
 * ?memberId= จำกัดคนเดียว (ไว้ทดสอบ) · ?dry=1 ดูว่าจะเตือนอะไรบ้าง โดยไม่เขียน/ไม่ยิงจริง
 */
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const result = await runPtAlerts({
      onlyMemberId: url.searchParams.get("memberId") || undefined,
      dryRun: url.searchParams.get("dry") === "1",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("pt-alerts cron error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
