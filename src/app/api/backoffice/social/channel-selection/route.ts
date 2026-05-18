import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets/store";

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

// Returns the raw saved channel-ID list. Channel IDs are public Page/IG identifiers,
// not secrets — safe to surface in plaintext so the UI can pre-check the right boxes.
export async function GET(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const raw = (await getSecret("SHARK_CHANNEL_IDS")) || "";
  // Filter out any masked-value junk (contains `*` from old buggy UI saves).
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("*"));
  return NextResponse.json({ ids });
}
