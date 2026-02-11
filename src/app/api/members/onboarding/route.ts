import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Complete onboarding
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lineUserId,
      name,
      email,
      phone,
      gender,
      birthDate,
      height,
      weight,
      goalWeight,
      goalType,
      activityLevel,
      dietType,
      targetMonths,
      bmr,
      tdee,
      dailyCalories,
      dailyProtein,
      dailyCarbs,
      dailyFat,
      dailyWater,
    } = body;

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    // Get system settings for trial period
    const systemSettings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    // Calculate trial expiry date if trial is enabled
    let trialData: { memberTypeId?: string; aiCoachExpireDate?: Date } = {};
    if (systemSettings?.trialDays && systemSettings.trialDays > 0 && systemSettings.trialMemberTypeId) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + systemSettings.trialDays);
      trialData = {
        memberTypeId: systemSettings.trialMemberTypeId,
        aiCoachExpireDate: expireDate,
      };
    }

    // Update or create member with all onboarding data
    const member = await prisma.member.upsert({
      where: { lineUserId },
      update: {
        name,
        email,
        phone,
        gender,
        birthDate: birthDate ? new Date(birthDate) : null,
        height,
        weight,
        goalWeight,
        goalType,
        activityLevel,
        dietType,
        targetMonths,
        bmr,
        tdee,
        dailyCalories,
        dailyProtein,
        dailyCarbs,
        dailyFat,
        dailySodium: 2300, // Default sodium limit
        dailySugar: 50, // Default sugar limit
        dailyWater,
        isOnboarded: true,
        updatedAt: new Date(),
        // Apply trial settings only if member doesn't have a memberType yet
        ...(trialData.memberTypeId && { memberTypeId: trialData.memberTypeId }),
        ...(trialData.aiCoachExpireDate && { aiCoachExpireDate: trialData.aiCoachExpireDate }),
      },
      create: {
        lineUserId,
        name,
        email,
        phone,
        gender,
        birthDate: birthDate ? new Date(birthDate) : null,
        height,
        weight,
        goalWeight,
        goalType,
        activityLevel,
        dietType,
        targetMonths,
        bmr,
        tdee,
        dailyCalories,
        dailyProtein,
        dailyCarbs,
        dailyFat,
        dailySodium: 2300,
        dailySugar: 50,
        dailyWater,
        isOnboarded: true,
        // Apply trial settings for new members
        ...trialData,
      },
    });

    // Create initial weight log
    if (weight) {
      await prisma.weightLog.create({
        data: {
          memberId: member.id,
          weight,
          note: "น้ำหนักเริ่มต้น",
        },
      });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Failed to complete onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
