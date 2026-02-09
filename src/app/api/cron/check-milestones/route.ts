import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  gatherMemberContext,
  generateCoachingMessage,
  createCoachingFlexMessage,
  getCourseProgress
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

// Milestone percentages to celebrate
const MILESTONES = [25, 50, 75, 100];

// Member type with memberType relation included
type MemberWithType = Prisma.MemberGetPayload<{
  include: { memberType: true }
}>;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active members with course
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        courseStartDate: { not: null },
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
        if (!member.courseStartDate || !member.memberType) {
          skipped++;
          continue;
        }

        const { day, progress } = getCourseProgress(
          member.courseStartDate,
          member.memberType.courseDuration
        );

        // Check if notifications are paused
        if (member.notificationsPausedUntil && member.notificationsPausedUntil > new Date()) {
          skipped++;
          continue;
        }

        // Check if today is a milestone day
        const isMilestoneDay = MILESTONES.some((milestone) => {
          const targetDay = Math.ceil((milestone / 100) * member.memberType!.courseDuration);
          return day === targetDay;
        });

        if (!isMilestoneDay) {
          skipped++;
          continue;
        }

        // Check if we already sent this milestone (avoid duplicate sends)
        // We could store this in DB, but for simplicity we'll just check if it's the exact day

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
          console.log(`[Milestone Cron] Sent ${progress}% milestone to member ${member.id}`);
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
