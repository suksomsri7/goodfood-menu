import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Debug AI Coach status for a member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
      include: {
        memberType: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Get system settings
    const systemSettings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    // Calculate AI Coach status
    let aiCoachStatus = "inactive";
    let aiCoachReason = "";
    
    if (!member.memberType) {
      aiCoachStatus = "no_type";
      aiCoachReason = "ไม่ได้กำหนดประเภท AI Coach ให้สมาชิก";
    } else if (!member.memberType.isActive) {
      aiCoachStatus = "type_disabled";
      aiCoachReason = `ประเภท '${member.memberType.name}' ถูกปิดการใช้งาน`;
    } else if (member.memberType.courseDuration === 0) {
      aiCoachStatus = "unlimited";
      aiCoachReason = "ใช้งานได้ไม่จำกัด";
    } else if (member.aiCoachExpireDate && member.aiCoachExpireDate > new Date()) {
      aiCoachStatus = "active";
      aiCoachReason = `ใช้งานได้ถึง ${member.aiCoachExpireDate.toLocaleDateString('th-TH')}`;
    } else {
      aiCoachStatus = "expired";
      aiCoachReason = member.aiCoachExpireDate 
        ? `หมดอายุเมื่อ ${member.aiCoachExpireDate.toLocaleDateString('th-TH')}`
        : "ไม่ได้กำหนดวันหมดอายุ";
    }

    // Notification settings
    const notifications = {
      morning: member.notifyMorningCoach,
      lunch: member.notifyLunchSuggestion,
      dinner: member.notifyDinnerSuggestion,
      evening: member.notifyEveningSummary,
      weekly: member.notifyWeeklyInsights,
      photo: member.notifyProgressPhoto,
      exercise: member.notifyPostExercise,
    };

    return NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        lineUserId: member.lineUserId,
        isOnboarded: member.isOnboarded,
        activityStatus: member.activityStatus,
      },
      aiCoach: {
        status: aiCoachStatus,
        reason: aiCoachReason,
        memberType: member.memberType ? {
          id: member.memberType.id,
          name: member.memberType.name,
          isActive: member.memberType.isActive,
          courseDuration: member.memberType.courseDuration,
        } : null,
        aiCoachExpireDate: member.aiCoachExpireDate?.toISOString() || null,
      },
      notifications,
      systemSettings: {
        trialDays: systemSettings?.trialDays,
        trialMemberTypeId: systemSettings?.trialMemberTypeId,
        generalMemberTypeId: systemSettings?.generalMemberTypeId,
      },
    });
  } catch (error) {
    console.error("Debug AI Coach error:", error);
    return NextResponse.json(
      { error: "Failed to get AI Coach debug info" },
      { status: 500 }
    );
  }
}
