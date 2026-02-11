import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  gatherMemberContext,
  isWeeklyMilestoneFromCreated,
  isAiCoachActive
} from "@/lib/coaching";
import { pushMessage, createFlexMessage } from "@/lib/line";
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

    console.log(`[Weekly Cron] Processing for ${members.length} members`);

    let insightsSent = 0;
    let photoRemindersSent = 0;
    let weightRemindersSent = 0;
    let skipped = 0;
    let failed = 0;

    for (const member of members) {
      try {
        // Check if it's a weekly milestone for this member
        if (!isWeeklyMilestoneFromCreated(member.createdAt)) {
          skipped++;
          continue;
        }

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

        const context = await gatherMemberContext(member.id);
        if (!context) {
          failed++;
          continue;
        }

        // Calculate week number from member creation
        const daysSinceCreated = Math.floor(
          (Date.now() - member.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekNumber = Math.floor(daysSinceCreated / 7);

        // Send Weekly Insights if enabled
        if (member.notifyWeeklyInsights) {
          const insightsMessage = await generateWeeklyInsights(member.id, context, weekNumber);
          const flexMessage = createWeeklyInsightsFlexMessage(insightsMessage, context, weekNumber);
          
          const success = await pushMessage(member.lineUserId, [flexMessage]);
          if (success) insightsSent++;
        }

        // Send Progress Photo Reminder if enabled
        if (member.notifyProgressPhoto) {
          const photoFlexMessage = createProgressPhotoReminderFlexMessage(context, weekNumber);
          
          // Add delay between messages
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          const success = await pushMessage(member.lineUserId, [photoFlexMessage]);
          if (success) photoRemindersSent++;
        }

        // Send Weight Reminder if enabled
        if ((member as any).notifyWeightReminder) {
          const weightFlexMessage = createWeightReminderFlexMessage(context, weekNumber);
          
          // Add delay between messages
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          const success = await pushMessage(member.lineUserId, [weightFlexMessage]);
          if (success) weightRemindersSent++;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing weekly for member ${member.id}:`, error);
        failed++;
      }
    }

    console.log(`[Weekly Cron] Insights: ${insightsSent}, Photo reminders: ${photoRemindersSent}, Weight reminders: ${weightRemindersSent}, Skipped: ${skipped}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      stats: { insightsSent, photoRemindersSent, weightRemindersSent, skipped, failed, total: members.length },
    });
  } catch (error) {
    console.error("[Weekly Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to process weekly cron" },
      { status: 500 }
    );
  }
}

