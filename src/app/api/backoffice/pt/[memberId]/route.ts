import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/staffAuth";
import { getTrainingView } from "@/lib/ptBackoffice";

export const dynamic = "force-dynamic";

/** GET /api/backoffice/pt/:memberId — ข้อมูลแท็บ "การเทรน" ในโปรไฟล์ลูกค้า */
export async function GET(req: NextRequest, ctx: { params: Promise<{ memberId: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { memberId } = await ctx.params;
  try {
    const view = await getTrainingView(memberId);
    if (!view) return NextResponse.json({ error: "ไม่พบลูกค้ารายนี้" }, { status: 404 });
    return NextResponse.json(view);
  } catch (e) {
    console.error("backoffice pt view error:", e);
    return NextResponse.json({ error: "โหลดข้อมูลการเทรนไม่สำเร็จ" }, { status: 500 });
  }
}
