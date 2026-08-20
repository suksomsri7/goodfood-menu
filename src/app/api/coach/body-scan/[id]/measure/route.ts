import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { safeId } from "@/lib/bodyStorage";
import { measureScan } from "@/lib/bodyMeasureStore";
import { WORKER_DOWN_MESSAGE } from "@/lib/bodyWorkerClient";

export const dynamic = "force-dynamic";

/**
 * วัดซ้ำ/วัดย้อนหลังสแกนเดิม (WO-BP-2 §B3)
 *
 * POST /api/coach/body-scan/[id]/measure
 *   ใช้เมื่อ: worker ล่มตอน commit · สูตรวัดถูกปรับ · user เพิ่งกรอกส่วนสูงหรือสายวัด
 *   รูปยังอยู่ใน private dir อยู่แล้ว จึงคิดใหม่ได้เสมอโดยไม่ต้องขอให้ลูกค้าถ่ายใหม่
 *
 * 🔴 ไม่ใช่ของตัวเอง = 404 ไม่ใช่ 403 (กติกาเดียวกับ body-photo/body-scan/[id]):
 *    403 คือการยืนยันว่า "สแกน id นี้มีอยู่จริงแต่เป็นของคนอื่น" ซึ่งไม่ควรบอกใครทั้งนั้น
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const noStore = (res: NextResponse) => {
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  };
  const notFound = () => noStore(NextResponse.json({ error: "ไม่พบสแกนนี้" }, { status: 404 }));

  try {
    const { id: rawId } = await params;
    const id = safeId(rawId);
    if (!id) return notFound();

    const result = await measureScan(id, member.id);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound();
      // worker ไม่พร้อม = ปัญหาของระบบ ไม่ใช่ของผู้ใช้ — ข้อความต้องไม่ทำให้เขาคิดว่าถ่ายรูปผิด
      return noStore(
        NextResponse.json({ error: WORKER_DOWN_MESSAGE, measured: false, workerDown: true }, { status: 503 })
      );
    }

    return noStore(
      NextResponse.json({
        ok: true,
        measured: true,
        scan: {
          id: result.scanId,
          heightCmUsed: result.heightCmUsed,
          calibrated: result.calibrated,
          widthsPx: result.widthsPx,
          estimates: result.estimates,
        },
      })
    );
  } catch (e: unknown) {
    console.error("[coach/body-scan/[id]/measure] POST", e);
    return NextResponse.json({ error: "วัดสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
