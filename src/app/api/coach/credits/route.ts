import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { getCreditSnapshot } from "@/lib/usage-limits";

export const dynamic = "force-dynamic";

/**
 * ยอดเครดิต AI คงเหลือของวันนี้ (แอปเอาไปโชว์บนหัวจอ/หน้าตั้งค่า)
 * GET → { limit, used, remaining, costs, typeName, typeColor, resetAt }
 * resetAt = เที่ยงคืนไทยถัดไป (ISO) — วันหมุนตามเวลาไทยเสมอ ไม่ใช่ UTC
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const snapshot = await getCreditSnapshot(member);
  const res = NextResponse.json(snapshot);
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
