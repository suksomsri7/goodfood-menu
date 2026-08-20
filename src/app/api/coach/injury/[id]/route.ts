import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { setInjuryActive } from "@/lib/trainingProfileStore";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/coach/injury/[id] { active } — เปิด/ปิดอาการที่เคยบันทึกไว้ (WO-PT-D §S3)
 *
 * ปิดแทนการลบ: ประวัติว่าเคยเจ็บตรงไหนมีค่ากับการอ่านย้อนหลัง และ user มักกลับมาเจ็บที่เดิม
 * (อยากลบจริง ๆ ค่อยทำที่หน้าความเป็นส่วนตัวเหมือน CoachMemory)
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (typeof body?.active !== "boolean") {
      return NextResponse.json({ error: "ระบุสถานะว่าจะเปิดหรือปิดรายการนี้ด้วยนะครับ" }, { status: 400 });
    }

    // ของคนอื่น = 404 เหมือนไม่มีอยู่จริง (ไม่ยืนยันว่ามี id นี้ในระบบ)
    const injury = await setInjuryActive(member.id, id, body.active);
    if (!injury) return NextResponse.json({ error: "ไม่พบรายการนี้ครับ" }, { status: 404 });

    const res = NextResponse.json({
      ok: true,
      injury,
      message: body.active ? "เปิดรายการนี้กลับมาแล้วครับ" : "ปิดรายการนี้แล้วครับ แผนจะกลับมาจัดท่าตามปกติ",
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/injury/:id] PATCH", e);
    return NextResponse.json({ error: "อัปเดตรายการไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}
