import { NextRequest, NextResponse } from "next/server";
import { getAuthedMemberAccessOnly, signWatchToken } from "@/lib/coachAuth";

/**
 * ออกกุญแจอายุ 30 วันให้แอปบน Apple Watch
 *
 * POST (Bearer access ปกติจากแอปมือถือ) → { watchToken, expiresAt }
 *
 * ทำไมต้องมี: นาฬิกาต่ออายุ token เองไม่ได้ (refresh token อยู่ใน Keychain ของ iPhone เท่านั้น)
 * access 1 ชม. จึงใช้ไม่ได้จริง — พอเกินชั่วโมงนาฬิกาก็หมดสิทธิ์ (บั๊ก build 31)
 *
 * ขอบเขต: watchToken ใช้แทน access ได้ แต่ **ต่ออายุตัวเองไม่ได้**
 *   /api/auth/native/refresh ตรวจ typ === "refresh" เท่านั้น → ยื่น watchToken ไปจะโดนปฏิเสธ 401
 *   และ endpoint นี้รับเฉพาะ access แท้ ๆ → watchToken ออกใบใหม่ให้ตัวเองไม่ได้
 *
 * ข้อจำกัดที่ยอมรับใน W1: ยังไม่มีตารางเก็บ jti ของ watch token (เพิกถอนใบเดียวไม่ได้)
 *   เพิกถอนได้ 2 ทาง — ปิดบัญชี (isActive=false) ตัดทันทีทุกใบ · หรือรอหมดอายุเองใน 30 วัน
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMemberAccessOnly(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { watchToken, expiresAt } = await signWatchToken(member.id);
  return NextResponse.json({ watchToken, expiresAt });
}
