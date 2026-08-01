import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember } from "@/lib/coachResolve";
import { bkkDateKey } from "@/lib/planGenerator";

/**
 * รับข้อมูลจาก Apple Health / Google Fit / Watch (ข้อ 4) — idempotent (sync ซ้ำไม่เพิ่มซ้ำ)
 * POST {
 *   source?: "healthkit"|"healthconnect"|"watch",
 *   workouts?: [{sourceId,type,startedAt,duration(min),calories,avgHR?,distanceM?}],
 *   weights?:  [{weight,date}],
 *   sleeps?:   [{sourceId,date,minutesAsleep,quality?,stages?}],
 *   metrics?:  [{date,steps?,restingHR?,activeKcal?,standHours?,exerciseMin?}],
 *   lineUserId?
 * } (+ Bearer) → { workouts, weights, sleeps, metrics } (จำนวนที่บันทึก/อัปเดต)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const member = await resolveMember(req);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const source: string = body.source || "healthkit";
    const counts = { workouts: 0, weights: 0, sleeps: 0, metrics: 0 };

    for (const w of body.workouts || []) {
      if (w.sourceId) {
        const exists = await prisma.exerciseLog.findFirst({
          where: { memberId: member.id, sourceId: w.sourceId },
        });
        if (exists) continue;
      }
      await prisma.exerciseLog.create({
        data: {
          memberId: member.id,
          name: w.type || "ออกกำลังกาย",
          type: w.type ?? null,
          duration: Math.round(Number(w.duration) || 0),
          calories: Number(w.calories) || 0,
          source: source === "watch" ? "watch" : "healthkit",
          sourceId: w.sourceId ?? null,
          date: w.startedAt ? new Date(w.startedAt) : new Date(),
        },
      });
      counts.workouts++;
    }

    for (const wt of body.weights || []) {
      const w = Number(wt.weight);
      if (!Number.isFinite(w) || w <= 0 || w > 500) continue; // F4: กัน NaN/ค่าเพี้ยน
      const date = wt.date ? new Date(wt.date) : new Date();
      if (isNaN(date.getTime())) continue;
      const dup = await prisma.weightLog.findFirst({
        where: { memberId: member.id, weight: w, date: { gte: new Date(date.getTime() - 12 * 3600e3), lte: new Date(date.getTime() + 12 * 3600e3) } },
      });
      if (dup) continue;
      await prisma.weightLog.create({ data: { memberId: member.id, weight: w, date, note: "sync" } });
      counts.weights++;
    }

    for (const s of body.sleeps || []) {
      const date = bkkDateKey(new Date(s.date));
      await prisma.sleepLog.upsert({
        where: { memberId_date_source: { memberId: member.id, date, source } },
        update: { minutesAsleep: Number(s.minutesAsleep) || 0, quality: s.quality ?? null, stages: s.stages ?? undefined, sourceId: s.sourceId ?? null },
        create: { memberId: member.id, date, minutesAsleep: Number(s.minutesAsleep) || 0, quality: s.quality ?? null, stages: s.stages ?? undefined, source, sourceId: s.sourceId ?? null },
      });
      counts.sleeps++;
    }

    for (const m of body.metrics || []) {
      const date = bkkDateKey(new Date(m.date));
      await prisma.dailyMetric.upsert({
        where: { memberId_date_source: { memberId: member.id, date, source } },
        update: {
          steps: m.steps ?? null, restingHR: m.restingHR ?? null, activeKcal: m.activeKcal ?? null,
          // วง Stand/Exercise ของ Apple — เก็บไว้ให้โค้ชใช้เป็นบริบท (ไม่ได้โชว์เป็นวงในหน้าหลัก)
          standHours: m.standHours ?? null, exerciseMin: m.exerciseMin ?? null,
        },
        create: {
          memberId: member.id, date, steps: m.steps ?? null, restingHR: m.restingHR ?? null,
          activeKcal: m.activeKcal ?? null, standHours: m.standHours ?? null, exerciseMin: m.exerciseMin ?? null, source,
        },
      });
      counts.metrics++;
    }

    return NextResponse.json(counts);
  } catch (e: any) {
    console.error("[health/sync]", e);
    return NextResponse.json({ error: e.message || "sync failed" }, { status: 500 });
  }
}
