import { NextRequest, NextResponse } from "next/server";
import { deleteSecret } from "@/lib/secrets/store";

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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const { key } = await ctx.params;
    await deleteSecret(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
