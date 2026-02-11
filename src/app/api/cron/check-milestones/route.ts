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

// Membership milestones (in days) to celebrate
const MILESTONES = [7, 14, 30, 60, 90, 180, 365];

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
    // Skip members who are "inactive" (haven't used app recently)
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        activityStatus: "active", // Skip inactive members - no LINE messages for them
        memberTypeId: { not: null },
      },
      include: {
        memberType: true,
      },
    }) as MemberWithType[];

    console.log(`[Milestone Cron] Checking ${members.length} members`);

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

        // Calculate days since member creation
        const daysSinceCreated = Math.floor(
          (Date.now() - member.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if today is a milestone day
        const isMilestoneDay = MILESTONES.includes(daysSinceCreated);

        if (!isMilestoneDay) {
          skipped++;
          continue;
        }

        const context = await gatherMemberContext(member.id);
        if (!context) {
          failed++;
          continue;
        }

        const message = await generateCoachingMessage("milestone", context);
        const flexMessage = createCoachingFlexMessage("milestone", message, context);
        
        const success = await pushMessage(member.lineUserId, [flexMessage]);
        
        if (success) {
          sent++;
          console.log(`[Milestone Cron] Sent ${daysSinceCreated}-day milestone to member ${member.id}`);
        } else {
          failed++;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error checking milestone for member ${member.id}:`, error);
        failed++;
      }
    }

    console.log(`[Milestone Cron] Sent ${sent}, Skipped ${skipped}, Failed ${failed}`);

    return NextResponse.json({
      success: true,
      stats: { sent, skipped, failed, total: members.length },
    });
  } catch (error) {
    console.error("[Milestone Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to process milestone check" },
      { status: 500 }
    );
  }
}
