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

    // Get member types for dropdown
    const memberTypes = await prisma.memberType.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        isDefault: true,
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

// PATCH - อัพเดทการตั้งค่า AI Coach
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { 
      aiCoachEnabled, 
      trialDays, 
      trialMemberTypeId, 
      generalMemberTypeId 
    } = body;

    const settings = await prisma.systemSetting.upsert({
      where: { id: "system" },
      update: {
        ...(aiCoachEnabled !== undefined && { aiCoachEnabled }),
        ...(trialDays !== undefined && { trialDays }),
        ...(trialMemberTypeId !== undefined && { trialMemberTypeId: trialMemberTypeId || null }),
        ...(generalMemberTypeId !== undefined && { generalMemberTypeId: generalMemberTypeId || null }),
      },
      create: {
        id: "system",
        aiCoachEnabled: aiCoachEnabled ?? true,
        trialDays: trialDays ?? 7,
        trialMemberTypeId: trialMemberTypeId || null,
        generalMemberTypeId: generalMemberTypeId || null,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating AI Coach settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
