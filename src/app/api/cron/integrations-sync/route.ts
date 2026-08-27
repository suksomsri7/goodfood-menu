import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessTokenFor, markSynced } from "@/lib/integrations/store";
import { syncFitbit } from "@/lib/integrations/fitbit";
import { syncStrava } from "@/lib/integrations/strava";
import { isProvider } from "@/lib/integrations/providers";

export const dynamic = "force-dynamic";

/**
 * ดึงข้อมูลจากบริการที่สมาชิกเชื่อมไว้ (Fitbit / Strava)
 *
 * 🔴 ต้องเป็น cron ไม่ใช่ดึงตอนเปิดแอป: Fitbit/Strava อยู่บนคลาวด์ของเขา
 *    ต่างจาก Apple Health ที่อ่านจากเครื่องได้ทันที — ถ้ารอให้เปิดแอปข้อมูลจะมาช้าและไม่ครบ
 * 🔴 คนที่ต่ออายุ token ไม่ได้ (เพิกถอนสิทธิ์) ให้จด lastError ไว้ ไม่ใช่ลบทิ้งเงียบ ๆ
 *    แอปจะได้บอก user ว่า "ต้องเชื่อมใหม่" แทนที่จะดูเหมือนยังต่ออยู่แต่ไม่มีข้อมูลเข้า
 */
export async function GET(req: NextRequest) {
  const secret = process.env.ARTICLE_CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.healthConnection.findMany({
    select: { memberId: true, provider: true, lastSyncAt: true },
  });

  const details: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    if (!isProvider(row.provider)) continue;
    try {
      const token = await accessTokenFor(row.memberId, row.provider);
      if (!token) {
        details.push({ memberId: row.memberId, provider: row.provider, status: "token-dead" });
        continue;
      }
      if (row.provider === "fitbit") {
        // 3 วันย้อนหลัง — เผื่อ user ซิงก์นาฬิกาช้าหรือแก้บันทึกย้อนหลัง
        const c = await syncFitbit(row.memberId, token, 3);
        await markSynced(row.memberId, row.provider);
        details.push({ memberId: row.memberId, provider: "fitbit", ...c });
      } else {
        // ดึงต่อจากรอบก่อน · เชื่อมครั้งแรก = ย้อน 30 วันให้มีของให้ดูเลย
        const since = row.lastSyncAt ?? new Date(Date.now() - 30 * 86400e3);
        const c = await syncStrava(row.memberId, token, since);
        await markSynced(row.memberId, row.provider);
        details.push({ memberId: row.memberId, provider: "strava", ...c });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[cron/integrations-sync]", row.provider, msg);
      await markSynced(row.memberId, row.provider, msg.slice(0, 200));
      details.push({ memberId: row.memberId, provider: row.provider, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, connections: rows.length, details });
}
