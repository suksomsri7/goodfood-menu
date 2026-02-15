import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { checkUsageLimit, logAiUsage } from "@/lib/usage-limits";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ingredients, weight, quantity, lineUserId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Food name is required" },
        { status: 400 }
      );
    }

    // Check usage limit if lineUserId is provided
    if (lineUserId) {
      const limitCheck = await checkUsageLimit(lineUserId, "dailyAiTextAnalysisLimit");
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { 
            error: limitCheck.message,
            limitReached: true,
            limit: limitCheck.limit,
            used: limitCheck.used,
          },
          { status: 429 }
        );
      }
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        data: {
          calories: 300,
          protein: 15,
          carbs: 40,
          fat: 12,
          sodium: 500,
          sugar: 5,
          description: "⚠️ ไม่พบ API Key กรุณากรอกข้อมูลด้วยตนเอง",
        },
      });
    }

    // Fetch user context for coaching
    let userContext = "";
    if (lineUserId) {
      try {
        const member = await prisma.member.findUnique({
          where: { lineUserId },
        });
        if (member) {
          const now = new Date();
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);

          const meals = await prisma.mealLog.findMany({
            where: {
              memberId: member.id,
              date: { gte: startOfDay, lte: endOfDay },
            },
          });

          const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
          const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
          const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
          const totalFat = meals.reduce((sum, m) => sum + m.fat, 0);

          const goalCalories = member.dailyCalories || 2000;
          const goalProtein = member.dailyProtein || 150;
          const goalCarbs = member.dailyCarbs || 250;
          const goalFat = member.dailyFat || 65;
          const remainCal = goalCalories - totalCalories;
          const remainPro = goalProtein - totalProtein;

          userContext = `\n\n--- ข้อมูลผู้ใช้ ---
ชื่อ: ${member.name || "ผู้ใช้"}
เพศ: ${member.gender === "female" ? "หญิง" : "ชาย"}
น้ำหนัก: ${member.weight || 70} kg | เป้าหมาย: ${member.goalWeight || 65} kg
เป้าหมายวันนี้: ${goalCalories} kcal | โปรตีน ${goalProtein}g | คาร์บ ${goalCarbs}g | ไขมัน ${goalFat}g
ทานไปแล้ววันนี้: ${totalCalories} kcal | โปรตีน ${totalProtein}g | คาร์บ ${totalCarbs}g | ไขมัน ${totalFat}g
เหลือ: ${remainCal} kcal | โปรตีน ${remainPro}g
จำนวนมื้อที่ทานไปแล้ว: ${meals.length} มื้อ`;
        }
      } catch (e) {
        console.error("Error fetching user context:", e);
      }
    }

    // Build prompt
    let prompt = `วิเคราะห์สารอาหารของอาหารต่อไปนี้ พร้อมให้คำแนะนำแบบโค้ชส่วนตัว:

ชื่ออาหาร: ${name}`;

    if (ingredients) {
      prompt += `\nส่วนประกอบ: ${ingredients}`;
    }

    if (weight) {
      prompt += `\nน้ำหนัก: ${weight} กรัม`;
    }

    if (quantity && quantity !== 1) {
      prompt += `\nจำนวน: ${quantity} ที่`;
    }

    if (userContext) {
      prompt += userContext;
    }

    prompt += `

กรุณาประมาณค่าสารอาหารต่อ 1 หน่วย และตอบเป็น JSON format เท่านั้น:
{
  "calories": แคลอรี่ (number),
  "protein": โปรตีนเป็นกรัม (number),
  "carbs": คาร์โบไฮเดรตเป็นกรัม (number),
  "fat": ไขมันเป็นกรัม (number),
  "sodium": โซเดียมเป็นมิลลิกรัม (number),
  "sugar": น้ำตาลเป็นกรัม (number),
  "description": "คำอธิบายสั้นๆ",
  "coaching": {
    "verdict": "GOOD" หรือ "OK" หรือ "CAUTION" หรือ "NOT_RECOMMENDED",
    "verdictText": "ข้อความสั้น 1 บรรทัด เช่น 'เหมาะมาก!' หรือ 'ควรระวัง' หรือ 'ไม่แนะนำ'",
    "reason": "เหตุผลว่าทำไมถึงเหมาะหรือไม่เหมาะ อธิบายสั้นๆ 1-2 ประโยค",
    "impact": "ถ้าทานมื้อนี้ไปแล้ว ผลลัพธ์จะเป็นอย่างไร เช่น แคลอรี่จะเกิน/ยังเหลือเท่าไหร่",
    "suggestion": "คำแนะนำจากโค้ช 1-2 ข้อ"
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `คุณคือ "AI Coach" โค้ชโภชนาการส่วนตัวมืออาชีพ มีอาชีพเป็นนักโภชนาการ นักกำหนดอาหาร และเทรนเนอร์สุขภาพ
ให้ประมาณค่าสารอาหารของอาหารไทยและอาหารทั่วไป พร้อมให้คำแนะนำว่าอาหารนี้เหมาะสมกับเป้าหมายของผู้ใช้หรือไม่
ใช้น้ำเสียงเป็นกันเอง เหมือนโค้ชส่วนตัวพูดกับลูกค้า
ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown code block`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON response
    let nutritionData;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse nutrition data");
    }

    // Log usage after successful analysis
    if (lineUserId) {
      await logAiUsage(lineUserId, "dailyAiTextAnalysisLimit");
    }

    return NextResponse.json({
      success: true,
      data: nutritionData,
    });
  } catch (error: unknown) {
    console.error("Food text analysis error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze food",
        data: {
          calories: 300,
          protein: 15,
          carbs: 40,
          fat: 12,
          sodium: 500,
          sugar: 5,
          description: "เกิดข้อผิดพลาด กรุณากรอกข้อมูลด้วยตนเอง",
        },
      },
      { status: 200 }
    );
  }
}
