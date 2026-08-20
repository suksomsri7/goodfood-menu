import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { exerciseFields, resolveImages } from "@/lib/exerciseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const items = await prisma.exercise.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const b = await req.json();
  const f = exerciseFields(b);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });

  // key ของท่าที่แอดมินเพิ่ม: สร้างจากเวลา — ไม่ชนกับ key มาตรฐานของคลังโค้ด
  const key = `custom_${Date.now().toString(36)}`;
  const images = await resolveImages(b.images);
  const item = await prisma.exercise.create({ data: { ...f.data, key, images, isCustom: true } });
  return NextResponse.json({ ok: true, item });
}
