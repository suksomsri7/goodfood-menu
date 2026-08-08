import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember } from "@/lib/coachResolve";
import { bkkDateKey } from "@/lib/planGenerator";
import { healthkitWorkoutName } from "@/lib/healthkitWorkout";

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
    // เหตุผลที่ข้าม workout แต่ละตัว — ให้ debug ได้ว่าทำไมนาฬิกาซิงก์แล้วไม่มีรายการขึ้น
    const workoutDetails: Array<{ sourceId: string | null; name: string; status: string }> = [];
    let skippedDuplicate = 0;
    let skippedOverlap = 0;

    for (const w of body.workouts || []) {
      const name = healthkitWorkoutName(w.type);

      if (w.sourceId) {
        const exists = await prisma.exerciseLog.findFirst({
          where: { memberId: member.id, sourceId: w.sourceId },
        });
        if (exists) {
          skippedDuplicate++;
          workoutDetails.push({ sourceId: w.sourceId, name, status: "skipped-duplicate" });
          continue;
        }
      }

      const startedAt = w.startedAt ? new Date(w.startedAt) : new Date();
      const durationMin = Math.round(Number(w.duration) || 0);
      const endedAt = new Date(startedAt.getTime() + durationMin * 60_000);

      /**
       * 🔴 กันนับซ้ำ: user เดิน 1 ครั้ง แต่เคยได้ 3 รายการ (นาฬิกา 122 + ติ๊กแผน 120 + กรอกมือ 237)
       * ทำให้วงแหวน + งบ "คืน 60%" บวมเกินจริง
       * ถ้ามีรายการที่ user บันทึกเอง (ไม่ใช่จากอุปกรณ์) คาบเกี่ยวช่วงเวลาของ workout นี้ → ไม่สร้างซ้ำ
       * ทิศเดียวพอ: นาฬิกามาทีหลังจะไม่ทับของมือ · ส่วน user กรอกมือทีหลังนาฬิกาไม่กัน (เจตนา user ชนะ)
       */
      const OVERLAP_MS = 45 * 60_000;
      const overlapping = await prisma.exerciseLog.findFirst({
        where: {
          memberId: member.id,
          date: { gte: new Date(startedAt.getTime() - OVERLAP_MS), lte: new Date(endedAt.getTime() + OVERLAP_MS) },
          NOT: { source: { in: ["healthkit", "watch"] } },
        },
        select: { id: true, name: true },
      });
      if (overlapping) {
        skippedOverlap++;
        workoutDetails.push({ sourceId: w.sourceId ?? null, name, status: "skipped-overlap" });
        continue;
      }

      await prisma.exerciseLog.create({
        data: {
          memberId: member.id,
          name, // ชื่อไทย ไม่ใช่รหัสดิบ (เดิมโชว์ "52")
          type: w.type != null ? String(w.type) : null,
          duration: durationMin,
          calories: Number(w.calories) || 0,
          source: source === "watch" ? "watch" : "healthkit",
          sourceId: w.sourceId ?? null,
          date: startedAt,
        },
      });
      counts.workouts++;
      workoutDetails.push({ sourceId: w.sourceId ?? null, name, status: "created" });
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

    // เพิ่ม field แบบ additive — ของเดิม { workouts, weights, sleeps, metrics } ยังอยู่ครบ
    return NextResponse.json({ ...counts, skippedDuplicate, skippedOverlap, workoutDetails });
  } catch (e: any) {
    console.error("[health/sync]", e);
    return NextResponse.json({ error: e.message || "sync failed" }, { status: 500 });
  }
}
