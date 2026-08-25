import { NextRequest, NextResponse } from "next/server";
import { loginWithIdentity } from "@/lib/coachAuth";
import { exchangeLineCode } from "@/lib/socialAuth";

export const dynamic = "force-dynamic";

// POST { code } → { accessToken, refreshToken, member, isNew }
// 🔴 แอปส่งมาแค่ code — การแลก token ใช้ channel secret ซึ่งอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
export async function POST(req: NextRequest) {
  try {
    const { code } = (await req.json()) as { code?: string };
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

    const id = await exchangeLineCode(code);
    const { member, tokens, isNew } = await loginWithIdentity(id, id.displayName);

    return NextResponse.json({
      ...tokens,
      isNew,
      member: { id: member.id, name: member.name, email: member.email, isOnboarded: member.isOnboarded },
    });
  } catch (e) {
    console.error("[auth/line]", e);
    return NextResponse.json({ error: "line sign-in failed" }, { status: 401 });
  }
}
