import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { gateImage } from "@/lib/bodyScanGate";
import { analyzePaths, WORKER_DOWN_MESSAGE } from "@/lib/bodyWorkerClient";
import {
  decodeImageDataUrl,
  ensureMemberDir,
  isBodyView,
  pendingMetaPath,
  pendingPath,
  privateExists,
  safeDelete,
  workerPath,
  writePrivate,
  BODY_VIEWS,
  type BodyView,
} from "@/lib/bodyStorage";

export const dynamic = "force-dynamic";

/**
 * อัปโหลดภาพสแกน "ทีละภาพ" (WO-BP-1 §B4)
 *
 * ทำไมทีละภาพ ไม่ใช่ส่ง 3 ภาพรวดเดียว:
 *   3 ภาพ × หลาย MB ใน request เดียว = ช้าและมีโอกาส timeout กลางทาง แล้ว user ต้องถ่ายใหม่ทั้งชุด
 *   ทีละภาพ = ล้มก็ถ่ายซ้ำแค่ภาพนั้น และบอกเหตุผลได้ทันทีตอนที่เขายังยืนอยู่ตรงนั้น
 *
 * POST { view: "front"|"side"|"back", image: dataURL }
 *   → 403 ถ้ายังไม่ยินยอม (WO-BODY §5 ข้อ 2)
 *   → เซฟลง private เป็น pending-<view>.jpg → ให้ worker วิเคราะห์ → gate ตัดสิน
 *   → ไม่ผ่าน: ลบไฟล์ทิ้ง + ตอบเหตุผลไทย (200 พร้อม pass:false — ไม่ใช่ error ของระบบ)
 *   → worker ล่ม: ลบไฟล์ทิ้ง + 503 (🔴 ห้ามเก็บรูปที่ยังไม่ได้วิเคราะห์ — WO-BP-1 §B4)
 *   → ผ่าน: เก็บ pending-<view>.jpg + pending-<view>.json (landmark) รอ commit
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

  let relPhoto: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));

    const view = String(body?.view ?? "").trim().toLowerCase();
    if (!isBodyView(view)) {
      return NextResponse.json(
        { error: `ไม่ทราบว่าเป็นภาพด้านไหน (รองรับ ${BODY_VIEWS.join("/")})` },
        { status: 400 }
      );
    }

    const decoded = decodeImageDataUrl(body?.image);
    if (!decoded.ok) return NextResponse.json({ error: decoded.error }, { status: 400 });

    await ensureMemberDir(member.id);
    relPhoto = pendingPath(member.id, view as BodyView);
    await writePrivate(relPhoto, decoded.image.buffer);

    // ── วิเคราะห์ ──
    const analyzed = await analyzePaths([workerPath(relPhoto)]);
    if (!analyzed.ok) {
      // 🔴 วิเคราะห์ไม่ได้ = ไม่เก็บ · ลบก่อนตอบเสมอ ไม่ใช่ปล่อยให้ค้างแล้วค่อยเก็บกวาดทีหลัง
      await safeDelete(relPhoto);
      relPhoto = null;
      return NextResponse.json({ error: WORKER_DOWN_MESSAGE, workerDown: true }, { status: 503 });
    }

    // ส่ง view เข้าไปด้วย — ภาพด้านข้างวัด "เอียง" จากเส้นไหล่ไม่ได้ (ไหล่สองข้างซ้อนกัน)
    const gate = gateImage(analyzed.images[0], view);
    if (!gate.pass) {
      await safeDelete(relPhoto);
      relPhoto = null;
      const res = NextResponse.json({
        ok: true,
        pass: false,
        view,
        quality: gate.quality,
        reason: gate.reason,
        reasons: gate.reasons,
        codes: gate.issues.map((i) => i.code),
        metrics: gate.metrics,
      });
      res.headers.set("Cache-Control", "no-store, must-revalidate");
      return res;
    }

    /* ผ่านแล้ว — เก็บ landmark ไว้ข้างไฟล์ เพื่อ commit ไม่ต้องเรียก worker ซ้ำ
       (เรียกซ้ำ = เสียเวลาอีกรอบ และผลอาจไม่ตรงกับที่บอก user ไปแล้วถ้าโมเดลถูกอัปเดตคั่นกลาง) */
    await writePrivate(
      pendingMetaPath(member.id, view as BodyView),
      JSON.stringify({
        view,
        quality: gate.quality,
        metrics: gate.metrics,
        landmarks: analyzed.images[0]?.landmarks ?? [],
        width: analyzed.images[0]?.width ?? null,
        height: analyzed.images[0]?.height ?? null,
        maskCoverage: analyzed.images[0]?.maskCoverage ?? null,
        meanLuma: analyzed.images[0]?.meanLuma ?? null,
        capturedAt: new Date().toISOString(),
      })
    );

    const res = NextResponse.json({
      ok: true,
      pass: true,
      view,
      quality: gate.quality,
      /** ผ่านแบบ ok = ยังมีข้อสังเกต (จอเอาไปโชว์ได้ว่า "ถ่ายใหม่ให้ดีกว่านี้ก็ได้นะ" แต่ไม่บังคับ) */
      reason: gate.reason,
      reasons: gate.reasons,
      metrics: gate.metrics,
      ms: analyzed.ms,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scan] POST", e);
    if (relPhoto) await safeDelete(relPhoto); // ล้มกลางทาง = ไม่ทิ้งรูปที่ไม่มีใครเป็นเจ้าของไว้บนดิสก์
    return NextResponse.json({ error: "อัปโหลดภาพไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

/** GET → มีภาพไหนรอ commit อยู่บ้าง (แอปเปิดกลับมากลางคันแล้วไปต่อได้ถูก) */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const pending: Record<string, boolean> = {};
    for (const v of BODY_VIEWS) pending[v] = await privateExists(pendingPath(member.id, v));

    const res = NextResponse.json({
      consented: !!member.bodyConsentAt,
      pending,
      canCommit: pending.front && pending.side,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-scan] GET", e);
    return NextResponse.json({ error: "ดูสถานะการสแกนไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
