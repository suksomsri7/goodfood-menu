import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSecret } from "@/lib/secrets/store";

// Rate limit: 10 requests per day per user
const DAILY_REQUEST_LIMIT = 10;

// Fallback messages when AI is unavailable
const FALLBACK_MESSAGES = [
  "ทานอาหารให้ครบ 3 มื้อ และดื่มน้ำให้เพียงพอนะคะ 💪",
  "พยายามเพิ่มผักและโปรตีนในทุกมื้ออาหาร 🥗",
  "อย่าลืมพักผ่อนให้เพียงพอควบคู่กับการทานอาหาร 😊",
  "การทานอาหารตรงเวลาช่วยให้ร่างกายเผาผลาญได้ดีขึ้น ⏰",
  "ลองเพิ่มโปรตีนในมื้อเช้าเพื่อให้อิ่มนานขึ้น 🍳",
];

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้านโภชนาการส่วนบุคคล หน้าที่ของคุณคือให้คำแนะนำเกี่ยวกับการทานอาหาร

กฎสำคัญ:
1. ตอบเป็นภาษาไทยเท่านั้น
2. ตอบสั้นๆ กระชับ 1-2 ประโยค (ไม่เกิน 100 ตัวอักษร)
3. เป็นมิตรและให้กำลังใจ
4. ถ้ามีอาหารใน Stock แนะนำจาก Stock ก่อน
5. ให้คำแนะนำที่ปฏิบัติได้จริง
6. ใช้ emoji 1-2 ตัวให้เหมาะสม

ห้าม:
- ตอบยาวเกินไป
- ใช้ศัพท์วิชาการมากเกินไป
- พูดถึงแคลอรี่ตัวเลขมากเกินไป`;

function getRandomFallback(): string {
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
}

// Check if recommendation is from today
function isFromToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// GET - ดึงคำแนะนำ (จาก cache หรือ generate ใหม่)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    // Find member
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      include: {
        aiRecommendation: true,
      },
    });

    if (!member) {
      return NextResponse.json({ message: getRandomFallback() });
    }

    // Check if we have a valid cached recommendation from today
    if (
      !forceRefresh &&
      member.aiRecommendation &&
      isFromToday(member.aiRecommendation.date)
    ) {
      return NextResponse.json({
        message: member.aiRecommendation.message,
        cached: true,
      });
    }

    // Check rate limit
    if (
      member.aiRecommendation &&
      isFromToday(member.aiRecommendation.date) &&
      member.aiRecommendation.requestCount >= DAILY_REQUEST_LIMIT
    ) {
      return NextResponse.json({
        message: member.aiRecommendation.message,
        cached: true,
        rateLimited: true,
      });
    }

    // Check for API key
    const apiKey = await getSecret("OPENAI_API_KEY");
    if (!apiKey) {
      console.log("OPENAI_API_KEY not configured, using fallback");
      return NextResponse.json({ message: getRandomFallback() });
    }

    // Gather context data for AI
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's meals
    const todayMeals = await prisma.mealLog.findMany({
      where: {
        memberId: member.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { date: "desc" },
    });

    // Get recent orders (stock)
    const recentOrders = await prisma.order.findMany({
      where: {
        memberId: member.id,
        status: { in: ["confirmed", "preparing", "ready"] },
      },
      include: {
        items: true,
      },
      take: 3,
      orderBy: { createdAt: "desc" },
    });

    // Calculate today's totals
    const consumed = todayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // Get stock items
    const stockItems = recentOrders.flatMap((order) =>
      order.items.map((item) => ({
        name: item.foodName,
        calories: item.calories || 0,
      }))
    );

    // Build context for AI
    const context = {
      goalType: member.goalType || "maintain",
      targetCalories: member.dailyCalories || 2000,
      targetProtein: member.dailyProtein || 100,
      consumedCalories: Math.round(consumed.calories),
      consumedProtein: Math.round(consumed.protein),
      remainingCalories: Math.round(
        (member.dailyCalories || 2000) - consumed.calories
      ),
      mealsEaten: todayMeals.map((m) => m.name),
      stockItems: stockItems.slice(0, 5),
      currentHour: new Date().getHours(),
    };

    // Build user message for AI
    const userMessage = `ข้อมูลผู้ใช้:
- เป้าหมาย: ${context.goalType === "lose" ? "ลดน้ำหนัก" : context.goalType === "gain" ? "เพิ่มน้ำหนัก" : "รักษาน้ำหนัก"}
- เป้าหมายแคลอรี่: ${context.targetCalories} Kcal/วัน
- ทานไปแล้ววันนี้: ${context.consumedCalories} Kcal
- เหลืออีก: ${context.remainingCalories} Kcal
- มื้อที่ทานไปแล้ว: ${context.mealsEaten.length > 0 ? context.mealsEaten.join(", ") : "ยังไม่ได้ทาน"}
- อาหารใน Stock: ${context.stockItems.length > 0 ? context.stockItems.map((s) => s.name).join(", ") : "ไม่มี"}
- เวลาปัจจุบัน: ${context.currentHour}:00 น.

กรุณาให้คำแนะนำสั้นๆ สำหรับมื้อถัดไป`;

    try {
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const aiMessage =
        response.choices[0]?.message?.content?.trim() || getRandomFallback();

      // Save/update recommendation in DB
      const newRequestCount =
        member.aiRecommendation && isFromToday(member.aiRecommendation.date)
          ? member.aiRecommendation.requestCount + 1
          : 1;

      await prisma.aiRecommendation.upsert({
        where: { memberId: member.id },
        update: {
          message: aiMessage,
          context: context,
          date: new Date(),
          requestCount: newRequestCount,
        },
        create: {
          memberId: member.id,
          message: aiMessage,
          context: context,
          date: new Date(),
          requestCount: 1,
        },
      });

      return NextResponse.json({
        message: aiMessage,
        cached: false,
      });
    } catch (aiError) {
      console.error("OpenAI API error:", aiError);
      return NextResponse.json({ message: getRandomFallback() });
    }
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json({ message: getRandomFallback() });
  }
}

// DELETE - ลบ cache (trigger regenerate)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json({ success: true });
    }

    // Delete recommendation cache
    await prisma.aiRecommendation.deleteMany({
      where: { memberId: member.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete recommendation error:", error);
    return NextResponse.json({ success: true });
  }
}
