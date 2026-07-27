import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

/**
 * ลบรายการจาก timeline (ปัดซ้ายลบ) — ownership check เสมอ
 * POST { type: "meal"|"exercise"|"water", id } (Bearer) → { ok }
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { type, id } = await req.json();
    if (!id || !["meal", "exercise", "water"].includes(type)) {
      return NextResponse.json({ error: "type meal|exercise|water + id required" }, { status: 400 });
    }
    let count = 0;
    if (type === "meal") count = (await prisma.mealLog.deleteMany({ where: { id, memberId: member.id } })).count;
    else if (type === "exercise") count = (await prisma.exerciseLog.deleteMany({ where: { id, memberId: member.id } })).count;
    else count = (await prisma.waterLog.deleteMany({ where: { id, memberId: member.id } })).count;

    if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[delete-entry]", e);
    return NextResponse.json({ error: e.message || "delete failed" }, { status: 500 });
  }
}
