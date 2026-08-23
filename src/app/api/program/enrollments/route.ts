import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { bkkDay, dayKey, enrollmentDays, thaiDate, trackLabel } from "@/lib/program";

export const dynamic = "force-dynamic";

/**
 * รายการคอร์สทั้งหมด — หน้า "ออเดอร์/สมัคร" ของหลังบ้าน
 *
 * คืนสองชั้นจากข้อมูลชุดเดียวกัน
 *   enrollments : ทุกใบสมัคร (ประวัติดิบ — ยกเลิกแล้วสมัครใหม่ = คนละใบ ถูกต้องแล้ว ห้ามยุบ)
 *   members     : หนึ่งคน = หนึ่งแถว สำหรับ "รายชื่อ"
 *
 * 🔴 ทำไมต้องมีชั้น members: แอดมินอ่านรายชื่อเพื่อตอบคำถามว่า "คนนี้ตอนนี้เป็นยังไง"
 *    ถ้าโชว์ทีละใบ คนที่ยกเลิกแล้วสมัครใหม่จะโผล่ 2 แถว แล้วดูเหมือนลูกค้า 2 คน
 */
export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const status = new URL(req.url).searchParams.get("status");
  const list = await prisma.programEnrollment.findMany({
    where: status && status !== "all" ? { status } : undefined,
    orderBy: { startDate: "desc" },
    take: 200,
    include: {
      member: { select: { id: true, name: true, displayName: true, phone: true } },
    },
  });

  const today = bkkDay();
  const enrollments = list.map((e) => {
    const days = enrollmentDays(e);
    return {
      id: e.id,
      member: {
        id: e.member.id,
        name: e.member.name || e.member.displayName || "(ไม่มีชื่อ)",
        phone: e.member.phone,
      },
      track: e.track,
      trackLabel: trackLabel(e.track),
      startDate: dayKey(e.startDate),
      endDate: dayKey(e.endDate),
      startLabel: thaiDate(e.startDate),
      endLabel: thaiDate(e.endDate),
      totalDays: e.totalDays,
      /** เหลืออีกกี่วันที่ยังต้องส่ง — ใช้เตือนต่ออายุ */
      remaining: days.filter((d) => d.date >= today).length,
      slots: e.slots,
      price: e.price,
      status: e.status,
    };
  });

  // ── ยุบเป็นรายคน ── (list เรียง startDate desc มาแล้ว ใบแรกของแต่ละคน = ใบล่าสุด)
  const byMember = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const bucket = byMember.get(e.member.id);
    if (bucket) bucket.push(e);
    else byMember.set(e.member.id, [e]);
  }

  const members = [...byMember.values()].map((rows) => {
    /** ใบที่ยังส่งอาหารอยู่ — คนหนึ่งมี active ได้ใบเดียวตามกติกาของ createEnrollment */
    const active = rows.find((r) => r.status === "active") ?? null;
    const latest = rows[0];
    return {
      memberId: latest.member.id,
      name: latest.member.name,
      phone: latest.member.phone,
      /** "เคยเข้ากี่คอร์ส" — นับทุกใบรวมที่ยกเลิก เพราะแอดมินใช้ดูว่าลูกค้าคนนี้กลับมาบ่อยแค่ไหน */
      courseCount: rows.length,
      active: active
        ? { id: active.id, trackLabel: active.trackLabel, remaining: active.remaining, endLabel: active.endLabel }
        : null,
      /** ใบล่าสุด — ใช้ตอบว่า "จบไปแล้วเมื่อไร / ยกเลิกไปแล้ว" เมื่อไม่มีใบที่ active */
      latest: { trackLabel: latest.trackLabel, endLabel: latest.endLabel, status: latest.status },
      /** ใช้เรียงลำดับฝั่ง server เท่านั้น */
      latestStart: latest.startDate,
    };
  });

  // คนที่ยังส่งอาหารอยู่ต้องอยู่บนสุดเสมอ — เป็นกลุ่มเดียวที่แอดมินต้องลงมือทำอะไรกับเขาวันนี้
  members.sort((a, b) => {
    if (!!a.active !== !!b.active) return a.active ? -1 : 1;
    if (a.active && b.active) return a.active.remaining - b.active.remaining;
    return b.latestStart.localeCompare(a.latestStart);
  });

  return NextResponse.json({ enrollments, members });
}
