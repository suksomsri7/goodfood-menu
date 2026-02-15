import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

    return NextResponse.json({
      ...settings,
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
    } = body;

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
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
