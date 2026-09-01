import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { isDeferred, type OverrideAction } from "@/lib/ptOverride";

export const dynamic = "force-dynamic";

const ACTIONS: ReadonlySet<string> = new Set([
  "set_weight", "reset_stall", "force_deload", "clear_calibration", "note",
]);
/** เพดานกันพิมพ์หลุด — 500 กก. ไม่ใช่น้ำหนักที่มนุษย์ยกในโปรแกรมนี้ */
const MAX_KG = 500;

/**
 * POST /api/backoffice/pt/:memberId/override — โค้ชมนุษย์สั่งข้าม engine
 *
 * 🔴 คำสั่ง 2 จำพวก ต้องบอกแอดมินให้ตรงว่าอันไหนมีผลเมื่อไร:
 *    · set_weight / force_deload = มีผล "แผนรอบถัดไป" (ไปรอที่ pendingOverrides)
 *    · reset_stall / clear_calibration = มีผลทันที
 *    ถ้าตอบว่า "บันทึกแล้ว" เฉย ๆ แอดมินจะไปบอกลูกค้าว่าวันนี้เปลี่ยนแล้ว ซึ่งไม่จริง
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ memberId: string }> }) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { memberId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "") as OverrideAction;
  const exerciseKey = body.exerciseKey ? String(body.exerciseKey) : null;
  const note = body.note ? String(body.note).slice(0, 500) : null;

  if (!ACTIONS.has(action)) return NextResponse.json({ error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "ไม่พบลูกค้ารายนี้" }, { status: 404 });

  let before: Record<string, unknown> | null = null;
  let after: Record<string, unknown> | null = null;
  const now = new Date();

  try {
    if (action === "set_weight") {
      if (!exerciseKey) return NextResponse.json({ error: "ต้องเลือกท่าก่อน" }, { status: 400 });
      const kg = Number(body.weightKg);
      if (!Number.isFinite(kg) || kg <= 0 || kg > MAX_KG) {
        return NextResponse.json({ error: `น้ำหนักต้องอยู่ระหว่าง 0-${MAX_KG} กก.` }, { status: 400 });
      }
      const st = await prisma.progressionState.findUnique({
        where: { memberId_exerciseKey: { memberId, exerciseKey } },
        select: { lastWeightKg: true },
      });
      before = { lastWeightKg: st?.lastWeightKg ?? null };
      after = { weightKg: Math.round(kg * 100) / 100 };
    } else if (action === "reset_stall") {
      if (!exerciseKey) return NextResponse.json({ error: "ต้องเลือกท่าก่อน" }, { status: 400 });
      const st = await prisma.progressionState.findUnique({
        where: { memberId_exerciseKey: { memberId, exerciseKey } },
        select: { stallCount: true, successStreak: true },
      });
      if (!st) return NextResponse.json({ error: "ท่านี้ยังไม่มีสถานะ progression" }, { status: 404 });
      before = { stallCount: st.stallCount, successStreak: st.successStreak };
      await prisma.progressionState.update({
        where: { memberId_exerciseKey: { memberId, exerciseKey } },
        data: { stallCount: 0 },
      });
      after = { stallCount: 0 };
    } else if (action === "clear_calibration") {
      const p = await prisma.trainingProfile.findUnique({ where: { memberId }, select: { calibration: true } });
      if (!p) return NextResponse.json({ error: "ลูกค้ายังไม่มีโปรไฟล์การเทรน" }, { status: 404 });
      before = { calibration: p.calibration };
      await prisma.trainingProfile.update({ where: { memberId }, data: { calibration: false } });
      after = { calibration: false };
    } else if (action === "force_deload") {
      after = { forceDeload: true };
    } else {
      // note — ไม่แตะค่าอะไร แค่บันทึกไว้ในประวัติให้กะถัดไปอ่าน
      if (!note) return NextResponse.json({ error: "โน้ตว่างไม่ได้" }, { status: 400 });
    }

    const row = await prisma.ptOverride.create({
      data: {
        memberId, exerciseKey, action, note,
        before: before as object | undefined,
        after: after as object | undefined,
        // คำสั่งที่มีผลทันที = ปั๊มว่าใช้แล้วตั้งแต่ตอนสร้าง (ไม่ให้ไปค้างในคิวใบสั่ง)
        consumedAt: isDeferred(action) ? null : now,
        staffId: staff.sub,
        staffEmail: staff.email,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      deferred: isDeferred(action),
      message: isDeferred(action)
        ? "บันทึกคำสั่งแล้ว — จะมีผลกับแผนรอบถัดไปที่ระบบสร้างให้"
        : "มีผลทันทีแล้ว",
    });
  } catch (e) {
    console.error("pt override error:", e);
    return NextResponse.json({ error: "สั่งไม่สำเร็จ" }, { status: 500 });
  }
}
