import { NextRequest, NextResponse } from "next/server";
import { verifyAppleToken, loginWithIdentity } from "@/lib/coachAuth";

// POST { identityToken, fullName? } → { accessToken, refreshToken, member, isNew }
export async function POST(req: NextRequest) {
  try {
    const { identityToken, fullName } = await req.json();
    if (!identityToken) return NextResponse.json({ error: "identityToken required" }, { status: 400 });

    const id = await verifyAppleToken(identityToken);
    const { member, tokens, isNew } = await loginWithIdentity(id, fullName);

    return NextResponse.json({
      ...tokens,
      isNew,
      member: { id: member.id, name: member.name, email: member.email, isOnboarded: member.isOnboarded },
    });
  } catch (e) {
    console.error("[auth/apple]", e);
    return NextResponse.json({ error: "apple sign-in failed" }, { status: 401 });
  }
}
