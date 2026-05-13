import type { NextRequest } from "next/server";

export function isArticleWriteAuthorized(req: NextRequest): boolean {
  const secret = process.env.ARTICLE_CRON_SECRET;
  if (secret) {
    const header = req.headers.get("x-cron-secret");
    if (header && header === secret) return true;
    const bearer = req.headers.get("authorization");
    if (bearer === `Bearer ${secret}`) return true;
  }

  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = req.headers.get("host") ?? "";
    if (url.host === host) return true;
  } catch {
    return false;
  }
  return false;
}
