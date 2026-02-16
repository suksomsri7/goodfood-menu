import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { checkUsageLimit, logAiUsage } from "@/lib/usage-limits";

const BASE_SYSTEM_PROMPT = `คุณคือ "AI Coach" โค้ชโภชนาการส่วนตัวมืออาชีพ มีอาชีพเป็นนักโภชนาการ นักกำหนดอาหาร และเทรนเนอร์สุขภาพ

หน้าที่ของคุณคือ:
1. วิเคราะห์อาหารจากรูปภาพและประมาณค่าสารอาหาร
2. ให้คำแนะนำแบบโค้ชส่วนตัว ว่าอาหารนี้เหมาะสมกับเป้าหมายของผู้ใช้หรือไม่

กรุณาตอบกลับเป็น JSON format เท่านั้น ดังนี้:

{
  "name": "ชื่ออาหาร (ภาษาไทย)",
  "ingredients": "ส่วนประกอบหลัก คั่นด้วยเครื่องหมายจุลภาค",
  "weight": ประมาณน้ำหนักเป็นกรัม (number),
  "calories": แคลอรี่ (number),
  "protein": โปรตีนเป็นกรัม (number),
  "carbs": คาร์โบไฮเดรตเป็นกรัม (number),
  "fat": ไขมันเป็นกรัม (number),
  "sodium": โซเดียมเป็นมิลลิกรัม (number),
  "sugar": น้ำตาลเป็นกรัม (number),
  "description": "คำอธิบายสั้นๆ เกี่ยวกับอาหาร",
  "coaching": {
    "verdict": "GOOD" หรือ "OK" หรือ "CAUTION" หรือ "NOT_RECOMMENDED",
    "verdictText": "ข้อความสั้น 1 บรรทัด เช่น 'เหมาะมาก!' หรือ 'ควรระวัง' หรือ 'ไม่แนะนำ'",
    "reason": "เหตุผลว่าทำไมถึงเหมาะหรือไม่เหมาะ อธิบายสั้นๆ 1-2 ประโยค",
    "impact": "ถ้าทานมื้อนี้ไปแล้ว ผลลัพธ์จะเป็นอย่างไร เช่น แคลอรี่จะเกิน/ยังเหลือเท่าไหร่ โปรตีนได้ตามเป้าไหม",
    "suggestion": "คำแนะนำจากโค้ช 1-2 ข้อ เช่น ทานได้เลย, ลดปริมาณลงครึ่งหนึ่ง, เปลี่ยนเป็นเมนูอื่น, เพิ่มผักเสริม"
  }
}

หมายเหตุ:
- ประมาณค่าจากขนาดจานและปริมาณอาหารที่เห็นในรูป
- ถ้าผู้ใช้ให้ข้อมูลเพิ่มเติม ให้นำมาประกอบการวิเคราะห์ด้วย
- ใช้น้ำเสียงเป็นกันเอง เหมือนโค้ชส่วนตัวพูดกับลูกค้า
- ให้คำแนะนำที่เป็นประโยชน์จริงๆ ไม่ใช่แค่บอกว่า "ดี" หรือ "ไม่ดี"
- ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, description, lineUserId } = body;

    // Check usage limit if lineUserId is provided
    if (lineUserId) {
      const limitCheck = await checkUsageLimit(lineUserId, "dailyAiAnalysisLimit");
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

    // Debug: Log API key status
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("=== Food Analysis API ===");
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("API Key prefix:", apiKey?.substring(0, 10) || "none");

    // Check for API key
    if (!apiKey || apiKey.trim() === "") {
      console.log("ERROR: No API key found!");
      return NextResponse.json(
        { 
          error: "OpenAI API key not configured",
          // Return mock data for development
          data: {
            name: "อาหารตัวอย่าง (Mock)",
            ingredients: "ข้าว, ไข่, ผัก",
            weight: 300,
            calories: 450,
            protein: 15,
            carbs: 55,
            fat: 18,
            sodium: 650,
            sugar: 5,
            description: "⚠️ กรุณาตั้งค่า OPENAI_API_KEY ใน .env.local และ restart server"
          }
        },
        { status: 200 }
      );
    }
    
    console.log("API Key found, proceeding with OpenAI call...");
    
    // Create OpenAI client with the API key
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // Fetch user context for coaching (goals, today's intake)
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

    // Build user message
    let userMessage = "กรุณาวิเคราะห์อาหารในรูปนี้ พร้อมให้คำแนะนำแบบโค้ชส่วนตัว";
    if (description) {
      userMessage += `\n\nข้อมูลเพิ่มเติมจากผู้ใช้: ${description}`;
    }
    if (userContext) {
      userMessage += userContext;
    }

    // Call OpenAI GPT-4o with vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: BASE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userMessage,
            },
            {
              type: "image_url",
              image_url: {
                url: image, // base64 data URL
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    
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

    console.log("✅ Analysis successful:", nutritionData.name);
    
    // Log usage after successful analysis
    if (lineUserId) {
      await logAiUsage(lineUserId, "dailyAiAnalysisLimit");
    }
    
    return NextResponse.json({
      success: true,
      data: nutritionData,
    });

  } catch (error: any) {
    console.error("Food analysis error:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to analyze food",
        // Return mock data on error for better UX
        data: {
          name: "ไม่สามารถวิเคราะห์ได้",
          ingredients: "",
          weight: 200,
          calories: 300,
          protein: 10,
          carbs: 40,
          fat: 12,
          sodium: 500,
          sugar: 5,
          description: "เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาแก้ไขข้อมูลด้วยตนเอง"
        }
      },
      { status: 200 }
    );
  }
}
