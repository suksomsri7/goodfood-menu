import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { createInjury, injuryAreaAlias, listInjuries } from "@/lib/trainingProfileStore";
import { normalizeInjuryInput } from "@/lib/trainingProfile";

export const dynamic = "force-dynamic";

/**
 * อาการบาดเจ็บ/ข้อจำกัดร่างกาย (WO-PT-D §S3)
 *
 * GET ?all=1 → ทั้งหมด (รวมที่ปิด/หมดอายุ สำหรับหน้าจัดการ) · ปกติ = เฉพาะที่ยังมีผล
 * POST { area, severity?, avoidPatterns?, avoidKeys?, note?, temporaryDays? }
 *   temporaryDays = "วันนี้ปวดเข่า" 7 วัน → เก็บ expiresAt ไว้ให้หมดอายุเอง
 *   🔴 ไม่ให้หมดอายุเอง = คนที่บอกครั้งเดียวจะโดนตัดท่าไปตลอดชีวิตโดยที่ไม่มีใครไปปิดให้
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const all = new URL(req.url).searchParams.get("all") === "1";
    const injuries = await listInjuries(member.id, { activeOnly: !all });
    const res = NextResponse.json({ injuries });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/injury] GET", e);
    return NextResponse.json({ error: "ดึงข้อมูลอาการบาดเจ็บไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = normalizeInjuryInput(body, injuryAreaAlias);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const injury = await createInjury(member.id, parsed.value);
    const res = NextResponse.json({
      ok: true,
      injury,
      message:
        parsed.value.severity === "avoid"
          ? "รับทราบครับ ระบบจะไม่จัดท่าที่เกี่ยวกับจุดนี้ให้จนกว่าคุณจะปิดรายการนี้"
          : "รับทราบครับ ช่วงนี้ระบบจะจัดท่าที่เกี่ยวกับจุดนี้ให้เบาลงก่อน",
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/injury] POST", e);
    return NextResponse.json({ error: "บันทึกอาการไม่สำเร็จ ลองอีกครั้งนะครับ" }, { status: 500 });
  }
}
