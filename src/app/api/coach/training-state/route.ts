import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

/** ถามได้สูงสุดกี่ท่าต่อครั้ง — แผน 1 วันมีไม่เกิน ~10 ท่า เผื่อไว้พอ */
const MAX_KEYS = 30;

/**
 * "ครั้งก่อนทำเท่าไร" ต่อท่า — Workout Player ใช้ prefill ช่อง kg/ครั้ง
 * GET /api/coach/training-state?keys=squat_bw,pushup → { states: { squat_bw: { last: {...} | null } } }
 *
 * เฟส A ยังไม่มี ProgressionState (เฟส B) → คืนแค่เซ็ตล่าสุดที่บันทึกไว้จริง
 * 🔴 ไม่มีข้อมูล = last:null ไม่ใช่เดาค่าให้ — ตัวเลขที่ prefill คือสิ่งที่ user จะยกจริง
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

  const states: Record<string, { last: Record<string, unknown> | null }> = {};
  for (const key of keys) {
    const row = await prisma.setLog.findFirst({
      where: { memberId: member.id, exerciseKey: key },
      orderBy: [{ date: "desc" }, { setNo: "desc" }],
    });
    states[key] = row
      ? {
          last: {
            actualWeightKg: row.actualWeightKg,
            actualReps: row.actualReps,
            actualSec: row.actualSec,
            feel: row.feel,
            rpe: row.rpe,
            setNo: row.setNo,
            date: row.date,
          },
        }
      : { last: null };
  }

  const res = NextResponse.json({ states });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
