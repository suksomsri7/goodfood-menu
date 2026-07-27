import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/coachAuth";
import { getSecret } from "@/lib/secrets/store";

/**
 * Tester login (ใช้ระหว่าง Apple login รอ Apple ฝั่งโน้น)
 * POST { code } → ต้องตรง secret DEV_LOGIN_CODE (ไม่ตั้ง = ปิด 403)
 * ออก session ให้ member "Coach Tester" (ผูก memberType ไม่จำกัดเวลาอัตโนมัติ)
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const expected = await getSecret("DEV_LOGIN_CODE");
    if (!expected) return NextResponse.json({ error: "disabled" }, { status: 403 });
    if (!code || code !== expected) return NextResponse.json({ error: "invalid code" }, { status: 401 });

    let member = await prisma.member.findFirst({ where: { email: "tester@coach.dev" } });
    if (!member) {
      const vip = await prisma.memberType.findFirst({ where: { courseDuration: 0, isActive: true } });
      member = await prisma.member.create({
        data: {
          name: "Coach Tester",
          email: "tester@coach.dev",
          isOnboarded: false,
          activityStatus: "inactive",
          memberTypeId: vip?.id ?? null,
        },
      });
    }
    const tokens = await signSession(member.id);
    return NextResponse.json({
      ...tokens,
      isNew: !member.isOnboarded,
      member: { id: member.id, name: member.name, email: member.email, isOnboarded: member.isOnboarded },
    });
  } catch (e) {
    console.error("[auth/dev]", e);
    return NextResponse.json({ error: "dev login failed" }, { status: 500 });
  }
}
