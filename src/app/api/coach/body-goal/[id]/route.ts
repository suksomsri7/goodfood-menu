import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/coach/body-goal/[id] { status } — ปิด/พัก/สำเร็จ (WO-BP-3 §B4)
 *
 * เปลี่ยนได้แค่สถานะ: ตัวเลขเป้าแก้ไม่ได้หลังตั้งแล้ว เพราะ "ความคืบหน้า" คิดจากจุดตั้งต้น ณ วันตั้งเป้า
 * ถ้าแก้เป้ากลางทางได้ กราฟความคืบหน้าย้อนหลังจะเปลี่ยนความหมายทั้งเส้นโดยที่ user ไม่รู้ตัว
 * → อยากได้เป้าใหม่ = ตั้งใหม่ (ของเดิมถูกปิดอัตโนมัติ และยังเปิดดูเป็นอัลบั้มเก่าได้)
 */
const ALLOWED = ["achieved", "paused", "cancelled"] as const;

const LABEL_TH: Record<string, string> = {
  achieved: "ถึงเป้าแล้ว 🎉 เก่งมากครับ",
  paused: "พักเป้านี้ไว้ก่อน กลับมาต่อเมื่อไหร่ก็ได้ครับ",
  cancelled: "ปิดเป้านี้แล้วครับ ตั้งใหม่ได้ตลอด",
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body?.status ?? "").trim();
    if (!(ALLOWED as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: "สถานะที่เปลี่ยนได้มีแค่ ถึงเป้า / พักไว้ / ยกเลิก เท่านั้นครับ" },
        { status: 400 }
      );
    }

    // เช็คเจ้าของก่อนเสมอ — id ของคนอื่นต้องได้ 404 เหมือนไม่มีอยู่จริง (ไม่ยืนยันว่ามีเป้านั้นในระบบ)
    const goal = await prisma.bodyGoal.findFirst({ where: { id, memberId: member.id } });
    if (!goal) return NextResponse.json({ error: "ไม่พบเป้าหมายนี้ครับ" }, { status: 404 });

    const updated = await prisma.bodyGoal.update({ where: { id: goal.id }, data: { status } });

    const res = NextResponse.json({ goal: updated, message: LABEL_TH[status] });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-goal/:id] PATCH", e);
    return NextResponse.json({ error: "อัปเดตเป้าหมายไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}