// Generate weekly insights message
async function generateWeeklyInsights(
  memberId: string,
  context: Awaited<ReturnType<typeof gatherMemberContext>>,
  weekNumber: number
): Promise<string> {
  if (!context) return "";
  
  // Get week's meal logs for analysis
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekMeals = await prisma.mealLog.findMany({
    where: {
      memberId,
      date: { gte: weekStart },
    },
  });

  // Calculate weekly stats
  const dailyStats: Record<number, { calories: number; protein: number; carbs: number; fat: number; mealCount: number }> = {};
  
  weekMeals.forEach((meal) => {
    const dayOfWeek = meal.date.getDay();
    if (!dailyStats[dayOfWeek]) {
      dailyStats[dayOfWeek] = { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
    }
    dailyStats[dayOfWeek].calories += meal.calories;
    dailyStats[dayOfWeek].protein += meal.protein;
    dailyStats[dayOfWeek].carbs += meal.carbs;
    dailyStats[dayOfWeek].fat += meal.fat;
    dailyStats[dayOfWeek].mealCount += 1;
  });

  // Find patterns
  const daysOverTarget: string[] = [];
  const daysUnderProtein: string[] = [];
  const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

  Object.entries(dailyStats).forEach(([day, stats]) => {
    if (stats.calories > context!.targets.calories * 1.1) {
      daysOverTarget.push(dayNames[parseInt(day)]);
    }
    if (stats.protein < context!.targets.protein * 0.8) {
      daysUnderProtein.push(dayNames[parseInt(day)]);
    }
  });

  // Build insights message
  let message = `📊 สรุปสัปดาห์ที่ ${weekNumber}\n\n`;
  
  const avgCalories = weekMeals.reduce((sum, m) => sum + m.calories, 0) / 7;
  const avgProtein = weekMeals.reduce((sum, m) => sum + m.protein, 0) / 7;
  
  message += `📈 ค่าเฉลี่ยต่อวัน:\n`;
  message += `• แคลอรี่: ${Math.round(avgCalories)} kcal\n`;
  message += `• โปรตีน: ${Math.round(avgProtein)}g\n\n`;

  if (daysOverTarget.length > 0) {
    message += `⚠️ วันที่ทานเกินเป้า: ${daysOverTarget.join(", ")}\n`;
  }
  
  if (daysUnderProtein.length > 0) {
    message += `💪 วันที่โปรตีนไม่ถึงเป้า: ${daysUnderProtein.join(", ")}\n`;
  }

  if (context!.weightChange !== null) {
    const changeText = context!.weightChange > 0 ? `+${context!.weightChange.toFixed(1)}` : context!.weightChange.toFixed(1);
    message += `\n⚖️ น้ำหนักเปลี่ยน: ${changeText} kg`;
  }

  return message;
}

// Create Weekly Insights Flex Message
function createWeeklyInsightsFlexMessage(
  message: string,
  context: Awaited<ReturnType<typeof gatherMemberContext>>,
  weekNumber: number
) {
  if (!context) {
    return createFlexMessage("💡 Insights สัปดาห์", {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "ไม่สามารถโหลดข้อมูลได้", wrap: true },
        ],
      },
    });
  }

  // Build status text
  const statusText = context.aiCoach.isUnlimited 
    ? "AI Coach ∞" 
    : context.aiCoach.daysRemaining 
      ? `AI Coach (เหลือ ${context.aiCoach.daysRemaining} วัน)` 
      : "AI Coach";

  return createFlexMessage(`💡 Insights สัปดาห์ที่ ${weekNumber}`, {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "💡", size: "xl", flex: 0 },
            {
              type: "text",
              text: `Insights สัปดาห์ที่ ${weekNumber}`,
              weight: "bold",
              size: "lg",
              color: "#1DB446",
              margin: "md",
            },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          contents: [
            {
              type: "text",
              text: statusText,
              size: "sm",
              color: "#888888",
            },
          ],
        },
        { type: "separator", margin: "lg" },
        {
          type: "text",
          text: message,
          wrap: true,
          size: "sm",
          margin: "lg",
          color: "#333333",
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          action: {
            type: "uri",
            label: "ดูรายละเอียด",
            uri: process.env.LIFF_URL || "https://liff.line.me/2009033721-Ou7cdCtC",
          },
        },
      ],
    },
  });
}

// Create Progress Photo Reminder Flex Message
function createProgressPhotoReminderFlexMessage(
  context: Awaited<ReturnType<typeof gatherMemberContext>>,
  weekNumber: number
) {
  if (!context) {
    return createFlexMessage("📸 ถ่ายรูปความคืบหน้า", {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "ไม่สามารถโหลดข้อมูลได้", wrap: true },
        ],
      },
    });
  }

  const weightText = context.weightChange !== null
    ? `น้ำหนักเปลี่ยน: ${context.weightChange > 0 ? "+" : ""}${context.weightChange.toFixed(1)} kg`
    : "";

  return createFlexMessage("📸 ถ่ายรูปความคืบหน้า", {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "📸", size: "xl", flex: 0 },
            {
              type: "text",
              text: "ถ่ายรูปความคืบหน้า!",
              weight: "bold",
              size: "lg",
              color: "#1DB446",
              margin: "md",
            },
          ],
        },
        {
          type: "text",
          text: `สัปดาห์ที่ ${weekNumber}`,
          size: "sm",
          color: "#888888",
          margin: "md",
        },
        { type: "separator", margin: "lg" },
        {
          type: "text",
          text: `สวัสดีครับ${context.name}!\n\nถึงเวลาถ่ายรูปบันทึกความคืบหน้าแล้วครับ ${weightText}\n\n💡 Tips:\n• ยืนตรง หน้าตรง และด้านข้าง\n• แสงสว่างเพียงพอ\n• ใส่เสื้อผ้าเดิมทุกครั้ง`,
          wrap: true,
          size: "sm",
          margin: "lg",
          color: "#333333",
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          action: {
            type: "uri",
            label: "📷 ถ่ายรูปเลย",
            uri: `${process.env.LIFF_URL || "https://liff.line.me/2009033721-Ou7cdCtC"}/progress-photo`,
          },
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "message",
            label: "ข้ามสัปดาห์นี้",
            text: "ข้ามถ่ายรูปสัปดาห์นี้",
          },
        },
      ],
    },
  });
}

