import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { bkkDayKey, buildPatternOf } from "@/lib/readinessStore";
import { adjustPlanForReadiness, type ReadinessBand, type ReadinessPlanItem } from "@/lib/readiness";

export const dynamic = "force-dynamic";

/**
 * POST /api/coach/readiness/apply — เอาคะแนนของวันนี้ไปปรับแผนวันนี้จริง ๆ
 *
 * แยกจาก POST /api/coach/readiness เพราะ "รู้คะแนน" กับ "ยอมให้ระบบตัดแผน" เป็นคนละการตัดสินใจ
 * user ต้องเห็นคะแนนก่อนแล้วกดเอง — แผนที่หายไปเองโดยไม่ได้สั่งคือสิ่งที่ทำให้คนเลิกเชื่อระบบ
 *
 * 🔴 ทำได้ครั้งเดียวต่อวัน (applied=true แล้วยิงซ้ำ = ไม่ตัดซ้ำ) — ไม่งั้นกดสองทีเซ็ตหายครึ่งวัน
 * 🔴 เก็บ planBackup = exercisePlan ทั้งก้อนก่อนแตะ → undo คืนของเดิมได้เป๊ะ ไม่ต้องคิดย้อนกลับ
 */

interface ExercisePlanJson {
  title?: string;
  durationMin?: number;
  items?: ReadinessPlanItem[];
  caloriesTarget?: number;
  readinessNote?: string;
  [k: string]: unknown;
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const dayKey = bkkDayKey(new Date());
    const checkin = await prisma.readinessCheckin.findUnique({
      where: { memberId_date: { memberId: member.id, date: dayKey } },
    });
    if (!checkin) {
      return NextResponse.json(
        { error: "ยังไม่ได้เช็คอินความพร้อมของวันนี้ — ตอบคำถามสั้น ๆ ก่อนแล้วเราจะปรับแผนให้" },
        { status: 400 }
      );
    }

    const band = (checkin.band ?? "normal") as ReadinessBand;
    if (band !== "reduced" && band !== "recovery") {
      const res = NextResponse.json({
        ok: true,
        applied: false,
        band,
        message: "วันนี้ความพร้อมอยู่ในเกณฑ์ดี — เดินตามแผนเดิมได้เลย ไม่ต้องปรับ",
      });
      res.headers.set("Cache-Control", "no-store, must-revalidate");
      return res;
    }

    /* 🔴 28 ส.ค. 69: ของเดิมล็อก "ปรับได้วันละครั้ง" แบบไม่ดูว่าคำตอบเปลี่ยนไปหรือยัง
       เจ้าของตอบใหม่ (แย่ลง) → ป้ายเปลี่ยนเป็น "วันพักฟื้น" แต่แผนยังเป็นของรอบก่อน = ขัดกันคาหนังคาเขา
       กติกาใหม่: ปรับซ้ำได้เมื่อ "ช่วงความพร้อมเปลี่ยน" เท่านั้น — กดปุ่มรัว ๆ ด้วยคำตอบเดิมยังไม่ตัดซ้ำ
       และต้องคืนแผนต้นฉบับก่อนเสมอ ไม่งั้นตัดซ้อนตัด (เซ็ตหายเป็นทวีคูณ) */
    const sameBandAlready = checkin.applied && checkin.appliedBand === band;
    if (sameBandAlready) {
      const res = NextResponse.json({
        ok: true,
        applied: true,
        alreadyApplied: true,
        band,
        message: "ปรับแผนของวันนี้ให้แล้ว — ถ้าอยากกลับไปแผนเดิม กด 'ย้อนกลับ' ได้",
      });
      res.headers.set("Cache-Control", "no-store, must-revalidate");
      return res;
    }

    const plan = await prisma.dailyPlan.findUnique({
      where: { memberId_date: { memberId: member.id, date: dayKey } },
    });
    if (!plan) {
      return NextResponse.json({ error: "วันนี้ยังไม่มีแผนออกกำลังกายให้ปรับ" }, { status: 404 });
    }

    /* ปรับซ้ำ = ต้องคิดจาก "แผนต้นฉบับ" ที่สำรองไว้ ไม่ใช่แผนที่โดนตัดไปแล้วรอบก่อน */
    const backup = checkin.applied ? (checkin.planBackup as ExercisePlanJson | null) : null;
    const ep = backup ?? ((plan.exercisePlan as ExercisePlanJson | null) ?? {});
    const items = Array.isArray(ep.items) ? ep.items : [];
    const patternOf = await buildPatternOf(items);
    const adjusted = adjustPlanForReadiness(items, band, checkin.soreAreas, patternOf);

    if (!adjusted.changed) {
      const res = NextResponse.json({
        ok: true,
        applied: false,
        band,
        message: "แผนวันนี้เบาพออยู่แล้ว — ไม่มีอะไรต้องลดเพิ่ม",
      });
      res.headers.set("Cache-Control", "no-store, must-revalidate");
      return res;
    }

    // วันพักฟื้นเปลี่ยนท่าทั้งวัน → เวลารวมของวันต้องตรงกับท่าใหม่ (ไม่งั้นการ์ดหน้าหลักโชว์ 45 นาทีทั้งที่เหลือ 35)
    const nextEp: ExercisePlanJson = { ...ep, items: adjusted.items };
    if (adjusted.dayNote) nextEp.readinessNote = adjusted.dayNote;
    if (adjusted.replacedDay) {
      nextEp.durationMin = adjusted.items.reduce((n, it) => n + (Number(it.minutes) || 0), 0);
    }

    await prisma.$transaction([
      prisma.dailyPlan.update({
        where: { id: plan.id },
        data: { exercisePlan: nextEp as Prisma.InputJsonValue },
      }),
      prisma.readinessCheckin.update({
        where: { id: checkin.id },
        data: {
          applied: true,
          appliedAt: new Date(),
          appliedBand: band,
          // สำรองไว้ครั้งแรกครั้งเดียว — ปรับซ้ำต้องยังกลับไปหาแผน "ก่อนแตะ" ได้เสมอ
          ...(checkin.planBackup ? {} : { planBackup: (plan.exercisePlan ?? Prisma.JsonNull) as Prisma.InputJsonValue }),
        },
      }),
    ]);

    const res = NextResponse.json({
      ok: true,
      applied: true,
      band,
      cutSets: adjusted.cutSets,
      replacedDay: adjusted.replacedDay,
      dayNote: adjusted.dayNote ?? null,
      items: adjusted.items,
      message: adjusted.replacedDay
        ? "เปลี่ยนวันนี้เป็นวันพักฟื้นให้แล้ว — เดินเบา ๆ กับยืดเหยียด"
        : `ลดปริมาณให้แล้ว ${adjusted.cutSets} เซ็ต — ที่เหลือเล่นตามปกติได้`,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/readiness/apply]", e);
    return NextResponse.json({ error: "ปรับแผนตามความพร้อมไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
