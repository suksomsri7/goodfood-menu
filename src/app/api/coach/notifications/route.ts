import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * ศูนย์แจ้งเตือนในแอป (เหมือน Notification Center ของ iPhone)
 * GET    → { items, unread }
 * PATCH  { id } | { all: true } → ทำเครื่องหมายอ่านแล้ว
 * DELETE ?id=... | ?all=1       → ลบ (ปัดซ้าย / กด ×)
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limitRaw = Number(new URL(req.url).searchParams.get("limit"));
  const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  const [items, unread] = await Promise.all([
    prisma.coachNotification.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.coachNotification.count({ where: { memberId: member.id, readAt: null } }),
  ]);

  return NextResponse.json({ items, unread });
}

export async function PATCH(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, all } = await req.json().catch(() => ({ id: undefined, all: undefined }));
  const now = new Date();

  if (all) {
    const r = await prisma.coachNotification.updateMany({
      where: { memberId: member.id, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true, updated: r.count });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // updateMany + memberId = กันแก้ของคนอื่น (ownership)
  const r = await prisma.coachNotification.updateMany({
    where: { id, memberId: member.id },
    data: { readAt: now },
  });
  return NextResponse.json({ ok: true, updated: r.count });
}

export async function DELETE(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  if (sp.get("all")) {
    const r = await prisma.coachNotification.deleteMany({ where: { memberId: member.id } });
    return NextResponse.json({ ok: true, deleted: r.count });
  }

  const id = sp.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const r = await prisma.coachNotification.deleteMany({ where: { id, memberId: member.id } });
  return NextResponse.json({ ok: true, deleted: r.count });
}