// Create Weight Reminder Flex Message
function createWeightReminderFlexMessage(
  context: Awaited<ReturnType<typeof gatherMemberContext>>,
  weekNumber: number
) {
  if (!context) {
    return createFlexMessage("⚖️ เตือนชั่งน้ำหนัก", {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "ไม่สามารถโหลดข้อมูลได้", wrap: true },
        ],
      },
    });
  }

  // Build weight info text
  let weightInfoText = "";
  if (context.goal.currentWeight) {
    weightInfoText += `น้ำหนักล่าสุด: ${context.goal.currentWeight} kg`;
  }
  if (context.goal.targetWeight) {
    weightInfoText += weightInfoText ? "\n" : "";
    weightInfoText += `เป้าหมาย: ${context.goal.targetWeight} kg`;
  }
  if (context.weightChange !== null) {
    const changeText = context.weightChange > 0 ? `+${context.weightChange.toFixed(1)}` : context.weightChange.toFixed(1);
    weightInfoText += weightInfoText ? "\n" : "";
    weightInfoText += `เปลี่ยนแปลง: ${changeText} kg`;
  }

  return createFlexMessage("⚖️ เตือนชั่งน้ำหนัก", {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "⚖️", size: "xl", flex: 0 },
            {
              type: "text",
              text: "ถึงเวลาชั่งน้ำหนัก!",
              weight: "bold",
              size: "lg",
              color: "#2196F3",
              margin: "md",
            },
          ],
        },
        {
          type: "text",
          text: `สัปดาห์ที่ ${weekNumber}`,
          size: "sm",
          color: "#888888",
          margin: "md",
        },
        { type: "separator", margin: "lg" },
        {
          type: "text",
          text: `สวัสดีตอนเช้า ${context.name}!\n\nอย่าลืมชั่งน้ำหนักวันนี้นะครับ เพื่อติดตามความก้าวหน้าของคุณ`,
          wrap: true,
          size: "sm",
          margin: "lg",
          color: "#333333",
        },
        ...(weightInfoText ? [
          {
            type: "box" as const,
            layout: "vertical" as const,
            margin: "lg" as const,
            paddingAll: "12px",
            backgroundColor: "#E3F2FD",
            cornerRadius: "8px",
            contents: [
              {
                type: "text" as const,
                text: weightInfoText,
                size: "sm" as const,
                color: "#1565C0",
                wrap: true,
              },
            ],
          },
        ] : []),
        {
          type: "text",
          text: "💡 Tips:\n• ชั่งตอนเช้าหลังตื่นนอน\n• ก่อนทานอาหารและดื่มน้ำ\n• ใส่เสื้อผ้าเบาๆ หรือไม่ใส่",
          wrap: true,
          size: "xs",
          margin: "lg",
          color: "#666666",
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#2196F3",
          action: {
            type: "uri",
            label: "⚖️ บันทึกน้ำหนัก",
            uri: "https://liff.line.me/2009033721-QFRs8owx",
          },
        },
      ],
    },
  });
}
