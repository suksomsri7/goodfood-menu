import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshDetailed, signSession } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";

/**
 * S3: refresh พร้อม rotation + ตรวจ reuse
 * - ใช้ 1 ครั้ง = token เก่าถูกเพิกถอน ออกคู่ใหม่ให้
 * - token ที่ถูกเพิกถอนแล้วโผล่มาอีก (เกิน grace) = สงสัยโดนขโมย → เพิกถอนทั้งหมดของ member
 * - grace 60 วิ: build 19 refresh พร้อมกันหลาย request (ไม่มี single-flight) — อย่านับเป็นการขโมย
 * - token รุ่นเก่า (ไม่มี jti — ออกก่อนมีระบบนี้) ยังใช้ได้จนหมดอายุ แล้วถูกอัปเกรดเป็นแบบ track ในการ refresh แรก
 *
 * POST { refreshToken } → { accessToken, refreshToken }
 */
const REUSE_GRACE_MS = 60_000;

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) return NextResponse.json({ error: "refreshToken required" }, { status: 400 });

    const parsed = await verifyRefreshDetailed(refreshToken);
    if (!parsed) return NextResponse.json({ error: "invalid refresh token" }, { status: 401 });
    const { memberId, jti } = parsed;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member || member.isActive === false) {
      return NextResponse.json({ error: "member not found" }, { status: 401 });
    }

    if (jti) {
      const row = await prisma.refreshToken.findUnique({ where: { id: jti } });

      if (!row || row.memberId !== memberId) {
        return NextResponse.json({ error: "invalid refresh token" }, { status: 401 });
      }
      if (row.expiresAt < new Date()) {
        return NextResponse.json({ error: "refresh token expired" }, { status: 401 });
      }
      if (row.revokedAt) {
        const age = Date.now() - row.revokedAt.getTime();
        if (age > REUSE_GRACE_MS) {
          // reuse หลัง grace = สงสัย token โดนขโมย → ตัดทุก session ของ member นี้
          // backdate เกิน grace: token ที่โดนตัดต้องตายทันที ไม่ใช่แอบต่ออายุได้อีก 60 วิ (เจอจาก QC)
          await prisma.refreshToken.updateMany({
            where: { memberId, revokedAt: null },
            data: { revokedAt: new Date(Date.now() - 120_000) },
          });
          console.warn(`[auth/refresh] reuse detected → revoke all sessions member=${memberId}`);
          return NextResponse.json({ error: "session revoked" }, { status: 401 });
        }
        // ภายใน grace = race ของ client เก่าที่ refresh ซ้อนกัน → ออกคู่ใหม่ให้ตามปกติ
      }

      const tokens = await signSession(memberId);
      if (!row.revokedAt) {
        // rotate: ปิดตัวเก่า (jti ตัวใหม่ฝังอยู่ในคู่ใหม่แล้ว)
        await prisma.refreshToken.update({ where: { id: jti }, data: { revokedAt: new Date() } });
      }
      return NextResponse.json(tokens);
    }

    // token รุ่นเก่า (stateless) — อัปเกรดเป็นแบบ track ในการใช้ครั้งแรก ใช้ได้จนหมดอายุเดิม
    const tokens = await signSession(memberId);
    return NextResponse.json(tokens);
  } catch (e) {
    console.error("[auth/refresh]", e);
    return NextResponse.json({ error: "refresh failed" }, { status: 401 });
  }
}
