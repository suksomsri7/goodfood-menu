import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/coachAuth";
import { getSecret } from "@/lib/secrets/store";

/**
 * Tester login (ใช้ระหว่าง Apple login รอ Apple ฝั่งโน้น)
 * POST { code } → ต้องตรง secret DEV_LOGIN_CODE (ไม่ตั้ง = ปิด 403)
 * ออก session ให้ member "Coach" (ผูก memberType ไม่จำกัดเวลาอัตโนมัติ)
 */
// S2: กัน brute-force เดารหัส — 5 ครั้งผิด/IP/ชั่วโมง (in-memory: มี container เดียว รีสตาร์ท=รีเซ็ต ยอมรับได้)
const attempts = new Map<string, { n: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 3600_000;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now > a.resetAt) return false;
  return a.n >= MAX_ATTEMPTS;
}
function recordFail(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now > a.resetAt) attempts.set(ip, { n: 1, resetAt: now + WINDOW_MS });
  else a.n++;
  if (attempts.size > 5000) attempts.clear(); // กันโตไม่จำกัด
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (tooMany(ip)) {
      return NextResponse.json({ error: "ลองมากเกินไป รอ 1 ชั่วโมงแล้วลองใหม่" }, { status: 429 });
    }

    const { code } = await req.json();
    const expected = await getSecret("DEV_LOGIN_CODE");
    if (!expected) return NextResponse.json({ error: "disabled" }, { status: 403 });
    if (!code || code !== expected) {
      recordFail(ip);
      return NextResponse.json({ error: "invalid code" }, { status: 401 });
    }

    let member = await prisma.member.findFirst({ where: { email: "tester@coach.dev" } });
    if (!member) {
      const vip = await prisma.memberType.findFirst({ where: { courseDuration: 0, isActive: true } });
      member = await prisma.member.create({
        data: {
          name: "Coach",
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
