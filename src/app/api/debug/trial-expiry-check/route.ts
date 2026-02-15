import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// #region agent log
const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9';
const log = (location: string, message: string, data: any, hypothesisId: string) => {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, message, data, hypothesisId, timestamp: Date.now() })
  }).catch(() => {});
};
// #endregion

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const memberId = url.searchParams.get("memberId");

  try {
    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    // #region agent log - Hypothesis D: Settings check
    log('route.ts:24', 'System settings loaded', {
      hasSettings: !!settings,
      generalMemberTypeId: settings?.generalMemberTypeId || 'NOT SET',
      trialMemberTypeId: settings?.trialMemberTypeId || 'NOT SET',
    }, 'D');
    // #endregion

    if (!settings) {
      return NextResponse.json({ error: "No system settings found" });
    }

    // Get member type names
    const memberTypes = await prisma.memberType.findMany({
      select: { id: true, name: true },
    });
    const typeMap = Object.fromEntries(memberTypes.map(t => [t.id, t.name]));

    // Calculate threshold (same logic as cron)
    const now = new Date();
    const todayThailand = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const tomorrowThailand = new Date(Date.UTC(
      todayThailand.getUTCFullYear(),
      todayThailand.getUTCMonth(),
      todayThailand.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    const thresholdDate = new Date(tomorrowThailand.getTime() - (7 * 60 * 60 * 1000));

    // #region agent log - Hypothesis C: Threshold calculation
    log('route.ts:50', 'Threshold calculation', {
      nowUTC: now.toISOString(),
      nowThailand: todayThailand.toISOString(),
      tomorrowThailand: tomorrowThailand.toISOString(),
      thresholdDate: thresholdDate.toISOString(),
      thresholdExplanation: `Expires before ${thresholdDate.toISOString()} = expired`,
    }, 'C');
    // #endregion

    // Check specific member
    if (action === "check-member" && memberId) {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: {
          id: true,
          displayName: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
        },
      });

      if (!member) {
        return NextResponse.json({ error: "Member not found" });
      }

      const isExpired = member.aiCoachExpireDate && member.aiCoachExpireDate < thresholdDate;
      const isNotGeneral = member.memberTypeId !== settings.generalMemberTypeId;
      const shouldBeUpdated = isExpired && isNotGeneral;

      // #region agent log - Hypothesis B & E: Member condition check
      log('route.ts:78', 'Member condition check', {
        memberId: member.id,
        displayName: member.displayName,
        memberTypeId: member.memberTypeId,
        memberTypeName: typeMap[member.memberTypeId || ''] || 'Unknown',
        aiCoachExpireDate: member.aiCoachExpireDate?.toISOString() || 'null',
        thresholdDate: thresholdDate.toISOString(),
        generalMemberTypeId: settings.generalMemberTypeId,
        isExpired,
        isNotGeneral,
        shouldBeUpdated,
        comparisonDetail: member.aiCoachExpireDate 
          ? `${member.aiCoachExpireDate.toISOString()} < ${thresholdDate.toISOString()} = ${isExpired}`
          : 'No expire date set',
      }, 'B,E');
      // #endregion

      return NextResponse.json({
        member: {
          id: member.id,
          displayName: member.displayName,
          memberTypeId: member.memberTypeId,
          memberTypeName: typeMap[member.memberTypeId || ''] || 'Unknown',
          aiCoachExpireDate: member.aiCoachExpireDate?.toISOString() || null,
        },
        analysis: {
          thresholdDate: thresholdDate.toISOString(),
          isExpired,
          isNotGeneral,
          shouldBeUpdated,
          generalMemberTypeId: settings.generalMemberTypeId,
          generalMemberTypeName: typeMap[settings.generalMemberTypeId || ''] || 'Not set',
        },
        conclusion: shouldBeUpdated 
          ? "✅ Member SHOULD be updated by cron" 
          : `❌ Member will NOT be updated: ${!isExpired ? 'Not expired yet' : 'Already general type'}`,
      });
    }

    // Simulate cron query
    if (action === "simulate-cron") {
      // #region agent log - Hypothesis B: Query simulation
      log('route.ts:115', 'Simulating cron query', {
        queryConditions: {
          'aiCoachExpireDate.lt': thresholdDate.toISOString(),
          'memberTypeId.not': settings.generalMemberTypeId,
        },
      }, 'B');
      // #endregion

      const expiredMembers = await prisma.member.findMany({
        where: {
          aiCoachExpireDate: {
            lt: thresholdDate,
          },
          memberTypeId: {
            not: settings.generalMemberTypeId,
          },
        },
        select: {
          id: true,
          displayName: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
        },
      });

      // #region agent log - Query result
      log('route.ts:140', 'Cron query result', {
        foundCount: expiredMembers.length,
        members: expiredMembers.map(m => ({
          id: m.id,
          name: m.displayName,
          typeId: m.memberTypeId,
          typeName: typeMap[m.memberTypeId || ''] || 'Unknown',
          expireDate: m.aiCoachExpireDate?.toISOString(),
        })),
      }, 'B');
      // #endregion

      return NextResponse.json({
        now: now.toISOString(),
        thresholdDate: thresholdDate.toISOString(),
        settings: {
          generalMemberTypeId: settings.generalMemberTypeId,
          generalMemberTypeName: typeMap[settings.generalMemberTypeId || ''] || 'Not set',
        },
        foundExpiredMembers: expiredMembers.length,
        members: expiredMembers.map(m => ({
          id: m.id,
          displayName: m.displayName,
          memberTypeId: m.memberTypeId,
          memberTypeName: typeMap[m.memberTypeId || ''] || 'Unknown',
          aiCoachExpireDate: m.aiCoachExpireDate?.toISOString(),
        })),
      });
    }

    // Default: show all members with AI Coach expire date
    const allMembers = await prisma.member.findMany({
      where: {
        aiCoachExpireDate: { not: null },
      },
      select: {
        id: true,
        displayName: true,
        memberTypeId: true,
        aiCoachExpireDate: true,
      },
      orderBy: { aiCoachExpireDate: 'asc' },
    });

    return NextResponse.json({
      availableActions: [
        "?action=check-member&memberId=xxx - ตรวจสอบสมาชิกเฉพาะคน",
        "?action=simulate-cron - จำลอง cron query",
      ],
      now: now.toISOString(),
      thresholdDate: thresholdDate.toISOString(),
      settings: {
        generalMemberTypeId: settings.generalMemberTypeId,
        generalMemberTypeName: typeMap[settings.generalMemberTypeId || ''] || 'Not set',
        trialMemberTypeId: settings.trialMemberTypeId,
        trialMemberTypeName: typeMap[settings.trialMemberTypeId || ''] || 'Not set',
      },
      membersWithExpireDate: allMembers.map(m => ({
        id: m.id,
        displayName: m.displayName,
        memberTypeId: m.memberTypeId,
        memberTypeName: typeMap[m.memberTypeId || ''] || 'Unknown',
        aiCoachExpireDate: m.aiCoachExpireDate?.toISOString(),
        isExpired: m.aiCoachExpireDate && m.aiCoachExpireDate < thresholdDate,
      })),
    });
  } catch (error) {
    // #region agent log - Error
    log('route.ts:210', 'Error occurred', {
      error: error instanceof Error ? error.message : String(error),
    }, 'D');
    // #endregion
    console.error("Debug error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
