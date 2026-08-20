import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { bkkDayKey } from "@/lib/readinessStore";

export const dynamic = "force-dynamic";

/**
 * POST /api/coach/readiness/undo — ย้อนแผนที่ปรับตามความพร้อมกลับเป็นของเดิม
 *
 * คืนจาก planBackup ตรง ๆ (ไม่ใช่ "คิดย้อนกลับ" ซึ่งพลาดได้ถ้ามีคนแก้แผนคั่นกลาง)
 * 🔴 ทำได้เฉพาะวันเดียวกันเท่านั้น — เราหา check-in ด้วย key ของวันนี้อยู่แล้ว
 *    ของเมื่อวานจึงย้อนไม่ได้โดยธรรมชาติ (แผนเมื่อวานเล่นไปแล้ว ย้อนทีหลัง = ประวัติเพี้ยน)
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const dayKey = bkkDayKey(new Date());
    const checkin = await prisma.readinessCheckin.findUnique({
      where: { memberId_date: { memberId: member.id, date: dayKey } },
    });
    if (!checkin || !checkin.applied || checkin.planBackup == null) {
      return NextResponse.json(
        { error: "วันนี้ยังไม่ได้ปรับแผนตามความพร้อมไว้ — ไม่มีอะไรต้องย้อนกลับ" },
        { status: 400 }
      );
    }

    const plan = await prisma.dailyPlan.findUnique({
      where: { memberId_date: { memberId: member.id, date: dayKey } },
    });
    if (!plan) {
      return NextResponse.json({ error: "ไม่พบแผนของวันนี้แล้ว — ย้อนกลับให้ไม่ได้" }, { status: 404 });
    }

    const backup = checkin.planBackup as Prisma.InputJsonValue;
    await prisma.$transaction([
      prisma.dailyPlan.update({ where: { id: plan.id }, data: { exercisePlan: backup } }),
      prisma.readinessCheckin.update({
        where: { id: checkin.id },
        // ล้าง backup ทิ้งด้วย — เหลือไว้จะกด undo ซ้ำแล้วทับแผนที่ user เพิ่งแก้เอง
        data: { applied: false, appliedAt: null, planBackup: Prisma.JsonNull },
      }),
    ]);

    const res = NextResponse.json({
      ok: true,
      applied: false,
      exercisePlan: backup,
      message: "คืนแผนเดิมของวันนี้ให้แล้ว",
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/readiness/undo]", e);
    return NextResponse.json({ error: "ย้อนแผนกลับไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
