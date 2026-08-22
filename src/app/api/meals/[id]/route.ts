import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trustedMember } from "@/lib/memberAuth";
import { readStaff } from "@/lib/staffAuth";

/**
 * 🔴 22 ส.ค. 69: เดิม 2 เส้นนี้ลบ/แก้ mealLog จาก id ล้วน ไม่เช็คว่าเป็นของใคร
 *    = ใครยิงก็ลบบันทึกอาหารของคนอื่นได้ · ตอนนี้ต้องเป็นเจ้าของ (หรือพนักงานหลังบ้าน)
 */
async function ownsMeal(req: NextRequest, mealId: string): Promise<boolean> {
  const meal = await prisma.mealLog.findUnique({ where: { id: mealId }, select: { memberId: true } });
  if (!meal) return false;
  const member = await trustedMember(req);
  if (member && member.id === meal.memberId) return true;
  return !!(await readStaff(req));
}

// DELETE - Delete a meal log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!(await ownsMeal(request, id))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await prisma.mealLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete meal:", error);
    return NextResponse.json(
      { error: "Failed to delete meal" },
      { status: 500 }
    );
  }
}

// PATCH - Update a meal log
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!(await ownsMeal(request, id))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    // ห้ามให้ client ย้ายบันทึกไปเป็นของคนอื่น หรือแก้ id
    delete body.memberId;
    delete body.id;

    const meal = await prisma.mealLog.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(meal);
  } catch (error) {
    console.error("Failed to update meal:", error);
    return NextResponse.json(
      { error: "Failed to update meal" },
      { status: 500 }
    );
  }
}
