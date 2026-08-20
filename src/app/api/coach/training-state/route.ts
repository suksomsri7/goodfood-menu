import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { computeNextForKeys, MAX_KEYS, type NextForKey } from "@/lib/progressionStore";

export const dynamic = "force-dynamic";

/**
 * "ครั้งก่อนทำเท่าไร" + "สัปดาห์หน้าทำเท่าไร" ต่อท่า
 * GET /api/coach/training-state?keys=squat_bw,pushup
 *   → { states: { squat_bw: { last: {...} | null, next: Rx | null } } }
 *
 * last = เซ็ตล่าสุดที่บันทึกไว้จริง (Workout Player ใช้ prefill ช่อง kg/ครั้ง)
 * next = ใบสั่งสัปดาห์หน้าจาก engine progression (จอสรุปจบเซสชัน + แผนสัปดาห์ถัดไปใช้ตัวเลขชุดเดียวกัน)
 *
 * 🔴 ไม่มีข้อมูล = null ทั้งคู่ ไม่ใช่เดาค่าให้ — ตัวเลขพวกนี้คือสิ่งที่ user จะยกจริง
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const keys = [
    ...new Set(
      (req.nextUrl.searchParams.get("keys") ?? "")
        .split(",")
        .map((k) => k.trim().slice(0, 60))
        .filter(Boolean)
    ),
  ].slice(0, MAX_KEYS);

  // engine ล่ม/ตารางยังไม่พร้อม ต้องไม่ทำให้ Player ที่รอค่า last ค้าง → next เป็น null ไปก่อน
  let nexts = new Map<string, NextForKey>();
  try {
    nexts = await computeNextForKeys(member.id, keys);
  } catch (e) {
    console.error("[coach/training-state] คิดใบสั่งสัปดาห์หน้าไม่สำเร็จ", e);
  }

  const states: Record<string, { last: Record<string, unknown> | null; next: unknown }> = {};
  for (const key of keys) {
    const row = await prisma.setLog.findFirst({
      where: { memberId: member.id, exerciseKey: key },
      orderBy: [{ date: "desc" }, { setNo: "desc" }],
    });
    states[key] = {
      last: row
        ? {
            actualWeightKg: row.actualWeightKg,
            actualReps: row.actualReps,
            actualSec: row.actualSec,
            feel: row.feel,
            rpe: row.rpe,
            setNo: row.setNo,
            date: row.date,
          }
        : null,
      next: nexts.get(key)?.next ?? null,
    };
  }

  const res = NextResponse.json({ states });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
