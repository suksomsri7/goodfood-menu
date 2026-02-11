import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCoachingMessage, gatherMemberContext, isAiCoachActive, CoachingType } from "@/lib/coaching";
import { getAllUsageLimits } from "@/lib/usage-limits";

// POST - Test send coaching message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, type = "exercise" } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { memberType: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check AI Coach status
    const aiActive = member.memberType ? isAiCoachActive(member) : false;
    
    // Try to gather context
    let context = null;
    let contextError = null;
    try {
      context = await gatherMemberContext(memberId);
    } catch (e) {
      contextError = String(e);
    }

    // Try to send message
    let sendResult = false;
    let sendError = null;
    try {
      sendResult = await sendCoachingMessage(memberId, type as "exercise");
    } catch (e) {
      sendError = String(e);
    }

    return NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        lineUserId: member.lineUserId,
        notifyPostExercise: member.notifyPostExercise,
      },
      aiCoach: {
        isActive: aiActive,
        memberType: member.memberType?.name || null,
        memberTypeActive: member.memberType?.isActive,
        courseDuration: member.memberType?.courseDuration,
        expireDate: member.aiCoachExpireDate?.toISOString(),
      },
      context: context ? {
        hasContext: true,
        exerciseToday: context.exerciseToday,
        name: context.name,
      } : {
        hasContext: false,
        error: contextError,
      },
      send: {
        success: sendResult,
        error: sendError,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET - Debug AI Coach status for a member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const memberId = searchParams.get("memberId");

    const testSend = searchParams.get("test") === "true";
    const checkUsage = searchParams.get("usage") === "true";

    // Check usage limits for a member
    if (checkUsage && (lineUserId || memberId)) {
      const member = await prisma.member.findFirst({
        where: lineUserId ? { lineUserId } : { id: memberId! },
        include: { memberType: true },
      });

      if (!member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      // Get usage limits
      const limits = await getAllUsageLimits(member.lineUserId);

      // Get today's usage logs
      const now = new Date();
      const thaiOffset = 7 * 60;
      const thaiNow = new Date(now.getTime() + thaiOffset * 60 * 1000);
      const startOfDay = new Date(thaiNow);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const startUTC = new Date(startOfDay.getTime() - thaiOffset * 60 * 1000);

      const todayLogs = await prisma.aiUsageLog.findMany({
        where: {
          memberId: member.id,
          createdAt: { gte: startUTC },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        member: {
          id: member.id,
          name: member.name,
          lineUserId: member.lineUserId,
          memberTypeId: member.memberTypeId,
          memberTypeName: member.memberType?.name || null,
        },
        memberTypeLimits: member.memberType ? {
          dailyPhotoLimit: member.memberType.dailyPhotoLimit,
          dailyAiAnalysisLimit: member.memberType.dailyAiAnalysisLimit,
          dailyAiTextAnalysisLimit: member.memberType.dailyAiTextAnalysisLimit,
          dailyAiRecommendLimit: member.memberType.dailyAiRecommendLimit,
          dailyExerciseAnalysisLimit: member.memberType.dailyExerciseAnalysisLimit,
          dailyMenuSelectLimit: member.memberType.dailyMenuSelectLimit,
          dailyScanLimit: member.memberType.dailyScanLimit,
        } : "no_member_type (default: 3)",
        usageLimits: limits,
        todayLogs: todayLogs.map(log => ({
          usageType: log.usageType,
          createdAt: log.createdAt.toISOString(),
        })),
        logsCount: todayLogs.length,
      });
    }

    // If no params, list all members with their AI Coach status
    if (!lineUserId && !memberId && !testSend) {
      const members = await prisma.member.findMany({
        include: { memberType: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      const memberList = members.map(m => {
        let status = "no_type";
        if (m.memberType) {
          if (!m.memberType.isActive) status = "type_disabled";
          else if (m.memberType.courseDuration === 0) status = "unlimited";
          else if (m.aiCoachExpireDate && m.aiCoachExpireDate > new Date()) status = "active";
          else status = "expired";
        }
        return {
          id: m.id,
          name: m.name,
          lineUserId: m.lineUserId,
          aiCoachStatus: status,
          memberType: m.memberType?.name || null,
          notifyPostExercise: m.notifyPostExercise,
        };
      });

      return NextResponse.json({ members: memberList });
    }

    // Handle test=true with memberId
    if (testSend && memberId) {
      const testMember = await prisma.member.findUnique({
        where: { id: memberId },
        include: { memberType: true },
      });

      if (!testMember) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      // Check AI Coach status
      const aiActive = testMember.memberType ? isAiCoachActive(testMember) : false;
      
      // Try to gather context
      let context = null;
      let contextError = null;
      try {
        context = await gatherMemberContext(memberId);
      } catch (e) {
        contextError = String(e);
      }

      // Get coaching type from query param (default: exercise)
      const coachingType = (searchParams.get("type") || "exercise") as CoachingType;
      const validTypes: CoachingType[] = ["morning", "lunch", "dinner", "evening", "weekly", "photo", "exercise", "milestone", "inactive"];
      
      if (!validTypes.includes(coachingType)) {
        return NextResponse.json({ 
          error: `Invalid type. Use: ${validTypes.join(", ")}` 
        }, { status: 400 });
      }

      // Try to send message
      let sendResult = false;
      let sendError = null;
      try {
        sendResult = await sendCoachingMessage(memberId, coachingType);
      } catch (e) {
        sendError = String(e);
      }

      return NextResponse.json({
        test: true,
        type: coachingType,
        member: {
          id: testMember.id,
          name: testMember.name,
          lineUserId: testMember.lineUserId,
        },
        notifications: {
          morning: testMember.notifyMorningCoach,
          lunch: testMember.notifyLunchSuggestion,
          dinner: testMember.notifyDinnerSuggestion,
          evening: testMember.notifyEveningSummary,
          weekly: testMember.notifyWeeklyInsights,
          photo: testMember.notifyProgressPhoto,
          exercise: testMember.notifyPostExercise,
          weight: testMember.notifyWeightReminder,
        },
        aiCoach: {
          isActive: aiActive,
          memberType: testMember.memberType?.name || null,
          memberTypeActive: testMember.memberType?.isActive,
          courseDuration: testMember.memberType?.courseDuration,
          expireDate: testMember.aiCoachExpireDate?.toISOString(),
        },
        context: context ? {
          hasContext: true,
          exerciseToday: context.exerciseToday,
          name: context.name,
        } : {
          hasContext: false,
          error: contextError,
        },
        send: {
          success: sendResult,
          error: sendError,
        },
      });
    }

    const member = await prisma.member.findFirst({
      where: lineUserId ? { lineUserId } : { id: memberId! },
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
