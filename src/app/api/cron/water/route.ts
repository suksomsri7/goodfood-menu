import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  shouldSendWaterReminder,
  gatherMemberContext,
  generateCoachingMessage,
  createCoachingFlexMessage
} from "@/lib/coaching";
import { pushMessage } from "@/lib/line";
import { Prisma } from "@prisma/client";

// Verify cron secret (optional security)
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
    // Get all active members with water reminder enabled
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        notifyWaterReminder: true,
        courseStartDate: { not: null },
        OR: [
          { notificationsPausedUntil: null },
          { notificationsPausedUntil: { lt: new Date() } },
        ],
      },
      include: {
        memberType: true,
      },
    }) as MemberWithType[];

    console.log(`[Water Cron] Processing for ${members.length} members`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const member of members) {
      try {
        // Check if within course duration
        if (member.courseStartDate && member.memberType) {
          const daysSinceStart = Math.floor(
            (Date.now() - member.courseStartDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysSinceStart >= member.memberType.courseDuration) {
            skipped++;
            continue;
          }
        }

        // Check if user needs water reminder (smart check)
        const needsReminder = await shouldSendWaterReminder(member.id);
        if (!needsReminder) {
          skipped++;
          continue;
        }

        // Gather context and generate message
        const context = await gatherMemberContext(member.id);
        if (!context) {
          failed++;
          continue;
        }

        const message = await generateCoachingMessage("water", context);
        const flexMessage = createCoachingFlexMessage("water", message, context);
        
        const success = await pushMessage(member.lineUserId, [flexMessage]);
        
        if (success) {
          sent++;
        } else {
          failed++;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing water reminder for member ${member.id}:`, error);
        failed++;
      }
    }

    console.log(`[Water Cron] Sent ${sent}, Skipped ${skipped}, Failed ${failed}`);

    return NextResponse.json({
      success: true,
      stats: { sent, skipped, failed, total: members.length },
    });
  } catch (error) {
    console.error("[Water Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to process water cron" },
      { status: 500 }
    );
  }
}
