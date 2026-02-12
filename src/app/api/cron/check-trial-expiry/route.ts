import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// This cron job checks for members whose AI Coach trial has expired
// and updates their memberType to the general type
export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:8',message:'Cron job started',data:{timestamp:new Date().toISOString()},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:17',message:'Auth check',data:{isAuthorized,hasAuthHeader:!!authHeader,hasCronSecret:!!process.env.CRON_SECRET},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:31',message:'System settings loaded',data:{hasSettings:!!settings,generalMemberTypeId:settings?.generalMemberTypeId,trialMemberTypeId:settings?.trialMemberTypeId},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!settings) {
      return NextResponse.json({ message: "No system settings found" });
    }

    // Check if generalMemberTypeId is configured
    if (!settings.generalMemberTypeId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:42',message:'generalMemberTypeId not configured - SKIPPING',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ 
        message: "Card หลังทดลอง ไม่ได้กำหนดไว้ - ข้ามการเปลี่ยน Card อัตโนมัติ",
        skipped: true,
      });
    }

    const now = new Date();

    // Find members whose AI Coach has expired
    const expiredMembers = await prisma.member.findMany({
      where: {
        aiCoachExpireDate: {
          lte: now,
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:70',message:'Found expired members',data:{count:expiredMembers.length,now:now.toISOString(),generalMemberTypeId:settings.generalMemberTypeId,members:expiredMembers.slice(0,5).map(m=>({id:m.id,name:m.displayName,typeId:m.memberTypeId,expireDate:m.aiCoachExpireDate}))},timestamp:Date.now(),hypothesisId:'C,D'})}).catch(()=>{});
    // #endregion

    if (expiredMembers.length === 0) {
      return NextResponse.json({
        message: "No expired AI Coach members found",
        checked: 0,
      });
    }

    // Update expired members to general member type
    const updatePromises = expiredMembers.map(async (member) => {
      return prisma.member.update({
        where: { id: member.id },
        data: {
          memberTypeId: settings.generalMemberTypeId,
          aiCoachExpireDate: null, // Clear the expire date
        },
      });
    });

    await Promise.all(updatePromises);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:95',message:'Updated members successfully',data:{count:expiredMembers.length,updatedTo:settings.generalMemberTypeId},timestamp:Date.now(),hypothesisId:'success'})}).catch(()=>{});
    // #endregion

    console.log(`[Cron] Updated ${expiredMembers.length} members from trial to general AI Coach type`);

    return NextResponse.json({
      success: true,
      message: `Updated ${expiredMembers.length} members`,
      updated: expiredMembers.map(m => ({
        id: m.id,
        name: m.displayName,
        expiredAt: m.aiCoachExpireDate,
      })),
    });
  } catch (error) {
    console.error("Error checking trial expiry:", error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-trial-expiry/route.ts:error',message:'Error in cron job',data:{error:String(error)},timestamp:Date.now(),hypothesisId:'error'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: "Failed to check trial expiry" },
      { status: 500 }
    );
  }
}
