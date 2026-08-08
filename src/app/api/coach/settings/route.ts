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
import { estimateEnergy, targetFromTdee, macroTargets } from "@/lib/energyModel";
import { validBurnGoal, BURN_GOAL_MIN, BURN_GOAL_MAX } from "@/lib/burnGoal";

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
  "notifyArticles",
] as const;

/** DateTime ใน DB → "YYYY-MM-DD" (เก็บเป็น UTC midnight จึงตัด ISO ตรง ๆ ได้) */
function toDateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * "YYYY-MM-DD" → Date (UTC midnight) · ไม่ผ่านเกณฑ์คืน undefined
 * อายุต้องอยู่ระหว่าง 10-100 ปี — ต่ำ/สูงกว่านี้คือกรอกผิด (สูตร BMR ใช้ไม่ได้)
 */
function parseBirthDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return undefined; // กัน 2026-02-31
  const age = calculateAge(d);
  if (age < 10 || age > 100) return undefined;
  return d;
}

function view(m: any) {
  return {
    name: m.displayName || m.name,
    birthDate: toDateStr(m.birthDate),
    goalType: m.goalType,
    goalWeight: m.goalWeight,
    weight: m.weight,
    height: m.height,
    activityLevel: m.activityLevel,
    equipment: m.equipment || "none",
    dailyCalories: m.dailyCalories,
    dailyProtein: m.dailyProtein,
    dailyWater: m.dailyWater,
    // null = ยังไม่ได้ตั้งเอง (ระบบใช้ Move goal ของนาฬิกา/ค่าคำนวณให้)
    dailyBurnGoal: m.dailyBurnGoal ?? null,
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

  // วันเกิดกระทบ BMR/TDEE โดยตรง → รูปแบบผิดหรือนอกช่วงต้องตอบ 400 ไม่ใช่เงียบ ๆ ข้าม
  if (b.birthDate !== undefined) {
    const bd = parseBirthDate(b.birthDate);
    if (!bd) {
      return NextResponse.json(
        { error: "birthDate ต้องเป็นรูปแบบ YYYY-MM-DD และอายุอยู่ระหว่าง 10-100 ปี" },
        { status: 400 }
      );
    }
    data.birthDate = bd;
  }

  // เป้าเผาผลาญที่ user ตั้งเอง — null = ล้าง override กลับไปใช้นาฬิกา/ค่าคำนวณ
  // ไม่เข้า touchesEnergy: เป็นเป้า "เผา" ไม่ใช่เป้า "กิน" ไม่ต้องคำนวณ BMR/มาโครใหม่
  if (b.dailyBurnGoal !== undefined) {
    if (b.dailyBurnGoal === null) {
      data.dailyBurnGoal = null;
    } else {
      const v = validBurnGoal(b.dailyBurnGoal);
      if (!v) {
        return NextResponse.json(
          { error: `dailyBurnGoal ต้องเป็นตัวเลข ${BURN_GOAL_MIN}-${BURN_GOAL_MAX} kcal (หรือ null เพื่อกลับไปใช้ค่าอัตโนมัติ)` },
          { status: 400 }
        );
      }
      data.dailyBurnGoal = v;
    }
  }

  if (["lose", "gain", "maintain"].includes(b.goalType)) data.goalType = b.goalType;
  if (typeof b.goalWeight === "number" && b.goalWeight >= 30 && b.goalWeight <= 250) data.goalWeight = b.goalWeight;
  if (typeof b.weight === "number" && b.weight >= 30 && b.weight <= 250) data.weight = b.weight;
  if (["sedentary", "light", "moderate", "active", "very_active"].includes(b.activityLevel)) data.activityLevel = b.activityLevel;
  if (["none", "home", "gym"].includes(b.equipment)) data.equipment = b.equipment;
  for (const k of NOTIFY_KEYS) if (typeof b[k] === "boolean") data[k] = b[k];

  // ค่าที่กระทบพลังงานเปลี่ยน → คำนวณเป้าใหม่ (สูตรเดียวกับ onboarding)
  const touchesEnergy = ["goalType", "goalWeight", "weight", "activityLevel", "birthDate"].some((k) => k in data);
  const birthDate = (data.birthDate as Date | undefined) ?? member.birthDate;
  if (touchesEnergy && birthDate && member.height && member.gender) {
    const weight = (data.weight as number) ?? member.weight ?? 70;
    const goalType = ((data.goalType as string) ?? member.goalType ?? "maintain") as "lose" | "gain" | "maintain";
    const activity = ((data.activityLevel as string) ?? member.activityLevel ?? "moderate") as ActivityLevel;
    const age = calculateAge(birthDate);
    const bmr = calculateBMR(weight, member.height, age, member.gender as "male" | "female");
    // เป้าพลังงาน: ใช้ค่าที่วัด/เรียนจากข้อมูลจริงถ้ามี (energyModel) — สูตร BMR×ตัวคูณเป็นทางสำรอง
    const est = await estimateEnergy(member.id);
    const useReal = est && est.source !== "formula";
    const tdee = useReal ? est!.tdee : calculateTDEE(bmr, activity);
    const dailyCalories = targetFromTdee(tdee, goalType, bmr);
    // มาโครคิดโปรตีนเป็น ก./กก. ก่อน (ของเดิมคิดเป็น % ทำให้โปรตีนพุ่งเกินจริงเมื่อแคลอรี่สูง)
    const { macros } = macroTargets(
      dailyCalories,
      weight,
      (data.goalWeight as number) ?? member.goalWeight ?? null,
      goalType
    );
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
