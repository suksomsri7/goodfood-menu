import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { dayKey, thaiDate } from "@/lib/program";
import { skipDay, unskipDay } from "@/lib/programEnroll";

export const dynamic = "force-dynamic";

/**
 * ขอหยุด / ยกเลิกการขอหยุด 1 วัน
 * POST   { date }  → หยุด
 * DELETE ?date=    → กลับมารับตามเดิม
 *
 * 🔴 ต้องตรวจว่าคอร์สเป็นของคนที่เรียกจริง — ไม่งั้นใครก็สั่งหยุดคอร์สคนอื่นได้
 */

function parseDay(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function myEnrollment(memberId: string) {
  return prisma.programEnrollment.findFirst({
    where: { memberId, status: "active" },
    orderBy: { startDate: "desc" },
  });
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const date = parseDay(body?.date);
  if (!date) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });

  const e = await myEnrollment(member.id);
  if (!e) return NextResponse.json({ error: "ยังไม่ได้อยู่ในโปรแกรม" }, { status: 400 });

  const result = await skipDay(e.id, date, typeof body?.reason === "string" ? body.reason : undefined);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    date: dayKey(date),
    endDate: dayKey(result.endDate),
    message: `หยุด ${thaiDate(date)} แล้ว — เลื่อนวันสุดท้ายไปเป็น ${thaiDate(result.endDate)} ให้ครบตามที่จ่ายไว้`,
  });
}

export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = parseDay(new URL(req.url).searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });

  const e = await myEnrollment(member.id);
  if (!e) return NextResponse.json({ error: "ยังไม่ได้อยู่ในโปรแกรม" }, { status: 400 });

  const result = await unskipDay(e.id, date);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    date: dayKey(date),
    endDate: dayKey(result.endDate),
    message: `กลับมารับอาหาร ${thaiDate(date)} ตามเดิม`,
  });
}
