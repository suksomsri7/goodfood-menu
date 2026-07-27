import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";

// POST { platform, token }  (auth required) → { ok }
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { platform, token } = await req.json();
    if (!["ios", "android"].includes(platform) || typeof token !== "string" || !token.trim()) {
      return NextResponse.json({ error: "platform must be ios|android + valid token" }, { status: 400 });
    }

    await prisma.deviceToken.upsert({
      where: { token },
      update: { memberId: member.id, platform, lastSeen: new Date() },
      create: { memberId: member.id, platform, token },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[devices/register]", e);
    return NextResponse.json({ error: "register failed" }, { status: 500 });
  }
}
