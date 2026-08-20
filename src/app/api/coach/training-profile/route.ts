import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import {
  buildTrainingContextSafe,
  getTrainingProfile,
  listInjuries,
  saveTrainingProfile,
  summarizeTrainingProfileOnce,
} from "@/lib/trainingProfileStore";
import {
  intensityCap,
  isCalibrationWeek,
  normalizeProfileInput,
  PARQ_ADVISORY_TH,
  repRangeFor,
} from "@/lib/trainingProfile";

export const dynamic = "force-dynamic";

/**
 * โปรไฟล์การเทรน (WO-PT-D §S3)
 *
 * GET → { profile, injuries, calibration, intensityCap, repRange }
 * PUT { primaryGoal, style?, daysPerWeek, sessionMin, trainDays[], likes[], dislikes[], parq{q1,q2,q3}, ... }
 *
 * ทำไม repRange ถึงคืนออกไปด้วย: จอ "โปรไฟล์การเทรน" ต้องบอกได้ว่าเลือกสไตล์นี้แล้วจะถูกสั่งกี่ครั้งต่อเซ็ต
 * (ไม่งั้น user เปลี่ยน style แล้วไม่เห็นว่าอะไรเปลี่ยน จนกว่าจะถึงสัปดาห์หน้า)
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const profile = await getTrainingProfile(member.id, now);
    const injuries = await listInjuries(member.id, { activeOnly: true }, now);

    const res = NextResponse.json({
      profile,
      injuries,
      calibration: isCalibrationWeek(profile, now),
      intensityCap: intensityCap(profile),
      repRange: repRangeFor(profile?.style ?? null, profile?.primaryGoal ?? null),
      ...(profile && intensityCap(profile) === "low" ? { advisory: PARQ_ADVISORY_TH } : {}),
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/training-profile] GET", e);
    return NextResponse.json({ error: "ดึงโปรไฟล์การเทรนไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = normalizeProfileInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const now = new Date();
    const profile = await saveTrainingProfile(member.id, parsed.value, now);

    // สรุป "คนนี้เป็นใคร" ครั้งเดียวหลังตั้งโปรไฟล์ — ล้ม/ไม่มีคีย์ = ข้ามเงียบ ๆ (บันทึกสำเร็จไปแล้ว)
    const context = await buildTrainingContextSafe(member.id, now);
    await summarizeTrainingProfileOnce(member.id, context);

    const cap = intensityCap(profile);
    const res = NextResponse.json({
      ok: true,
      profile,
      calibration: isCalibrationWeek(profile, now),
      intensityCap: cap,
      repRange: repRangeFor(profile.style ?? null, profile.primaryGoal),
      // PAR-Q ตอบ "ใช่" → คำแนะนำโทนอ่อน (ไม่ใช่ error ไม่ใช่คำเตือน ไม่ใช่การวินิจฉัย)
      ...(cap === "low" ? { advisory: PARQ_ADVISORY_TH } : {}),
      message: "บันทึกโปรไฟล์การเทรนแล้วครับ แผนสัปดาห์ถัดไปจะจัดตามนี้ให้",
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/training-profile] PUT", e);
    return NextResponse.json({ error: "บันทึกโปรไฟล์การเทรนไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}
