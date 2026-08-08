import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { estimateEnergy, nextStepHint } from "@/lib/energyModel";
import { personalBurnGoal } from "@/lib/burnGoal";

/**
 * "เป้าพลังงานของคุณมาจากไหน" — โค้ชต้องอธิบายตัวเลขของตัวเองได้
 * GET  (Bearer) → { current, estimate:{tdee,target,source,confidence,explain,macros,...}, hint, differs }
 * POST (Bearer) → ใช้ค่าที่ประเมินได้เป็นเป้าใหม่ทันที (user กดยืนยันเอง) → { ok, applied }
 */
const SOURCE_LABEL: Record<string, string> = {
  adaptive: "เรียนจากผลจริงของคุณ",
  measured: "วัดจาก Apple Health",
  formula: "ค่าประมาณจากสูตร",
};

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const e = await estimateEnergy(member.id);
  if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });

  const current = {
    calories: member.dailyCalories ?? null,
    protein: member.dailyProtein ?? null,
    carbs: member.dailyCarbs ?? null,
    fat: member.dailyFat ?? null,
  };
  const burnGoal = await personalBurnGoal(member, { tdee: e.tdee }).catch(() => null);

  return NextResponse.json({
    current,
    estimate: { ...e, sourceLabel: SOURCE_LABEL[e.source] },
    // เป้าแหวน "เผาผลาญ" — คนละเรื่องกับ target (แคลอรี่ที่ควรกิน)
    burnGoal,
    hint: nextStepHint(e),
    // ต่างจากของเดิมเกิน 100 kcal หรือโปรตีนต่างเกิน 20 g → แอปขึ้นปุ่มให้ปรับ
    differs:
      Math.abs((current.calories ?? 0) - e.target) > 100 ||
      Math.abs((current.protein ?? 0) - e.macros.protein) > 20,
  });
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const e = await estimateEnergy(member.id);
  if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });

  const prev = member.dailyCalories ?? null;
  await prisma.member.update({
    where: { id: member.id },
    data: {
      bmr: e.bmr,
      tdee: e.tdee,
      dailyCalories: e.target,
      dailyProtein: e.macros.protein,
      dailyCarbs: e.macros.carbs,
      dailyFat: e.macros.fat,
    },
  });
  // เก็บประวัติไว้ให้โค้ชเช้าพูดถึงได้ + ตรวจย้อนหลังได้ว่าใครเปลี่ยนเป้าเมื่อไร
  await prisma.planAdjustment.create({
    data: {
      memberId: member.id,
      reason: `ปรับเป้าตามที่คุณยืนยัน — ${SOURCE_LABEL[e.source]}: ${e.explain}`,
      prevCalories: prev ?? e.target,
      newCalories: e.target,
      detail: { source: e.source, confidence: e.confidence, dataDays: e.dataDays, macros: e.macros, byUser: true },
    },
  });

  return NextResponse.json({ ok: true, applied: { calories: e.target, ...e.macros }, source: e.source });
}
