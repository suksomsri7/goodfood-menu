/**
 * helper กลางสำหรับ endpoint ที่เดิมใช้ lineUserId (LIFF) แต่ต้องรองรับ Coach native (JWT) ด้วย
 * - มี Bearer → ใช้ member จาก JWT (เช็ค isActive แล้ว)
 * - ไม่มี → fallback lineUserId เดิม (LIFF ไม่กระทบ)
 * quota (usage-limits) ผูกกับ lineUserId → native (lineUserId null) จะข้าม quota
 * (สมาชิก native ถูก gate ด้วย isAiCoachActive อยู่แล้ว — quota รายฟีเจอร์เป็น follow-up WO-0.2)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember, getAuthedMemberAccessOnly } from "@/lib/coachAuth";

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
  if (lineUserId) {
    return prisma.member.findUnique({ where: { lineUserId }, include: { memberType: true } });
  }
  return null;
}
