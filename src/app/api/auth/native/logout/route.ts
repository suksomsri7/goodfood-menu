import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshDetailed } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";

/**
 * S3: ออกจากระบบ = เพิกถอน refresh token จริง (เดิม client แค่ลบ token ทิ้ง ฝั่ง server ยังใช้ได้)
 * POST { refreshToken, all? } → { ok }
 * - all=true: ตัดทุก session ของ member (ใช้ตอน "ออกจากระบบทุกเครื่อง")
 */
export async function POST(req: NextRequest) {
  try {
    const { refreshToken, all } = await req.json();
    if (!refreshToken) return NextResponse.json({ error: "refreshToken required" }, { status: 400 });

    const parsed = await verifyRefreshDetailed(refreshToken);
    // token เพี้ยน/หมดอายุ = ถือว่า logout สำเร็จ (เป้าหมายคือให้ใช้ต่อไม่ได้)
    if (!parsed) return NextResponse.json({ ok: true });

    // backdate เกิน grace ของ refresh (60 วิ) — logout แล้วต้องใช้ต่อไม่ได้ทันที ไม่ใช่อีก 1 นาที
    const revokedAt = new Date(Date.now() - 120_000);
    if (all) {
      await prisma.refreshToken.updateMany({
        where: { memberId: parsed.memberId, revokedAt: null },
        data: { revokedAt },
      });
    } else if (parsed.jti) {
      await prisma.refreshToken.updateMany({
        where: { id: parsed.jti, memberId: parsed.memberId },
        data: { revokedAt },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/logout]", e);
    return NextResponse.json({ ok: true }); // logout ไม่ควรล้มเหลวฝั่ง client
  }
}
