import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import {
  MealTarget,
  PROGRAM_SLOTS,
  RUNWAY_DAYS,
  TRACKS,
  addDays,
  bkkDay,
  dailyTarget,
  dayKey,
  enrollmentDays,
  mealTargets,
  runwayEnd,
  servedFor,
  thaiDate,
  trackFor,
  trackLabel,
} from "@/lib/program";
import { absoluteImageUrl } from "@/lib/articleFeed";
import { playableVideo } from "@/lib/youtubeUrl";

export const dynamic = "force-dynamic";

/**
 * ช่องโภชนาการในแอป — คืนข้อมูลชุดเดียวให้ทั้งคนที่อยู่ในโปรแกรมและคนที่ยังไม่อยู่
 *
 * 🔴 เป้าสารอาหารรายมื้อเป็นของ "ทุกคน" ไม่ใช่ของเฉพาะลูกค้าที่จ่ายเงิน
 *    คนที่ยังไม่สมัครก็ต้องเห็นว่าตัวเองต้องการเท่าไร — นั่นแหละคือสิ่งที่ทำให้เขาอยากสมัคร
 *    ต่างกันแค่ชั้นบน: อยู่ในโปรแกรม = มีกล่องที่จะได้รับจริง · ยังไม่อยู่ = มีปุ่มชวนสมัคร
 */

/** ฟิลด์ชุดเดียวที่แอปต้องใช้ต่อ 1 เมนู — ใช้ร่วมกันทั้งคนในโปรแกรมและคนที่ยังไม่เข้า */
const FOOD_SELECT = {
  id: true, name: true, imageUrl: true, imageIsAi: true, videoUrl: true, description: true,
  calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true,
  recipe: { include: { ingredient: true }, orderBy: { order: "asc" as const } },
} as const;

type FoodRow = Prisma.FoodGetPayload<{ select: typeof FOOD_SELECT }>;

function foodPayload(food: FoodRow, target: MealTarget) {
  return {
    id: food.id,
    name: food.name,
    image: absoluteImageUrl(food.imageUrl),
    /** true = รูปที่ AI สร้าง ไม่ใช่ภาพถ่ายกล่องจริง → แอปต้องขึ้นป้าย "ภาพตัวอย่าง" */
    imageIsAi: food.imageIsAi,
    /** null = ไม่มีคลิป หรือลิงก์ที่แอดมินวางแกะไม่ออก → แอปไม่ขึ้นปุ่ม ▶ */
    video: playableVideo(food.videoUrl),
    description: food.description,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    sodium: food.sodium,
    sugar: food.sugar,
    /** null = เมนูนี้ไม่มีข้อมูลโภชนาการเลย · ปกติจะได้ค่าที่ปรับตามคนนี้แล้ว */
    served: servedFor(food.recipe, target, food),
  };
}

