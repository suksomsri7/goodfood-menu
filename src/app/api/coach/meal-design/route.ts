import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import {
  DESIGN_DAYS, MENU_REQUIREMENT, buildDesign, dislikedFoodIds,
  filterFoodsForProfile, loadFoodProfile, menuAvailability, adjustTargetForHealth,
} from "@/lib/mealDesign";
import { serializeDesign } from "@/lib/mealDesignView";

export const dynamic = "force-dynamic";

/**
 * ออกแบบมื้ออาหารผูกปิ่นโต
 *
 * GET  → { menuReady, foodCount, packages[], latest }  ข้อมูลไว้เปิดหน้า "ออกแบบมื้ออาหาร"
 * POST { days: 7|14|30 } → จัดแผนใหม่ 1 ชุด (status=draft) พร้อมสรุปรายวัน
 *
 * 🔴 ไม่เรียก AI — deterministic ล้วน (จัดซ้ำได้ผลเดิม · ตรวจย้อนหลังได้ว่าทำไมได้เมนูนี้)
 */

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ count, packages }, profileRow, latest] = await Promise.all([
    menuAvailability(),
    prisma.foodProfile.findUnique({ where: { memberId: member.id }, select: { id: true } }),
    prisma.mealPlanDesign.findFirst({
      where: { memberId: member.id, status: "draft" },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: [{ dayNumber: "asc" }, { id: "asc" }] } },
    }),
  ]);

  const res = NextResponse.json({
    // เมนูน้อยเกินจัดแม้แพ็กเกจสั้นสุด = ยังไม่เปิดบริการ (แอปต้องบอกตรง ๆ ไม่ใช่โชว์หน้าเปล่า)
    menuReady: count >= MENU_REQUIREMENT[DESIGN_DAYS[0]].min,
    foodCount: count,
    packages,
    surveyDone: !!profileRow,
    latest: latest ? serializeDesign(latest) : null,
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const days = Number(body.days);
    if (!DESIGN_DAYS.includes(days as any)) {
      return NextResponse.json({ error: "days ต้องเป็น 7, 14 หรือ 30" }, { status: 400 });
    }

    const [{ foods }, profile, disliked] = await Promise.all([
      menuAvailability(),
      loadFoodProfile(member.id),
      dislikedFoodIds(member.id),
    ]);

    const req_ = MENU_REQUIREMENT[days];
    const usable = filterFoodsForProfile({
      foods, profile, dislikedFoodIds: disliked, needAtLeast: req_.min,
    });
    if (usable.foods.length < req_.min) {
      return NextResponse.json({
        error: "เมนูที่กินได้ยังไม่พอสำหรับแพ็กเกจนี้",
        detail: {
          usable: usable.foods.length, need: req_.min,
          droppedAvoid: usable.droppedAvoid, droppedDisliked: usable.droppedDisliked,
        },
      }, { status: 409 });
    }

    const target = adjustTargetForHealth({
      targetKcal: member.dailyCalories ?? 1800,
      protein: member.dailyProtein ?? 90,
      carbs: member.dailyCarbs ?? 200,
      fat: member.dailyFat ?? 60,
      sodium: member.dailySodium ?? 2300,
      sugar: member.dailySugar ?? 50,
    }, profile.healthConditions);

    const built = buildDesign({ memberId: member.id, days, foods: usable.foods, target, profile });
    if (built.items.length === 0) {
      return NextResponse.json({ error: "จัดแผนไม่สำเร็จ", warnings: built.warnings }, { status: 409 });
    }

    // แผน draft เดิมที่ยังไม่ได้สั่ง = ยกเลิกทิ้ง (ให้มี draft ค้างได้ทีละชุดเท่านั้น กันสับสน)
    await prisma.mealPlanDesign.updateMany({
      where: { memberId: member.id, status: "draft" },
      data: { status: "cancelled" },
    });

    const design = await prisma.mealPlanDesign.create({
      data: {
        memberId: member.id, days, targetKcal: target.targetKcal,
        totalPrice: built.totalPrice, offTargetDays: built.offTargetDays,
        items: { create: built.items },
      },
      include: { items: { orderBy: [{ dayNumber: "asc" }, { id: "asc" }] } },
    });

    if (usable.cuisineNarrowed) built.warnings.push("จัดจากประเภทอาหารที่เลือกไว้เป็นหลัก");
    return NextResponse.json({ ...serializeDesign(design), warnings: built.warnings });
  } catch (e: any) {
    console.error("[coach/meal-design]", e);
    return NextResponse.json({ error: "design failed" }, { status: 500 });
  }
}
