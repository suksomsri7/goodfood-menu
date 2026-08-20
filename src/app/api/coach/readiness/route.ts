import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { autoParts, bkkDayKey } from "@/lib/readinessStore";
import { computeReadiness, suggestionFor, type ReadinessBand } from "@/lib/readiness";

export const dynamic = "force-dynamic";

/**
 * Check-in ความพร้อมประจำวัน (เฟส C · ENGINE §4.1)
 *
 * GET  /api/coach/readiness?_ts=  → ของวันนี้
 *   - เช็คอินแล้ว  : คืนคะแนน/band/คำแนะนำเดิม (ไม่คิดใหม่ — ตัวเลขที่ user เห็นตอนเช้าต้องไม่เปลี่ยนเองตอนบ่าย)
 *   - ยังไม่เช็คอิน: คืนแค่ "มี/ไม่มี" ข้อมูลจาก Watch + needsAnswers
 *     🔴 ห้ามคิดคะแนนให้ก่อน user ตอบ — คะแนนที่ยังไม่รวมความรู้สึกของเขาคือคะแนนที่ผิด
 * POST /api/coach/readiness { energy?, soreness?, soreAreas?[] }
 *   → upsert ของวันนี้ + คิดคะแนน + คำแนะนำไทย 1 ประโยค (ยังไม่แตะแผน — ผู้ใช้กดยืนยันที่ /apply เอง)
 */

const MAX_SORE_AREAS = 8;

/** 1-5 เท่านั้น · ไม่ส่งมา = ไม่ตอบ (ไม่ใช่ 0) */
function parseScale(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw == null) return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 5) return { ok: false };
  return { ok: true, value: Math.round(n) };
}

function parseSoreAreas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((a) => String(a ?? "").trim().slice(0, 30))
        .filter(Boolean)
    ),
  ].slice(0, MAX_SORE_AREAS);
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const dayKey = bkkDayKey(new Date());
    const [existing, auto] = await Promise.all([
      prisma.readinessCheckin.findUnique({
        where: { memberId_date: { memberId: member.id, date: dayKey } },
      }),
      autoParts(member.id, dayKey),
    ]);

    const autoView = {
      hrv: { available: auto.availability.hrv, value: auto.snapshot.hrvMs },
      rhr: { available: auto.availability.rhr, value: auto.snapshot.rhr },
      sleep: { available: auto.availability.sleep, minutes: auto.snapshot.sleepMin },
    };

    const body = existing
      ? {
          needsAnswers: false,
          date: dayStr(dayKey),
          checkin: {
            energy: existing.energy,
            soreness: existing.soreness,
            soreAreas: existing.soreAreas,
            score: existing.score,
            band: existing.band,
            applied: existing.applied,
            appliedAt: existing.appliedAt,
            canUndo: existing.applied && existing.planBackup != null,
          },
          suggestion: suggestionFor(existing.score, (existing.band as ReadinessBand) ?? "normal"),
          auto: autoView,
        }
      : { needsAnswers: true, date: dayStr(dayKey), checkin: null, auto: autoView };

    const res = NextResponse.json(body);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/readiness] GET", e);
    return NextResponse.json({ error: "ดึงข้อมูลความพร้อมไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const energy = parseScale(body?.energy);
    const soreness = parseScale(body?.soreness);
    if (!energy.ok || !soreness.ok) {
      return NextResponse.json({ error: "ค่าที่ส่งมาต้องอยู่ระหว่าง 1-5 — ลองเลือกใหม่อีกครั้งนะ" }, { status: 400 });
    }
    const soreAreas = parseSoreAreas(body?.soreAreas);

    const dayKey = bkkDayKey(new Date());
    const auto = await autoParts(member.id, dayKey);
    const result = computeReadiness({
      hrv: auto.hrv,
      rhr: auto.rhr,
      sleep: auto.sleep,
      energy: energy.value,
      soreness: soreness.value,
    });

    /* เก็บ snapshot ของ Watch ไว้ด้วย — DailyMetric ถูกเขียนทับได้ทั้งวัน
       ถ้าไม่เก็บ พรุ่งนี้เราจะอธิบายไม่ได้ว่าคะแนนเมื่อวานมาจากตัวเลขอะไร
       🔴 ไม่แตะ applied/planBackup: ตอบใหม่ระหว่างวันไม่ควรทำให้ปุ่ม "ย้อนกลับ" ของแผนที่ปรับไปแล้วใช้ไม่ได้ */
    const data = {
      energy: energy.value,
      soreness: soreness.value,
      soreAreas,
      hrvMs: auto.snapshot.hrvMs,
      rhr: auto.snapshot.rhr,
      sleepMin: auto.snapshot.sleepMin,
      score: result.score,
      band: result.band,
    };
    const checkin = await prisma.readinessCheckin.upsert({
      where: { memberId_date: { memberId: member.id, date: dayKey } },
      create: { memberId: member.id, date: dayKey, ...data },
      update: data,
    });

    const res = NextResponse.json({
      ok: true,
      date: dayStr(dayKey),
      score: result.score,
      band: result.band,
      suggestion: suggestionFor(result.score, result.band),
      parts: result.parts,
      missing: result.missing,
      /** true = band นี้มีอะไรให้ปรับในแผนวันนี้ (จอค่อยขึ้นปุ่ม "ปรับแผนให้เบาลง") */
      canAdjust: result.band === "reduced" || result.band === "recovery",
      applied: checkin.applied,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/readiness] POST", e);
    return NextResponse.json({ error: "บันทึกความพร้อมไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
