import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { suggestWeeks, validateGoal, GOAL_LABEL_TH } from "@/lib/bodyGoal";
import {
  buildBodyBundle,
  currentSnapshot,
  toCurrentNumbers,
} from "@/lib/bodyGoalStore";
import { gatherSignalInput } from "@/lib/bodySignalsStore";

export const dynamic = "force-dynamic";

/**
 * เป้าหมายรูปร่าง (WO-BP-3 §B4)
 *
 * POST — ตั้งเป้าใหม่ (มี active ได้ทีละอันเดียว: ของเดิมถูกปิดเป็น cancelled)
 * GET  — ก้อนเดียวจบทั้งจอ: เป้า + ความคืบหน้า + Body Score + สัญญาณ + หมุด + รายงานล่าสุด
 *
 * 🔴 เลขทุกตัวที่ตอบกลับต้องอธิบายที่มาได้ (start/expectedByNow/explain ของคะแนน)
 *    จอห้ามคิดเทรนด์หรือคะแนนเอง — ที่นี่คือแหล่งเดียว
 */

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** ชื่ออัลบั้มเริ่มต้นเมื่อ user ไม่ตั้งเอง — ต้องอ่านรู้เรื่องในรายการ transformation */
function defaultLabel(now: Date): string {
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `เป้าหมายรูปร่าง ${months[bkk.getUTCMonth()]} ${bkk.getUTCFullYear() + 543}`;
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const input = {
      targetWeightKg: num(body?.targetWeightKg),
      targetWaistCm: num(body?.targetWaistCm),
      targetBfLo: num(body?.targetBfLo),
      targetBfHi: num(body?.targetBfHi),
      targetWeeks: num(body?.targetWeeks),
    };

    const snapshot = await currentSnapshot(member.id);
    const current = toCurrentNumbers(snapshot);
    const verdict = validateGoal(input, current);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reasons[0], reasons: verdict.reasons }, { status: 400 });
    }

    const saved = verdict.fixed ?? input;
    const suggestion = suggestWeeks(current, {
      weightKg: saved.targetWeightKg,
      waistCm: saved.targetWaistCm,
      bfMid:
        saved.targetBfLo != null && saved.targetBfHi != null
          ? (saved.targetBfLo + saved.targetBfHi) / 2
          : (saved.targetBfLo ?? saved.targetBfHi ?? null),
    });

    const now = new Date();
    const label = String(body?.label ?? "").trim().slice(0, 60) || defaultLabel(now);

    /* เป้า active ได้ทีละอัน — ของเดิมปิดเป็น cancelled ไม่ใช่ลบทิ้ง
       (อัลบั้ม transformation เก่ายังต้องเปิดดูได้ และประวัติการเปลี่ยนใจก็เป็นข้อมูลของลูกค้า) */
    const goal = await prisma.$transaction(async (tx) => {
      await tx.bodyGoal.updateMany({
        where: { memberId: member.id, status: "active" },
        data: { status: "cancelled" },
      });
      return tx.bodyGoal.create({
        data: {
          memberId: member.id,
          label,
          targetWeightKg: saved.targetWeightKg,
          targetWaistCm: saved.targetWaistCm,
          targetBfLo: saved.targetBfLo,
          targetBfHi: saved.targetBfHi,
          targetWeeks: saved.targetWeeks,
          // จุดตั้งต้นของอัลบั้ม = สแกนล่าสุด ณ ตอนตั้งเป้า (ค่าตัวเลขคิดย้อนตอนอ่าน — ดู resolveGoalStart)
          startScanId: snapshot.latestScanId,
          startedAt: now,
          status: "active",
        },
      });
    });

    const res = NextResponse.json({
      goal,
      suggested: suggestion,
      reasons: verdict.reasons,
      flags: verdict.flags,
      adjusted: !!verdict.fixed,
      current,
      /** เป้าไหนคิดเวลาไม่ได้เพราะยังไม่มีค่าปัจจุบัน — จอควรชวนให้ชั่ง/สแกนก่อน */
      missingCurrent: (["weight", "waist", "bf"] as const)
        .filter(
          (k) =>
            (k === "weight" && saved.targetWeightKg != null && current.weightKg == null) ||
            (k === "waist" && saved.targetWaistCm != null && current.waistCm == null) ||
            (k === "bf" && (saved.targetBfLo != null || saved.targetBfHi != null) && current.bfMid == null)
        )
        .map((k) => ({ key: k, label: GOAL_LABEL_TH[k] })),
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-goal] POST", e);
    return NextResponse.json({ error: "ตั้งเป้าไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [bundle, signalCtx, report] = await Promise.all([
      buildBodyBundle(member.id),
      gatherSignalInput(member.id).catch((e) => {
        console.error("[coach/body-goal] signals ล้ม — ตอบก้อนอื่นต่อ:", e);
        return null;
      }),
      prisma.bodyReport.findFirst({
        where: { memberId: member.id },
        orderBy: { periodEnd: "desc" },
        select: { id: true, periodStart: true, periodEnd: true, narrative: true, stats: true, createdAt: true },
      }),
    ]);

    const res = NextResponse.json({
      goal: bundle.goal,
      progress: bundle.goal?.progress ?? null,
      milestones: bundle.goal?.milestones ?? [],
      score: bundle.score,
      signals: signalCtx?.signals ?? [],
      /** ค่าที่ระบบใช้ตัดสินสัญญาณ — เปิดให้ตรวจได้ ไม่ใช่กล่องดำ */
      signalInput: signalCtx?.input ?? null,
      snapshot: {
        weightKg: bundle.snapshot.weightKg,
        waist: bundle.snapshot.waist,
        bfPct: bundle.snapshot.bfPct,
        tapeWaistCm: bundle.snapshot.tapeWaistCm,
        latestScanDate: bundle.snapshot.latestScanDate,
      },
      latestReport: report,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-goal] GET", e);
    return NextResponse.json({ error: "ดึงเป้าหมายไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}
