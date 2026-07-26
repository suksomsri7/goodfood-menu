import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAiCoach } from "@/lib/coaching";
import { checkUsageLimit, logAiUsage } from "@/lib/usage-limits";
import { generateWeekPlan, bkkTodayKey, addDays } from "@/lib/planGenerator";

export const dynamic = "force-dynamic";

// POST /api/plan/generate { lineUserId, start?: "today" | "nextWeek" }
export async function POST(request: NextRequest) {
  try {
    const { lineUserId, start } = await request.json();
    if (!lineUserId) {
      return NextResponse.json({ error: "lineUserId is required" }, { status: 400 });
    }

    // gate สิทธิ์
    const { member, active } = await requireAiCoach(lineUserId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (!active) {
      return NextResponse.json(
        { error: "ฟีเจอร์นี้สำหรับสมาชิกคอร์ส กรุณาติดต่อแอดมิน", locked: true },
        { status: 403 }
      );
    }

    // เริ่มสัปดาห์: วันนี้ หรือ สัปดาห์หน้า (วันนี้+7)
    const startKey = start === "nextWeek" ? addDays(bkkTodayKey(), 7) : bkkTodayKey();
    const endKey = addDays(startKey, 6);

    // กันสร้างซ้ำ: ถ้าช่วง 7 วันนี้มีแผนครบแล้ว → 409
    const existing = await prisma.dailyPlan.count({
      where: { memberId: member.id, date: { gte: startKey, lte: endKey } },
    });
    if (existing >= 7) {
      return NextResponse.json(
        { error: "สัปดาห์นี้มีแผนอยู่แล้ว", alreadyExists: true },
        { status: 409 }
      );
    }

    // เช็คโควตา AI (นับรวมกับ recommend)
    const limit = await checkUsageLimit(lineUserId, "dailyAiRecommendLimit");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: limit.message, limitReached: true, limit: limit.limit, used: limit.used },
        { status: 429 }
      );
    }

    const result = await generateWeekPlan(member.id, startKey);
    if (!result.usedFallback) {
      await logAiUsage(lineUserId, "dailyAiRecommendLimit");
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      weekBatchId: result.weekBatchId,
      usedFallback: result.usedFallback,
      startDate: startKey.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
  }
}
