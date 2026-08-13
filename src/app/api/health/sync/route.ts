import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember } from "@/lib/coachResolve";
import { bkkDateKey } from "@/lib/planGenerator";
import { healthkitWorkoutName } from "@/lib/healthkitWorkout";
import { sanitizeLogInstant } from "@/lib/coachLogTime";
import { validMoveGoal } from "@/lib/burnGoal";

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

      // นาฬิกาที่ตั้งเวลาเพี้ยน/ข้อมูลเสียเคยดัน log ไปอยู่อนาคต → บันทึกตกวันถัดไป
      const startedAt = sanitizeLogInstant(w.startedAt);
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

    /*
     * 🔴 การนอนต้อง "รวมทั้งคืน" ก่อนบันทึก
     *
     * Apple Watch ไม่ได้เขียนการนอนเป็นก้อนเดียว แต่เป็นช่วงย่อยสลับกันทั้งคืน
     * (Core/Deep/REM ช่วงละ 5-60 นาที) แอปรุ่นเดิมส่งมาช่วงละ 1 รายการ แล้วตรงนี้ upsert
     * ด้วยคีย์ (member, วันที่, source) เดียวกัน → ช่วงหลังทับช่วงก่อนไปเรื่อย ๆ
     * เหลือแค่ "ช่วงสุดท้ายของคืน" (ของจริงที่เจอ: 7 / 11 / 60 นาที ทั้งที่นอน ~7 ชม.)
     *
     * แก้ที่ฝั่ง server ด้วยเพื่อให้แอปรุ่นที่ติดตั้งอยู่แล้วได้ค่าถูกทันทีโดยไม่ต้องรอ build:
     * รวมทุกรายการของคืนเดียวกันในคำขอนี้เข้าด้วยกันก่อน แล้วค่อยเขียนครั้งเดียว
     * (idempotent: ยิงซ้ำได้ เพราะรวมจาก payload ของรอบนั้น ไม่ได้บวกทับค่าเดิมใน DB)
     */
    const MAX_SLEEP_MIN = 16 * 60; // กันข้อมูลเสีย/ซ้อนกันจนได้ตัวเลขเป็นไปไม่ได้
    const nights = new Map<
      string,
      { date: Date; minutes: number; quality: number | null; stages: any; sourceId: string | null }
    >();
    for (const s of body.sleeps || []) {
      const date = bkkDateKey(new Date(s.date));
      const key = date.toISOString();
      const prev = nights.get(key);
      const minutes = Number(s.minutesAsleep) || 0;
      if (!prev) {
        nights.set(key, {
          date,
          minutes,
          quality: s.quality ?? null,
          stages: s.stages ?? null,
          sourceId: s.sourceId ?? null,
        });
        continue;
      }
      prev.minutes += minutes;
      // คุณภาพ/stages: ถ้าแอปส่งมาแบบรวมทั้งคืนแล้ว (รุ่นใหม่) จะมีรายการเดียวอยู่แล้ว
      // เคสหลายรายการ = รุ่นเก่าที่ส่งเป็นช่วงย่อย ซึ่งไม่มี stages มาด้วย
      if (prev.quality === null && s.quality != null) prev.quality = s.quality;
      if (!prev.stages && s.stages) prev.stages = s.stages;
    }

    for (const n of nights.values()) {
      const minutesAsleep = Math.min(MAX_SLEEP_MIN, Math.round(n.minutes));
      await prisma.sleepLog.upsert({
        where: { memberId_date_source: { memberId: member.id, date: n.date, source } },
        update: { minutesAsleep, quality: n.quality, stages: n.stages ?? undefined, sourceId: n.sourceId },
        create: {
          memberId: member.id, date: n.date, minutesAsleep,
          quality: n.quality, stages: n.stages ?? undefined, source, sourceId: n.sourceId,
        },
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
          // เป้าวง Move ที่ user ตั้งไว้บนนาฬิกา — ใช้เป็นเป้าแหวน "เผาผลาญ" ในแอป
          // ส่งมาเฉพาะตอนมีค่า: sync รอบที่ไม่ได้แนบ moveGoal มาต้องไม่ล้างเป้าเดิมทิ้ง
          ...(validMoveGoal(m.moveGoal) !== null ? { moveGoal: validMoveGoal(m.moveGoal) } : {}),
        },
        create: {
          memberId: member.id, date, steps: m.steps ?? null, restingHR: m.restingHR ?? null,
          activeKcal: m.activeKcal ?? null, standHours: m.standHours ?? null, exerciseMin: m.exerciseMin ?? null,
          moveGoal: validMoveGoal(m.moveGoal), source,
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
