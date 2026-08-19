import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { uploadToBunny } from "@/lib/bunny";
import { generateFoodImage } from "@/lib/foodImage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * ปุ่ม "สร้างรูปด้วย AI" ในหน้าแก้เมนู — ใช้ตอนครัวยังไม่ได้ถ่ายรูปจริง
 * รูปที่ได้ติดธง imageIsAi=true เสมอ (ทุกที่ที่โชว์ต้องขึ้นป้าย "ภาพตัวอย่าง")
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const food = await prisma.food.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, ingredients: true, calories: true, imageUrl: true, imageIsAi: true,
      category: { select: { name: true } },
    },
  });
  if (!food) return NextResponse.json({ error: "ไม่พบเมนูนี้" }, { status: 404 });

  // กันทับรูปถ่ายจริงของครัวโดยไม่ตั้งใจ — ต้องส่ง force มาเท่านั้น
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (food.imageUrl && !food.imageIsAi && !force) {
    return NextResponse.json({ error: "เมนูนี้มีรูปถ่ายจริงอยู่แล้ว — ถ้าจะทับต้องยืนยัน" }, { status: 409 });
  }

  try {
    const { dataUrl, model } = await generateFoodImage({
      name: food.name,
      description: food.description,
      ingredients: food.ingredients,
      calories: food.calories,
      categoryName: food.category?.name ?? null,
    });
    const url = await uploadToBunny(dataUrl, "foods", `${food.id}-ai.png`);
    await prisma.food.update({ where: { id: food.id }, data: { imageUrl: url, imageIsAi: true } });
    return NextResponse.json({ ok: true, imageUrl: url, model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "สร้างรูปไม่สำเร็จ" }, { status: 502 });
  }
}
