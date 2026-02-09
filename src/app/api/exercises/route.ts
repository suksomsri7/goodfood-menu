import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCoachingMessage } from "@/lib/coaching";

// Common exercise types with estimated calories per minute
const EXERCISE_CALORIES: Record<string, number> = {
  // Cardio
  "วิ่ง": 10, "เดินเร็ว": 5, "ปั่นจักรยาน": 8, "ว่ายน้ำ": 9, 
  "กระโดดเชือก": 12, "เต้นแอโรบิค": 7, "เดินขึ้นบันได": 8,
  "เดินบนลู่วิ่ง": 5, "วิ่งบนลู่วิ่ง": 10, "ปั่นจักรยานอยู่กับที่": 7,
  "เครื่องเดินวงรี (Elliptical)": 8, "เครื่องพายเรือ": 9,
  "ลู่วิ่ง": 8, "จักรยานปั่นอยู่กับที่": 7, "เครื่องเดินวงรี": 8,
  "Step Aerobics": 8, "Zumba": 7, "เต้น": 6, "กระโดดตบ (Jumping Jacks)": 8,
  // Strength
  "ยกน้ำหนัก": 6, "วิดพื้น": 7, "สควอท": 6, "แพลงค์": 4, "ดัมเบล": 5,
  "บาร์เบล": 6, "เครื่อง Leg Press": 5, "เครื่อง Chest Press": 5,
  "เครื่อง Lat Pulldown": 5, "เครื่อง Cable": 5, "ซิทอัพ": 5,
  "Crunch": 4, "Deadlift": 7, "Bench Press": 6, "Lunges": 6,
  "Burpees": 10, "Pull-up": 8, "Chin-up": 8, "Dips": 6,
  // Sports
  "แบดมินตัน": 7, "เทนนิส": 8, "บาสเกตบอล": 8, "ฟุตบอล": 9,
  "วอลเลย์บอล": 6, "ปิงปอง": 4, "กอล์ฟ": 4, "มวย": 10,
  "เทควันโด": 10, "ยูโด": 10, "คาราเต้": 10, "สควอช": 9,
  "แฮนด์บอล": 8, "รักบี้": 9, "ฮอกกี้": 8, "สเก็ต": 7, "สกี": 8,
  // Flexibility
  "โยคะ": 3, "ยืดเหยียด": 2, "พิลาทิส": 4, "ไทชิ": 3, "ชี่กง": 2,
  "โยคะร้อน (Hot Yoga)": 5, "Foam Rolling": 2, "การหายใจ": 1,
  // Other activities
  "ทำสวน": 4, "ทำความสะอาดบ้าน": 3, "ซักผ้า": 2, "ล้างรถ": 3,
  "เดินช้อปปิ้ง": 3, "เล่นกับลูก": 4, "จูงสุนัขเดินเล่น": 3,
  "ขี่ม้า": 5, "ปีนเขา": 8, "ตั้งแคมป์": 3,
  // Default
  "กำหนดเอง": 5, "อื่นๆ": 5,
};

// GET - Get exercise logs for a user on a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD (local date from client)
    const tzOffsetStr = searchParams.get("tzOffset"); // Client timezone offset in minutes

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Build date filter with timezone awareness
    let dateFilter = {};
    if (dateStr) {
      const tzOffset = tzOffsetStr ? parseInt(tzOffsetStr, 10) : 0;
      const [year, month, day] = dateStr.split('-').map(Number);
      
      const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      startOfDayUTC.setUTCMinutes(startOfDayUTC.getUTCMinutes() + tzOffset);
      
      const endOfDayUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      endOfDayUTC.setUTCMinutes(endOfDayUTC.getUTCMinutes() + tzOffset);
      
      dateFilter = {
        date: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
      };
    }

    const exercises = await prisma.exerciseLog.findMany({
      where: {
        memberId: member.id,
        ...dateFilter,
      },
      orderBy: { date: "desc" },
    });

    // Calculate total calories burned
    const totalBurned = exercises.reduce((sum, ex) => sum + ex.calories, 0);

    return NextResponse.json({ exercises, totalBurned });
  } catch (error) {
    console.error("Failed to get exercises:", error);
    return NextResponse.json(
      { error: "Failed to get exercises" },
      { status: 500 }
    );
  }
}

// POST - Add a new exercise log
export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exercises/route.ts:POST',message:'Exercise POST called',data:{},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json();
    const {
      lineUserId,
      name,
      type,
      duration, // minutes
      calories, // optional - if not provided, will be calculated
      intensity,
      note,
      date,
    } = body;

    if (!lineUserId || !name || !duration) {
      return NextResponse.json(
        { error: "lineUserId, name, and duration are required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Calculate calories if not provided
    let calculatedCalories = calories;
    if (!calculatedCalories) {
      const baseRate = EXERCISE_CALORIES[name] || EXERCISE_CALORIES["อื่นๆ"];
      // Adjust for intensity
      let intensityMultiplier = 1;
      if (intensity === "low") intensityMultiplier = 0.8;
      if (intensity === "high") intensityMultiplier = 1.3;
      
      calculatedCalories = Math.round(baseRate * duration * intensityMultiplier);
    }

    const exercise = await prisma.exerciseLog.create({
      data: {
        memberId: member.id,
        name,
        type,
        duration,
        calories: calculatedCalories,
        intensity,
        note,
        date: date ? new Date(date) : new Date(),
      },
    });

    console.log("[Exercise] Created:", { memberId: member.id, exerciseId: exercise.id, name, calories: calculatedCalories });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exercises/route.ts:POST',message:'Exercise created, calling sendCoachingMessage',data:{memberId:member.id,exerciseName:name,calories:calculatedCalories},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Send post-exercise coaching notification (async, don't block response)
    sendCoachingMessage(member.id, "exercise").then(sent => {
      console.log("[Exercise] Coaching notification result:", { memberId: member.id, sent });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exercises/route.ts:POST',message:'sendCoachingMessage completed',data:{memberId:member.id,sent},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }).catch(err => {
      console.error("[Exercise] Failed to send coaching:", err);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exercises/route.ts:POST',message:'sendCoachingMessage failed',data:{memberId:member.id,error:String(err)},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });

    return NextResponse.json(exercise);
  } catch (error) {
    console.error("Failed to add exercise:", error);
    return NextResponse.json(
      { error: "Failed to add exercise" },
      { status: 500 }
    );
  }
}

// GET exercise types for dropdown
export async function OPTIONS() {
  return NextResponse.json({
    exerciseTypes: Object.keys(EXERCISE_CALORIES),
    caloriesPerMinute: EXERCISE_CALORIES,
  });
}
