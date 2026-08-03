import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildOpenAI, aiModel, aiOutageReason } from "@/lib/aiClient";
import { checkUsageLimit, logAiUsage, creditsExhaustedResponse } from "@/lib/usage-limits";
import { getSecret } from "@/lib/secrets/store";

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้านโภชนาการ หน้าที่ของคุณคือวิเคราะห์ข้อมูลโภชนาการจากรูปถ่ายฉลากสินค้า

กรุณาอ่านข้อมูลจากรูปภาพและตอบกลับเป็น JSON format เท่านั้น ดังนี้:

{
  "name": "ชื่อสินค้า (ภาษาไทยหรืออังกฤษตามที่อ่านได้)",
  "brand": "ยี่ห้อ (ถ้ามี)",
  "servingSize": ขนาด serving เป็นตัวเลข (number),
  "servingUnit": "หน่วย เช่น g, ml, ชิ้น",
  "calories": แคลอรี่ต่อ serving (number),
  "protein": โปรตีนเป็นกรัม (number),
  "carbs": คาร์โบไฮเดรตเป็นกรัม (number),
  "fat": ไขมันเป็นกรัม (number),
  "sodium": โซเดียมเป็นมิลลิกรัม (number),
  "sugar": น้ำตาลเป็นกรัม (number),
  "fiber": ใยอาหารเป็นกรัม (number หรือ null ถ้าไม่มี),
  "confidence": ความมั่นใจในข้อมูล 0-100 (number)
}

หมายเหตุ:
- อ่านค่าจากตารางโภชนาการในรูป
- ถ้าไม่เห็นค่าใด ให้ใส่ 0 หรือ null
- ให้ค่า confidence ต่ำถ้ารูปไม่ชัดหรืออ่านยาก
- ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = await getSecret("OPENAI_API_KEY");
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: "OpenAI API key not configured",
          data: {
            name: "ไม่สามารถวิเคราะห์ได้",
            brand: null,
            servingSize: 100,
            servingUnit: "g",
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            sodium: 0,
            sugar: 0,
            fiber: null,
            confidence: 0,
          }
        },
        { status: 200 }
      );
    }

    const openai = buildOpenAI(apiKey);
    const body = await request.json();
    const { image, barcode, description, lineUserId, skipQuota } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // Check usage limit if lineUserId is provided
    if (lineUserId && !skipQuota) {
      const limitCheck = await checkUsageLimit(lineUserId, "dailyScanLimit");
      if (!limitCheck.allowed) return creditsExhaustedResponse(limitCheck);
    }

    console.log(`🤖 Analyzing nutrition label for barcode: ${barcode || 'unknown'}`);

    // Build user message
    let userMessage = "กรุณาอ่านข้อมูลโภชนาการจากรูปฉลากสินค้านี้";
    if (barcode) {
      userMessage += `\n\nBarcode: ${barcode}`;
    }
    if (description) {
      userMessage += `\n\nข้อมูลเพิ่มเติม: ${description}`;
    }

    const response = await openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o"),
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
                url: image,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.2, // Lower temperature for more accurate reading
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON response
    let nutritionData;
    try {
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

    console.log(`✅ Analysis complete: ${nutritionData.name} (confidence: ${nutritionData.confidence}%)`);

    // Log usage after successful analysis
    if (lineUserId && !skipQuota) {
      await logAiUsage(lineUserId, "dailyScanLimit");
    }

    return NextResponse.json({
      success: true,
      data: {
        ...nutritionData,
        barcode,
        source: "ai_analysis",
      },
    });

  } catch (error: any) {
    const outage = aiOutageReason(error);
    if (outage) return NextResponse.json({ error: outage.message, reason: outage.code, success: false }, { status: 503 });
    console.error("Barcode analyze error:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to analyze nutrition label",
        data: {
          name: "ไม่สามารถวิเคราะห์ได้",
          brand: null,
          servingSize: 100,
          servingUnit: "g",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          sodium: 0,
          sugar: 0,
          fiber: null,
          confidence: 0,
        }
      },
      { status: 200 }
    );
  }
}
