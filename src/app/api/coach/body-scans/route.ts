import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * ไทม์ไลน์สแกนของตัวเอง (WO-BP-1 §B4)
 *
 * GET /api/coach/body-scans?limit=30
 *   → { scans: [{ id, date, views, quality, heightCmUsed, photoUrls, createdAt }] }
 *
 * 🔴 ไม่มีรูปและไม่มี path จริงในคำตอบ — มีแค่ id/URL ที่ต้องยิงกลับมาขอทีละภาพ
 *    (ถ้าคืน path จริง ก็เท่ากับบอกโครงสร้างที่เก็บของลูกค้าคนอื่นให้ฟรี ๆ)
 *    landmarks/widthsPx/estimates ก็ไม่คืนที่นี่ — ก้อนใหญ่และจอไทม์ไลน์ไม่ได้ใช้
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const raw = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), MAX_LIMIT) : DEFAULT_LIMIT;

    const rows = await prisma.bodyScan.findMany({
      where: { memberId: member.id },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        quality: true,
        heightCmUsed: true,
        backPath: true,
        createdAt: true,
      },
    });

    const scans = rows.map((r) => {
      const views = r.backPath ? ["front", "side", "back"] : ["front", "side"];
      return {
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        quality: r.quality,
        heightCmUsed: r.heightCmUsed,
        views,
        photoUrls: Object.fromEntries(views.map((v) => [v, `/api/coach/body-photo/${r.id}/${v}`])),
        createdAt: r.createdAt,
      };
    });

    const res = NextResponse.json({ scans, count: scans.length });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scans] GET", e);
    return NextResponse.json({ error: "ดึงประวัติการสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
