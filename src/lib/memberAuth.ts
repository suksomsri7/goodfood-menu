/**
 * helper กลางสำหรับ endpoint ที่เดิมใช้ lineUserId (LIFF) แต่ต้องรองรับ Coach native (JWT) ด้วย
 * - มี Bearer → ใช้ member จาก JWT (เช็ค isActive แล้ว)
 * - ไม่มี → คุกกี้ `gf_member` ที่แลกมาจาก LINE (ดู liffAuth.ts)
 *
 * 🔴 22 ส.ค. 69: เลิกเชื่อ `?lineUserId=` ที่ client ส่งมา — เดิมใครรู้ id ของคนอื่นก็อ่าน/แก้ข้อมูลคนนั้นได้
 *    ยังเปิดคืนได้ชั่วคราวด้วย env `LIFF_ALLOW_LEGACY_ID=1` (ต้อง build ใหม่) เผื่อ LIFF ของจริงพัง
 *
 * quota (usage-limits) ผูกกับ lineUserId → native (lineUserId null) จะข้าม quota
 * (สมาชิก native ถูก gate ด้วย isAiCoachActive อยู่แล้ว — quota รายฟีเจอร์เป็น follow-up WO-0.2)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember, getAuthedMemberAccessOnly } from "@/lib/coachAuth";
import { lineUserIdFromCookie, legacyLineUserIdAllowed } from "@/lib/liffAuth";
import { readStaff } from "@/lib/staffAuth";

/**
 * มี Authorization: Bearer มาด้วยไหม (ไม่สนว่า token ใช้ได้จริงหรือเปล่า)
 * ใช้แยกสาเหตุตอน memberFromReq คืน null:
 *   มี Bearer แต่ไม่ผ่าน = token หมดอายุ/ไม่ถูกต้อง → 401 (client จะได้รู้ว่าต้องต่ออายุ)
 *   ไม่มี Bearer เลย     = เคส LIFF/lineUserId หาไม่เจอ → คงพฤติกรรมเดิม (404)
 */
export function hasBearer(req: NextRequest): boolean {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  return !!h && h.startsWith("Bearer ");
}

/**
 * คืน response 401 ถ้าคำขอนี้ "แนบ Bearer มาแต่ยืนยันตัวตนไม่ผ่าน" · ไม่ใช่เคสนั้นคืน null
 *
 * 🔴 บทเรียนจาก build 31: นาฬิกาถือ access token อายุ 1 ชม. พอหมดอายุ initial-data ตอบ 404
 *    ("Member not found") แอปเลยขึ้น "โหลดข้อมูลไม่สำเร็จ (404)" แทนที่จะรู้ว่าต้องต่ออายุ token
 */
export function unauthorizedIfBearer(req: NextRequest): NextResponse | null {
  if (!hasBearer(req)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * คำขอนี้ "ไม่มีตัวตนติดมาเลย" (ไม่มี Bearer และไม่มีคุกกี้ LIFF) → คืน 401
 * ใช้แทนการตอบ 404 "Member not found" ซึ่งอ่านแล้วเหมือนระบบพัง ทั้งที่แค่ยังไม่ได้ยืนยันตัวตน
 */
export async function unauthorizedIfNoIdentity(req: NextRequest): Promise<NextResponse | null> {
  if (hasBearer(req)) return null;
  if (await lineUserIdFromCookie(req)) return null;
  if (legacyLineUserIdAllowed()) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * @param opts.accessOnly ไม่รับ watch token (ใช้กับเส้นที่นาฬิกาไม่ได้เรียก เช่น สร้างแผน)
 *                        ทาง lineUserId (LIFF) ไม่กระทบ
 */
export async function memberFromReq(
  req: NextRequest,
  lineUserId?: string | null,
  opts?: { accessOnly?: boolean }
) {
  const authed = opts?.accessOnly ? await getAuthedMemberAccessOnly(req) : await getAuthedMember(req);
  if (authed) return authed;

  const trusted = await lineUserIdFromCookie(req);
  // พารามิเตอร์ที่ client ส่งมาใช้ได้ต่อเมื่อ "ตรงกับตัวตนที่ LINE ยืนยันแล้ว" เท่านั้น
  const resolved = trusted ?? (legacyLineUserIdAllowed() ? lineUserId ?? null : null);
  if (!resolved) return null;
  if (trusted && lineUserId && lineUserId !== trusted) return null;

  return prisma.member.findUnique({ where: { lineUserId: resolved }, include: { memberType: true } });
}

/**
 * lineUserId ที่ยืนยันแล้วของคำขอนี้ (สำหรับเส้นที่ query prisma เอง ไม่ได้ใช้ memberFromReq)
 * คืน null = ไม่มีตัวตน → ต้องตอบ 401 ห้ามใช้ค่าจาก query string แทน
 */
export async function trustedLineUserId(
  req: NextRequest,
  fromClient?: string | null
): Promise<string | null> {
  // แอป native ถือ Bearer — ยอมรับด้วย เผื่อวันหลังมีจอไหนเรียกเส้นฝั่ง LIFF
  if (hasBearer(req)) {
    const authed = await getAuthedMember(req);
    if (authed?.lineUserId) return authed.lineUserId;
  }

  const trusted = await lineUserIdFromCookie(req);
  if (trusted) {
    if (fromClient && fromClient !== trusted) return null; // ขอของคนอื่น = ปฏิเสธ
    return trusted;
  }
  return legacyLineUserIdAllowed() ? fromClient ?? null : null;
}

/**
 * เหมือน trustedLineUserId แต่ยอมให้ "พนักงานหลังบ้าน" ถาม id ของลูกค้าได้
 * (หน้าแชทหลังบ้านเปิดโปรไฟล์ลูกค้าจาก lineUserId ของห้องแชท)
 */
export async function trustedLineUserIdOrStaff(
  req: NextRequest,
  fromClient?: string | null
): Promise<string | null> {
  const own = await trustedLineUserId(req, fromClient);
  if (own) return own;
  if (fromClient && (await readStaff(req))) return fromClient;
  return null;
}

/** member ที่ยืนยันแล้วของคำขอนี้ (Bearer หรือคุกกี้ LIFF) — ไม่มี = null */
export async function trustedMember(req: NextRequest, fromClient?: string | null) {
  return memberFromReq(req, fromClient ?? null);
}
