import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { checkUsageLimit, logAiUsage } from "@/lib/usage-limits";
import { getSecret } from "@/lib/secrets/store";

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
      lineUserId,
      existingCartItems = 0,
      existingCartFoodIds = []
    }: { 
      foods: Food[]; 
      requiredItems: number; 
      packageName: string;
      userGoals?: UserGoals;
      lineUserId?: string;
      existingCartItems?: number;
      existingCartFoodIds?: string[];
    } = body;

    if (!foods || foods.length === 0 || !requiredItems) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // Check usage limit if lineUserId is provided
    if (lineUserId) {
      const limitCheck = await checkUsageLimit(lineUserId, "dailyMenuSelectLimit");
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

    // Calculate how many more items needed (subtract existing cart)
    const itemsNeeded = Math.max(0, requiredItems - existingCartItems);
    
    // Filter out foods already in cart
    const availableFoods = foods.filter(f => !existingCartFoodIds.includes(f.id));
    
    // If no more items needed
    if (itemsNeeded === 0) {
      return NextResponse.json({
        success: true,
        selectedFoods: [],
        recommendation: "✅ คุณมีสินค้าในตะกร้าครบตามคอร์สแล้ว!",
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalPrice: 0,
        existingCartItems,
        itemsNeeded: 0,
      });
    }

    // Check if OpenAI API key is configured
    const apiKey = await getSecret("OPENAI_API_KEY");
    if (!apiKey) {
      // Return random selection without AI
      const shuffled = [...availableFoods].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(itemsNeeded, availableFoods.length));
      
      return NextResponse.json({
        success: true,
        selectedFoods: selected.map(f => ({ ...f, quantity: 1 })),
        recommendation: existingCartItems > 0 
          ? `⚠️ ไม่พบ API Key - เลือกเพิ่มอีก ${selected.length} เมนูให้แล้ว (มีในตะกร้าแล้ว ${existingCartItems} รายการ)`
          : "⚠️ ไม่พบ API Key - เลือกแบบสุ่มให้แล้ว",
        totalCalories: selected.reduce((sum, f) => sum + f.calories, 0),
        totalProtein: selected.reduce((sum, f) => sum + f.protein, 0),
        totalCarbs: selected.reduce((sum, f) => sum + f.carbs, 0),
        totalFat: selected.reduce((sum, f) => sum + f.fat, 0),
        totalPrice: selected.reduce((sum, f) => sum + f.price, 0),
        existingCartItems,
        itemsNeeded,
      });
    }

    // Build food list for AI (use available foods, not all foods)
    const foodList = availableFoods.map((f, i) => 
      `${i + 1}. ${f.name} - ${f.calories} kcal, P:${f.protein}g, C:${f.carbs}g, F:${f.fat}g, ราคา ฿${f.price}`
    ).join("\n");

    // Build prompt
    let prompt = `คุณเป็นนักโภชนาการ ช่วยเลือกเมนูอาหารสำหรับคอร์ส "${packageName}"
`;

    if (existingCartItems > 0) {
      prompt += `
ลูกค้ามีสินค้าในตะกร้าแล้ว: ${existingCartItems} รายการ
ต้องการเลือกเพิ่มอีก: ${itemsNeeded} เมนู (เพื่อให้ครบ ${requiredItems} เมนู)
`;
    } else {
      prompt += `
จำนวนที่ต้องเลือก: ${itemsNeeded} เมนู
`;
    }

    prompt += `
รายการอาหารที่สามารถเลือกได้ (ไม่รวมที่อยู่ในตะกร้าแล้ว):
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
กรุณาเลือก ${itemsNeeded} เมนู โดยพิจารณา:
1. ความหลากหลายของสารอาหาร
2. สมดุลระหว่างโปรตีน คาร์บ และไขมัน
3. ${userGoals ? "เหมาะสมกับเป้าหมายของผู้ใช้" : "เหมาะสมกับการรับประทานในแต่ละวัน"}

ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown code block:
{
  "selectedIds": [หมายเลขของเมนูที่เลือก เช่น 1, 3, 5],
  "recommendation": "คำแนะนำสั้นๆ 2-3 ประโยค เป็นภาษาไทย"
}`;

    // Calculate appropriate max_tokens based on items needed
    // Each ID takes ~3-4 tokens, plus JSON structure and recommendation
    const estimatedTokens = Math.max(500, itemsNeeded * 5 + 200);

    const openai = buildOpenAI(apiKey);
    const completion = await openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content: "คุณเป็นนักโภชนาการ ช่วยเลือกเมนูอาหารที่หลากหลายและมีคุณค่าทางโภชนาการ ตอบเป็น JSON เท่านั้น ต้องเลือกให้ครบตามจำนวนที่ขอ",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: estimatedTokens,
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

    // Map selected IDs to foods (use availableFoods since that's what AI sees)
    const selectedFoods: (Food & { quantity: number })[] = [];
    const selectedIndices = aiResponse.selectedIds || [];
    
    for (const idx of selectedIndices) {
      const food = availableFoods[idx - 1]; // AI uses 1-based index
      if (food && selectedFoods.length < itemsNeeded) {
        selectedFoods.push({ ...food, quantity: 1 });
      }
    }

    // If not enough foods selected, fill with random ones from available foods
    while (selectedFoods.length < itemsNeeded && selectedFoods.length < availableFoods.length) {
      const remaining = availableFoods.filter(f => !selectedFoods.find(sf => sf.id === f.id));
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

    // Build recommendation message
    let recommendation = aiResponse.recommendation || "เลือกเมนูที่หลากหลายและมีคุณค่าทางโภชนาการให้คุณแล้ว";
    if (existingCartItems > 0) {
      recommendation = `🛒 มีในตะกร้าแล้ว ${existingCartItems} รายการ - ${recommendation}`;
    }

    // Log usage after successful selection
    if (lineUserId) {
      await logAiUsage(lineUserId, "dailyMenuSelectLimit");
    }

    return NextResponse.json({
      success: true,
      selectedFoods,
      recommendation,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalPrice,
      existingCartItems,
      itemsNeeded,
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
