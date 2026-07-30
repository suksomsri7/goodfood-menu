import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalories,
  calculateMacros,
  calculateAge,
  type ActivityLevel,
} from "@/lib/health-calculator";

export const dynamic = "force-dynamic";

/**
 * หน้าตั้งค่าของแอป Coach — เดิม user แก้อะไรไม่ได้เลยหลัง onboarding
 * GET   → ค่าปัจจุบัน (เป้าหมาย/อุปกรณ์/สวิตช์แจ้งเตือน)
 * PATCH → แก้ goalType/goalWeight/weight/activityLevel/equipment + notify* flags
 *         แตะค่าที่กระทบพลังงาน → คำนวณ BMR/TDEE/แคลอรี่/มาโครใหม่ให้ทันที
 */
const NOTIFY_KEYS = [
  "notifyMorningCoach",
  "notifyLunchSuggestion",
  "notifyDinnerSuggestion",
  "notifyWaterReminder",
  "notifyWeeklyInsights",
  "notifyWeightReminder",
] as const;

function view(m: any) {
  return {
    name: m.displayName || m.name,
    goalType: m.goalType,
    goalWeight: m.goalWeight,
    weight: m.weight,
    height: m.height,
    activityLevel: m.activityLevel,
    equipment: m.equipment || "none",
    dailyCalories: m.dailyCalories,
    dailyProtein: m.dailyProtein,
    dailyWater: m.dailyWater,
    notify: Object.fromEntries(NOTIFY_KEYS.map((k) => [k, m[k]])),
  };
}

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(view(member));
}

export async function PATCH(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (["lose", "gain", "maintain"].includes(b.goalType)) data.goalType = b.goalType;
  if (typeof b.goalWeight === "number" && b.goalWeight >= 30 && b.goalWeight <= 250) data.goalWeight = b.goalWeight;
  if (typeof b.weight === "number" && b.weight >= 30 && b.weight <= 250) data.weight = b.weight;
  if (["sedentary", "light", "moderate", "active", "very_active"].includes(b.activityLevel)) data.activityLevel = b.activityLevel;
  if (["none", "home", "gym"].includes(b.equipment)) data.equipment = b.equipment;
  for (const k of NOTIFY_KEYS) if (typeof b[k] === "boolean") data[k] = b[k];

  // ค่าที่กระทบพลังงานเปลี่ยน → คำนวณเป้าใหม่ (สูตรเดียวกับ onboarding)
  const touchesEnergy = ["goalType", "goalWeight", "weight", "activityLevel"].some((k) => k in data);
  if (touchesEnergy && member.birthDate && member.height && member.gender) {
    const weight = (data.weight as number) ?? member.weight ?? 70;
    const goalType = ((data.goalType as string) ?? member.goalType ?? "maintain") as "lose" | "gain" | "maintain";
    const activity = ((data.activityLevel as string) ?? member.activityLevel ?? "moderate") as ActivityLevel;
    const age = calculateAge(member.birthDate);
    const bmr = calculateBMR(weight, member.height, age, member.gender as "male" | "female");
    const tdee = calculateTDEE(bmr, activity);
    const dailyCalories = calculateDailyCalories(tdee, goalType);
    const dietType = ["balanced", "high_protein", "low_fat"].includes(member.dietType || "")
      ? (member.dietType as "balanced" | "high_protein" | "low_fat")
      : "balanced"; // สมาชิกเก่าบางคนเก็บเป็นข้อความไทย ("ทั่วไป") → กัน NaN
    const macros = calculateMacros(dailyCalories, dietType);
    Object.assign(data, {
      bmr,
      tdee,
      dailyCalories,
      dailyProtein: macros.protein,
      dailyCarbs: macros.carbs,
      dailyFat: macros.fat,
    });
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const updated = await prisma.member.update({ where: { id: member.id }, data });
  return NextResponse.json({ ok: true, ...view(updated), recalculated: touchesEnergy });
}
