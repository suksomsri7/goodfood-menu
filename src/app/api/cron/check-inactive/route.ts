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

// Member type with memberType relation included
type MemberWithType = Prisma.MemberGetPayload<{
  include: { memberType: true }
}>;

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get system settings
    const settings = await prisma.systemSetting.findUnique({
      where: { id: "system" },
    });

    const inactiveDaysThreshold = settings?.inactiveDaysThreshold ?? 7;
    const gracePeriodDays = settings?.gracePeriodDays ?? 2;

    // Get all members that are still "active" status
    const members = await prisma.member.findMany({
      where: {
        isActive: true, // Account is enabled
        activityStatus: "active", // Not yet marked inactive
      },
      include: {
        memberType: true,
      },
    }) as MemberWithType[];

    // Filter members with lastActiveAt set (skip those without)
    const membersWithActivity = members.filter(m => m.lastActiveAt !== null);

    console.log(`[Inactive Cron] Checking ${membersWithActivity.length} active members (${members.length - membersWithActivity.length} skipped - no activity data)`);

    const now = new Date();
    let changedToInactive = 0;
    let gracePeriodReminders = 0;
    let stillActive = 0;
    let failed = 0;

    for (const member of membersWithActivity) {
      try {
        const lastActive = member.lastActiveAt || member.createdAt;
        const daysSinceActive = Math.floor(
          (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Case 1: Past threshold - change to inactive
        if (daysSinceActive >= inactiveDaysThreshold) {
          await prisma.member.update({
            where: { id: member.id },
            data: {
              activityStatus: "inactive",
              inactiveSince: now,
              welcomeBackShown: false, // Reset so modal shows when they return
            },
          });
          changedToInactive++;
          console.log(`[Inactive Cron] Member ${member.id} changed to inactive (${daysSinceActive} days)`);
          continue;
        }

        // Case 2: In grace period - send reminder
        const gracePeriodStart = inactiveDaysThreshold - gracePeriodDays;
        if (daysSinceActive >= gracePeriodStart && daysSinceActive < inactiveDaysThreshold) {
          // Check if AI Coach is active (only send reminder if AI Coach enabled)
          if (!isAiCoachActive(member)) {
            stillActive++;
            continue;
          }

          // Check if notifications are paused
          if (member.notificationsPausedUntil && member.notificationsPausedUntil > now) {
            stillActive++;
            continue;
          }

          // Send grace period reminder (once per day based on days calculation)
          // Only send on first day of grace period to avoid spamming
          if (daysSinceActive === gracePeriodStart) {
            const context = await gatherMemberContext(member.id);
            if (context) {
              const message = await generateCoachingMessage("inactive", context);
              const flexMessage = createCoachingFlexMessage("inactive", message, context);
              
              const success = await pushMessage(member.lineUserId, [flexMessage]);
              if (success) {
                gracePeriodReminders++;
                console.log(`[Inactive Cron] Sent grace period reminder to member ${member.id}`);
              } else {
                failed++;
              }
            }
          }
        }

        stillActive++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Error processing member ${member.id}:`, error);
        failed++;
      }
    }

    console.log(`[Inactive Cron] Changed to inactive: ${changedToInactive}, Grace reminders: ${gracePeriodReminders}, Still active: ${stillActive}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      stats: {
        total: membersWithActivity.length,
        changedToInactive,
        gracePeriodReminders,
        stillActive,
        failed,
      },
      settings: {
        inactiveDaysThreshold,
        gracePeriodDays,
      },
    });
  } catch (error) {
    console.error("[Inactive Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to process inactive check" },
      { status: 500 }
    );
  }
}
