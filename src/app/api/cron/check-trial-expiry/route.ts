import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// This cron job checks for members whose AI Coach trial has expired
// and updates their memberType to the general type
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    if (!settings) {
      return NextResponse.json({ message: "No system settings found" });
    }

    // Check if generalMemberTypeId is configured
    if (!settings.generalMemberTypeId) {
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
    return NextResponse.json(
      { error: "Failed to check trial expiry" },
      { status: 500 }
    );
  }
}
