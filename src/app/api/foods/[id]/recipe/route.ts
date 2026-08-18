import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { ROLES, personalize, recipeNutrition, rowsToLines } from "@/lib/recipe";

export const dynamic = "force-dynamic";

/**
 * สูตรมาตรฐานของเมนูหนึ่งกล่อง
 *
 * 🔴 บันทึกสูตรแล้ว = โภชนาการของเมนูถูกคำนวณใหม่จากสูตรทันที (เขียนทับค่าที่เคยกรอกมือ)
 *    เพราะถ้าปล่อยให้สองที่ไม่ตรงกัน ครัวจะไม่รู้ว่าจะเชื่ออันไหน
 *    ลบสูตรจนหมด = ปล่อยตัวเลขเดิมไว้ (ไม่ล้างเป็น 0 — เมนูจะกลายเป็นกล่องเปล่าทันที)
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const food = await prisma.food.findUnique({
    where: { id },
    select: {
      id: true, name: true, calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true,
      recipe: { include: { ingredient: true }, orderBy: { order: "asc" } },
    },
  });
  if (!food) return NextResponse.json({ error: "ไม่พบเมนูนี้" }, { status: 404 });

  const lines = rowsToLines(food.recipe);
  return NextResponse.json({
    food: { id: food.id, name: food.name },
    items: food.recipe.map((r) => ({
      ingredientId: r.ingredientId,
      name: r.ingredient.name,
      unit: r.ingredient.unit,
      role: r.role,
      baseAmount: r.baseAmount,
      scalable: r.scalable,
      minAmount: r.minAmount,
      maxAmount: r.maxAmount,
      note: r.note,
      order: r.order,
    })),
    /** โภชนาการที่คิดได้จากสูตร — ว่างเมื่อยังไม่มีสูตร */
    computed: lines.length > 0 ? recipeNutrition(lines) : null,
    /** ค่าที่บันทึกอยู่บนเมนูตอนนี้ (ไว้ให้เห็นว่าต่างจากสูตรแค่ไหน) */
    stored: {
      kcal: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat,
      fiber: food.fiber, sodium: food.sodium, sugar: food.sugar,
    },
    /** ตัวอย่างจานของคนกินน้อย/ปานกลาง/เยอะ — ให้ครัวเห็นผลของสูตรทันทีโดยไม่ต้องรอลูกค้าจริง */
    preview:
      lines.length > 0
        ? [
            { label: "คุมแคลอรี่ (350 kcal · P30)", plan: personalize(lines, { kcal: 350, protein: 30, fat: 10, fiber: 6 }) },
            { label: "ปานกลาง (500 kcal · P40)", plan: personalize(lines, { kcal: 500, protein: 40, fat: 15, fiber: 8 }) },
            { label: "กินเยอะ (700 kcal · P55)", plan: personalize(lines, { kcal: 700, protein: 55, fat: 22, fiber: 10 }) },
          ]
        : [],
  });
}

interface IncomingItem {
  ingredientId: string;
  role: string;
  baseAmount: number | string;
  scalable?: boolean;
  minAmount?: number | string | null;
  maxAmount?: number | string | null;
  note?: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { id } = await params;
  const food = await prisma.food.findUnique({ where: { id }, select: { id: true } });
  if (!food) return NextResponse.json({ error: "ไม่พบเมนูนี้" }, { status: 404 });

  const body = (await req.json()) as { items?: IncomingItem[] };
  const incoming = body.items ?? [];

  // ── ตรวจก่อนแตะ DB ──
  const seen = new Set<string>();
  for (const it of incoming) {
    if (!it.ingredientId) return NextResponse.json({ error: "มีบรรทัดที่ยังไม่ได้เลือกวัตถุดิบ" }, { status: 400 });
    if (seen.has(it.ingredientId)) return NextResponse.json({ error: "มีวัตถุดิบซ้ำกันในสูตร — รวมเป็นบรรทัดเดียว" }, { status: 400 });
    seen.add(it.ingredientId);

    if (!(ROLES as readonly string[]).includes(it.role)) return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });

    const base = num(it.baseAmount);
    if (base === null || base <= 0) return NextResponse.json({ error: "ปริมาณมาตรฐานต้องมากกว่า 0" }, { status: 400 });

    const min = num(it.minAmount);
    const max = num(it.maxAmount);
    if (min !== null && min < 0) return NextResponse.json({ error: "ขั้นต่ำติดลบไม่ได้" }, { status: 400 });
    if (min !== null && max !== null && min > max) return NextResponse.json({ error: "ขั้นต่ำมากกว่าขั้นสูงไม่ได้" }, { status: 400 });
    // ขอบเขตที่ไม่ครอบค่ามาตรฐาน = สูตรขัดกับตัวเอง (กล่องมาตรฐานจะออกมาผิดตั้งแต่กล่องแรก)
    if (min !== null && base < min) return NextResponse.json({ error: "ปริมาณมาตรฐานต่ำกว่าขั้นต่ำที่กำหนด" }, { status: 400 });
    if (max !== null && base > max) return NextResponse.json({ error: "ปริมาณมาตรฐานสูงกว่าขั้นสูงที่กำหนด" }, { status: 400 });
  }

  const ids = [...seen];
  if (ids.length > 0) {
    const found = await prisma.ingredient.count({ where: { id: { in: ids } } });
    if (found !== ids.length) return NextResponse.json({ error: "มีวัตถุดิบที่ถูกลบไปแล้วอยู่ในสูตร — โหลดหน้าใหม่" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { foodId: id } }),
    ...(incoming.length > 0
      ? [
          prisma.recipeItem.createMany({
            data: incoming.map((it, i) => ({
              foodId: id,
              ingredientId: it.ingredientId,
              role: it.role,
              baseAmount: num(it.baseAmount)!,
              scalable: it.scalable ?? true,
              minAmount: num(it.minAmount),
              maxAmount: num(it.maxAmount),
              note: it.note?.trim() || null,
              order: i,
            })),
          }),
        ]
      : []),
  ]);

  // ── โภชนาการของเมนู = ผลรวมสูตร ──
  const saved = await prisma.recipeItem.findMany({ where: { foodId: id }, include: { ingredient: true }, orderBy: { order: "asc" } });
  let computed = null;
  if (saved.length > 0) {
    computed = recipeNutrition(rowsToLines(saved));
    await prisma.food.update({
      where: { id },
      data: {
        calories: computed.kcal,
        protein: computed.protein,
        carbs: computed.carbs,
        fat: computed.fat,
        fiber: computed.fiber,
        sodium: computed.sodium,
        sugar: computed.sugar,
        ingredients: saved.map((s) => `${s.ingredient.name} ${s.baseAmount}${s.ingredient.unit === "pc" ? " ชิ้น" : s.ingredient.unit === "ml" ? " มล." : " ก."}`),
      },
    });
  }

  return NextResponse.json({ ok: true, count: saved.length, computed });
}
