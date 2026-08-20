import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { isBodyView, readPrivate, safeId, type BodyView } from "@/lib/bodyStorage";

export const dynamic = "force-dynamic";

/**
 * ทางออกเดียวของภาพร่างกาย (WO-BODY §5 ข้อ 1 · WO-BP-1 §B4)
 *
 * GET /api/coach/body-photo/[scanId]/[view]
 *
 * 🔴 กติกาสามข้อที่ห้ามแตะ:
 *   1. ต้อง login และต้องเป็น "เจ้าของสแกนนั้น" เท่านั้น
 *   2. ไม่ใช่ของตัวเอง → 404 ไม่ใช่ 403 — 403 คือการบอกว่า "มีรูปนี้อยู่จริงนะ แต่ไม่ให้ดู"
 *      ซึ่งเปิดทางให้ไล่เดา id เพื่อดูว่าใครสแกนวันไหน (ข้อมูลนี้เองก็อ่อนไหว)
 *   3. Cache-Control: no-store — ห้ามให้ CDN/เบราว์เซอร์/proxy เก็บสำเนาไว้ที่ไหนทั้งสิ้น
 *      (บทเรียนจาก /uploads ที่ตั้ง immutable 30 วัน: ลบไฟล์แล้วสำเนายังอยู่ตามทางอีกเป็นเดือน)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string; view: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notFound = () => {
    const res = NextResponse.json({ error: "ไม่พบรูปนี้" }, { status: 404 });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  };

  try {
    const { scanId: rawId, view: rawView } = await params;
    const scanId = safeId(rawId);
    const view = String(rawView ?? "").toLowerCase();
    if (!scanId || !isBodyView(view)) return notFound();

    // where มี memberId อยู่ด้วย — ของคนอื่นจะ "ไม่มีอยู่" ตั้งแต่ชั้น query ไม่ต้องมาเช็คทีหลังแล้วเผลอลืม
    const scan = await prisma.bodyScan.findFirst({
      where: { id: scanId, memberId: member.id },
      select: { frontPath: true, sidePath: true, backPath: true },
    });
    if (!scan) return notFound();

    const relPath: Record<BodyView, string | null> = {
      front: scan.frontPath,
      side: scan.sidePath,
      back: scan.backPath,
    };
    const rel = relPath[view];
    if (!rel) return notFound();

    let buf: Buffer;
    try {
      buf = await readPrivate(rel);
    } catch {
      // แถวมีแต่ไฟล์หาย (ลบมือ/ดิสก์หาย) — สำหรับผู้ใช้คือ "ไม่มีรูปนี้" เหมือนกัน
      console.warn("[coach/body-photo] แถวมีแต่ไฟล์หาย");
      return notFound();
    }

    const res = new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        // กันเบราว์เซอร์เดาเป็น html แล้วรัน · กันฝังข้ามเว็บ
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Referrer-Policy": "no-referrer",
      },
    });
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-photo] GET", e);
    return NextResponse.json({ error: "เปิดรูปไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
