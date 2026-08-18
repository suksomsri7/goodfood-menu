import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { bkkDay, dayKey, enrollmentDays, thaiDate, trackLabel } from "@/lib/program";
import { membersServedOn, toPackingList } from "@/lib/programQuery";

export const dynamic = "force-dynamic";

/**
 * รายชื่อคนในโปรแกรม — 2 มุมมองจากข้อมูลชุดเดียวกัน
 *   ?view=roster (ค่าเริ่มต้น) มุมนักโภชนาการ: รายคน ต้องการสารอาหารเท่าไร เหลือกี่วัน
 *   ?view=packing            มุมครัว: มื้อ → จาน → ตักยังไง กี่กล่อง
 *
 * แยกสองมุมเพราะคนใช้ต่างกันจริง ๆ — คนแพ็คไม่ได้ไล่อ่านทีละคน เขาตักทีละหม้อ
 */

function parseDay(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { searchParams } = new URL(req.url);
  const date = parseDay(searchParams.get("date")) ?? bkkDay();
  const view = searchParams.get("view") === "packing" ? "packing" : "roster";

  const served = await membersServedOn(date);

  const summary = {
    date: dayKey(date),
    label: thaiDate(date),
    serving: served.length,
    boxes: served.reduce((n, m) => n + m.meals.length, 0),
    /** ⚠️ ช่องที่มีลูกค้ารออยู่แต่ปฏิทินยังว่าง — ต้องเป็นศูนย์ก่อนถึงเวลาทำอาหาร */
    missingMenu: served
      .flatMap((m) => m.meals.filter((x) => !x.food).map((x) => `${m.trackLabel} · ${x.slot}`))
      .filter((v, i, a) => a.indexOf(v) === i),
    /**
     * ⚠️ กล่องที่ตักยังไงก็ไม่ตรงเป้า — แก้ที่ปฏิทิน ไม่ใช่ที่ทัพพี
     * แยกจาก missingMenu เพราะอันนั้น "ไม่มีเมนู" ส่วนอันนี้ "มีเมนูแต่ไม่เข้ากับคน"
     */
    offTarget: served
      .flatMap((m) => m.meals.filter((x) => x.portion?.off).map((x) => `${m.trackLabel} · ${x.slot}`))
      .filter((v, i, a) => a.indexOf(v) === i),
  };

  if (view === "packing") {
    return NextResponse.json({ summary, slots: toPackingList(served) });
  }

  return NextResponse.json({ summary, members: served });
}

/**
 * POST — เพิ่มลูกค้าเข้าโปรแกรมจากหลังบ้าน (แอดมินรับออเดอร์ทางโทรศัพท์/LINE)
 * ฝั่งลูกค้าสมัครเองใช้ /api/coach/program/enroll ซึ่งเรียกตรรกะเดียวกัน
 */
export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = await req.json().catch(() => null);
  if (!body?.memberId) return NextResponse.json({ error: "ต้องระบุสมาชิก" }, { status: 400 });

  const { createEnrollment } = await import("@/lib/programEnroll");
  const result = await createEnrollment({
    memberId: body.memberId,
    track: body.track,
    startDate: parseDay(body.startDate) ?? undefined,
    totalDays: body.totalDays,
    slots: body.slots,
    price: body.price,
    addressId: body.addressId,
    deliveryNote: body.deliveryNote,
    /** หลังบ้านข้ามการเช็ครันเวย์ได้ เพราะแอดมินอาจกำลังจะกรอกปฏิทินต่อทันที */
    allowIncompleteRunway: body.force === true,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, enrollment: result.enrollment });
}

/** PATCH — ยกเลิก / เปลี่ยนสายให้ลูกค้า */
export async function PATCH(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = await req.json().catch(() => null);
  if (!body?.enrollmentId) return NextResponse.json({ error: "ต้องระบุคอร์ส" }, { status: 400 });

  const data: { status?: string; track?: string; deliveryNote?: string } = {};
  if (body.status && ["active", "completed", "cancelled"].includes(body.status)) data.status = body.status;
  if (body.track) data.track = body.track;
  if (typeof body.deliveryNote === "string") data.deliveryNote = body.deliveryNote;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "ไม่มีอะไรให้แก้" }, { status: 400 });

  const e = await prisma.programEnrollment.update({ where: { id: body.enrollmentId }, data });
  return NextResponse.json({ ok: true, enrollment: { ...e, trackLabel: trackLabel(e.track) } });
}
