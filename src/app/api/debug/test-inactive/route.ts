import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  gatherMemberContext,
  generateCoachingMessage,
  createCoachingFlexMessage,
  isAiCoachActive
} from "@/lib/coaching";
import { pushMessage } from "@/lib/line";

// Debug endpoint to test inactive notification system
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId");
  const sendTest = searchParams.get("sendTest") === "true";

  try {
    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    const inactiveDaysThreshold = settings?.inactiveDaysThreshold ?? 7;
    const gracePeriodDays = settings?.gracePeriodDays ?? 2;

    // Get member count by status
    const [activeCount, inactiveCount, totalCount] = await Promise.all([
      prisma.member.count({ where: { activityStatus: "active", isActive: true } }),
      prisma.member.count({ where: { activityStatus: "inactive", isActive: true } }),
      prisma.member.count({ where: { isActive: true } }),
    ]);

    // If lineUserId provided, get specific member info
    let memberInfo = null;
    let testResult = null;

    if (lineUserId) {
      const member = await prisma.member.findUnique({
        where: { lineUserId },
        include: { memberType: true },
      });

      if (member) {
        const now = new Date();
        const lastActive = member.lastActiveAt || member.createdAt;
        const daysSinceActive = Math.floor(
          (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
        );

        const gracePeriodStart = inactiveDaysThreshold - gracePeriodDays;
        const isInGracePeriod = daysSinceActive >= gracePeriodStart && daysSinceActive < inactiveDaysThreshold;
        const shouldBeInactive = daysSinceActive >= inactiveDaysThreshold;

        memberInfo = {
          id: member.id,
          name: member.name,
          lineUserId: member.lineUserId,
          activityStatus: member.activityStatus,
          lastActiveAt: member.lastActiveAt,
          daysSinceActive,
          inactiveDaysThreshold,
          gracePeriodDays,
          gracePeriodStart,
          isInGracePeriod,
          shouldBeInactive,
          aiCoachActive: isAiCoachActive(member),
          notificationsPaused: member.notificationsPausedUntil && member.notificationsPausedUntil > now,
          memberTypeName: member.memberType?.name,
        };

        // Send test message if requested
        if (sendTest && member.activityStatus === "active") {
          const context = await gatherMemberContext(member.id);
          if (context) {
            const message = await generateCoachingMessage("inactive", context);
            const flexMessage = createCoachingFlexMessage("inactive", message, context);
            
            const success = await pushMessage(member.lineUserId, [flexMessage]);
            testResult = {
              sent: success,
              message: success ? "ส่งข้อความทดสอบสำเร็จ" : "ส่งข้อความไม่สำเร็จ",
              generatedMessage: message,
            };
          } else {
            testResult = {
              sent: false,
              message: "ไม่สามารถ gather context ได้",
            };
          }
        }
      }
    }

    // Get members approaching inactive (in grace period)
    const membersInGracePeriod = await prisma.member.findMany({
      where: {
        isActive: true,
        activityStatus: "active",
        lastActiveAt: {
          lte: new Date(Date.now() - (inactiveDaysThreshold - gracePeriodDays) * 24 * 60 * 60 * 1000),
          gt: new Date(Date.now() - inactiveDaysThreshold * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        name: true,
        lastActiveAt: true,
        lineUserId: true,
      },
      take: 10,
    });

    // Calculate days since active for each
    const membersWithDays = membersInGracePeriod.map(m => {
      const days = Math.floor((Date.now() - (m.lastActiveAt?.getTime() || 0)) / (1000 * 60 * 60 * 24));
      return {
        ...m,
        daysSinceActive: days,
        daysUntilInactive: inactiveDaysThreshold - days,
      };
    });

    return NextResponse.json({
      success: true,
      settings: {
        inactiveDaysThreshold,
        gracePeriodDays,
        gracePeriodStart: inactiveDaysThreshold - gracePeriodDays,
      },
      stats: {
        total: totalCount,
        active: activeCount,
        inactive: inactiveCount,
      },
      membersInGracePeriod: membersWithDays,
      memberInfo,
      testResult,
      cronSchedule: "ทุกวัน เวลา 10:00 น. (UTC+7)",
      howItWorks: {
        step1: `User ไม่เปิดแอป ${inactiveDaysThreshold - gracePeriodDays} วัน → ส่งข้อความเตือน "คิดถึงนะ"`,
        step2: `User ไม่เปิดแอป ${inactiveDaysThreshold} วัน → เปลี่ยนสถานะเป็น inactive และหยุดส่งข้อความ`,
        step3: "เมื่อ User กลับมาเปิดแอป → เปลี่ยนสถานะเป็น active และแสดง Welcome Back modal",
      },
    });
  } catch (error) {
    console.error("Error in test-inactive:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
