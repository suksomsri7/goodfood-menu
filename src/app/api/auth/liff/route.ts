import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/secrets/store";
import {
  issueMemberCookie,
  clearMemberCookie,
  verifyLineIdToken,
  verifyLineAccessToken,
} from "@/lib/liffAuth";

export const dynamic = "force-dynamic";

/**
 * แลก token ของ LINE เป็น session ของเรา (คุกกี้ httpOnly `gf_member`)
 * POST { idToken? , accessToken? , displayName? , pictureUrl? }   ← หน้า LIFF เรียกตอนเปิด
 * POST { devCode }                                                ← เปิดในเบราว์เซอร์เพื่อ QC เท่านั้น
 *
 * 🔴 หัวใจ: lineUserId ต้องมาจากสิ่งที่ LINE เซ็นให้เท่านั้น — ไม่รับ lineUserId ที่ client ส่งมาเอง
 *    (เดิมทุกเส้นเชื่อ `?lineUserId=` ตรง ๆ = ใครรู้ id ของคนอื่นก็สวมรอยได้)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* ไม่มี body = ถือว่าไม่ได้ส่ง token มา */
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const devCode = typeof body.devCode === "string" ? body.devCode : "";

  let lineUserId: string | null = null;

  if (idToken) lineUserId = await verifyLineIdToken(idToken);
  if (!lineUserId && accessToken) lineUserId = await verifyLineAccessToken(accessToken);

  // โหมดทดสอบในเบราว์เซอร์ (ไม่มี LINE) — ต้องรู้รหัสที่เก็บใน secret_settings เท่านั้น
  if (!lineUserId && devCode) {
    const expected = (await getSecret("DEV_LOGIN_CODE")) || process.env.DEV_LOGIN_CODE || "";
    if (expected && devCode === expected) lineUserId = "dev-user-001";
  }

  if (!lineUserId) {
    const res = NextResponse.json(
      { error: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาเปิดหน้านี้จากแอป LINE อีกครั้ง" },
      { status: 401 }
    );
    clearMemberCookie(res);
    return res;
  }

  const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
  const pictureUrl = typeof body.pictureUrl === "string" ? body.pictureUrl : undefined;

  // เดิม LiffProvider ยิง POST /api/members/me เพื่อสมัคร/อัปเดตโปรไฟล์ — ย้ายมาทำตรงนี้ในคำขอเดียว
  const member = await prisma.member.upsert({
    where: { lineUserId },
    update: {
      ...(displayName ? { displayName } : {}),
      ...(pictureUrl ? { pictureUrl } : {}),
      lastActiveAt: new Date(),
    },
    create: {
      lineUserId,
      displayName,
      pictureUrl,
      dailyCalories: 2000,
      dailyProtein: 150,
      dailyCarbs: 250,
      dailyFat: 65,
      dailySodium: 2300,
      dailySugar: 50,
      dailyWater: 2000,
      activityStatus: "inactive",
      lastActiveAt: new Date(),
    },
    select: { id: true, isOnboarded: true },
  });

  const res = NextResponse.json({ ok: true, memberId: member.id, isOnboarded: member.isOnboarded });
  await issueMemberCookie(res, lineUserId);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** ออกจากระบบฝั่ง LIFF (ล้างคุกกี้) */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearMemberCookie(res);
  return res;
}
