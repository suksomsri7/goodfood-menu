import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  price: number;
}

interface UserGoals {
  dailyCalories?: number;
  dailyProtein?: number;
  dailyCarbs?: number;
  dailyFat?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      foods, 
      requiredItems, 
      packageName,
      userGoals,
      lineUserId 
    }: { 
      foods: Food[]; 
      requiredItems: number; 
      packageName: string;
      userGoals?: UserGoals;
      lineUserId?: string;
    } = body;

    if (!foods || foods.length === 0 || !requiredItems) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return random selection without AI
      const shuffled = [...foods].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(requiredItems, foods.length));
      
      return NextResponse.json({
        success: true,
        selectedFoods: selected.map(f => ({ ...f, quantity: 1 })),
        recommendation: "⚠️ ไม่พบ API Key - เลือกแบบสุ่มให้แล้ว",
        totalCalories: selected.reduce((sum, f) => sum + f.calories, 0),
        totalProtein: selected.reduce((sum, f) => sum + f.protein, 0),
        totalCarbs: selected.reduce((sum, f) => sum + f.carbs, 0),
        totalFat: selected.reduce((sum, f) => sum + f.fat, 0),
        totalPrice: selected.reduce((sum, f) => sum + f.price, 0),
      });
    }

    // Build food list for AI
    const foodList = foods.map((f, i) => 
      `${i + 1}. ${f.name} - ${f.calories} kcal, P:${f.protein}g, C:${f.carbs}g, F:${f.fat}g, ราคา ฿${f.price}`
    ).join("\n");

    // Build prompt
    let prompt = `คุณเป็นนักโภชนาการ ช่วยเลือกเมนูอาหารสำหรับคอร์ส "${packageName}"

จำนวนที่ต้องเลือก: ${requiredItems} เมนู

รายการอาหารที่มี:
${foodList}

`;

    if (userGoals) {
      prompt += `
เป้าหมายโภชนาการของผู้ใช้:
- เป้าหมายแคลอรี่/วัน: ${userGoals.dailyCalories || 2000} kcal
- เป้าหมายโปรตีน/วัน: ${userGoals.dailyProtein || 120} g
- เป้าหมายคาร์บ/วัน: ${userGoals.dailyCarbs || 200} g
- เป้าหมายไขมัน/วัน: ${userGoals.dailyFat || 60} g
`;
    }

    prompt += `
กรุณาเลือก ${requiredItems} เมนู โดยพิจารณา:
1. ความหลากหลายของสารอาหาร
2. สมดุลระหว่างโปรตีน คาร์บ และไขมัน
3. ${userGoals ? "เหมาะสมกับเป้าหมายของผู้ใช้" : "เหมาะสมกับการรับประทานในแต่ละวัน"}

ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown code block:
{
  "selectedIds": [หมายเลขของเมนูที่เลือก เช่น 1, 3, 5],
  "recommendation": "คำแนะนำสั้นๆ 2-3 ประโยค เป็นภาษาไทย"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "คุณเป็นนักโภชนาการ ช่วยเลือกเมนูอาหารที่หลากหลายและมีคุณค่าทางโภชนาการ ตอบเป็น JSON เท่านั้น",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON response
    let aiResponse;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Map selected IDs to foods
    const selectedFoods: (Food & { quantity: number })[] = [];
    const selectedIndices = aiResponse.selectedIds || [];
    
    for (const idx of selectedIndices) {
      const food = foods[idx - 1]; // AI uses 1-based index
      if (food && selectedFoods.length < requiredItems) {
        selectedFoods.push({ ...food, quantity: 1 });
      }
    }

    // If not enough foods selected, fill with random ones
    while (selectedFoods.length < requiredItems && selectedFoods.length < foods.length) {
      const remaining = foods.filter(f => !selectedFoods.find(sf => sf.id === f.id));
      if (remaining.length > 0) {
        const randomFood = remaining[Math.floor(Math.random() * remaining.length)];
        selectedFoods.push({ ...randomFood, quantity: 1 });
      } else {
        break;
      }
    }

    // Calculate totals
    const totalCalories = selectedFoods.reduce((sum, f) => sum + f.calories, 0);
    const totalProtein = selectedFoods.reduce((sum, f) => sum + f.protein, 0);
    const totalCarbs = selectedFoods.reduce((sum, f) => sum + f.carbs, 0);
    const totalFat = selectedFoods.reduce((sum, f) => sum + f.fat, 0);
    const totalPrice = selectedFoods.reduce((sum, f) => sum + f.price, 0);

    return NextResponse.json({
      success: true,
      selectedFoods,
      recommendation: aiResponse.recommendation || "เลือกเมนูที่หลากหลายและมีคุณค่าทางโภชนาการให้คุณแล้ว",
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalPrice,
    });

  } catch (error: unknown) {
    console.error("AI menu selection error:", error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to select menu",
      },
      { status: 500 }
    );
  }
}
