import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { exerciseFields, resolveImages } from "@/lib/exerciseAdmin";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const existing = await prisma.exercise.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบท่านี้" }, { status: 404 });

  const b = await req.json();
  const f = exerciseFields(b);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });

  const images = b.images !== undefined ? await resolveImages(b.images) : existing.images;
  const item = await prisma.exercise.update({ where: { id }, data: { ...f.data, images } });
  return NextResponse.json({ ok: true, item });
}

/**
 * ท่ามาตรฐาน (จากคลังโค้ด) ลบจริงไม่ได้ — แผนเก่า/ตรรกะจัดแผนยังอ้างชื่ออยู่ → ปิดใช้งานแทน
 * ท่าที่แอดมินเพิ่มเอง (isCustom) ลบจริงได้
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const existing = await prisma.exercise.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบท่านี้" }, { status: 404 });

  if (existing.isCustom) {
    await prisma.exercise.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }
  await prisma.exercise.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true, deleted: false, deactivated: true });
}
