import { NextRequest, NextResponse } from "next/server";
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
  thaiDate,
  trackLabel,
} from "@/lib/program";
import { absoluteImageUrl } from "@/lib/articleFeed";

export const dynamic = "force-dynamic";

/**
 * ช่องโภชนาการในแอป — คืนข้อมูลชุดเดียวให้ทั้งคนที่อยู่ในโปรแกรมและคนที่ยังไม่อยู่
 *
 * 🔴 เป้าสารอาหารรายมื้อเป็นของ "ทุกคน" ไม่ใช่ของเฉพาะลูกค้าที่จ่ายเงิน
 *    คนที่ยังไม่สมัครก็ต้องเห็นว่าตัวเองต้องการเท่าไร — นั่นแหละคือสิ่งที่ทำให้เขาอยากสมัคร
 *    ต่างกันแค่ชั้นบน: อยู่ในโปรแกรม = มีกล่องที่จะได้รับจริง · ยังไม่อยู่ = มีปุ่มชวนสมัคร
 */

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

    return NextResponse.json({
      enrolled: false,
      daily,
      /** เป้ารายมื้อของทุกคน — ค่านี้คือ "งานของ Coach AI" ที่หลังบ้านเอาไปตักอาหาร */
      targets: mealTargets(member),
      tracks: TRACKS.map((t) => ({ key: t.key, label: t.label })),
      /** สมัครได้เร็วสุดวันไหน — ปฏิทินต้องเต็มพอสำหรับคอร์สเต็มความยาว */
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
    include: {
      food: {
        select: {
          id: true, name: true, imageUrl: true, description: true,
          calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true,
        },
      },
    },
  });
  const menuAt = new Map(menu.map((m) => [`${dayKey(m.date)}|${m.slot}`, m]));

  const week = days.map((d) => {
    const key = dayKey(d.date);
    const meals = PROGRAM_SLOTS.filter((s) => enrollment.slots.includes(s)).map((slot) => {
      const cell = menuAt.get(`${key}|${slot}`);
      const t = targetBySlot.get(slot)!;
      return {
        slot,
        target: t,
        food: cell
          ? {
              id: cell.food.id,
              name: cell.food.name,
              image: absoluteImageUrl(cell.food.imageUrl),
              description: cell.food.description,
              calories: cell.food.calories,
              protein: cell.food.protein,
              carbs: cell.food.carbs,
              fat: cell.food.fat,
              fiber: cell.food.fiber,
              sodium: cell.food.sodium,
              sugar: cell.food.sugar,
            }
          : null,
      };
    });
    return {
      dayNumber: d.dayNumber,
      date: key,
      label: thaiDate(d.date),
      isToday: key === dayKey(today),
      meals,
    };
  });

  return NextResponse.json({
    enrolled: true,
    daily,
    targets,
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
