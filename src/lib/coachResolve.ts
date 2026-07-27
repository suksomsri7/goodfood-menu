/**
 * resolve member สำหรับ Coach native endpoints — **JWT only**
 * (F1 fix: ไม่รับ lineUserId ใน body อีกต่อไป กัน impersonation คนอื่นด้วยการเดา lineUserId)
 * endpoint LIFF เดิมมี logic lineUserId ของตัวเองแยก ไม่เกี่ยวกับตัวนี้
 */
import { NextRequest } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { isAiCoachActive } from "@/lib/coaching";

export async function resolveMember(req: NextRequest) {
  return getAuthedMember(req); // เช็ค isActive ให้แล้วในตัว
}

export function coachActive(member: { memberType: any; aiCoachExpireDate: Date | null } | null): boolean {
  if (!member) return false;
  return isAiCoachActive(member as any);
}
