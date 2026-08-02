import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember } from "@/lib/coachResolve";
import { EXERCISE_CATALOG } from "@/lib/exerciseCatalog";

export const dynamic = "force-dynamic";

/**
 * คลังท่าออกกำลังกาย + สื่อสาธิต — แอปค้นด้วย key ที่มากับแผน
 * (เพิ่มคลิปใหม่ที่ backend แล้วแอปเห็นทันที ไม่ต้อง build ใหม่)
 *
 * GET → { items: [...], withMedia: [key], weightKg, kcalFormula }
 *  - items แต่ละตัวมี met ติดมาด้วยแล้ว (WO-B) → แอปคำนวณ kcal เองได้ทันทีไม่ต้องยิง AI
 *  - weightKg = น้ำหนักปัจจุบันของ member (Member.weight ก่อน ถ้าไม่มีใช้ WeightLog ล่าสุด)
 *    ไม่ได้ล็อกอิน/ไม่มีน้ำหนัก → null (ของเดิมที่เรียกแบบไม่มี token ยังใช้ได้เหมือนเดิม)
 */
export async function GET(req: NextRequest) {
  let weightKg: number | null = null;
  try {
    const member = await resolveMember(req);
    if (member) {
      weightKg = member.weight ?? null;
      if (weightKg == null) {
        const last = await prisma.weightLog.findFirst({
          where: { memberId: member.id },
          orderBy: { date: "desc" },
          select: { weight: true },
        });
        weightKg = last?.weight ?? null;
      }
    }
  } catch (e) {
    console.error("[coach/exercises] weight lookup", e);
  }

  return NextResponse.json({
    items: EXERCISE_CATALOG,
    withMedia: EXERCISE_CATALOG.filter((e) => e.media).map((e) => e.key),
    weightKg,
    kcalFormula: "met * 3.5 * weightKg / 200 * minutes",
  });
}
