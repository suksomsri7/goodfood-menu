import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";

/**
 * ลบบัญชี (Apple บังคับ: แอปที่มี account ต้องลบได้ในแอป — App Store Review 5.1.1(v))
 * DELETE + JWT → ลบ member จริง (ตารางลูก cascade ทั้งหมด) · Order ปลดความเป็นเจ้าของ (เก็บเป็นออเดอร์นิรนาม)
 * ไม่มี soft-delete: user กดยืนยัน 2 ชั้นในแอปแล้ว
 */
export async function DELETE(req: NextRequest) {
  try {
    const member = await getAuthedMember(req);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    await prisma.$transaction([
      prisma.order.updateMany({ where: { memberId: member.id }, data: { memberId: null } }),
      prisma.member.delete({ where: { id: member.id } }),
    ]);

    console.log(`[coach/account] deleted member=${member.id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coach/account]", e);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
