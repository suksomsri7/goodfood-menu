import { NextRequest, NextResponse } from "next/server";
// access token เท่านั้น — นาฬิกาไม่เรียกเส้นนี้ (เรียกแค่ initial-data/plan/plan[id]/execute/agent)
import { getAuthedMemberAccessOnly as getAuthedMember } from "@/lib/coachAuth";
import { getMemories, deactivateMemory } from "@/lib/coachMemory";
import { prisma } from "@/lib/prisma";

// GET → { memories, insights }  (สิ่งที่โค้ชจำ + insight รายสัปดาห์)
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [memories, insights] = await Promise.all([
    getMemories(member.id, 100),
    prisma.behaviorInsight.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return NextResponse.json({ memories, insights });
}

// DELETE ?id=... → user ลบสิ่งที่โค้ชจำ (privacy)
export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deactivateMemory(member.id, id);
  return NextResponse.json({ ok: true });
}
