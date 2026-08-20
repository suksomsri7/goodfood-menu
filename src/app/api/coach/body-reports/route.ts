import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 52;

/**
 * GET /api/coach/body-reports?limit= — รายงานร่างกาย 4 สัปดาห์ย้อนหลัง (WO-BP-3 §B4)
 *
 * เรียงใหม่→เก่า (ต่างจาก body-trends ที่เป็นเส้นกราฟ) เพราะจอนี้คือ "รายการ" ที่อ่านฉบับล่าสุดก่อน
 * stats ส่งไปทั้งก้อนโดยตั้งใจ: ย่อหน้าที่ LLM เขียนต้องตรวจย้อนกับตัวเลขต้นทางได้เสมอ
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const raw = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), MAX_LIMIT) : DEFAULT_LIMIT;

    const reports = await prisma.bodyReport.findMany({
      where: { memberId: member.id },
      orderBy: { periodEnd: "desc" },
      take: limit,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        stats: true,
        narrative: true,
        source: true,
        createdAt: true,
      },
    });

    const res = NextResponse.json({ reports, count: reports.length });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-reports] GET", e);
    return NextResponse.json({ error: "ดึงรายงานไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}
