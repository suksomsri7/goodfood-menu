import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { adjustTodayWorkout, undoTodayAdjust, type AdjustMode } from "@/lib/workoutAdjustStore";

export const dynamic = "force-dynamic";

/**
 * PT-E · ปรับแผนของ "วันนี้" ตามสถานการณ์จริงที่เพิ่งเกิด (WO-PT-ENGINE §4.4)
 *
 * POST   { mode:"time", minutes:20, apply?:boolean }        → ย่อแผนให้ลงเวลาที่เหลือ
 * POST   { mode:"sore", area:"เข่า", apply?:boolean }        → เลี่ยงท่าที่ลงจุดที่ปวด
 * DELETE                                                     → คืนแผนเดิมของวันนี้
 *
 * apply=false (ค่าเริ่มต้น) = คิดให้ดูเฉย ๆ ยังไม่บันทึก —
 * แผนที่เปลี่ยนเองโดยผู้ใช้ไม่ได้กดยืนยันคือสิ่งที่ทำให้คนเลิกเชื่อระบบ (กติกาเดียวกับ readiness/apply)
 */

const MODES: AdjustMode[] = ["time", "sore"];

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? "") as AdjustMode;
    if (!MODES.includes(mode)) {
      return NextResponse.json({ error: "ไม่รู้จักวิธีปรับแผนแบบนี้" }, { status: 400 });
    }

    const out = await adjustTodayWorkout(
      member.id,
      member.equipment,
      { mode, minutes: body?.minutes, area: body?.area, apply: body?.apply === true },
      new Date()
    );
    if (!out.ok) return NextResponse.json({ error: out.message }, { status: out.status ?? 400 });

    const res = NextResponse.json(out);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/workout-adjust]", e);
    return NextResponse.json({ error: "ปรับแผนวันนี้ไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const out = await undoTodayAdjust(member.id, new Date());
    if (!out.ok) return NextResponse.json({ error: out.message }, { status: out.status ?? 400 });
    const res = NextResponse.json(out);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/workout-adjust:undo]", e);
    return NextResponse.json({ error: "ย้อนแผนวันนี้ไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
