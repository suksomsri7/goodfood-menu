import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  gatherMemberContext,
  generateCoachingMessage,
  createCoachingFlexMessage,
  isAiCoachActive
} from "@/lib/coaching";
import { pushMessage } from "@/lib/line";
import { Prisma } from "@prisma/client";

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

// Member type with memberType relation included
type MemberWithType = Prisma.MemberGetPayload<{
  include: { memberType: true }
}>;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active members with AI Coach
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        memberTypeId: { not: null },
      },
      include: {
        memberType: true,
      },
    }) as MemberWithType[];

    console.log(`[Inactive Cron] Checking ${members.length} members`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const member of members) {
      try {
        // Check if AI Coach is active
        if (!isAiCoachActive(member)) {
          skipped++;
          continue;
        }

        // Check if notifications are paused
        if (member.notificationsPausedUntil && member.notificationsPausedUntil > new Date()) {
          skipped++;
          continue;
        }

        // Get inactive threshold from member type (default 2 days)
        const inactiveDays = member.memberType?.inactiveReminderDays || 2;

        // Check last meal log
        const lastMealLog = await prisma.mealLog.findFirst({
          where: { memberId: member.id },
          orderBy: { date: "desc" },
        });

        if (!lastMealLog) {
          // Never logged - check if member joined more than threshold days ago
          const daysSinceCreated = Math.floor(
            (Date.now() - member.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysSinceCreated < inactiveDays) {
            skipped++;
            continue;
          }
        } else {
          // Check days since last log
          const daysSinceLastLog = Math.floor(
            (Date.now() - lastMealLog.date.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceLastLog < inactiveDays) {
            skipped++;
            continue; // Still active
          }
        }

        // User is inactive - send reminder
        const context = await gatherMemberContext(member.id);
        if (!context) {
          failed++;
          continue;
        }

        const message = await generateCoachingMessage("inactive", context);
        const flexMessage = createCoachingFlexMessage("inactive", message, context);
        
        const success = await pushMessage(member.lineUserId, [flexMessage]);
        
        if (success) {
          sent++;
          console.log(`[Inactive Cron] Sent reminder to member ${member.id}`);
        } else {
          failed++;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error checking inactive for member ${member.id}:`, error);
        failed++;
      }
    }

    console.log(`[Inactive Cron] Sent ${sent}, Skipped ${skipped}, Failed ${failed}`);

    return NextResponse.json({
      success: true,
      stats: { sent, skipped, failed, total: members.length },
    });
  } catch (error) {
    console.error("[Inactive Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to process inactive check" },
      { status: 500 }
    );
  }
}
