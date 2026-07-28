import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { memberFromReq } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

// GET /api/plan?lineUserId=..&month=YYYY-MM  → แผนทั้งเดือน (BKK)  (+ Bearer สำหรับ native)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const month = searchParams.get("month"); // YYYY-MM

    const member = await memberFromReq(request, lineUserId);
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!isAiCoachActive(member)) {
      return NextResponse.json(
        { error: "ฟีเจอร์นี้สำหรับสมาชิกคอร์ส", locked: true },
        { status: 403 }
      );
    }

    // ช่วงเดือน (เก็บ date เป็น UTC-midnight ของ BKK calendar date)
    const now = new Date();
    let y = now.getUTCFullYear();
    let mo = now.getUTCMonth();
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      y = parseInt(month.slice(0, 4), 10);
      mo = parseInt(month.slice(5, 7), 10) - 1;
    }
    const start = new Date(Date.UTC(y, mo, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, mo + 1, 1, 0, 0, 0));

    const plans = await prisma.dailyPlan.findMany({
      where: { memberId: member.id, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      success: true,
      month: `${y}-${String(mo + 1).padStart(2, "0")}`,
      plans: plans.map((p) => ({
        id: p.id,
        date: p.date.toISOString().slice(0, 10),
        status: p.status,
        exerciseDone: p.exerciseDone,
        mealsDone: p.mealsDone,
        exerciseItemsDone: p.exerciseItemsDone,
        exercisePlan: p.exercisePlan,
        mealPlan: p.mealPlan,
        aiNote: p.aiNote,
      })),
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}
