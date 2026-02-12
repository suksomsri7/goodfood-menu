import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Debug endpoint to test trial expiry logic
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lineUserId = searchParams.get("lineUserId");

  try {
    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    // Get all member types for reference
    const memberTypes = await prisma.memberType.findMany({
      select: { id: true, name: true, isDefault: true },
    });

    const now = new Date();
    
    // Calculate threshold for Thailand timezone (same logic as cron job)
    const todayThailand = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const tomorrowThailand = new Date(Date.UTC(
      todayThailand.getUTCFullYear(),
      todayThailand.getUTCMonth(),
      todayThailand.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    const thresholdDate = new Date(tomorrowThailand.getTime() - (7 * 60 * 60 * 1000));
    const todayThailandStr = `${todayThailand.getUTCFullYear()}-${String(todayThailand.getUTCMonth()+1).padStart(2,'0')}-${String(todayThailand.getUTCDate()).padStart(2,'0')}`;

    if (action === "run-all-tests") {
      // Comprehensive system test
      const testResults: {
        name: string;
        status: "PASS" | "FAIL" | "WARN";
        details: string;
        data?: unknown;
      }[] = [];

      // Test 1: System Settings Configuration
      const test1Pass = !!settings?.generalMemberTypeId && !!settings?.trialMemberTypeId;
      testResults.push({
        name: "1. System Settings Configuration",
        status: test1Pass ? "PASS" : "FAIL",
        details: test1Pass 
          ? `generalMemberTypeId: ${settings?.generalMemberTypeId}, trialMemberTypeId: ${settings?.trialMemberTypeId}`
          : "Missing generalMemberTypeId or trialMemberTypeId",
        data: {
          generalMemberTypeId: settings?.generalMemberTypeId,
          generalMemberTypeName: memberTypes.find(t => t.id === settings?.generalMemberTypeId)?.name,
          trialMemberTypeId: settings?.trialMemberTypeId,
          trialMemberTypeName: memberTypes.find(t => t.id === settings?.trialMemberTypeId)?.name,
        },
      });

      // Test 2: Timezone Calculation
      const expectedThailandDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const test2Pass = todayThailand.getUTCDate() === expectedThailandDate.getUTCDate();
      testResults.push({
        name: "2. Thailand Timezone Calculation",
        status: test2Pass ? "PASS" : "FAIL",
        details: `UTC: ${now.toISOString()}, Thailand Date: ${todayThailandStr}, Threshold: ${thresholdDate.toISOString()}`,
        data: {
          nowUTC: now.toISOString(),
          todayThailand: todayThailandStr,
          thresholdDate: thresholdDate.toISOString(),
        },
      });

      // Test 3: Member Types Exist
      const trialType = memberTypes.find(t => t.id === settings?.trialMemberTypeId);
      const generalType = memberTypes.find(t => t.id === settings?.generalMemberTypeId);
      const test3Pass = !!trialType && !!generalType;
      testResults.push({
        name: "3. Member Types Exist",
        status: test3Pass ? "PASS" : "FAIL",
        details: test3Pass 
          ? `Trial: "${trialType?.name}", General: "${generalType?.name}"`
          : `Missing types - Trial: ${!!trialType}, General: ${!!generalType}`,
      });

      // Test 4: Check for members with expire date
      const membersWithExpire = await prisma.member.findMany({
        where: { aiCoachExpireDate: { not: null } },
        select: {
          id: true,
          displayName: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
          memberType: { select: { name: true } },
        },
        take: 10,
      });
      testResults.push({
        name: "4. Members with Expire Date",
        status: membersWithExpire.length > 0 ? "PASS" : "WARN",
        details: membersWithExpire.length > 0 
          ? `Found ${membersWithExpire.length} member(s) with expire date`
          : "No members with expire date found (need to set expire date to test)",
        data: membersWithExpire.map(m => ({
          id: m.id,
          name: m.displayName,
          type: m.memberType?.name,
          expireDate: m.aiCoachExpireDate,
          isExpired: m.aiCoachExpireDate! < thresholdDate,
        })),
      });

      // Test 5: Expiry Logic Test (simulation)
      const testCases = [
        { name: "Yesterday", date: new Date(now.getTime() - 24 * 60 * 60 * 1000), shouldExpire: true },
        { name: "Today 00:00 UTC", date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)), shouldExpire: true },
        { name: "Tomorrow", date: new Date(now.getTime() + 24 * 60 * 60 * 1000), shouldExpire: false },
      ];
      const logicTests = testCases.map(tc => ({
        ...tc,
        dateISO: tc.date.toISOString(),
        actualExpired: tc.date < thresholdDate,
        pass: (tc.date < thresholdDate) === tc.shouldExpire,
      }));
      const test5Pass = logicTests.every(t => t.pass);
      testResults.push({
        name: "5. Expiry Logic Simulation",
        status: test5Pass ? "PASS" : "FAIL",
        details: test5Pass 
          ? "All expiry logic tests passed"
          : "Some expiry logic tests failed",
        data: logicTests.map(t => ({
          case: t.name,
          date: t.dateISO,
          shouldExpire: t.shouldExpire,
          actualExpired: t.actualExpired,
          result: t.pass ? "✅ PASS" : "❌ FAIL",
        })),
      });

      // Test 6: Query Performance Test
      const queryStart = Date.now();
      const expiredCount = await prisma.member.count({
        where: {
          aiCoachExpireDate: { lt: thresholdDate },
          memberTypeId: { not: settings?.generalMemberTypeId || "" },
        },
      });
      const queryTime = Date.now() - queryStart;
      testResults.push({
        name: "6. Query Performance",
        status: queryTime < 1000 ? "PASS" : "WARN",
        details: `Found ${expiredCount} expired members in ${queryTime}ms`,
        data: { expiredCount, queryTimeMs: queryTime },
      });

      // Summary
      const passCount = testResults.filter(t => t.status === "PASS").length;
      const failCount = testResults.filter(t => t.status === "FAIL").length;
      const warnCount = testResults.filter(t => t.status === "WARN").length;

      return NextResponse.json({
        summary: {
          total: testResults.length,
          passed: passCount,
          failed: failCount,
          warnings: warnCount,
          overallStatus: failCount === 0 ? (warnCount === 0 ? "✅ ALL PASS" : "⚠️ PASS WITH WARNINGS") : "❌ SOME FAILED",
        },
        timestamp: now.toISOString(),
        thailandDate: todayThailandStr,
        tests: testResults,
        nextSteps: failCount > 0 
          ? ["Fix the failed tests before the system will work correctly"]
          : warnCount > 0
          ? ["System is working. Warnings indicate areas that may need attention."]
          : ["System is fully configured and working correctly!"],
      });
    }

    if (action === "check-member" && lineUserId) {
      // Check specific member
      const member = await prisma.member.findUnique({
        where: { lineUserId },
        select: {
          id: true,
          displayName: true,
          lineUserId: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
          memberType: { select: { id: true, name: true } },
        },
      });

      if (!member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      const isExpired = member.aiCoachExpireDate ? member.aiCoachExpireDate < thresholdDate : false;
      const isAlreadyGeneral = member.memberTypeId === settings?.generalMemberTypeId;
      const wouldBeUpdated = isExpired && !isAlreadyGeneral && settings?.generalMemberTypeId;

      return NextResponse.json({
        member: {
          id: member.id,
          displayName: member.displayName,
          lineUserId: member.lineUserId,
          currentType: member.memberType,
          aiCoachExpireDate: member.aiCoachExpireDate,
        },
        analysis: {
          now: now.toISOString(),
          isExpired,
          isAlreadyGeneral,
          wouldBeUpdated,
          generalMemberTypeId: settings?.generalMemberTypeId,
          generalMemberTypeName: memberTypes.find(t => t.id === settings?.generalMemberTypeId)?.name || "Not configured",
        },
      });
    }

    if (action === "list-expired") {
      // Find all expired members (using Thailand timezone threshold)
      const expiredMembers = await prisma.member.findMany({
        where: {
          aiCoachExpireDate: {
            lt: thresholdDate,
          },
        },
        select: {
          id: true,
          displayName: true,
          lineUserId: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
          memberType: { select: { id: true, name: true } },
        },
        take: 20,
      });

      // Filter those that would be updated
      const wouldBeUpdated = expiredMembers.filter(m => 
        m.memberTypeId !== settings?.generalMemberTypeId
      );

      return NextResponse.json({
        systemSettings: {
          generalMemberTypeId: settings?.generalMemberTypeId,
          generalMemberTypeName: memberTypes.find(t => t.id === settings?.generalMemberTypeId)?.name || "NOT CONFIGURED",
          trialMemberTypeId: settings?.trialMemberTypeId,
          trialMemberTypeName: memberTypes.find(t => t.id === settings?.trialMemberTypeId)?.name || "NOT CONFIGURED",
        },
        now: now.toISOString(),
        expiredMembers: expiredMembers.map(m => ({
          id: m.id,
          displayName: m.displayName,
          lineUserId: m.lineUserId,
          currentType: m.memberType?.name,
          currentTypeId: m.memberTypeId,
          aiCoachExpireDate: m.aiCoachExpireDate,
          wouldBeUpdated: m.memberTypeId !== settings?.generalMemberTypeId,
        })),
        summary: {
          totalExpired: expiredMembers.length,
          wouldBeUpdated: wouldBeUpdated.length,
          alreadyGeneral: expiredMembers.length - wouldBeUpdated.length,
        },
      });
    }

    if (action === "trigger-update") {
      // Manually trigger the update for expired members
      if (!settings?.generalMemberTypeId) {
        return NextResponse.json({ error: "generalMemberTypeId not configured" }, { status: 400 });
      }

      const expiredMembers = await prisma.member.findMany({
        where: {
          aiCoachExpireDate: { lt: thresholdDate },
          memberTypeId: { not: settings.generalMemberTypeId },
        },
        select: {
          id: true,
          displayName: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
          memberType: { select: { name: true } },
        },
      });

      if (expiredMembers.length === 0) {
        return NextResponse.json({ message: "No expired members to update", updated: 0 });
      }

      const updatePromises = expiredMembers.map(async (member) => {
        return prisma.member.update({
          where: { id: member.id },
          data: {
            memberTypeId: settings.generalMemberTypeId,
            aiCoachExpireDate: null,
          },
        });
      });

      await Promise.all(updatePromises);

      const generalType = memberTypes.find(t => t.id === settings.generalMemberTypeId);

      return NextResponse.json({
        success: true,
        message: `Updated ${expiredMembers.length} members to "${generalType?.name}"`,
        updated: expiredMembers.map(m => ({
          id: m.id,
          displayName: m.displayName,
          previousType: m.memberType?.name,
          previousExpireDate: m.aiCoachExpireDate,
          newType: generalType?.name,
        })),
      });
    }

    if (action === "list-with-expire") {
      // Find all members with aiCoachExpireDate set
      const membersWithExpire = await prisma.member.findMany({
        where: {
          aiCoachExpireDate: { not: null },
        },
        select: {
          id: true,
          displayName: true,
          lineUserId: true,
          memberTypeId: true,
          aiCoachExpireDate: true,
          memberType: { select: { id: true, name: true } },
        },
        orderBy: { aiCoachExpireDate: "asc" },
        take: 50,
      });

      return NextResponse.json({
        now: now.toISOString(),
        membersWithExpireDate: membersWithExpire.map(m => ({
          id: m.id,
          displayName: m.displayName,
          lineUserId: m.lineUserId,
          currentType: m.memberType?.name,
          currentTypeId: m.memberTypeId,
          aiCoachExpireDate: m.aiCoachExpireDate,
          isExpired: m.aiCoachExpireDate! < thresholdDate,
          daysUntilExpire: Math.ceil((m.aiCoachExpireDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        })),
        total: membersWithExpire.length,
      });
    }

    // Default: show system status
    return NextResponse.json({
      systemSettings: {
        generalMemberTypeId: settings?.generalMemberTypeId,
        generalMemberTypeName: memberTypes.find(t => t.id === settings?.generalMemberTypeId)?.name || "NOT CONFIGURED ⚠️",
        trialMemberTypeId: settings?.trialMemberTypeId,
        trialMemberTypeName: memberTypes.find(t => t.id === settings?.trialMemberTypeId)?.name || "NOT CONFIGURED ⚠️",
        trialDays: settings?.trialDays,
      },
      memberTypes: memberTypes.map(t => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
        isTrialType: t.id === settings?.trialMemberTypeId,
        isGeneralType: t.id === settings?.generalMemberTypeId,
      })),
      cronSchedule: "1 17 * * * (UTC) = 00:01 Thailand Time daily",
      now: now.toISOString(),
      todayThailand: todayThailandStr,
      thresholdDate: thresholdDate.toISOString(),
      explanation: "สมาชิกที่มี aiCoachExpireDate < thresholdDate จะถือว่าหมดอายุ (เทียบตามวันที่ไทย)",
      availableActions: [
        "?action=run-all-tests - 🧪 ทดสอบระบบทั้งหมดอัตโนมัติ",
        "?action=list-expired - แสดงสมาชิกที่หมดอายุแล้ว",
        "?action=list-with-expire - แสดงสมาชิกที่มีวันหมดอายุ",
        "?action=check-member&lineUserId=xxx - ตรวจสอบสมาชิกเฉพาะคน",
        "?action=trigger-update - ⚡ เปลี่ยน Card สมาชิกที่หมดอายุทันที (Manual Trigger)",
      ],
      troubleshooting: {
        step1: "ตรวจสอบว่า generalMemberTypeId มีค่าหรือไม่ (ถ้าเป็น NOT CONFIGURED จะไม่ทำงาน)",
        step2: "ใช้ ?action=list-expired เพื่อดูสมาชิกที่หมดอายุ",
        step3: "ตรวจสอบ Vercel Cron logs ที่ https://vercel.com/[team]/[project]/functions",
      },
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
