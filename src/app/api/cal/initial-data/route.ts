import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberFromReq } from "@/lib/memberAuth";
import { getDailyBudget } from "@/lib/dailyBudget";
import { estimateEnergy } from "@/lib/energyModel";
import { getCreditSnapshot } from "@/lib/usage-limits";

// Combined API endpoint to fetch all initial data for /cal page in ONE request
// This reduces 4 API calls to 1, significantly improving initial load time

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    const tzOffset = parseInt(searchParams.get("tzOffset") || "0", 10);

    // รองรับ JWT (native) หรือ lineUserId (LIFF)
    const member = await memberFromReq(request, lineUserId);

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Calculate date range for today's data
    let startOfDay: Date;
    let endOfDay: Date;

    if (dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number);
      startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      startOfDay.setUTCMinutes(startOfDay.getUTCMinutes() + tzOffset);
      endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      endOfDay.setUTCMinutes(endOfDay.getUTCMinutes() + tzOffset);
    } else {
      startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Fetch meals, water, exercises in PARALLEL
    const [meals, waterResult, exercisesResult] = await Promise.all([
      // Meals for selected date
      prisma.mealLog.findMany({
        where: {
          memberId: member.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          name: true,
          weight: true,
          multiplier: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          sodium: true,
          sugar: true,
          imageUrl: true,
          ingredients: true,
          date: true,
        },
      }),

      // Water intake for selected date
      prisma.waterLog.aggregate({
        where: {
          memberId: member.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: { amount: true },
      }),

      // Exercises for selected date
      prisma.exerciseLog.findMany({
        where: {
          memberId: member.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          duration: true,
          calories: true,
          intensity: true,
          note: true,
          date: true,
          // แอปใช้ติดป้าย "จาก Apple Watch" (healthkit | watch | manual | ai_photo)
          source: true,
        },
      }),
    ]);

    // Coach native: รายการน้ำ (timeline) + การนอน + activeKcal/ก้าว จาก HealthKit + badge แจ้งเตือน
    const [waterLogs, sleepLogs, dayMetrics, unreadNotifications, energyEst] = await Promise.all([
      prisma.waterLog.findMany({
        where: { memberId: member.id, date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { date: "asc" },
        select: { id: true, amount: true, date: true },
      }),
      prisma.sleepLog.findMany({
        where: { memberId: member.id, date: { gte: startOfDay, lte: endOfDay } },
        select: { minutesAsleep: true },
      }),
      prisma.dailyMetric.findMany({
        where: { memberId: member.id, date: { gte: startOfDay, lte: endOfDay } },
        select: { activeKcal: true, steps: true },
      }),
      prisma.coachNotification.count({ where: { memberId: member.id, readAt: null } }),
      // ฐานพลังงานของ "วันที่ไม่ได้ออกกำลังกาย" (วัด/เรียนจากข้อมูลจริงถ้ามี)
      estimateEnergy(member.id).catch(() => null),
    ]);
    // งบวันนี้ = ฐาน + คืน 60% ของที่ออกกำลังกายจริง · พร้อมงบทั้งสัปดาห์
    const budget = await getDailyBudget(member.id, { baseTdee: energyEst?.baseTdee }).catch(() => null);
    // เครดิต AI วันนี้ (โครงเดียวกับ GET /api/coach/credits) — แอปจะได้ไม่ต้องยิงเพิ่มอีก request
    const credits = await getCreditSnapshot(member).catch(() => null);
    // คืนเดียวอาจมีทั้งจาก HealthKit และที่ user บอกโค้ชเอง → เอาค่ามากสุด ไม่ใช่บวกกัน (กันนับซ้ำ)
    const sleepMinutes = sleepLogs.reduce((s, x) => Math.max(s, x.minutesAsleep), 0);
    const activeKcal = dayMetrics.reduce((s, x) => s + (x.activeKcal || 0), 0);
    const daySteps = dayMetrics.reduce((s, x) => s + (x.steps || 0), 0);

    // Calculate totals
    const waterTotal = waterResult._sum.amount || 0;
    const exerciseBurned = exercisesResult.reduce((sum, ex) => sum + ex.calories, 0);

    const responseTime = Date.now() - startTime;

    // Build response
    const response = NextResponse.json({
      member,
      meals,
      water: {
        total: waterTotal,
        items: waterLogs,
      },
      sleep: { minutes: sleepMinutes },
      // งบแคลอรี่แบบ "ฐาน + คืนบางส่วน" (แอปใช้ตัวนี้แทน member.dailyCalories ตรง ๆ)
      energy: budget
        ? {
            base: budget.base, earned: budget.earned, target: budget.target,
            exerciseKcal: budget.exerciseKcal, eaten: budget.eaten, remaining: budget.remaining,
            week: budget.week, explain: budget.explain,
            source: energyEst?.source ?? "formula",
          }
        : null,
      metrics: { activeKcal, steps: daySteps },
      credits,
      // badge ศูนย์แจ้งเตือน (แอปเรียก endpoint นี้ทุกครั้งที่เปิด/เปลี่ยนวันอยู่แล้ว)
      notifications: { unread: unreadNotifications },
      exercises: {
        items: exercisesResult,
        totalBurned: exerciseBurned,
      },
      meta: {
        responseTime,
        date: dateStr || new Date().toISOString().split('T')[0],
      },
    });

    // ห้ามแคช: เป็นข้อมูลสดรายบุคคล — เคยตั้ง max-age=30 แล้วเจอบั๊ก
    // ติ๊กแผนเสร็จ → โหลดใหม่ได้ค่าเก่าจากแคชของเครื่อง (แหวน/ไทม์ไลน์ไม่ขยับจนกว่าจะปิดเปิดแอป)
    response.headers.set("Cache-Control", "no-store, must-revalidate");

    return response;
  } catch (error) {
    console.error("Failed to get initial data:", error);
    return NextResponse.json(
      { error: "Failed to get initial data" },
      { status: 500 }
    );
  }
}
