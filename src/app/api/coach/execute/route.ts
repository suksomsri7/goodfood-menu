import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember, coachActive } from "@/lib/coachResolve";
import { upsertMemories } from "@/lib/coachMemory";
import { bkkDateKey, bkkTodayKey } from "@/lib/planGenerator";

/**
 * execute action ที่ user ยืนยันแล้ว (มาจาก /api/coach/agent)
 * POST { actions:[{tool,args}], acceptMemory?:[{kind,fact}], lineUserId? } (+ Bearer)
 *  → { done:[...], memorySaved }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const member = await resolveMember(req);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!coachActive(member)) return NextResponse.json({ error: "locked" }, { status: 403 });

    const actions: Array<{ tool: string; args: any }> = (Array.isArray(body.actions) ? body.actions : []).slice(0, 20);
    const done: string[] = [];
    // clamp กันค่าเพี้ยน/ติดลบ/มหาศาล (NaN → 0)
    const num = (v: any, max: number) => Math.min(max, Math.max(0, Number(v) || 0));

    for (const a of actions) {
      const g = a.args || {};
      if (a.tool === "log_meal") {
        await prisma.mealLog.create({
          data: {
            memberId: member.id,
            name: String(g.name || "อาหาร").slice(0, 120),
            weight: g.weight != null ? num(g.weight, 5000) : null,
            calories: num(g.calories, 6000),
            protein: num(g.protein, 500),
            carbs: num(g.carbs, 1000),
            fat: num(g.fat, 500),
            sodium: g.sodium != null ? num(g.sodium, 20000) : null,
            sugar: g.sugar != null ? num(g.sugar, 1000) : null,
            ingredients: g.ingredients ?? null,
            via: g.via || "voice",
          },
        });
        done.push("log_meal");
      } else if (a.tool === "log_water") {
        await prisma.waterLog.create({ data: { memberId: member.id, amount: num(g.amount, 5000) } });
        done.push("log_water");
      } else if (a.tool === "log_exercise") {
        await prisma.exerciseLog.create({
          data: {
            memberId: member.id,
            name: String(g.name || "ออกกำลังกาย").slice(0, 120),
            type: g.type ?? null,
            duration: num(g.duration, 1440),
            calories: num(g.calories, 6000),
            intensity: g.intensity ?? null,
            source: "manual",
          },
        });
        done.push("log_exercise");
      } else if (a.tool === "log_sleep") {
        // นอน: คีย์เป็น "วันที่ตื่น" (BKK) · source=voice แยกจาก healthkit กันทับกัน
        const minutes = Math.round(num(g.minutes, 1440));
        if (minutes > 0) {
          // ไม่เชื่อวันที่จาก AI ตรง ๆ — เคยเดาย้อนไป 2 วัน · อนาคต/เก่ากว่า 14 วัน = ใช้วันนี้แทน
          const today = bkkTodayKey();
          let date = today;
          if (typeof g.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) {
            const asked = bkkDateKey(new Date(`${g.date}T00:00:00.000Z`));
            const ageDays = (today.getTime() - asked.getTime()) / 86400000;
            if (!isNaN(asked.getTime()) && ageDays >= 0 && ageDays <= 14) date = asked;
          }
          {
            await prisma.sleepLog.upsert({
              where: { memberId_date_source: { memberId: member.id, date, source: "voice" } },
              update: { minutesAsleep: minutes },
              create: { memberId: member.id, date, minutesAsleep: minutes, source: "voice" },
            });
            done.push("log_sleep");
          }
        }
      } else if (a.tool === "log_weight") {
        const w = Number(g.weight);
        if (Number.isFinite(w) && w > 0 && w <= 500) {
          await prisma.weightLog.create({ data: { memberId: member.id, weight: w, note: "voice" } });
          done.push("log_weight");
        }
      }
      // adjust_plan → เก็บไว้เฟสหลัง (ต้อง regenerate) — ข้ามอย่างปลอดภัย
    }

    let memorySaved = 0;
    const VALID_KINDS = ["preference", "pattern", "constraint", "goal_note", "dislike", "injury", "schedule", "context"];
    if (Array.isArray(body.acceptMemory) && body.acceptMemory.length) {
      const clean = body.acceptMemory
        .slice(0, 20)
        .filter((m: any) => VALID_KINDS.includes(m?.kind) && typeof m?.fact === "string" && m.fact.trim())
        .map((m: any) => ({ kind: m.kind, fact: String(m.fact).slice(0, 200), source: "chat" }));
      const saved = await upsertMemories(member.id, clean);
      memorySaved = saved.length;
    }

    return NextResponse.json({ done, memorySaved });
  } catch (e: any) {
    console.error("[coach/execute]", e);
    return NextResponse.json({ error: e.message || "execute failed" }, { status: 500 });
  }
}
