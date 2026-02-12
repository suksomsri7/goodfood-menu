import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAiCoachActive, shouldSendNotification } from "@/lib/coaching";

// Calculate expiry threshold for Thailand timezone (same logic as coaching cron)
function getExpiryThreshold(now: Date): Date {
  const todayThailand = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const startOfTodayThailand = new Date(Date.UTC(
    todayThailand.getUTCFullYear(),
    todayThailand.getUTCMonth(),
    todayThailand.getUTCDate(),
    0, 0, 0, 0
  ));
  return new Date(startOfTodayThailand.getTime() - (7 * 60 * 60 * 1000));
}

// Debug endpoint to test coaching notification system
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lineUserId = searchParams.get("lineUserId");

  try {
    const now = new Date();
    const thaiTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const currentThaiTime = thaiTime.toISOString().slice(11, 16);
    const expiryThreshold = getExpiryThreshold(now);

    if (action === "check-member" && lineUserId) {
      // Check specific member's coaching eligibility
      const member = await prisma.member.findUnique({
        where: { lineUserId },
        include: { memberType: true },
      });

      if (!member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      // Check all conditions
      const isUnlimited = member.memberType?.courseDuration === 0;
      const isExpiredCheck = !isUnlimited && 
        (!member.aiCoachExpireDate || member.aiCoachExpireDate < expiryThreshold);
      
      const checks = {
        isActive: member.isActive,
        activityStatus: member.activityStatus,
        activityStatusIsActive: member.activityStatus === "active",
        hasMemberType: !!member.memberType,
        memberTypeName: member.memberType?.name,
        memberTypeIsActive: member.memberType?.isActive,
        courseDuration: member.memberType?.courseDuration,
        isUnlimited,
        aiCoachExpireDate: member.aiCoachExpireDate,
        expiryThreshold: expiryThreshold.toISOString(),
        isExpired: isExpiredCheck,
        expiryExplanation: member.aiCoachExpireDate 
          ? `${member.aiCoachExpireDate.toISOString()} >= ${expiryThreshold.toISOString()} = ${member.aiCoachExpireDate >= expiryThreshold ? "ACTIVE ✅" : "EXPIRED ❌"}`
          : "No expire date set",
        morningCoachTime: member.memberType?.morningCoachTime,
        notifyMorningCoach: member.notifyMorningCoach,
        notificationsPausedUntil: member.notificationsPausedUntil,
        isPaused: member.notificationsPausedUntil ? member.notificationsPausedUntil > now : false,
      };

      // Determine isAiCoachActive
      const aiCoachActive = member.memberType ? isAiCoachActive({
        memberType: member.memberType,
        aiCoachExpireDate: member.aiCoachExpireDate,
      }) : false;

      // Check shouldSendNotification for morning
      const shouldSendMorning = await shouldSendNotification(member.id, "morning");

      // Time window check
      let timeWindowCheck = "N/A";
      if (member.memberType?.morningCoachTime) {
        const [memberHour, memberMin] = member.memberType.morningCoachTime.split(":").map(Number);
        const [currentHour, currentMin] = currentThaiTime.split(":").map(Number);
        const memberTotalMin = memberHour * 60 + memberMin;
        const currentTotalMin = currentHour * 60 + currentMin;
        const diff = Math.abs(memberTotalMin - currentTotalMin);
        const adjustedDiff = Math.min(diff, 1440 - diff);
        timeWindowCheck = adjustedDiff <= 30 ? `PASS (diff: ${adjustedDiff} min)` : `FAIL (diff: ${adjustedDiff} min, need ≤30)`;
      }

      // Determine why not sending
      const reasons: string[] = [];
      if (!member.isActive) reasons.push("❌ member.isActive = false");
      if (member.activityStatus !== "active") reasons.push(`❌ activityStatus = "${member.activityStatus}" (need "active")`);
      if (!member.memberType) reasons.push("❌ No memberType assigned");
      if (member.memberType && !member.memberType.isActive) reasons.push("❌ memberType.isActive = false");
      if (member.memberType && member.memberType.courseDuration !== 0) {
        if (!member.aiCoachExpireDate) reasons.push("❌ aiCoachExpireDate not set (required for non-unlimited)");
        else if (member.aiCoachExpireDate < expiryThreshold) reasons.push(`❌ AI Coach expired: ${member.aiCoachExpireDate.toISOString()} < threshold ${expiryThreshold.toISOString()}`);
      }
      if (!member.notifyMorningCoach) reasons.push("❌ notifyMorningCoach = false");
      if (checks.isPaused) reasons.push(`❌ Notifications paused until ${member.notificationsPausedUntil}`);

      return NextResponse.json({
        member: {
          id: member.id,
          displayName: member.displayName,
          lineUserId: member.lineUserId,
        },
        currentThaiTime,
        checks,
        results: {
          isAiCoachActive: aiCoachActive,
          shouldSendMorning,
          timeWindowCheck,
        },
        diagnosis: {
          wouldReceiveMorningCoach: reasons.length === 0 && shouldSendMorning,
          reasons: reasons.length > 0 ? reasons : ["✅ All checks passed"],
        },
        cronSchedule: {
          morning: "0 0 * * * UTC = 07:00 Thailand",
          lunch: "30 4 * * * UTC = 11:30 Thailand",
          dinner: "30 10 * * * UTC = 17:30 Thailand",
          evening: "0 13 * * * UTC = 20:00 Thailand",
        },
      });
    }

    if (action === "list-eligible") {
      // List members eligible for morning coaching
      const members = await prisma.member.findMany({
        where: {
          isActive: true,
          activityStatus: "active",
          memberTypeId: { not: null },
        },
        include: { memberType: true },
        take: 20,
      });

      const eligibleMembers = members.map(m => {
        const aiCoachActive = m.memberType ? isAiCoachActive({
          memberType: m.memberType,
          aiCoachExpireDate: m.aiCoachExpireDate,
        }) : false;

        const reasons: string[] = [];
        if (!m.memberType?.isActive) reasons.push("memberType inactive");
        if (m.memberType && m.memberType.courseDuration !== 0) {
          if (!m.aiCoachExpireDate) reasons.push("no expireDate");
          else if (m.aiCoachExpireDate < now) reasons.push("expired");
        }
        if (!m.notifyMorningCoach) reasons.push("notifyMorningCoach off");

        return {
          id: m.id,
          displayName: m.displayName,
          memberType: m.memberType?.name,
          activityStatus: m.activityStatus,
          aiCoachExpireDate: m.aiCoachExpireDate,
          isAiCoachActive: aiCoachActive,
          notifyMorningCoach: m.notifyMorningCoach,
          wouldReceive: aiCoachActive && m.notifyMorningCoach,
          issues: reasons.length > 0 ? reasons : null,
        };
      });

      return NextResponse.json({
        currentThaiTime,
        totalActiveMembers: members.length,
        eligibleForMorning: eligibleMembers.filter(m => m.wouldReceive).length,
        members: eligibleMembers,
      });
    }

    if (action === "simulate-morning") {
      // Simulate what would happen if morning cron runs now
      const members = await prisma.member.findMany({
        where: {
          isActive: true,
          activityStatus: "active",
          memberTypeId: { not: null },
        },
        include: { memberType: true },
      });

      let wouldSend = 0;
      let wouldSkip = 0;
      const details: { name: string; status: string; reason?: string }[] = [];

      for (const m of members) {
        if (!m.memberType?.isActive) {
          wouldSkip++;
          details.push({ name: m.displayName || m.id, status: "skip", reason: "memberType inactive" });
          continue;
        }

        const isUnlimited = m.memberType.courseDuration === 0;
        const isExpired = !isUnlimited && (!m.aiCoachExpireDate || m.aiCoachExpireDate < now);
        if (isExpired) {
          wouldSkip++;
          details.push({ name: m.displayName || m.id, status: "skip", reason: "AI Coach expired" });
          continue;
        }

        // Time check
        const memberTime = m.memberType.morningCoachTime;
        if (memberTime) {
          const [memberHour, memberMin] = memberTime.split(":").map(Number);
          const [currentHour, currentMin] = currentThaiTime.split(":").map(Number);
          const memberTotalMin = memberHour * 60 + memberMin;
          const currentTotalMin = currentHour * 60 + currentMin;
          const diff = Math.abs(memberTotalMin - currentTotalMin);
          const adjustedDiff = Math.min(diff, 1440 - diff);
          if (adjustedDiff > 30) {
            wouldSkip++;
            details.push({ name: m.displayName || m.id, status: "skip", reason: `time mismatch (${memberTime} vs ${currentThaiTime})` });
            continue;
          }
        }

        if (!m.notifyMorningCoach) {
          wouldSkip++;
          details.push({ name: m.displayName || m.id, status: "skip", reason: "notification off" });
          continue;
        }

        wouldSend++;
        details.push({ name: m.displayName || m.id, status: "would_send" });
      }

      return NextResponse.json({
        currentThaiTime,
        simulation: {
          totalMembers: members.length,
          wouldSend,
          wouldSkip,
        },
        details: details.slice(0, 20),
      });
    }

    if (action === "check-member-types") {
      // Check all member types configuration
      const memberTypes = await prisma.memberType.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          courseDuration: true,
          morningCoachTime: true,
          lunchReminderTime: true,
          dinnerReminderTime: true,
          eveningSummaryTime: true,
          _count: { select: { members: true } },
        },
      });

      return NextResponse.json({
        memberTypes: memberTypes.map(mt => ({
          id: mt.id,
          name: mt.name,
          isActive: mt.isActive,
          courseDuration: mt.courseDuration,
          isUnlimited: mt.courseDuration === 0,
          note: mt.courseDuration === 0 
            ? "✅ Unlimited - ไม่ต้องมี aiCoachExpireDate" 
            : `⚠️ ${mt.courseDuration} วัน - ต้องมี aiCoachExpireDate`,
          morningCoachTime: mt.morningCoachTime,
          memberCount: mt._count.members,
        })),
        explanation: "ถ้า courseDuration > 0 สมาชิกต้องมี aiCoachExpireDate ที่ยังไม่หมดอายุถึงจะได้รับข้อความ",
      });
    }

    // Default: show system info
    return NextResponse.json({
      currentThaiTime,
      cronSchedule: {
        morning: "0 0 * * * UTC = 07:00 Thailand",
        lunch: "30 4 * * * UTC = 11:30 Thailand", 
        dinner: "30 10 * * * UTC = 17:30 Thailand",
        evening: "0 13 * * * UTC = 20:00 Thailand",
      },
      availableActions: [
        "?action=check-member&lineUserId=xxx - ตรวจสอบสมาชิกเฉพาะคน",
        "?action=list-eligible - แสดงรายชื่อสมาชิกที่มีสิทธิ์รับข้อความ",
        "?action=simulate-morning - จำลองว่า cron morning จะส่งให้ใครบ้าง",
        "?action=check-member-types - ตรวจสอบการตั้งค่า Member Types ทั้งหมด",
      ],
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
