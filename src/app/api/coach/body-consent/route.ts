import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

/**
 * ยินยอมเก็บ/วิเคราะห์ภาพร่างกาย (WO-BODY §5 ข้อ 2 · WO-BP-1 §B4)
 *
 * ต้องมีค่านี้ก่อน /api/coach/body-scan ถึงจะรับรูปได้ — ไม่มี = 403 เสมอ
 * ข้อความยินยอมจริง ๆ อยู่ในแอป (ภาษาคน: เก็บที่ไหน ใครเห็น ลบยังไง) เส้นนี้แค่ประทับเวลา
 *
 * GET    → { consented, consentedAt, terms }
 * POST   → ประทับเวลา (ประทับแล้วไม่ประทับซ้ำ — เวลาที่ยินยอม "ครั้งแรก" คือหลักฐานที่ต้องไม่ถูกเขียนทับ)
 * DELETE → ถอนความยินยอม (ไม่ลบรูปให้อัตโนมัติ — การลบรูปเป็นคนละการกระทำ ผู้ใช้ต้องสั่งเอง
 *          จะได้ไม่มีใครกดถอนแล้วเสียประวัติทั้งเส้นโดยไม่ตั้งใจ · ลบรูปใช้ DELETE /api/coach/body-scan/[id])
 */

/** สิ่งที่ user กำลังตกลง — เก็บไว้ในโค้ดเพื่อให้แอปกับ backend พูดตรงกันเสมอ */
const CONSENT_TERMS = [
  "รูปเก็บในพื้นที่ส่วนตัวของเซิร์ฟเวอร์ ไม่ได้อยู่ในโฟลเดอร์สาธารณะ และเปิดได้เฉพาะบัญชีของคุณเท่านั้น",
  "ทีมงาน/แอดมินเห็นเฉพาะตัวเลข ไม่เห็นรูปของคุณ",
  "รูปไม่ถูกนำไปใช้ฝึกโมเดล AI และไม่ถูกส่งออกนอกระบบ",
  "ลบได้ทุกเมื่อ — ลบสแกนหนึ่งครั้ง = ลบทั้งแถวข้อมูลและไฟล์รูปจริง",
];

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = NextResponse.json({
    consented: !!member.bodyConsentAt,
    consentedAt: member.bodyConsentAt,
    terms: CONSENT_TERMS,
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const consentedAt =
      member.bodyConsentAt ??
      (
        await prisma.member.update({
          where: { id: member.id },
          data: { bodyConsentAt: new Date() },
          select: { bodyConsentAt: true },
        })
      ).bodyConsentAt;

    const res = NextResponse.json({ ok: true, consented: true, consentedAt, terms: CONSENT_TERMS });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-consent] POST", e);
    return NextResponse.json({ error: "บันทึกการยินยอมไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await prisma.member.update({ where: { id: member.id }, data: { bodyConsentAt: null } });
    const res = NextResponse.json({
      ok: true,
      consented: false,
      note: "ถอนความยินยอมแล้ว — สแกนใหม่ไม่ได้จนกว่าจะยินยอมอีกครั้ง · รูปเดิมยังอยู่ ลบได้ที่หน้าอัลบั้ม",
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-consent] DELETE", e);
    return NextResponse.json({ error: "ถอนการยินยอมไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
