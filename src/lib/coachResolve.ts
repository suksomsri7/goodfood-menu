/**
 * resolve member จาก request — รองรับทั้ง Coach native (JWT) และ LIFF เดิม (lineUserId ใน body)
 * + gate isAiCoachActive จุดเดียว
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { isAiCoachActive } from "@/lib/coaching";

export async function resolveMember(req: NextRequest, bodyLineUserId?: string) {
  const authed = await getAuthedMember(req);
  if (authed) return authed;
  if (bodyLineUserId) {
    return prisma.member.findUnique({ where: { lineUserId: bodyLineUserId }, include: { memberType: true } });
  }
  return null;
}

export function coachActive(member: { memberType: any; aiCoachExpireDate: Date | null } | null): boolean {
  if (!member) return false;
  return isAiCoachActive(member as any);
}
