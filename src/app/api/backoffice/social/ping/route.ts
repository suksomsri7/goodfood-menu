import { NextRequest, NextResponse } from "next/server";
import { sharkPing } from "@/lib/social/sharkClient";

export const dynamic = "force-dynamic";

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = req.headers.get("host") ?? "";
    return url.host === host;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await sharkPing();
  return NextResponse.json(result);
}
