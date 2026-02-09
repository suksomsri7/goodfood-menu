import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  CoachingType,
  shouldSendNotification,
  gatherMemberContext,
  generateCoachingMessage,
  createCoachingFlexMessage
} from "@/lib/coaching";
import { pushMessage } from "@/lib/line";
import { Prisma } from "@prisma/client";

// Verify cron secret (optional security)
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // Skip if not configured
  
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

// Member type with memberType relation included
type MemberWithType = Prisma.MemberGetPayload<{
  include: { memberType: true }
}>;

export async function GET(request: NextRequest) {
  console.log("[Coaching Cron] Called:", request.url);

  // Verify secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as CoachingType;

  if (!type || !["morning", "lunch", "dinner", "evening"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Use: morning, lunch, dinner, or evening" },
      { status: 400 }
    );
  }

  try {
    // Get all active members with course start date
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        courseStartDate: { not: null },
      },
      include: {
        memberType: true,
      },
    }) as MemberWithType[];

    console.log(`[Coaching Cron] Processing ${type} for ${members.length} members`);

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
            continue; // Course ended
          }
        }

        // Check notification preference
        const shouldSend = await shouldSendNotification(member.id, type);
        
        if (!shouldSend) {
          skipped++;
          continue;
        }

        // Gather context and generate message
        const context = await gatherMemberContext(member.id);
        if (!context) {
          failed++;
          continue;
        }

        const message = await generateCoachingMessage(type, context);
        const flexMessage = createCoachingFlexMessage(type, message, context);
        
        const success = await pushMessage(member.lineUserId, [flexMessage]);
        
        if (success) {
          sent++;
        } else {
          failed++;
        }

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing member ${member.id}:`, error);
        failed++;
      }
    }

    console.log(`[Coaching Cron] ${type}: Sent ${sent}, Skipped ${skipped}, Failed ${failed}`);

    return NextResponse.json({
      success: true,
      type,
      stats: { sent, skipped, failed, total: members.length },
    });
  } catch (error) {
    console.error("[Coaching Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to process coaching cron" },
      { status: 500 }
    );
  }
}
