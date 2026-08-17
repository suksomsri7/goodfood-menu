import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { dayKey, thaiDate, trackLabel } from "@/lib/program";
import { createEnrollment } from "@/lib/programEnroll";

export const dynamic = "force-dynamic";

/**
 * สมัครเข้าโปรแกรมจากแอป
 *
 * ⚠️ ยังไม่ผูกระบบชำระเงิน — คอร์สถูกสร้างเป็น active ทันทีแล้วให้แอดมินตามเก็บเงินทาง LINE OA
 *    (ทำแบบเดียวกับ /api/coach/meal-design/[id]/order ที่ใช้อยู่)
 *    เมื่อมีเกตเวย์แล้วให้เปลี่ยนเป็นสร้างสถานะรอชำระก่อน
 */

function parseDay(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // ที่อยู่: ใช้ที่ส่งมา ถ้าไม่ส่งก็หยิบที่อยู่หลักของสมาชิก
  let addressId: string | null = typeof body?.addressId === "string" ? body.addressId : null;
  if (addressId) {
    const owned = await prisma.address.findFirst({ where: { id: addressId, memberId: member.id } });
    if (!owned) return NextResponse.json({ error: "ไม่พบที่อยู่นี้" }, { status: 400 });
  } else {
    const fallback = await prisma.address.findFirst({
      where: { memberId: member.id, isActive: true },
      orderBy: { isDefault: "desc" },
    });
    addressId = fallback?.id ?? null;
  }

  const result = await createEnrollment({
    memberId: member.id,
    track: body?.track,
    startDate: parseDay(body?.startDate),
    totalDays: body?.totalDays ?? 7,
    slots: body?.slots,
    price: body?.price ?? 0,
    addressId,
    deliveryNote: typeof body?.deliveryNote === "string" ? body.deliveryNote : null,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const e = result.enrollment;
  return NextResponse.json({
    ok: true,
    enrollment: {
      id: e.id,
      track: e.track,
      trackLabel: trackLabel(e.track),
      startDate: dayKey(e.startDate),
      endDate: dayKey(e.endDate),
      startLabel: thaiDate(e.startDate),
      endLabel: thaiDate(e.endDate),
      totalDays: e.totalDays,
      slots: e.slots,
    },
    /** ไม่มีที่อยู่ = แอดมินต้องถามทาง LINE — บอกแอปให้เตือน user ตั้งแต่ตอนนี้ */
    needsAddress: !addressId,
  });
}
