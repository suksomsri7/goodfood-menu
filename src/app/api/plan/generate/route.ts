import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { memberFromReq, unauthorizedIfBearer, unauthorizedIfNoIdentity } from "@/lib/memberAuth";
import { checkUsageLimitForMember, logAiUsageByMemberId, creditsExhaustedResponse } from "@/lib/usage-limits";
import { generateWeekPlan, bkkTodayKey, addDays } from "@/lib/planGenerator";

export const dynamic = "force-dynamic";

// POST /api/plan/generate { lineUserId?, start? }  (+ Bearer สำหรับ native)
export async function POST(request: NextRequest) {
  try {
    const { lineUserId, start } = await request.json();

    // gate สิทธิ์ (JWT native หรือ lineUserId LIFF)
    // access token เท่านั้น — นาฬิกาไม่ได้สร้างแผน (เรียกแค่ initial-data/plan/plan[id]/execute/agent)
    const member = await memberFromReq(request, lineUserId, { accessOnly: true });
    if (!member) {
      // มี Bearer แต่ใช้ไม่ได้ = token หมดอายุ → 401 ให้ client ต่ออายุ
      return unauthorizedIfBearer(request) ?? (await unauthorizedIfNoIdentity(request)) ?? NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (!isAiCoachActive(member)) {
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

    // S1: โควตา AI ครอบทุกช่องทาง (เดิมเช็คเฉพาะ LIFF → native generate ได้ไม่จำกัด)
    // สร้างแผน 7 วัน = งานหนักสุด → มีราคาเครดิตของตัวเอง (creditKey "plan")
    const limit = await checkUsageLimitForMember(member, "dailyAiRecommendLimit", { creditKey: "plan" });
    if (!limit.allowed) return creditsExhaustedResponse(limit);

    const result = await generateWeekPlan(member.id, startKey);
    // 🔴 usedFallback = AI ไม่ตอบ/ล่ม แล้วใช้แผนสำรอง → ไม่หักเครดิต
    if (!result.usedFallback) {
      await logAiUsageByMemberId(member.id, "dailyAiRecommendLimit", { creditKey: "plan" });
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
