import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { IngredientPayload, validateIngredient } from "../route";

export const dynamic = "force-dynamic";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบวัตถุดิบนี้" }, { status: 404 });

  const body = (await req.json()) as IngredientPayload;
  const merged = { ...existing, ...body } as IngredientPayload;
  const err = validateIngredient(merged);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  if (body.name && body.name.trim() !== existing.name) {
    const dup = await prisma.ingredient.findUnique({ where: { name: body.name.trim() } });
    if (dup) return NextResponse.json({ error: `มี "${body.name.trim()}" ในคลังอยู่แล้ว` }, { status: 409 });
  }

  const item = await prisma.ingredient.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? existing.name,
      unit: body.unit ?? existing.unit,
      gramsPerPiece: body.gramsPerPiece !== undefined ? num(body.gramsPerPiece) : existing.gramsPerPiece,
      calories: num(merged.calories)!,
      protein: num(merged.protein)!,
      carbs: num(merged.carbs)!,
      fat: num(merged.fat)!,
      fiber: body.fiber !== undefined ? num(body.fiber) : existing.fiber,
      sodium: body.sodium !== undefined ? num(body.sodium) : existing.sodium,
      sugar: body.sugar !== undefined ? num(body.sugar) : existing.sugar,
      defaultRole: body.defaultRole ?? existing.defaultRole,
      stepGrams: Math.round(num(body.stepGrams) ?? existing.stepGrams),
      // แก้ตัวเลขเองแล้ว = ครัวยืนยันแล้ว ไม่ใช่ค่าประมาณอีกต่อไป (ยกเว้นสั่งมาตรง ๆ)
      isEstimate: body.isEstimate ?? false,
      source: body.source !== undefined ? body.source?.trim() || null : existing.source,
      isActive: body.isActive ?? existing.isActive,
    },
  });
  return NextResponse.json({ item });
}

/**
 * ลบวัตถุดิบ — 🔴 ถ้ายังมีสูตรใช้อยู่ ห้ามลบเด็ดขาด
 * (FK เป็น Restrict อยู่แล้ว แต่ต้องตอบเป็นภาษาคนว่าติดที่เมนูไหน ไม่ใช่โยน error ของ DB)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const used = await prisma.recipeItem.findMany({
    where: { ingredientId: id },
    select: { food: { select: { name: true } } },
    take: 5,
  });
  if (used.length > 0) {
    const names = used.map((u) => u.food.name).join(", ");
    return NextResponse.json(
      { error: `ลบไม่ได้ — ยังมีสูตรใช้อยู่: ${names}${used.length === 5 ? " และอื่น ๆ" : ""} · ถ้าเลิกใช้ให้ปิดการใช้งานแทน` },
      { status: 409 },
    );
  }

  await prisma.ingredient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
