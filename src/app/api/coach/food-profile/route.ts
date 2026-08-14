import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { DEFAULT_PROFILE } from "@/lib/mealDesign";

export const dynamic = "force-dynamic";

/**
 * แบบสำรวจรสนิยมอาหาร — ใช้เป็นตัวกรองจริงตอนจัดแผนผูกปิ่นโต
 *
 * GET  → { profile, answered }   answered=false = ยังไม่เคยทำแบบสำรวจ (แอปพาไปทำก่อน)
 * PUT  → บันทึก/แก้ไข (แก้กี่ครั้งก็ได้ ไม่ใช่ตอบครั้งเดียวจบ)
 *
 * 🔴 allergies คือข้อมูลความปลอดภัย — เก็บเป็นคอลัมน์ที่ query ได้ ไม่ยัดใน CoachMemory
 *    (CoachMemory เป็นข้อความอิสระที่ AI เขียนเอง ใช้กรองเมนูแบบรับประกันไม่ได้)
 */

const ALLOWED_MEATS = ["หมู", "วัว", "ไก่", "ทะเล", "ไม่กินเนื้อสัตว์"];
const ALLOWED_SLOTS = ["เช้า", "กลางวัน", "ว่าง", "เย็น"];
const ALLOWED_TASTE = ["จัดจ้าน", "กลมกล่อม", "จืด"];
const ALLOWED_CONDITIONS = ["เบาหวาน", "ความดัน", "ไต", "ไขมันในเลือด"];

/** ตัดข้อความขยะ/ยาวเกิน แล้วคืนเป็นรายการที่ไม่ซ้ำ */
function cleanList(v: unknown, max = 20, maxLen = 40): string[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, maxLen);
    if (t) out.add(t);
    if (out.size >= max) break;
  }
  return [...out];
}
const pickFrom = (v: unknown, allowed: string[]) => cleanList(v).filter((x) => allowed.includes(x));

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = await prisma.foodProfile.findUnique({ where: { memberId: member.id } });
  const res = NextResponse.json({
    answered: !!row,
    profile: row ?? { ...DEFAULT_PROFILE, memberId: member.id },
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export async function PUT(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const b = await req.json();
    const slots = pickFrom(b.mealSlots, ALLOWED_SLOTS);
    const spice = Number(b.spiceLevel);
    const budget = Number(b.budgetPerDay);

    const data = {
      allergies: cleanList(b.allergies),
      avoidMeats: pickFrom(b.avoidMeats, ALLOWED_MEATS),
      spiceLevel: Number.isFinite(spice) ? Math.min(3, Math.max(0, Math.round(spice))) : 1,
      eatsVegetables: b.eatsVegetables !== false,
      dislikedVeggies: cleanList(b.dislikedVeggies),
      tastePref: ALLOWED_TASTE.includes(b.tastePref) ? b.tastePref : null,
      cuisines: cleanList(b.cuisines, 8),
      // ไม่เลือกมื้อเลย = ใช้ค่ามาตรฐาน 3 มื้อ (แผนที่ไม่มีมื้อเลยไม่มีประโยชน์)
      mealSlots: slots.length ? slots : DEFAULT_PROFILE.mealSlots,
      healthConditions: pickFrom(b.healthConditions, ALLOWED_CONDITIONS),
      budgetPerDay: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null,
    };

    const profile = await prisma.foodProfile.upsert({
      where: { memberId: member.id },
      update: data,
      create: { memberId: member.id, ...data },
    });
    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    console.error("[coach/food-profile]", e);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
