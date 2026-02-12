import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Debug endpoint to test trial expiry logic
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lineUserId = searchParams.get("lineUserId");

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:10',message:'Debug endpoint called',data:{action,lineUserId},timestamp:Date.now(),hypothesisId:'entry'})}).catch(()=>{});
  // #endregion

  try {
    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:22',message:'System settings loaded',data:{settings:{trialDays:settings?.trialDays,trialMemberTypeId:settings?.trialMemberTypeId,generalMemberTypeId:settings?.generalMemberTypeId}},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:47',message:'Checking specific member',data:{member,generalMemberTypeId:settings?.generalMemberTypeId,isExpired:member?.aiCoachExpireDate?member.aiCoachExpireDate<=now:false,isAlreadyGeneral:member?.memberTypeId===settings?.generalMemberTypeId},timestamp:Date.now(),hypothesisId:'C,D'})}).catch(()=>{});
      // #endregion

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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:92',message:'Found expired members',data:{count:expiredMembers.length,members:expiredMembers.map(m=>({id:m.id,name:m.displayName,typeId:m.memberTypeId,expireDate:m.aiCoachExpireDate}))},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Filter those that would be updated
      const wouldBeUpdated = expiredMembers.filter(m => 
        m.memberTypeId !== settings?.generalMemberTypeId
      );

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:101',message:'Filtered members for update',data:{totalExpired:expiredMembers.length,wouldBeUpdatedCount:wouldBeUpdated.length,generalMemberTypeId:settings?.generalMemberTypeId},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion

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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:trigger',message:'Manual trigger - updating members',data:{count:expiredMembers.length,targetTypeId:settings.generalMemberTypeId},timestamp:Date.now(),hypothesisId:'manual-trigger'})}).catch(()=>{});
      // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'test-trial-expiry/route.ts:error',message:'Error in debug endpoint',data:{error:String(error)},timestamp:Date.now(),hypothesisId:'error'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
