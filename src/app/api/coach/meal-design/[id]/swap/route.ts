import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { effectivePrice, foodAvoidHit, loadGoodfoodMenu, type PickableFood } from "@/lib/goodfoodMealPicker";
import { dislikedFoodIds, loadFoodProfile, profileAvoidKeywords } from "@/lib/mealDesign";
import { serializeDesign } from "@/lib/mealDesignView";

export const dynamic = "force-dynamic";

/**
 * เปลี่ยนเมนู 1 มื้อในแผน
 * POST /api/coach/meal-design/{id}/swap
 *   { itemId, reason: "dislike"|"bored"|"variety", toFoodId? }
 *
 * 🔴 ต้องมี reason เสมอ — "เบื่อ" กับ "ไม่ชอบ" คนละเรื่องกัน
 *    ถ้านับรวมกันหมด ระบบจะตัดเมนูที่ลูกค้าชอบทิ้งเพราะเพิ่งกินไปเมื่อวาน
 *    เฉพาะ dislike เท่านั้นที่ถูกตัดถาวรจากแผนครั้งต่อ ๆ ไป
 *
 * ไม่ส่ง toFoodId = ให้ระบบเลือกตัวแทนที่ "มาโครใกล้ที่สุด" ให้เอง
 */

const REASONS = ["dislike", "bored", "variety"];

/** ความต่างของมาโครแบบถ่วงน้ำหนัก — แคลอรี่กับโปรตีนสำคัญกว่าคาร์บ/ไขมัน */
function macroDistance(a: { calories: number; protein: number; carbs: number; fat: number },
                       b: { calories: number; protein: number; carbs: number; fat: number }) {
  return (
    Math.abs(a.calories - b.calories) / Math.max(1, b.calories) * 3 +
    Math.abs(a.protein - b.protein) / Math.max(1, b.protein) * 2 +
    Math.abs(a.carbs - b.carbs) / Math.max(1, b.carbs) +
    Math.abs(a.fat - b.fat) / Math.max(1, b.fat)
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = REASONS.includes(body.reason) ? body.reason : "dislike";

    const design = await prisma.mealPlanDesign.findFirst({
      where: { id, memberId: member.id },
      include: { items: { orderBy: [{ dayNumber: "asc" }, { id: "asc" }] } },
    });
    if (!design) return NextResponse.json({ error: "not found" }, { status: 404 });
    // สั่งไปแล้วห้ามแก้ — ไม่งั้นสิ่งที่ครัวเห็นกับที่ลูกค้าเห็นจะไม่ตรงกัน
    if (design.status !== "draft") {
      return NextResponse.json({ error: "แผนนี้สั่งไปแล้ว แก้ไม่ได้" }, { status: 409 });
    }

    const item = design.items.find((i) => i.id === body.itemId);
    if (!item) return NextResponse.json({ error: "ไม่พบมื้อที่ต้องการเปลี่ยน" }, { status: 404 });

    const [menu, profile, disliked] = await Promise.all([
      loadGoodfoodMenu(),
      loadFoodProfile(member.id),
      dislikedFoodIds(member.id),
    ]);
    const avoid = profileAvoidKeywords(profile);

    // เมนูที่ใช้ในวันเดียวกันอยู่แล้ว — ห้ามซ้ำในวันเดียว
    const sameDay = new Set(design.items.filter((i) => i.dayNumber === item.dayNumber).map((i) => i.foodId));

    let pool: PickableFood[] = menu.filter((f) =>
      f.id !== item.foodId &&
      !sameDay.has(f.id) &&
      !disliked.has(f.id) &&
      foodAvoidHit(f, avoid) === null
    );
    // กันตันเมื่อกรองจนไม่เหลือ — ยอมให้ซ้ำกับของไม่ชอบดีกว่าเปลี่ยนไม่ได้เลย
    if (pool.length === 0) {
      pool = menu.filter((f) => f.id !== item.foodId && foodAvoidHit(f, avoid) === null);
    }
    if (pool.length === 0) {
      return NextResponse.json({ error: "ไม่มีเมนูอื่นให้เปลี่ยนแล้ว" }, { status: 409 });
    }

    let next: PickableFood | undefined;
    if (typeof body.toFoodId === "string") {
      next = pool.find((f) => f.id === body.toFoodId);
      if (!next) return NextResponse.json({ error: "เมนูที่เลือกใช้ไม่ได้" }, { status: 400 });
    } else {
      next = [...pool].sort((a, b) => macroDistance(a, item) - macroDistance(b, item))[0];
    }

    const price = effectivePrice(next);
    const [updatedItem] = await prisma.$transaction([
      prisma.mealPlanDesignItem.update({
        where: { id: item.id },
        data: {
          foodId: next.id, foodName: next.name, imageUrl: next.imageUrl,
          price, servings: 1,
          calories: next.calories, protein: next.protein, carbs: next.carbs, fat: next.fat,
          sodium: next.sodium, sugar: next.sugar,
          swapCount: { increment: 1 },
        },
      }),
      prisma.mealSwap.create({
        data: {
          memberId: member.id, designId: design.id,
          dayNumber: item.dayNumber, slot: item.slot,
          fromFoodId: item.foodId, fromName: item.foodName,
          toFoodId: next.id, toName: next.name, reason,
        },
      }),
    ]);

    // ราคารวมเปลี่ยนตามเมนูจริง (user เคาะ: คิดตามเมนูที่เลือก ไม่ใช่เหมาแพ็กเกจ)
    const fresh = await prisma.mealPlanDesign.findUniqueOrThrow({
      where: { id: design.id },
      include: { items: { orderBy: [{ dayNumber: "asc" }, { id: "asc" }] } },
    });
    const total = fresh.items.reduce((a, i) => a + i.price * i.servings, 0);
    const saved = await prisma.mealPlanDesign.update({
      where: { id: design.id },
      data: { totalPrice: total },
      include: { items: { orderBy: [{ dayNumber: "asc" }, { id: "asc" }] } },
    });

    return NextResponse.json({
      ok: true,
      changed: { itemId: updatedItem.id, from: item.foodName, to: next.name, reason },
      ...serializeDesign(saved),
    });
  } catch (e: any) {
    console.error("[coach/meal-design/swap]", e);
    return NextResponse.json({ error: "swap failed" }, { status: 500 });
  }
}
