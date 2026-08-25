import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { ROLES } from "@/lib/recipe";
import { ALLERGEN_OPTIONS, BOWL_STEP_KEYS } from "@/lib/bowl";
import { isBase64Image, uploadToBunny } from "@/lib/bunny";

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
  // ── ฝั่งจอสั่งอาหารในแอป ──
  nameEn?: string | null;
  displayName?: string | null;
  /// รับได้ทั้ง URL เดิม และ data:image/... (จะอัปโหลดลงดิสก์ให้เอง)
  imageUrl?: string | null;
  bowlStep?: string | null;
  portionSize?: number | null;
  portionPrice?: number | null;
  allergens?: string[];
  sortOrder?: number | null;
  soldOut?: boolean;
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

  // ── ฝั่งจอสั่งอาหาร: ถ้าจะให้ลูกค้าเลือกได้ ต้องมีครบทั้งขั้น รูป และปริมาณต่อที่ ──
  if (b.bowlStep !== undefined && b.bowlStep !== null && b.bowlStep !== "") {
    if (!(BOWL_STEP_KEYS as readonly string[]).includes(b.bowlStep)) return "ขั้นในจอสั่งอาหารไม่ถูกต้อง";
    const portion = num(b.portionSize);
    if (!partial && !portion) return "วัตถุดิบที่ให้ลูกค้าเลือกเองต้องระบุปริมาณต่อ 1 ที่ ไม่งั้นคิดแคลอรี่กับราคาไม่ได้";
    if (portion !== null && portion <= 0) return "ปริมาณต่อ 1 ที่ ต้องมากกว่า 0";
  }
  const portion = num(b.portionSize);
  if (portion !== null && portion > 1000) return "ปริมาณต่อ 1 ที่ ดูมากผิดปกติ (เกิน 1000) — ตรวจหน่วยอีกที";
  const price = num(b.portionPrice);
  if (price !== null && (price < 0 || price > 5000)) return "ราคาต่อ 1 ที่ ต้องอยู่ระหว่าง 0–5000 บาท";
  if (b.allergens !== undefined && !Array.isArray(b.allergens)) return "สารก่อภูมิแพ้ต้องเป็นรายการ";
  return null;
}

/** รับได้ทั้ง URL เดิมและ data URL — ถ้าเป็น base64 จะเซฟลงดิสก์แล้วคืน path สาธารณะ */
export async function resolveIngredientImage(raw: string | null | undefined): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (!raw) return null;
  if (!isBase64Image(raw)) return raw;
  return uploadToBunny(raw, "ingredients", "ingredient.jpg");
}

const cleanAllergens = (list: string[] | undefined): string[] | undefined => {
  if (!list) return undefined;
  const valid = new Set(ALLERGEN_OPTIONS.map((a) => a.value));
  return [...new Set(list.map((a) => String(a).trim()).filter((a) => valid.has(a)))];
};

export { cleanAllergens };

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const all = searchParams.get("all") === "1";
  const step = searchParams.get("step")?.trim();

  const stepFilter =
    step === "none"
      ? { bowlStep: null }
      : step && (BOWL_STEP_KEYS as readonly string[]).includes(step)
        ? { bowlStep: step }
        : {};

  const items = await prisma.ingredient.findMany({
    where: {
      ...(all ? {} : { isActive: true }),
      ...stepFilter,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { nameEn: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ bowlStep: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: 400,
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
      nameEn: body.nameEn?.trim() || null,
      displayName: body.displayName?.trim() || null,
      imageUrl: (await resolveIngredientImage(body.imageUrl)) ?? null,
      bowlStep: body.bowlStep || null,
      portionSize: num(body.portionSize),
      portionPrice: Math.round(num(body.portionPrice) ?? 0),
      allergens: cleanAllergens(body.allergens) ?? [],
      sortOrder: Math.round(num(body.sortOrder) ?? 0),
      soldOut: body.soldOut ?? false,
      soldOutAt: body.soldOut ? new Date() : null,
    },
  });
  return NextResponse.json({ item: created }, { status: 201 });
}
