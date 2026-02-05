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

    // Calculate if user is over budget
    const isOverCalories = dailyNutrition.remaining.calories < 0;
    const isOverProtein = dailyNutrition.remaining.protein < 0;
    const caloriesOver = Math.abs(dailyNutrition.remaining.calories);
    const caloriesAfterEating = dailyNutrition.consumed.calories + selectedFood.calories;
    const willExceedTarget = caloriesAfterEating > dailyNutrition.target.calories;

    // Build status message
    let statusMessage = "";
    if (isOverCalories) {
      statusMessage = `⚠️ สถานะ: เกินเป้าหมายแคลอรี่ไปแล้ว ${caloriesOver.toFixed(0)} Kcal`;
    } else if (willExceedTarget) {
      const willExceedBy = caloriesAfterEating - dailyNutrition.target.calories;
      statusMessage = `⚠️ สถานะ: หากทานอาหารนี้จะเกินเป้าหมายไป ${willExceedBy.toFixed(0)} Kcal`;
    } else {
      statusMessage = `✅ สถานะ: ยังทานได้อีก ${dailyNutrition.remaining.calories.toFixed(0)} Kcal`;
    }

    // Use AI for smarter recommendation
    const prompt = `คุณเป็นนักโภชนาการ ให้คำแนะนำสั้นๆ (1-2 ประโยค)

อาหารที่เลือก: ${selectedFood.name}
- แคลอรี่: ${selectedFood.calories} Kcal
- โปรตีน: ${selectedFood.protein}g

สถานะโภชนาการวันนี้:
- ทานไปแล้ว: ${dailyNutrition.consumed.calories.toFixed(0)} Kcal
- เป้าหมาย: ${dailyNutrition.target.calories.toFixed(0)} Kcal
- คงเหลือ: ${dailyNutrition.remaining.calories.toFixed(0)} Kcal ${isOverCalories ? "(เกินเป้าหมายแล้ว!)" : ""}

${statusMessage}

กฎสำคัญ:
- ถ้าเกินเป้าหมายแคลอรี่แล้ว → แนะนำให้หยุดทาน หรือเลือกอาหารที่แคลอรี่ต่ำกว่า
- ถ้าทานแล้วจะเกินเป้าหมาย → แนะนำให้ลดปริมาณ หรืองดทาน
- ถ้ายังไม่เกิน → บอกว่าทานได้

ให้คำแนะนำเป็นภาษาไทย สั้นกระชับ เป็นกันเอง`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "คุณเป็นนักโภชนาการที่เคร่งครัด ถ้าผู้ใช้เกินเป้าหมายแคลอรี่แล้ว ต้องแนะนำให้หยุดทานหรืองดอาหารนั้น ห้ามแนะนำว่าเหมาะสมถ้าเกินแคลอรี่แล้ว ตอบเป็นภาษาไทยเท่านั้น ไม่เกิน 2 ประโยค",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
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
