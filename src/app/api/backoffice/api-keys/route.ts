import { NextRequest, NextResponse } from "next/server";
import { listSecrets, setSecret } from "@/lib/secrets/store";
import { isManagedKey } from "@/lib/secrets/keys";

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
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const items = await listSecrets();
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "list failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { key?: string; value?: string; updatedBy?: string };
    const key = (body.key ?? "").trim();
    const value = (body.value ?? "").trim();
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    if (!value) return NextResponse.json({ error: "value required" }, { status: 400 });
    if (!isManagedKey(key)) {
      return NextResponse.json({ error: `unknown key: ${key}` }, { status: 400 });
    }
    await setSecret(key, value, body.updatedBy);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}
