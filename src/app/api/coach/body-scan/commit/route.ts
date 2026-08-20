import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { bkkDayKey } from "@/lib/readinessStore";
import { worstQuality, type ScanQuality } from "@/lib/bodyScanGate";
import {
  movePrivate,
  pendingMetaPath,
  pendingPath,
  privateExists,
  readPrivate,
  safeDelete,
  scanPhotoPath,
  BODY_VIEWS,
  REQUIRED_VIEWS,
  type BodyView,
} from "@/lib/bodyStorage";

export const dynamic = "force-dynamic";

/** เนื้อใน pending-<view>.json ที่ POST /api/coach/body-scan เขียนไว้ */
interface PendingMeta {
  quality?: ScanQuality;
  landmarks?: unknown;
  metrics?: unknown;
  width?: number | null;
  height?: number | null;
  maskCoverage?: number | null;
  meanLuma?: number | null;
  capturedAt?: string;
}

async function readMeta(memberId: string, view: BodyView): Promise<PendingMeta | null> {
  try {
    return JSON.parse((await readPrivate(pendingMetaPath(memberId, view))).toString("utf8")) as PendingMeta;
  } catch {
    return null;
  }
}

/** ลบ pending ทั้งชุด (ไฟล์รูป + json) — ใช้ทั้งตอน commit สำเร็จ และตอน user ยกเลิกกลางคัน */
async function clearPending(memberId: string): Promise<void> {
  for (const v of BODY_VIEWS) {
    await safeDelete(pendingPath(memberId, v));
    await safeDelete(pendingMetaPath(memberId, v));
  }
}

