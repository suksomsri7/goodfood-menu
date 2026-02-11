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

// Type for time-based coaching (morning, lunch, dinner, evening only)
type TimeBasedCoachingType = "morning" | "lunch" | "dinner" | "evening";

// Map coaching type to MemberType time field
const timeFieldMap: Record<TimeBasedCoachingType, string> = {
  morning: "morningCoachTime",
  lunch: "lunchReminderTime",
  dinner: "dinnerReminderTime",
  evening: "eveningSummaryTime",
};

// Get current Thai time in HH:mm format
function getCurrentThaiTime(): string {
  const now = new Date();
  // Convert to Thai timezone (UTC+7)
  const thaiTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return thaiTime.toISOString().slice(11, 16); // HH:mm format
}

// Check if member's notification time matches current time window (±30 min)
function isWithinTimeWindow(memberTime: string, currentTime: string, windowMinutes: number = 30): boolean {
  const [memberHour, memberMin] = memberTime.split(":").map(Number);
  const [currentHour, currentMin] = currentTime.split(":").map(Number);
  
  const memberTotalMin = memberHour * 60 + memberMin;
  const currentTotalMin = currentHour * 60 + currentMin;
  
  const diff = Math.abs(memberTotalMin - currentTotalMin);
  // Handle midnight crossing
  const adjustedDiff = Math.min(diff, 1440 - diff);
  
  return adjustedDiff <= windowMinutes;
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
    const currentTime = getCurrentThaiTime();
    console.log(`[Coaching Cron] Current Thai time: ${currentTime}`);

    // Get all active members with AI Coach configured
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        memberTypeId: { not: null },
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
        // Check if AI Coach is active
        if (member.memberType) {
          // Skip if member type is disabled
          if (!member.memberType.isActive) {
            skipped++;
            continue; // AI Coach disabled for this type
          }
          
          const isUnlimited = member.memberType.courseDuration === 0;
          const isExpired = !isUnlimited && 
            (!member.aiCoachExpireDate || member.aiCoachExpireDate < new Date());
          
          if (isExpired) {
            skipped++;
            continue; // AI Coach expired
          }

          // Check if member's time setting matches current time
          const timeField = timeFieldMap[type as TimeBasedCoachingType];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const memberTime = (member.memberType as any)[timeField] as string;
          if (memberTime && !isWithinTimeWindow(memberTime, currentTime)) {
            skipped++;
            continue; // Not the right time for this member
          }
        }

        // Check notification preference (this also checks isAiCoachActive)
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
      currentTime,
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
