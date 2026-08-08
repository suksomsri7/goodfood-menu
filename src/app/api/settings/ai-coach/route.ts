import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCreditCosts, setCreditCosts, CREDIT_LABELS, DEFAULT_CREDIT_COSTS } from "@/lib/aiCredits";

// GET - ดึงการตั้งค่า AI Coach
export async function GET() {
  try {
    // Get or create system settings
    let settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.systemSetting.create({
        data: { id: "system" },
      });
    }

    // Get all member types for dropdown (include inactive for settings)
    const memberTypes = await prisma.memberType.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        isDefault: true,
        isActive: true,
      },
    });

    // ราคาเครดิต AI ต่อ action (โหมด combined) — sanitize + เติมค่าเริ่มต้นให้แล้ว
    const aiCreditCosts = await getCreditCosts();

    return NextResponse.json({
      ...settings,
      aiCreditCosts,
      aiCreditDefaults: DEFAULT_CREDIT_COSTS,
      aiCreditLabels: CREDIT_LABELS,
      memberTypes,
    });
  } catch (error) {
    console.error("Error fetching AI Coach settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทการตั้งค่า AI Coach และ Activity Settings
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { 
      aiCoachEnabled, 
      trialDays, 
      trialMemberTypeId, 
      generalMemberTypeId,
      // Activity Settings
      inactiveDaysThreshold,
      gracePeriodDays,
      // Premium Settings
      premiumPrice,
      premiumDays,
      // ราคาเครดิต AI ต่อ action
      aiCreditCosts,
      // LINE OA ที่รับออเดอร์อาหาร (ปุ่มสั่งในแอปโค้ช)
      lineOaId,
    } = body;

    if (aiCreditCosts !== undefined) await setCreditCosts(aiCreditCosts);

    const settings = await prisma.systemSetting.upsert({
      where: { id: "system" },
      update: {
        ...(aiCoachEnabled !== undefined && { aiCoachEnabled }),
        ...(trialDays !== undefined && { trialDays }),
        ...(trialMemberTypeId !== undefined && { trialMemberTypeId: trialMemberTypeId || null }),
        ...(generalMemberTypeId !== undefined && { generalMemberTypeId: generalMemberTypeId || null }),
        ...(inactiveDaysThreshold !== undefined && { inactiveDaysThreshold }),
        ...(gracePeriodDays !== undefined && { gracePeriodDays }),
        ...(premiumPrice !== undefined && { premiumPrice }),
        ...(premiumDays !== undefined && { premiumDays }),
        ...(lineOaId !== undefined && { lineOaId: String(lineOaId).trim() || null }),
      },
      create: {
        id: "system",
        aiCoachEnabled: aiCoachEnabled ?? true,
        trialDays: trialDays ?? 7,
        trialMemberTypeId: trialMemberTypeId || null,
        generalMemberTypeId: generalMemberTypeId || null,
        inactiveDaysThreshold: inactiveDaysThreshold ?? 7,
        gracePeriodDays: gracePeriodDays ?? 2,
        premiumPrice: premiumPrice ?? 299,
        premiumDays: premiumDays ?? 30,
        lineOaId: lineOaId ? String(lineOaId).trim() : null,
      },
    });

    return NextResponse.json({ ...settings, aiCreditCosts: await getCreditCosts() });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
