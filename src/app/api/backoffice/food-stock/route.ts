import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { MAX_STOCK_QTY, expiryLabel, isStockUnit, stockFlags } from "@/lib/foodStock";

export const dynamic = "force-dynamic";

/**
 * คลังอาหารรายคน (ฝั่งแอดมิน)
 *
 * GET    ?memberId=... | ?lineUserId=...   → รายการทั้งหมดของคนนั้น (รวมที่หมดแล้ว)
 * POST   { memberId|lineUserId, items:[{foodId, quantity, unit, expiresAt?}] }
 * PATCH  { id, remaining?|addQuantity?, unit?, expiresAt?|clearExpiry? }
 * DELETE ?id=...
 *
 * 🔴 หลังบ้านเท่านั้น (requireStaff) — นี่คือของที่ลูกค้าจ่ายเงินมาแล้ว
 * 🔴 เพิ่มได้เฉพาะเมนูของครัวที่ยังเปิดขาย (Food.isActive) เท่านั้น
 */

async function resolveMemberId(params: { memberId?: string | null; lineUserId?: string | null }) {
  const { memberId, lineUserId } = params;
  if (memberId) return memberId;
  if (!lineUserId) return null;
  const m = await prisma.member.findUnique({ where: { lineUserId }, select: { id: true } });
  return m?.id ?? null;
}

const shape = (r: {
  id: string; name: string; imageUrl: string | null; unit: string; quantity: number; remaining: number;
  expiresAt: Date | null; calories: number; protein: number; addedBy: string | null; createdAt: Date; foodId: string;
}) => ({
  ...r,
  ...stockFlags(r),
  expiryText: expiryLabel(r.expiresAt),
});

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const p = new URL(req.url).searchParams;
  const memberId = await resolveMemberId({ memberId: p.get("memberId"), lineUserId: p.get("lineUserId") });
  if (!memberId) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  const rows = await prisma.memberFoodStock.findMany({
    where: { memberId },
    orderBy: [{ remaining: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, foodId: true, name: true, imageUrl: true, unit: true, quantity: true, remaining: true,
      expiresAt: true, calories: true, protein: true, addedBy: true, createdAt: true,
    },
  });

  return NextResponse.json({ memberId, items: rows.map(shape) });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => ({}))) as {
    memberId?: string; lineUserId?: string;
    items?: { foodId?: string; quantity?: number; unit?: string; expiresAt?: string | null; note?: string }[];
  };

  const memberId = await resolveMemberId({ memberId: body.memberId, lineUserId: body.lineUserId });
  if (!memberId) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  const items = (body.items ?? []).filter((i) => i?.foodId);
  if (items.length === 0) return NextResponse.json({ error: "ยังไม่ได้เลือกเมนู" }, { status: 400 });

  const foods = await prisma.food.findMany({
    where: { id: { in: items.map((i) => i.foodId!) }, isActive: true },
    select: {
      id: true, name: true, imageUrl: true, calories: true, protein: true, carbs: true, fat: true,
      sodium: true, sugar: true,
    },
  });
  const byId = new Map(foods.map((f) => [f.id, f]));

  const staffName = (staff as { name?: string; email?: string }).name || (staff as { email?: string }).email || "แอดมิน";
  const created: string[] = [];

  for (const it of items) {
    const food = byId.get(it.foodId!);
    // เมนูถูกปิด/ลบไปแล้ว = บอกตรง ๆ ว่าเมนูไหน ไม่ใช่เงียบแล้วเพิ่มไม่ครบ
    if (!food) return NextResponse.json({ error: "มีเมนูที่ปิดขายหรือถูกลบไปแล้ว — รีเฟรชแล้วเลือกใหม่" }, { status: 400 });

    const qty = Math.round(Number(it.quantity) || 0);
    if (qty < 1 || qty > MAX_STOCK_QTY) {
      return NextResponse.json({ error: `จำนวนของ "${food.name}" ต้องอยู่ระหว่าง 1–${MAX_STOCK_QTY}` }, { status: 400 });
    }
    if (it.unit && !isStockUnit(it.unit)) {
      return NextResponse.json({ error: "หน่วยนับไม่ถูกต้อง" }, { status: 400 });
    }
    const expiresAt = it.expiresAt ? new Date(it.expiresAt) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "วันหมดอายุไม่ถูกต้อง" }, { status: 400 });
    }

    const row = await prisma.memberFoodStock.create({
      data: {
        memberId,
        foodId: food.id,
        // สำเนาไว้ ณ ตอนเพิ่ม — ครัวแก้สูตรทีหลังไม่กระทบของที่ลูกค้าถืออยู่
        name: food.name,
        imageUrl: food.imageUrl,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        sodium: food.sodium,
        sugar: food.sugar,
        unit: it.unit && isStockUnit(it.unit) ? it.unit : "กล่อง",
        quantity: qty,
        remaining: qty,
        expiresAt,
        note: it.note?.slice(0, 200) || null,
        addedBy: staffName,
      },
      select: { id: true },
    });
    created.push(row.id);
  }

  return NextResponse.json({ ok: true, created: created.length });
}

export async function PATCH(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string; remaining?: number; addQuantity?: number; unit?: string; expiresAt?: string | null; clearExpiry?: boolean;
  };
  if (!body.id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  const cur = await prisma.memberFoodStock.findUnique({ where: { id: body.id } });
  if (!cur) return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (body.addQuantity !== undefined) {
    // "เติมของ" — เพิ่มทั้งยอดรวมและคงเหลือ (ประวัติจึงยังบอกได้ว่าเคยให้ไปทั้งหมดเท่าไร)
    const add = Math.round(Number(body.addQuantity) || 0);
    if (add < 1 || add > MAX_STOCK_QTY) {
      return NextResponse.json({ error: `จำนวนที่เติมต้องอยู่ระหว่าง 1–${MAX_STOCK_QTY}` }, { status: 400 });
    }
    data.quantity = cur.quantity + add;
    data.remaining = cur.remaining + add;
  } else if (body.remaining !== undefined) {
    const rem = Math.round(Number(body.remaining));
    if (!Number.isFinite(rem) || rem < 0 || rem > cur.quantity + MAX_STOCK_QTY) {
      return NextResponse.json({ error: "จำนวนคงเหลือไม่ถูกต้อง" }, { status: 400 });
    }
    data.remaining = rem;
  }

  if (body.unit !== undefined) {
    if (!isStockUnit(body.unit)) return NextResponse.json({ error: "หน่วยนับไม่ถูกต้อง" }, { status: 400 });
    data.unit = body.unit;
  }
  if (body.clearExpiry) data.expiresAt = null;
  else if (body.expiresAt !== undefined && body.expiresAt !== null) {
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "วันหมดอายุไม่ถูกต้อง" }, { status: 400 });
    data.expiresAt = d;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "ไม่มีอะไรให้แก้" }, { status: 400 });

  const row = await prisma.memberFoodStock.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true, item: shape(row) });
}

export async function DELETE(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  /* บันทึกที่เคยตัดจากใบนี้ให้ stockId เป็น null (schema ตั้ง SetNull ไว้)
     — ประวัติการกินของลูกค้าต้องไม่หายไปเพราะแอดมินลบใบสต๊อก */
  await prisma.memberFoodStock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
