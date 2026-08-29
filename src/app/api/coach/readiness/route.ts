import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { autoParts, bkkDayKey } from "@/lib/readinessStore";
import { computeReadiness, readinessReasons, suggestionFor, DEFAULT_SLEEP_GOAL_MIN, type ReadinessBand, recurringSoreAdvice } from "@/lib/readiness";

export const dynamic = "force-dynamic";

/**
 * Check-in ความพร้อมประจำวัน (เฟส C · ENGINE §4.1)
 *
 * GET  /api/coach/readiness?_ts=  → ของวันนี้
 *   - เช็คอินแล้ว  : คืนคะแนน/band/คำแนะนำเดิม (ไม่คิดใหม่ — ตัวเลขที่ user เห็นตอนเช้าต้องไม่เปลี่ยนเองตอนบ่าย)
 *     + parts ประกอบใหม่จาก snapshot ที่เก็บไว้ (เปิดชีตซ้ำแล้วแท่งรายส่วนต้องไม่หาย)
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
      /* base = ค่าปกติ 28 วันของคนนี้เอง — จอใช้โชว์ "58 · ปกติ 59" (ตัวเลขเดี่ยว ๆ อ่านไม่ออกว่าดีหรือแย่) */
      rhr: {
        available: auto.availability.rhr,
        value: auto.snapshot.rhr,
        base: auto.rhr ? Math.round(auto.rhr.base28dAvg) : null,
      },
      sleep: { available: auto.availability.sleep, minutes: auto.snapshot.sleepMin },
    };

    /* แท่งรายส่วนตอนเปิดชีตซ้ำ: ประกอบใหม่จาก snapshot ที่เก็บตอนเช็คอิน + baseline ปัจจุบัน
       score/band ยังใช้ค่าที่เก็บไว้เสมอ (parts ใช้แค่วาดแท่ง — baseline ขยับระหว่างวันได้เล็กน้อย)
       ส่วนไหน snapshot ไม่มีหรือ baseline หายไปแล้ว = ไม่มี key → จอไม่วาดแท่งนั้น (ห้ามเติมเลขเอง) */
    const reconParts = existing
      ? computeReadiness({
          hrv: existing.hrvMs != null && auto.hrv ? { ...auto.hrv, today7dAvg: existing.hrvMs } : undefined,
          rhr: existing.rhr != null && auto.rhr ? { ...auto.rhr, today: existing.rhr } : undefined,
          sleep: existing.sleepMin != null ? { minutes: existing.sleepMin, goalMinutes: DEFAULT_SLEEP_GOAL_MIN } : undefined,
          energy: existing.energy,
          soreness: existing.soreness,
        }).parts
      : null;

    /* อาการที่บ่นซ้ำที่เดิม — ดู 7 วันหลังสุด (ไม่รวมวันนี้ก็ได้ ให้เห็นแนวโน้มจริง) */
    const recent = await prisma.readinessCheckin.findMany({
      where: { memberId: member.id, date: { gte: new Date(dayKey.getTime() - 7 * 86400000) } },
      select: { soreAreas: true },
      orderBy: { date: "desc" },
      take: 7,
    });
    const soreAdvice = recurringSoreAdvice(recent);

    /* 🔴 ปิดลูป: สิ่งที่ user บอกไว้ "หลังเล่นครั้งก่อน" ต้องถูกหยิบมาใช้ ไม่ใช่เก็บไว้เฉย ๆ
       feel มีอยู่แล้วและ engine progression ใช้ตั้งน้ำหนัก — แต่จอความพร้อมไม่เคยพูดถึงเลย
       พอโค้ชพูดว่า "ครั้งก่อนคุณบอกว่าหนักเกิน" user จะรู้สึกว่าโค้ชจำได้จริง (ไม่ใช่แค่คำนวณ) */
    const lastSets = await prisma.setLog.findMany({
      where: { memberId: member.id, feel: { not: null }, date: { gte: new Date(dayKey.getTime() - 3 * 86400000) } },
      select: { feel: true },
      orderBy: { date: "desc" },
      take: 12,
    });
    const hardCount = lastSets.filter((x) => x.feel === "too_hard" || x.feel === "hard").length;
    const easyCount = lastSets.filter((x) => x.feel === "too_easy" || x.feel === "easy").length;
    const lastFeelNote =
      lastSets.length >= 3 && hardCount >= Math.ceil(lastSets.length / 2)
        ? "ครั้งก่อนคุณบอกว่าหนักไป — วันนี้โค้ชเลยไม่ดันเพิ่ม"
        : lastSets.length >= 3 && easyCount >= Math.ceil(lastSets.length / 2)
        ? "ครั้งก่อนคุณบอกว่าเบาไป — ถ้าวันนี้ไหว โค้ชขยับขึ้นให้ได้"
        : null;

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
            parts: reconParts,
            applied: existing.applied,
            appliedAt: existing.appliedAt,
            canUndo: existing.applied && existing.planBackup != null,
          },
          suggestion: suggestionFor(existing.score, (existing.band as ReadinessBand) ?? "normal"),
          /** เหตุผลภาษาคน — จอเอาไปโชว์แทนคะแนนดิบ (เจ้าของทัก 28 ส.ค. 69 ว่า "37/100" ไม่สื่ออะไร) */
          reasons: reconParts
            ? readinessReasons(reconParts, {
                sleepMinutes: existing.sleepMin,
                soreAreas: existing.soreAreas,
                energy: existing.energy,
              })
            : [],
          /** อาการที่บ่นซ้ำที่เดิม — โค้ชควรทัก ไม่ใช่ลดเซ็ตไปเรื่อย ๆ */
          soreAdvice: soreAdvice?.text ?? null,
          /** สิ่งที่ user บอกหลังเล่นครั้งก่อน — โชว์ให้เห็นว่าระบบจำและเอาไปใช้จริง */
          lastFeelNote,
          auto: autoView,
        }
      : { needsAnswers: true, date: dayStr(dayKey), checkin: null, soreAdvice: soreAdvice?.text ?? null, lastFeelNote, auto: autoView };

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
      reasons: readinessReasons(result.parts, {
        sleepMinutes: checkin.sleepMin,
        soreAreas: checkin.soreAreas,
        energy: checkin.energy,
      }),
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
