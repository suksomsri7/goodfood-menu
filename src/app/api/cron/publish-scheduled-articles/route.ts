import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

async function runPublishSweep() {
  const now = new Date();
  const due = await prisma.article.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
    },
    select: { id: true, slug: true, scheduledFor: true },
  });

  if (due.length === 0) {
    return { promoted: 0, ids: [] as string[] };
  }

  const result = await prisma.$transaction(
    due.map((a) =>
      prisma.article.update({
        where: { id: a.id },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
        },
        select: { id: true, slug: true },
      })
    )
  );

  return { promoted: result.length, ids: result.map((r) => r.id), articles: result };
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const out = await runPublishSweep();
    return NextResponse.json({ ok: true, ...out, at: new Date().toISOString() });
  } catch (error) {
    console.error("[cron.publish-scheduled-articles] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Allow GET with secret too, for simpler crontab/curl one-liner
  return POST(req);
}
