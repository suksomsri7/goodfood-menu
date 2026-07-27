import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { memberFromReq } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

// PATCH /api/plan/[id] { lineUserId?, exerciseDone?, mealsDone? }  (+ Bearer native)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { lineUserId, exerciseDone, mealsDone } = await request.json();

    const member = await memberFromReq(request, lineUserId);
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!isAiCoachActive(member)) {
      return NextResponse.json({ error: "ฟีเจอร์นี้สำหรับสมาชิกคอร์ส", locked: true }, { status: 403 });
    }

    const plan = await prisma.dailyPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    // ownership
    if (plan.memberId !== member.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextExerciseDone = typeof exerciseDone === "boolean" ? exerciseDone : plan.exerciseDone;
    const nextMealsDone =
      mealsDone && typeof mealsDone === "object"
        ? { ...(plan.mealsDone as Record<string, boolean> | null), ...mealsDone }
        : (plan.mealsDone as Record<string, boolean> | null);

    // คำนวณ status จากความคืบหน้า
    const mealPlan = plan.mealPlan as { meals?: { slot: string }[] } | null;
    const totalMeals = mealPlan?.meals?.length ?? 0;
    const doneMeals = nextMealsDone
      ? Object.values(nextMealsDone).filter(Boolean).length
      : 0;
    const allMealsDone = totalMeals > 0 && doneMeals >= totalMeals;

    let status: string;
    if (nextExerciseDone && allMealsDone) status = "done";
    else if (nextExerciseDone || doneMeals > 0) status = "partial";
    else status = "planned";

    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: {
        exerciseDone: nextExerciseDone,
        mealsDone: nextMealsDone ?? undefined,
        status,
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      status: updated.status,
      exerciseDone: updated.exerciseDone,
      mealsDone: updated.mealsDone,
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
