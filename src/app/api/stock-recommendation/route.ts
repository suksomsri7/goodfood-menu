import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { selectedFood, dailyNutrition } = body;

    if (!selectedFood || !dailyNutrition) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return a simple calculated recommendation
      const caloriesAfter = dailyNutrition.consumed.calories + selectedFood.calories;
      const remaining = dailyNutrition.target.calories - caloriesAfter;
      
      if (remaining < 0) {
        return NextResponse.json({
          recommendation: `หากทาน ${selectedFood.name} จะทำให้แคลอรี่เกินเป้าหมาย ${Math.abs(remaining).toFixed(0)} Kcal ควรพิจารณาลดปริมาณหรือเลือกอาหารอื่น`,
        });
      } else if (remaining < 200) {
        return NextResponse.json({
          recommendation: `เหมาะสมสำหรับมื้อนี้ หลังทานจะเหลือแคลอรี่อีก ${remaining.toFixed(0)} Kcal สำหรับวันนี้`,
        });
      } else {
        return NextResponse.json({
          recommendation: `ทานได้เลย! หลังทานจะยังเหลือพื้นที่แคลอรี่อีก ${remaining.toFixed(0)} Kcal สำหรับมื้อถัดไป`,
        });
      }
    }

    // Use AI for smarter recommendation
    const prompt = `คุณเป็นนักโภชนาการ ให้คำแนะนำสั้นๆ (1-2 ประโยค) เกี่ยวกับการเลือกทานอาหารนี้

อาหารที่เลือก: ${selectedFood.name}
- แคลอรี่: ${selectedFood.calories} Kcal
- โปรตีน: ${selectedFood.protein}g
- คาร์บ: ${selectedFood.carbs}g
- ไขมัน: ${selectedFood.fat}g

สถานะโภชนาการวันนี้:
- ทานไปแล้ว: ${dailyNutrition.consumed.calories} Kcal (P: ${dailyNutrition.consumed.protein}g, C: ${dailyNutrition.consumed.carbs}g, F: ${dailyNutrition.consumed.fat}g)
- เป้าหมาย: ${dailyNutrition.target.calories} Kcal (P: ${dailyNutrition.target.protein}g, C: ${dailyNutrition.target.carbs}g, F: ${dailyNutrition.target.fat}g)
- คงเหลือ: ${dailyNutrition.remaining.calories} Kcal (P: ${dailyNutrition.remaining.protein}g, C: ${dailyNutrition.remaining.carbs}g, F: ${dailyNutrition.remaining.fat}g)

ให้คำแนะนำเป็นภาษาไทย สั้นกระชับ เป็นกันเอง บอกว่าเหมาะสมหรือไม่ และเหตุผลสั้นๆ`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "คุณเป็นนักโภชนาการที่ให้คำแนะนำสั้นๆ เป็นกันเอง ตอบเป็นภาษาไทยเท่านั้น ไม่เกิน 2 ประโยค",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const recommendation = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error("Stock recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendation" },
      { status: 500 }
    );
  }
}
