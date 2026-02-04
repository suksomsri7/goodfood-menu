import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้านโภชนาการอาหาร หน้าที่ของคุณคือวิเคราะห์อาหารจากรูปภาพและข้อมูลที่ได้รับ

กรุณาวิเคราะห์และประมาณค่าสารอาหารของอาหารในรูป โดยตอบกลับเป็น JSON format เท่านั้น ดังนี้:

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
  "description": "คำอธิบายสั้นๆ เกี่ยวกับอาหารและคุณค่าทางโภชนาการ"
}

หมายเหตุ:
- ประมาณค่าจากขนาดจานและปริมาณอาหารที่เห็นในรูป
- ถ้าผู้ใช้ให้ข้อมูลเพิ่มเติม ให้นำมาประกอบการวิเคราะห์ด้วย
- ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { image, description } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // Build user message
    let userMessage = "กรุณาวิเคราะห์อาหารในรูปนี้";
    if (description) {
      userMessage += `\n\nข้อมูลเพิ่มเติมจากผู้ใช้: ${description}`;
    }

    // Call OpenAI GPT-4o with vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
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
      max_tokens: 1000,
      temperature: 0.3,
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
