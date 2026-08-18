import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { bkkDay, dayKey, enrollmentDays, thaiDate, trackLabel } from "@/lib/program";

export const dynamic = "force-dynamic";

/** รายการคอร์สทั้งหมด — หน้า "ออเดอร์/สมัคร" ของหลังบ้าน */
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
  return NextResponse.json({
    enrollments: list.map((e) => {
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
    }),
  });
}
