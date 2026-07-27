import { NextRequest, NextResponse } from "next/server";
import { verifySession, signSession } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";

// POST { refreshToken } → { accessToken, refreshToken }
export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) return NextResponse.json({ error: "refreshToken required" }, { status: 400 });

    const memberId = await verifySession(refreshToken, "refresh");
    if (!memberId) return NextResponse.json({ error: "invalid refresh token" }, { status: 401 });

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.isActive === false) return NextResponse.json({ error: "member not found" }, { status: 401 });

    const tokens = await signSession(memberId);
    return NextResponse.json(tokens);
  } catch (e) {
    console.error("[auth/refresh]", e);
    return NextResponse.json({ error: "refresh failed" }, { status: 401 });
  }
}
