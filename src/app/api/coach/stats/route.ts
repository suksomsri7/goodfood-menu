import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { computeStats } from "@/lib/gamification";

// GET → { streak, badges, weeklyReview }  (สำหรับหน้า gamification / weekly review card)
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const stats = await computeStats(member);
  return NextResponse.json(stats);
}
