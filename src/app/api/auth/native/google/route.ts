import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleToken, loginWithIdentity } from "@/lib/coachAuth";

// POST { idToken, fullName? } → { accessToken, refreshToken, member, isNew }
export async function POST(req: NextRequest) {
  try {
    const { idToken, fullName } = await req.json();
    if (!idToken) return NextResponse.json({ error: "idToken required" }, { status: 400 });

    const id = await verifyGoogleToken(idToken);
    const { member, tokens, isNew } = await loginWithIdentity(id, fullName);

    return NextResponse.json({
      ...tokens,
      isNew,
      member: { id: member.id, name: member.name, email: member.email, isOnboarded: member.isOnboarded },
    });
  } catch (e) {
    console.error("[auth/google]", e);
    return NextResponse.json({ error: "google sign-in failed" }, { status: 401 });
  }
}
