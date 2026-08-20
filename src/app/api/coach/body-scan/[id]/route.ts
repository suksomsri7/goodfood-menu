import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { safeDelete, safeId } from "@/lib/bodyStorage";

export const dynamic = "force-dynamic";

/**
 * ลบสแกน (WO-BODY §5 ข้อ 3 — "ลบได้จริง")
 *
 * DELETE /api/coach/body-scan/[id] → ลบไฟล์รูปทุก view + ลบแถว
 *
 * 🔴 ลบไฟล์ "ก่อน" ลบแถว: ถ้าลบแถวก่อนแล้วลบไฟล์พลาด จะไม่มีใครรู้ว่าไฟล์นั้นเป็นของใคร = ลบไม่ได้อีกเลย
 *    ลบไฟล์ก่อนแล้วลบแถวพลาด ยังกดลบซ้ำได้ (safeDelete มองว่า "ไม่มีไฟล์" = สำเร็จ)
 * ไม่ใช่ของตัวเอง → 404 เหมือน body-photo (ห้ามยืนยันว่าสแกนนั้นมีอยู่)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notFound = () => {
    const res = NextResponse.json({ error: "ไม่พบสแกนนี้" }, { status: 404 });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  };

  try {
    const { id: rawId } = await params;
    const id = safeId(rawId);
    if (!id) return notFound();

    const scan = await prisma.bodyScan.findFirst({
      where: { id, memberId: member.id },
      select: { id: true, frontPath: true, sidePath: true, backPath: true },
    });
    if (!scan) return notFound();

    let deletedFiles = 0;
    for (const p of [scan.frontPath, scan.sidePath, scan.backPath]) {
      if (p && (await safeDelete(p))) deletedFiles++;
    }
    await prisma.bodyScan.delete({ where: { id: scan.id } });

    const res = NextResponse.json({ ok: true, id: scan.id, deletedFiles });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scan/[id]] DELETE", e);
    return NextResponse.json({ error: "ลบสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

/** GET → รายละเอียดสแกนเดียว (รวม landmark ดิบ สำหรับ BP-2 / การส่งออกข้อมูลของเจ้าตัว) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id: rawId } = await params;
    const id = safeId(rawId);
    if (!id) return NextResponse.json({ error: "ไม่พบสแกนนี้" }, { status: 404 });

    const scan = await prisma.bodyScan.findFirst({ where: { id, memberId: member.id } });
    if (!scan) {
      const res = NextResponse.json({ error: "ไม่พบสแกนนี้" }, { status: 404 });
      res.headers.set("Cache-Control", "no-store, must-revalidate");
      return res;
    }

    const views = scan.backPath ? ["front", "side", "back"] : ["front", "side"];
    const res = NextResponse.json({
      scan: {
        id: scan.id,
        date: scan.date.toISOString().slice(0, 10),
        quality: scan.quality,
        heightCmUsed: scan.heightCmUsed,
        views,
        photoUrls: Object.fromEntries(views.map((v) => [v, `/api/coach/body-photo/${scan.id}/${v}`])),
        landmarks: scan.landmarks,
        widthsPx: scan.widthsPx,
        estimates: scan.estimates,
        createdAt: scan.createdAt,
      },
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scan/[id]] GET", e);
    return NextResponse.json({ error: "ดึงข้อมูลสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
