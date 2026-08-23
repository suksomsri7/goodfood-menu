import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { dailyTarget, mealTargets, thaiDate, trackLabel } from "@/lib/program";

export const dynamic = "force-dynamic";

/**
 * โปรไฟล์ลูกค้าในโปรแกรม — ทุกอย่างที่ครัว/แอดมินต้องรู้เกี่ยวกับคนนี้ ในหน้าเดียว
 *
 * 🔴 เรียง "ของที่ทำให้เกิดอันตราย" ไว้บนสุดเสมอ (แพ้อาหาร → โรคประจำตัว)
 *    ข้อมูลรสนิยมสำคัญรองลงมา — สลับลำดับเมื่อไรคนอ่านเร็ว ๆ จะพลาดของสำคัญ
 */

const ageFrom = (b: Date | null): number | null => {
  if (!b) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};

const GOAL_LABEL: Record<string, string> = {
  lose: "ลดน้ำหนัก",
  maintain: "รักษาน้ำหนัก",
  gain: "เพิ่มน้ำหนัก",
  muscle: "เพิ่มกล้ามเนื้อ",
};

const SPICE = ["ไม่กินเผ็ด", "เผ็ดน้อย", "เผ็ดกลาง", "เผ็ดมาก"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { memberId } = await params;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true, name: true, displayName: true, phone: true, email: true,
      gender: true, birthDate: true, height: true, weight: true, goalWeight: true, goalType: true,
      activityLevel: true, dietType: true, targetMonths: true, bmr: true, tdee: true,
      dailyCalories: true, dailyProtein: true, dailyCarbs: true, dailyFat: true,
      dailyFiber: true, dailySodium: true, dailySugar: true,
      createdAt: true, isOnboarded: true,
    },
  });
  if (!member) return NextResponse.json({ error: "ไม่พบลูกค้ารายนี้" }, { status: 404 });

  const [profile, enrollments, addresses, weights, swaps, orders, feedbacks] = await Promise.all([
    prisma.foodProfile.findUnique({ where: { memberId } }),
    prisma.programEnrollment.findMany({
      where: { memberId },
      orderBy: { startDate: "desc" },
      include: { address: { select: { address: true, subDistrict: true, district: true, province: true, postalCode: true } } },
    }),
    prisma.address.findMany({ where: { memberId }, select: { id: true, address: true, subDistrict: true, district: true, province: true, postalCode: true, isDefault: true } }),
    prisma.weightLog.findMany({ where: { memberId }, orderBy: { date: "desc" }, take: 5, select: { date: true, weight: true } }),
    // เมนูที่ลูกค้าเปลี่ยนออก — บอกรสนิยมจริงได้ดีกว่าแบบสำรวจ เพราะเป็นพฤติกรรม ไม่ใช่คำตอบ
    prisma.mealSwap.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { createdAt: true, reason: true, fromName: true, toName: true },
    }),
    prisma.order.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, totalPrice: true, status: true, createdAt: true },
    }),
    // เสียงหลังทานรายมื้อ — ครัวใช้ปรับรส/ปริมาณรายคน
    prisma.mealFeedback.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { createdAt: true, foodName: true, slot: true, taste: true, portion: true, note: true },
    }),
  ]);

  const active = enrollments.find((e) => e.status === "active") ?? null;
  const target = dailyTarget(member);

  const fmtAddr = (a: { address: string; subDistrict: string | null; district: string | null; province: string | null; postalCode: string | null } | null) =>
    a ? [a.address, a.subDistrict, a.district, a.province, a.postalCode].filter(Boolean).join(" ") : null;

  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name || member.displayName || "(ไม่มีชื่อ)",
      phone: member.phone,
      email: member.email,
      gender: member.gender,
      age: ageFrom(member.birthDate),
      height: member.height,
      weight: member.weight,
      goalWeight: member.goalWeight,
      goalLabel: member.goalType ? GOAL_LABEL[member.goalType] ?? member.goalType : null,
      activityLevel: member.activityLevel,
      dietType: member.dietType,
      targetMonths: member.targetMonths,
      bmr: member.bmr ? Math.round(member.bmr) : null,
      tdee: member.tdee ? Math.round(member.tdee) : null,
      isOnboarded: member.isOnboarded,
      joinedLabel: thaiDate(new Date(Date.UTC(member.createdAt.getUTCFullYear(), member.createdAt.getUTCMonth(), member.createdAt.getUTCDate())), false),
      joinedAt: member.createdAt,
    },

    /** 🔴 ส่วนที่ครัวต้องอ่านก่อนทำอาหาร */
    safety: {
      allergies: profile?.allergies ?? [],
      healthConditions: profile?.healthConditions ?? [],
      /** ยังไม่เคยทำแบบสำรวจ = ไม่ได้แปลว่าไม่แพ้อะไร ต้องบอกให้ต่างกัน */
      hasProfile: !!profile,
    },

    preference: profile
      ? {
          avoidMeats: profile.avoidMeats,
          dislikedVeggies: profile.dislikedVeggies,
          eatsVegetables: profile.eatsVegetables,
          spiceLabel: SPICE[profile.spiceLevel] ?? null,
          tastePref: profile.tastePref,
          cuisines: profile.cuisines,
          mealSlots: profile.mealSlots,
          budgetPerDay: profile.budgetPerDay,
        }
      : null,

    nutrition: {
      daily: target,
      perMeal: mealTargets(member, active?.slots ?? undefined),
    },

    program: {
      active: active
        ? {
            id: active.id,
            track: active.track,
            trackLabel: trackLabel(active.track),
            startLabel: thaiDate(active.startDate),
            endLabel: thaiDate(active.endDate),
            totalDays: active.totalDays,
            slots: active.slots,
            price: active.price,
            deliveryNote: active.deliveryNote,
            address: fmtAddr(active.address),
            enrolledLabel: thaiDate(new Date(Date.UTC(active.createdAt.getUTCFullYear(), active.createdAt.getUTCMonth(), active.createdAt.getUTCDate())), false),
          }
        : null,
      history: enrollments.map((e) => ({
        id: e.id,
        trackLabel: trackLabel(e.track),
        startLabel: thaiDate(e.startDate, false),
        endLabel: thaiDate(e.endDate, false),
        totalDays: e.totalDays,
        status: e.status,
        price: e.price,
      })),
    },

    addresses: addresses.map((a) => ({ id: a.id, text: fmtAddr(a), isDefault: a.isDefault })),
    weights: weights.map((w) => ({ date: w.date, weight: w.weight })),
    feedbacks: feedbacks.map((f) => ({
      at: f.createdAt,
      foodName: f.foodName,
      slot: f.slot,
      taste: f.taste,
      portion: f.portion,
      note: f.note,
    })),
    swaps: swaps.map((s) => ({
      createdAt: s.createdAt,
      reason: s.reason,
      from: s.fromName,
      to: s.toName,
    })),
    orders,
  });
}
