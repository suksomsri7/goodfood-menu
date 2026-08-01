import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { macroTargets } from "@/lib/energyModel";
import { getAuthedMember } from "@/lib/coachAuth";

// POST - Complete onboarding  (+ Bearer สำหรับ Coach native)
export async function POST(request: NextRequest) {
  try {
    const authed = await getAuthedMember(request);
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
      equipment,
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

    if (!authed && !lineUserId) {
      return NextResponse.json(
        { error: "auth required (Bearer หรือ lineUserId)" },
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
      where: authed ? { id: authed.id } : { lineUserId },
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
        equipment: equipment ?? undefined,
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
        activityStatus: "active", // Set active when onboarding completes
        lastActiveAt: new Date(),
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
        equipment: equipment ?? undefined,
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
        activityStatus: "active", // Set active when onboarding completes
        lastActiveAt: new Date(),
        // Apply trial settings for new members
        ...trialData,
      },
    });

    // เซิร์ฟเวอร์เป็นเจ้าของสูตรมาโคร — แอปส่งค่าที่คำนวณเองมา แต่ของเดิมคิดโปรตีนเป็น % ของแคลอรี่
    // ทำให้คนแคลอรี่สูงได้เป้าโปรตีนเกินจริง (เคสจริง: 258 g/วัน) → คิดใหม่เป็น ก./กก. ตรงนี้เสมอ
    if (member.dailyCalories && member.weight) {
      const { macros } = macroTargets(member.dailyCalories, member.weight, member.goalWeight, member.goalType ?? "maintain");
      if (macros.protein !== member.dailyProtein || macros.fat !== member.dailyFat) {
        await prisma.member.update({
          where: { id: member.id },
          data: { dailyProtein: macros.protein, dailyCarbs: macros.carbs, dailyFat: macros.fat },
        });
        member.dailyProtein = macros.protein;
        member.dailyCarbs = macros.carbs;
        member.dailyFat = macros.fat;
      }
    }

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
