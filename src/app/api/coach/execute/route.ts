import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember, coachActive } from "@/lib/coachResolve";
import { upsertMemories } from "@/lib/coachMemory";

/**
 * execute action ที่ user ยืนยันแล้ว (มาจาก /api/coach/agent)
 * POST { actions:[{tool,args}], acceptMemory?:[{kind,fact}], lineUserId? } (+ Bearer)
 *  → { done:[...], memorySaved }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const member = await resolveMember(req, body.lineUserId);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!coachActive(member)) return NextResponse.json({ error: "locked" }, { status: 403 });

    const actions: Array<{ tool: string; args: any }> = Array.isArray(body.actions) ? body.actions : [];
    const done: string[] = [];

    for (const a of actions) {
      const g = a.args || {};
      if (a.tool === "log_meal") {
        await prisma.mealLog.create({
          data: {
            memberId: member.id,
            name: g.name || "อาหาร",
            weight: g.weight ?? null,
            calories: Number(g.calories) || 0,
            protein: Number(g.protein) || 0,
            carbs: Number(g.carbs) || 0,
            fat: Number(g.fat) || 0,
            sodium: g.sodium != null ? Number(g.sodium) : null,
            sugar: g.sugar != null ? Number(g.sugar) : null,
            ingredients: g.ingredients ?? null,
            via: g.via || "voice",
          },
        });
        done.push("log_meal");
      } else if (a.tool === "log_water") {
        await prisma.waterLog.create({ data: { memberId: member.id, amount: Number(g.amount) || 0 } });
        done.push("log_water");
      } else if (a.tool === "log_exercise") {
        await prisma.exerciseLog.create({
          data: {
            memberId: member.id,
            name: g.name || "ออกกำลังกาย",
            type: g.type ?? null,
            duration: Number(g.duration) || 0,
            calories: Number(g.calories) || 0,
            intensity: g.intensity ?? null,
            source: "manual",
          },
        });
        done.push("log_exercise");
      }
      // adjust_plan → เก็บไว้เฟสหลัง (ต้อง regenerate) — ข้ามอย่างปลอดภัย
    }

    let memorySaved = 0;
    if (Array.isArray(body.acceptMemory) && body.acceptMemory.length) {
      const saved = await upsertMemories(
        member.id,
        body.acceptMemory.map((m: any) => ({ kind: m.kind, fact: m.fact, source: "chat" }))
      );
      memorySaved = saved.length;
    }

    return NextResponse.json({ done, memorySaved });
  } catch (e: any) {
    console.error("[coach/execute]", e);
    return NextResponse.json({ error: e.message || "execute failed" }, { status: 500 });
  }
}
