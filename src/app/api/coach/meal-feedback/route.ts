import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

/**
 * เสียงจากลูกค้าหลังทานมื้อหนึ่ง — taste 1-3 · portion 1-3 · note สั้น ๆ
 * ต้องมีอย่างน้อย 1 อย่าง (ข้ามทั้งหมด = ไม่ต้องยิงมา) · ครัวอ่านจากการ์ดลูกค้าในหลังบ้าน
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* ตกไปเช็คด้านล่าง */ }

  const clamp = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 3 ? Math.round(n) : null;
  };
  const taste = clamp(b.taste);
  const portion = clamp(b.portion);
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  const foodName = typeof b.foodName === "string" ? b.foodName.trim().slice(0, 120) : "";

  if (!foodName) return NextResponse.json({ error: "foodName required" }, { status: 400 });
  if (taste == null && portion == null && !note) {
    return NextResponse.json({ error: "ต้องมีคำตอบอย่างน้อย 1 ข้อ" }, { status: 400 });
  }

  // วัน BKK (UTC midnight ของวันนั้น -7) — กติกาเดียวกับ DailyPlan
  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  const date = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));

  const row = await prisma.mealFeedback.create({
    data: {
      memberId: member.id,
      foodId: typeof b.foodId === "string" && b.foodId ? b.foodId : null,
      foodName,
      slot: typeof b.slot === "string" && b.slot ? b.slot.slice(0, 20) : null,
      date,
      taste,
      portion,
      note: note || null,
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
