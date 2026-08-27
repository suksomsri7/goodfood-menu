import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { PROVIDERS, PROVIDER_META, configuredProviders, isProvider } from "@/lib/integrations/providers";
import { disconnect } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

/**
 * GET → รายการบริการที่ต่อตรงได้ + สถานะของสมาชิกคนนี้
 * แอปใช้ตัดสินว่าจะวาดปุ่มไหน — ปุ่มที่กดแล้วพังไม่ควรมีอยู่ (แพตเทิร์นเดียวกับ providers ของหน้า login)
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [configured, rows] = await Promise.all([
    configuredProviders(),
    prisma.healthConnection.findMany({
      where: { memberId: member.id },
      select: { provider: true, lastSyncAt: true, lastError: true, createdAt: true },
    }),
  ]);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const res = NextResponse.json({
    providers: PROVIDERS.filter((p) => configured[p]).map((p) => {
      const row = byProvider.get(p);
      return {
        key: p,
        label: PROVIDER_META[p].label,
        blurb: PROVIDER_META[p].blurb,
        connected: !!row,
        lastSyncAt: row?.lastSyncAt ?? null,
        lastError: row?.lastError ?? null,
      };
    }),
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

/** DELETE ?provider=fitbit — ยกเลิกการเชื่อม (ข้อมูลที่ดึงมาแล้วยังอยู่ เป็นบันทึกของ user) */
export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const provider = new URL(req.url).searchParams.get("provider") ?? "";
  if (!isProvider(provider)) return NextResponse.json({ error: "ไม่รู้จักบริการนี้" }, { status: 400 });

  await disconnect(member.id, provider);
  return NextResponse.json({ ok: true });
}
