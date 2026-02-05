import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log("OpenAI API key not configured, returning mock data");
      return NextResponse.json({
        name: "ลู่วิ่ง",
        duration: 30,
        calories: 250,
        distance: "3.5 km",
        speed: "7 km/h",
        heartRate: "135 bpm",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at reading exercise machine displays. Analyze the image of an exercise machine screen and extract the workout data.

Return a JSON object with the following fields (use null if not visible):
- name: string - Type of exercise (e.g., "Treadmill", "Elliptical", "Stationary Bike", "Rowing Machine") in Thai
- duration: number - Duration in minutes
- calories: number - Calories burned
- distance: string - Distance covered (with unit, e.g., "3.5 km")
- speed: string - Average speed (with unit, e.g., "7 km/h")
- heartRate: string - Heart rate if shown (with unit, e.g., "135 bpm")
- incline: string - Incline level if applicable
- resistance: string - Resistance level if applicable
- pace: string - Pace if shown (e.g., "8:30 /km")

Common Thai names for machines:
- Treadmill = ลู่วิ่ง
- Elliptical = เครื่องเดินวงรี
- Stationary Bike = จักรยานปั่นอยู่กับที่
- Rowing Machine = เครื่องพายเรือ
- Stair Climber = เครื่องปีนบันได
- Cross Trainer = เครื่อง Cross Trainer

Only return valid JSON, no additional text.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this exercise machine display and extract the workout data. Return the data as JSON.",
            },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json(
        { error: "Failed to analyze image" },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(content);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "Failed to parse analysis result" },
        { status: 500 }
      );
    }

    // Ensure required fields have values
    return NextResponse.json({
      name: result.name || "ออกกำลังกาย",
      duration: result.duration || 30,
      calories: result.calories || 200,
      distance: result.distance || null,
      speed: result.speed || null,
      heartRate: result.heartRate || null,
      incline: result.incline || null,
      resistance: result.resistance || null,
      pace: result.pace || null,
    });

  } catch (error) {
    console.error("Error analyzing exercise image:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
