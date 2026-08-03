import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { resolveLogTime } from "@/lib/coachLogTime";

/**
 * แก้บันทึกใน timeline (ปัดซ้าย → "แก้ไข") — ownership check เสมอ
 * POST { type: "meal"|"exercise", id, fields } (Bearer) → { ok: true }
 *
 * meal   fields: name, calories, protein, carbs, fat, sodium, sugar (+ time/date)
 * exercise fields: name, duration, calories, type (+ time/date)
 *
 * กติกา:
 * - ส่งมาเฉพาะ field ที่จะแก้ (ไม่ส่ง = คงของเดิม)
 * - ห้ามแตะ via / imageUrl / ingredients ของ MealLog (บันทึกจากรูปต้องคงที่มาไว้)
 * - ไม่ยุ่ง logic ติ๊กแผน (การแก้ค่าไม่กระทบเครื่องหมายถูก — untick อยู่ที่ delete-entry เท่านั้น)
 * - clamp ค่าเหมือน /api/coach/execute กันค่าเพี้ยน/ติดลบ/มหาศาล
 */

/** clamp ตัวเลขแบบเดียวกับ execute (NaN → 0) */
const num = (v: any, max: number) => Math.min(max, Math.max(0, Number(v) || 0));
/** field ที่ส่งมาจริงเท่านั้นถึงจะแก้ (undefined/null = ไม่แตะ) */
const has = (f: any, k: string) => f[k] !== undefined && f[k] !== null;

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { type, id, fields } = await req.json();
    if (!id || !["meal", "exercise"].includes(type)) {
      return NextResponse.json({ error: "type meal|exercise + id required" }, { status: 400 });
    }
    const f = (fields && typeof fields === "object" ? fields : {}) as Record<string, any>;
    const at = resolveLogTime(f); // เวลาไทยที่ user เลือกใหม่ (ถ้าส่งมาและอยู่ในช่วงที่เชื่อได้)

    if (type === "meal") {
      const log = await prisma.mealLog.findFirst({ where: { id, memberId: member.id }, select: { id: true } });
      if (!log) return NextResponse.json({ error: "not found" }, { status: 404 });

      const data: Record<string, any> = {};
      if (has(f, "name") && String(f.name).trim()) data.name = String(f.name).trim().slice(0, 120);
      if (has(f, "calories")) data.calories = num(f.calories, 6000);
      if (has(f, "protein")) data.protein = num(f.protein, 500);
      if (has(f, "carbs")) data.carbs = num(f.carbs, 1000);
      if (has(f, "fat")) data.fat = num(f.fat, 500);
      if (has(f, "sodium")) data.sodium = num(f.sodium, 20000);
      if (has(f, "sugar")) data.sugar = num(f.sugar, 1000);
      if (at) data.date = at;
      if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

      // กรอง memberId ซ้ำใน where ของ update ด้วย (กันแก้ของคนอื่นแม้เดา id ถูก)
      const r = await prisma.mealLog.updateMany({ where: { id, memberId: member.id }, data });
      if (r.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    const log = await prisma.exerciseLog.findFirst({ where: { id, memberId: member.id }, select: { id: true } });
    if (!log) return NextResponse.json({ error: "not found" }, { status: 404 });

    const data: Record<string, any> = {};
    if (has(f, "name") && String(f.name).trim()) data.name = String(f.name).trim().slice(0, 120);
    if (has(f, "duration")) data.duration = Math.round(num(f.duration, 1440));
    if (has(f, "calories")) data.calories = num(f.calories, 6000);
    if (has(f, "type")) data.type = String(f.type).trim().slice(0, 40) || null;
    if (at) data.date = at;
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

    const r = await prisma.exerciseLog.updateMany({ where: { id, memberId: member.id }, data });
    if (r.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[update-entry]", e);
    return NextResponse.json({ error: e.message || "update failed" }, { status: 500 });
  }
}