/** เมนูของวันหนึ่งในสายหนึ่ง ครบทุกมื้อที่มีเป้า — ใช้โชว์ให้คนที่ยังไม่เข้าโปรแกรมเห็นของจริง */
async function dayMenu(date: Date, track: string, targets: MealTarget[]) {
  const rows = await prisma.menuCalendarItem.findMany({
    where: { date, track },
    include: { food: { select: FOOD_SELECT } },
  });
  const at = new Map(rows.map((r) => [r.slot, r.food]));
  return {
    date: dayKey(date),
    label: thaiDate(date),
    isToday: true,
    meals: targets.map((t) => {
      const food = at.get(t.slot);
      return { slot: t.slot, target: t, food: food ? foodPayload(food, t) : null };
    }),
  };
}

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = bkkDay();
  const daily = dailyTarget(member);

  const enrollment = await prisma.programEnrollment.findFirst({
    where: { memberId: member.id, status: "active", endDate: { gte: today } },
    orderBy: { startDate: "asc" },
  });

  // ── ยังไม่อยู่ในโปรแกรม ──
  if (!enrollment) {
    const horizon = await prisma.menuCalendarItem.findMany({
      where: { date: { gte: addDays(today, 1), lt: addDays(today, 120) } },
      select: { date: true, track: true, slot: true },
    });
    const runway = runwayEnd(horizon, addDays(today, 1));

    /* 🔴 คนที่ยังไม่สมัครต้องเห็น "อาหารจริงของวันนี้" ไม่ใช่แค่ตัวเลขเป้า
       — หน้านี้คือหน้าขาย ถ้าไม่เห็นว่าได้กินอะไร ก็ไม่มีเหตุผลให้สมัคร
       สายอาหารเลือกให้จากแบบสำรวจ ไม่ต้องให้เขาเดาเองว่าสายไหนคืออะไร */
    const profile = await prisma.foodProfile.findUnique({
      where: { memberId: member.id },
      select: { avoidMeats: true, allergies: true },
    });
    const picked = trackFor(profile);
    const targets = mealTargets(member);
    const preview = await dayMenu(today, picked.track, targets);

    return NextResponse.json({
      enrolled: false,
      daily,
      /** เป้ารายมื้อของทุกคน — ค่านี้คือ "งานของ Coach AI" ที่หลังบ้านเอาไปตักอาหาร */
      targets,
      tracks: TRACKS.map((t) => ({ key: t.key, label: t.label })),
      track: picked.track,
      trackLabel: trackLabel(picked.track),
      trackReason: picked.reason,
      /** null = ยังไม่เคยทำแบบสำรวจ (คนละเรื่องกับ "ตอบว่าไม่เลี่ยงอะไร") */
      hasFoodProfile: !!profile,
      /** เมนูจริงของวันนี้ในสายนั้น — โชว์เป็นตัวอย่างว่าเข้าโปรแกรมแล้วได้กินอะไร */
      today: preview,
      canEnroll: runway.days >= RUNWAY_DAYS,
      earliestStart: dayKey(addDays(today, 1)),
      earliestStartLabel: thaiDate(addDays(today, 1)),
    });
  }

  // ── อยู่ในโปรแกรม ──
  const days = enrollmentDays(enrollment);
  const targets = mealTargets(member, enrollment.slots);
  const targetBySlot = new Map<string, MealTarget>(targets.map((t) => [t.slot, t]));

  const menu = await prisma.menuCalendarItem.findMany({
    where: {
      track: enrollment.track,
      slot: { in: enrollment.slots },
      date: { gte: enrollment.startDate, lte: enrollment.endDate },
    },
    include: { food: { select: FOOD_SELECT } },
  });
  const menuAt = new Map(menu.map((m) => [`${dayKey(m.date)}|${m.slot}`, m]));

  const week = days.map((d) => {
    const key = dayKey(d.date);
    const meals = PROGRAM_SLOTS.filter((s) => enrollment.slots.includes(s)).map((slot) => {
      const cell = menuAt.get(`${key}|${slot}`);
      const t = targetBySlot.get(slot)!;
      return { slot, target: t, food: cell ? foodPayload(cell.food, t) : null };
    });
    return {
      dayNumber: d.dayNumber,
      date: key,
      label: thaiDate(d.date),
      isToday: key === dayKey(today),
      meals,
    };
  });

  /* มื้อที่ "ไม่ได้ซื้อ" ในคอร์สนี้ (ปกติคือมื้อว่าง) — หน้าโภชนาการโชว์ครบ 4 มื้อเสมอ
     🔴 เป้าของมื้อพวกนี้ต้องคิดจากการแบ่งวันแบบ 4 มื้อ ไม่ใช่เอาเป้าของคอร์ส 3 มื้อมาใช้
        (คอร์ส 3 มื้อเกลี่ยพลังงานทั้งวันลง 3 กล่องไปแล้ว) */
  const missing = PROGRAM_SLOTS.filter((s) => !enrollment.slots.includes(s));
  const fullDayTargets = mealTargets(member);
  const addOns = missing.length
    ? (await dayMenu(today, enrollment.track, fullDayTargets.filter((t) => missing.includes(t.slot)))).meals
    : [];

  return NextResponse.json({
    enrolled: true,
    daily,
    targets,
    /** มื้อที่ยังไม่ได้อยู่ในคอร์ส — แอปโชว์เป็นการ์ด "เพิ่มมื้อนี้ได้" ไม่ใช่ซ่อนไปเฉย ๆ */
    addOns,
    enrollment: {
      id: enrollment.id,
      track: enrollment.track,
      trackLabel: trackLabel(enrollment.track),
      startDate: dayKey(enrollment.startDate),
      endDate: dayKey(enrollment.endDate),
      endLabel: thaiDate(enrollment.endDate),
      totalDays: enrollment.totalDays,
      remaining: days.filter((d) => d.date >= today).length,
      slots: enrollment.slots,
      price: enrollment.price,
    },
    week,
  });
}
