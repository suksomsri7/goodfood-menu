import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { checkUsageLimit, logAiUsage } from "@/lib/usage-limits";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { lineUserId, dateStr } = await request.json();

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    // Check usage limit
    const limitCheck = await checkUsageLimit(lineUserId, "dailyAiRecommendLimit");
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

    // Fetch member data with goals
    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Parse date
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch today's meals
    const meals = await prisma.mealLog.findMany({
      where: {
        memberId: member.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { date: "asc" },
    });

    // Fetch today's exercises
    const exercises = await prisma.exerciseLog.findMany({
      where: {
        memberId: member.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { date: "asc" },
    });

    // Fetch today's water
    const waterLogs = await prisma.waterLog.findMany({
      where: {
        memberId: member.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    const totalWater = waterLogs.reduce((sum, log) => sum + log.amount, 0);

    // Calculate totals
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
    const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
    const totalFat = meals.reduce((sum, m) => sum + m.fat, 0);
    const totalSodium = meals.reduce((sum, m) => sum + (m.sodium || 0), 0);
    const totalSugar = meals.reduce((sum, m) => sum + (m.sugar || 0), 0);
    const totalExerciseCalories = exercises.reduce((sum, e) => sum + e.calories, 0);
    const totalExerciseDuration = exercises.reduce((sum, e) => sum + e.duration, 0);

    // Calculate age
    let age = 30;
    if (member.birthDate) {
      const birthDate = new Date(member.birthDate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Prepare data for AI
    const userData = {
      // Personal info
      name: member.name || "ผู้ใช้",
      gender: member.gender || "male",
      age,
      height: member.height || 170,
      currentWeight: member.weight || 70,
      goalWeight: member.goalWeight || 65,
      activityLevel: member.activityLevel || "moderate",
      
      // Daily goals
      goals: {
        calories: member.dailyCalories || 2000,
        protein: member.dailyProtein || 150,
        carbs: member.dailyCarbs || 250,
        fat: member.dailyFat || 65,
        sodium: member.dailySodium || 2300,
        sugar: member.dailySugar || 50,
        water: member.dailyWater || 2000,
      },
      
      // BMR/TDEE
      bmr: member.bmr || null,
      tdee: member.tdee || null,
      
      // Today's intake
      today: {
        meals: meals.map(m => ({
          name: m.name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          sodium: m.sodium,
          sugar: m.sugar,
          time: new Date(m.date).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        })),
        totals: {
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          sodium: totalSodium,
          sugar: totalSugar,
        },
        exercises: exercises.map(e => ({
          name: e.name,
          duration: e.duration,
          calories: e.calories,
          type: e.type,
        })),
        exerciseTotals: {
          calories: totalExerciseCalories,
          duration: totalExerciseDuration,
        },
        water: totalWater,
      },
    };

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return mock analysis
      return NextResponse.json({
        success: true,
        analysis: {
          summary: `📊 สรุปประจำวัน\n\nรับประทานไป ${totalCalories} kcal จากเป้าหมาย ${userData.goals.calories} kcal\nออกกำลังกายเผาผลาญ ${totalExerciseCalories} kcal`,
          goalAnalysis: `🎯 วิเคราะห์จากเป้าหมาย\n\n• แคลอรี่: ${totalCalories}/${userData.goals.calories} kcal (${Math.round(totalCalories/userData.goals.calories*100)}%)\n• โปรตีน: ${totalProtein}/${userData.goals.protein}g (${Math.round(totalProtein/userData.goals.protein*100)}%)\n• คาร์บ: ${totalCarbs}/${userData.goals.carbs}g\n• ไขมัน: ${totalFat}/${userData.goals.fat}g`,
          recommendations: `💡 คำแนะนำ\n\n• ดื่มน้ำให้ครบ ${userData.goals.water} ml\n• เพิ่มการออกกำลังกายอีกเล็กน้อย\n• ควบคุมปริมาณโซเดียม`,
        },
        data: userData,
      });
    }

    // Call OpenAI for analysis
    const prompt = `คุณเป็นนักโภชนาการและผู้เชี่ยวชาญด้านสุขภาพ กรุณาวิเคราะห์ข้อมูลสุขภาพประจำวันต่อไปนี้:

ข้อมูลส่วนตัว:
- ชื่อ: ${userData.name}
- เพศ: ${userData.gender === 'male' ? 'ชาย' : 'หญิง'}
- อายุ: ${userData.age} ปี
- ส่วนสูง: ${userData.height} ซม.
- น้ำหนักปัจจุบัน: ${userData.currentWeight} กก.
- น้ำหนักเป้าหมาย: ${userData.goalWeight} กก.
- BMR: ${userData.bmr ? Math.round(userData.bmr) : 'ไม่ระบุ'} kcal
- TDEE: ${userData.tdee ? Math.round(userData.tdee) : 'ไม่ระบุ'} kcal

เป้าหมายรายวัน:
- แคลอรี่: ${userData.goals.calories} kcal
- โปรตีน: ${userData.goals.protein}g
- คาร์บ: ${userData.goals.carbs}g
- ไขมัน: ${userData.goals.fat}g
- โซเดียม: ${userData.goals.sodium} mg
- น้ำตาล: ${userData.goals.sugar}g
- น้ำ: ${userData.goals.water} ml

บันทึกวันนี้:
${userData.today.meals.length > 0 ? 
  `อาหาร:\n${userData.today.meals.map(m => `- ${m.time} ${m.name}: ${m.calories} kcal`).join('\n')}` : 
  'ยังไม่มีรายการอาหาร'}

รวมสารอาหาร:
- แคลอรี่: ${userData.today.totals.calories}/${userData.goals.calories} kcal
- โปรตีน: ${userData.today.totals.protein}/${userData.goals.protein}g
- คาร์บ: ${userData.today.totals.carbs}/${userData.goals.carbs}g
- ไขมัน: ${userData.today.totals.fat}/${userData.goals.fat}g
- โซเดียม: ${userData.today.totals.sodium}/${userData.goals.sodium} mg
- น้ำตาล: ${userData.today.totals.sugar}/${userData.goals.sugar}g

${userData.today.exercises.length > 0 ?
  `การออกกำลังกาย:\n${userData.today.exercises.map(e => `- ${e.name}: ${e.duration} นาที, เผาผลาญ ${e.calories} kcal`).join('\n')}\nรวม: ${userData.today.exerciseTotals.duration} นาที, ${userData.today.exerciseTotals.calories} kcal` :
  'ยังไม่มีการออกกำลังกาย'}

ดื่มน้ำ: ${userData.today.water}/${userData.goals.water} ml

กรุณาตอบเป็นภาษาไทย ในรูปแบบ JSON ดังนี้:
{
  "summary": "สรุปภาพรวมสั้นๆ 2-3 ประโยค",
  "goalAnalysis": "วิเคราะห์เทียบกับเป้าหมาย แยกเป็นข้อๆ",
  "recommendations": "คำแนะนำที่เป็นประโยชน์ 3-4 ข้อ"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "คุณเป็นนักโภชนาการและผู้เชี่ยวชาญด้านสุขภาพ ให้คำแนะนำที่เป็นมิตรและเข้าใจง่าย ตอบเป็นภาษาไทยเท่านั้น"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      console.error("AI returned no content");
      return NextResponse.json({
        success: true,
        analysis: {
          summary: "ไม่สามารถวิเคราะห์ได้ในขณะนี้",
          goalAnalysis: [],
          recommendations: [],
        },
        data: userData,
      });
    }

    // Parse JSON from response
    let analysis;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure all fields exist
        analysis = {
          summary: parsed.summary || "ไม่มีข้อมูลสรุป",
          goalAnalysis: parsed.goalAnalysis || [],
          recommendations: parsed.recommendations || [],
        };
      } else {
        // No JSON found, use content as summary
        analysis = {
          summary: content.substring(0, 500),
          goalAnalysis: [],
          recommendations: [],
        };
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      // If parsing fails, use the raw content
      analysis = {
        summary: content.substring(0, 500),
        goalAnalysis: [],
        recommendations: [],
      };
    }

    // Log usage after successful analysis
    await logAiUsage(lineUserId, "dailyAiRecommendLimit");

    return NextResponse.json({
      success: true,
      analysis,
      data: userData,
    });

  } catch (error: any) {
    console.error("AI Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze" },
      { status: 500 }
    );
  }
}