/**
 * ปิดงานสแกน (WO-BP-1 §B4)
 *
 * POST → ครบ 2-3 ภาพแล้ว: สร้าง/ทับ BodyScan ของ "วันนี้" (BKK) แล้วย้าย pending → ชื่อจริง
 *
 * 🔴 สแกนซ้ำวันเดิม = ทับ: ต้องลบไฟล์ชุดเก่าก่อนเขียนแถวใหม่เสมอ
 *    ไม่งั้นรูปชุดเก่าจะค้างบนดิสก์แบบไม่มีแถวไหนอ้างถึง = ลบไม่ได้อีกเลย (ผู้ใช้กด "ลบ" ก็ไม่หาย)
 *
 * DELETE → ทิ้ง pending ทั้งหมด (ยกเลิกกลางคัน) — ไม่แตะสแกนที่ commit ไปแล้ว
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!member.bodyConsentAt) {
    return NextResponse.json(
      { error: "ต้องยินยอมให้เก็บภาพร่างกายก่อนเริ่มสแกน — กดดูรายละเอียดแล้วยืนยันได้ในหน้าสแกนนะครับ", needsConsent: true },
      { status: 403 }
    );
  }

  try {
    // ── ภาพไหนพร้อมบ้าง ──
    const available: BodyView[] = [];
    for (const v of BODY_VIEWS) if (await privateExists(pendingPath(member.id, v))) available.push(v);

    const missing = REQUIRED_VIEWS.filter((v) => !available.includes(v));
    if (missing.length) {
      const th: Record<string, string> = { front: "ด้านหน้า", side: "ด้านข้าง", back: "ด้านหลัง" };
      return NextResponse.json(
        {
          error: `ยังขาดภาพ${missing.map((v) => th[v] ?? v).join(" และ ")} — ถ่ายให้ครบก่อนบันทึกนะครับ`,
          missing,
        },
        { status: 400 }
      );
    }

    const metas: Partial<Record<BodyView, PendingMeta | null>> = {};
    for (const v of available) metas[v] = await readMeta(member.id, v);

    const quality = worstQuality(available.map((v) => metas[v]?.quality ?? "ok"));
    const date = bkkDayKey(new Date());

    // landmark ดิบต่อภาพ — อาหารของ BP-2 (reprocess ได้โดยไม่ต้องขอรูปใหม่จากลูกค้า)
    const landmarks: Record<string, unknown> = {};
    for (const v of available) {
      landmarks[v] = {
        points: metas[v]?.landmarks ?? [],
        width: metas[v]?.width ?? null,
        height: metas[v]?.height ?? null,
        maskCoverage: metas[v]?.maskCoverage ?? null,
        meanLuma: metas[v]?.meanLuma ?? null,
        metrics: metas[v]?.metrics ?? null,
        capturedAt: metas[v]?.capturedAt ?? null,
      };
    }

    /* ทับของวันเดียวกัน: ลบ "ไฟล์" ของแถวเดิมก่อน แล้วค่อยเขียนแถว
       ไม่งั้นรูปชุดเก่าจะค้างบนดิสก์แบบไม่มีแถวไหนอ้างถึง = ผู้ใช้กดลบก็ไม่หาย */
    const existing = await prisma.bodyScan.findUnique({
      where: { memberId_date: { memberId: member.id, date } },
      select: { id: true, frontPath: true, sidePath: true, backPath: true },
    });
    if (existing) {
      for (const p of [existing.frontPath, existing.sidePath, existing.backPath]) {
        if (p) await safeDelete(p);
      }
    }

    /* ตั้ง id เองตั้งแต่ต้น เพราะ "ชื่อไฟล์ผูกกับ id" — ถ้ารอ id จาก DB จะต้องเขียนแถวสองรอบ
       และมีช่วงที่แถวชี้ไปยังไฟล์ที่ยังไม่มี · uuid เข้ารูปแบบ [a-z0-9-] เดียวกับที่ safeId ยอมรับ */
    const scanId = existing?.id ?? randomUUID();
    const paths = {
      frontPath: scanPhotoPath(member.id, scanId, "front"),
      sidePath: scanPhotoPath(member.id, scanId, "side"),
      backPath: available.includes("back") ? scanPhotoPath(member.id, scanId, "back") : null,
    };
    const data = {
      ...paths,
      heightCmUsed: member.height ?? null,
      quality,
      landmarks: landmarks as never,
      widthsPx: {} as never,
      estimates: {} as never,
    };

    if (existing) await prisma.bodyScan.update({ where: { id: scanId }, data });
    else await prisma.bodyScan.create({ data: { id: scanId, memberId: member.id, date, ...data } });

    // ── ย้ายไฟล์เข้าที่ ──
    try {
      for (const v of available) {
        await movePrivate(pendingPath(member.id, v), scanPhotoPath(member.id, scanId, v));
      }
    } catch (moveErr) {
      /* ย้ายไม่สำเร็จ = แถวชี้ไปไฟล์ที่ไม่มีอยู่ → ย้อนคืนให้หมด
         ปล่อยไว้แล้วบอกว่าสำเร็จคือหลอกลูกค้าว่ามีรูปเก็บอยู่ทั้งที่ไม่มี */
      console.error("[coach/body-scan/commit] ย้ายไฟล์ไม่สำเร็จ — ย้อนแถวคืน", moveErr);
      for (const v of available) await safeDelete(scanPhotoPath(member.id, scanId, v));
      if (!existing) await prisma.bodyScan.delete({ where: { id: scanId } }).catch(() => {});
      throw moveErr;
    }
    await clearPending(member.id);

    const res = NextResponse.json({
      ok: true,
      scan: {
        id: scanId,
        date: date.toISOString().slice(0, 10),
        views: available,
        quality,
        heightCmUsed: member.height ?? null,
        replacedToday: !!existing,
        /** BP-1 ยังไม่มีตัวเลขวัด — จอต้องไม่แต่งค่าให้ user เห็น (BP-2 เป็นคนเติม) */
        estimates: null,
      },
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scan/commit] POST", e);
    return NextResponse.json({ error: "บันทึกสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await clearPending(member.id);
    const res = NextResponse.json({ ok: true, cleared: true });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scan/commit] DELETE", e);
    return NextResponse.json({ error: "ยกเลิกการสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
