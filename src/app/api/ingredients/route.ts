import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { ROLES } from "@/lib/recipe";

export const dynamic = "force-dynamic";

/**
 * คลังวัตถุดิบ — โภชนาการต่อ 100 ก./มล.
 *
 * 🔴 บังคับ requireStaff เหมือน /api/program/* — ตัวเลขในนี้คือสูตรของร้าน
 * 🔴 ค่าที่รับต้องเป็น "ต่อ 100 หน่วย" เสมอ ไม่ใช่ต่อหน่วยบริโภค
 *    ถ้ากรอกผิดฐาน อาหารทุกกล่องที่ใช้วัตถุดิบตัวนี้จะเพี้ยนพร้อมกันทั้งหมด
 */

export interface IngredientPayload {
  name?: string;
  unit?: string;
  gramsPerPiece?: number | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number | null;
  sodium?: number | null;
  sugar?: number | null;
  defaultRole?: string;
  stepGrams?: number;
  isEstimate?: boolean;
  source?: string | null;
  isActive?: boolean;
}

const UNITS = ["g", "ml", "pc"];

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** ตรวจก่อนเขียน — คืนข้อความไทยที่บอกตรง ๆ ว่าช่องไหนผิด (ไม่ใช่ "invalid input") */
export function validateIngredient(b: IngredientPayload, { partial = false } = {}): string | null {
  const need = (v: unknown) => !partial || v !== undefined;

  if (need(b.name) && !b.name?.trim()) return "ต้องมีชื่อวัตถุดิบ";
  if (b.unit !== undefined && !UNITS.includes(b.unit)) return "หน่วยต้องเป็น g / ml / pc เท่านั้น";
  if (b.unit === "pc" && !(num(b.gramsPerPiece) ?? 0)) return "หน่วยนับชิ้นต้องระบุน้ำหนักต่อชิ้น (กรัม) ไม่งั้นคิดโภชนาการไม่ได้";

  for (const [key, label] of [["calories", "แคลอรี่"], ["protein", "โปรตีน"], ["carbs", "คาร์บ"], ["fat", "ไขมัน"]] as const) {
    const v = num(b[key]);
    if (need(b[key]) && v === null) return `ต้องกรอก${label}ต่อ 100 หน่วย`;
    if (v !== null && v < 0) return `${label}ติดลบไม่ได้`;
  }
  for (const [key, label] of [["fiber", "ไฟเบอร์"], ["sodium", "โซเดียม"], ["sugar", "น้ำตาล"]] as const) {
    const v = num(b[key]);
    if (v !== null && v < 0) return `${label}ติดลบไม่ได้`;
  }
  if (b.defaultRole !== undefined && !(ROLES as readonly string[]).includes(b.defaultRole)) return "บทบาทไม่ถูกต้อง";

  const step = num(b.stepGrams);
  if (step !== null && (step < 1 || step > 100)) return "ขั้นการชั่งต้องอยู่ระหว่าง 1–100";

  /*
   * กันกรอกผิดฐาน: ถ้าใส่ตัวเลขของ "ทั้งจาน" แทน "ต่อ 100 ก." แคลอรี่จะทะลุ 900
   * (ไขมันบริสุทธิ์ = 884 kcal/100 ก. คือเพดานธรรมชาติ ไม่มีอาหารไหนเกินนี้)
   */
  const kcal = num(b.calories);
  if (kcal !== null && kcal > 900) return "แคลอรี่ต่อ 100 ก. เกิน 900 — น่าจะกรอกค่าของทั้งจานมา ให้หารกลับเป็นต่อ 100 ก. ก่อน";
  for (const [key, label] of [["protein", "โปรตีน"], ["carbs", "คาร์บ"], ["fat", "ไขมัน"]] as const) {
    const v = num(b[key]);
    if (v !== null && v > 100) return `${label}ต่อ 100 ก. เกิน 100 ก. ไม่ได้`;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const all = searchParams.get("all") === "1";

  const items = await prisma.ingredient.findMany({
    where: {
      ...(all ? {} : { isActive: true }),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: 300,
  });

  // เอาไว้เตือนตอนจะลบ — วัตถุดิบที่ถูกใช้ในสูตรอยู่ ลบแล้วสูตรพัง
  const used = await prisma.recipeItem.groupBy({ by: ["ingredientId"], _count: { _all: true } });
  const useMap = new Map(used.map((u) => [u.ingredientId, u._count._all]));

  return NextResponse.json({
    items: items.map((i) => ({ ...i, usedIn: useMap.get(i.id) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json()) as IngredientPayload;
  const err = validateIngredient(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const name = body.name!.trim();
  const dup = await prisma.ingredient.findUnique({ where: { name } });
  if (dup) return NextResponse.json({ error: `มี "${name}" ในคลังอยู่แล้ว` }, { status: 409 });

  const created = await prisma.ingredient.create({
    data: {
      name,
      unit: body.unit || "g",
      gramsPerPiece: num(body.gramsPerPiece),
      calories: num(body.calories)!,
      protein: num(body.protein)!,
      carbs: num(body.carbs)!,
      fat: num(body.fat)!,
      fiber: num(body.fiber),
      sodium: num(body.sodium),
      sugar: num(body.sugar),
      defaultRole: body.defaultRole || "other",
      stepGrams: Math.round(num(body.stepGrams) ?? 10),
      isEstimate: body.isEstimate ?? true,
      source: body.source?.trim() || null,
    },
  });
  return NextResponse.json({ item: created }, { status: 201 });
}
