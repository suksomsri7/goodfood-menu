import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ingredients, weight, quantity } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Food name is required" },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return estimated data without AI
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

    // Build prompt
    let prompt = `วิเคราะห์สารอาหารของอาหารต่อไปนี้:

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

    prompt += `

กรุณาประมาณค่าสารอาหารต่อ 1 หน่วย และตอบเป็น JSON format เท่านั้น:
{
  "calories": แคลอรี่ (number),
  "protein": โปรตีนเป็นกรัม (number),
  "carbs": คาร์โบไฮเดรตเป็นกรัม (number),
  "fat": ไขมันเป็นกรัม (number),
  "sodium": โซเดียมเป็นมิลลิกรัม (number),
  "sugar": น้ำตาลเป็นกรัม (number),
  "description": "คำอธิบายสั้นๆ"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "คุณเป็นนักโภชนาการ ให้ประมาณค่าสารอาหารของอาหารไทยและอาหารทั่วไป ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown code block",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
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
