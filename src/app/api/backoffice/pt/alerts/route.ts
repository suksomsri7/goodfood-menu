import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

const KIND_TH: Record<string, string> = {
  stall: "ตัวเลขไม่ขยับ",
  readiness_low: "ความพร้อมต่ำติดกัน",
  new_injury: "แจ้งเจ็บใหม่",
};

/** GET /api/backoffice/pt/alerts?all=1 — รายการเตือนที่ยังไม่มีใครรับเรื่อง (all=1 = รวมที่ปิดแล้ว) */
export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const all = new URL(req.url).searchParams.get("all") === "1";
  const rows = await prisma.ptAlert.findMany({
    where: all ? {} : { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, memberId: true, kind: true, subject: true, message: true,
      createdAt: true, notifiedAt: true, resolvedAt: true, resolvedBy: true,
      member: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member?.name ?? null,
      kind: r.kind,
      kindLabel: KIND_TH[r.kind] ?? r.kind,
      subject: r.subject,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      notified: !!r.notifiedAt,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolvedBy: r.resolvedBy,
    })),
    openCount: rows.filter((r) => !r.resolvedAt).length,
  });
}

/** POST /api/backoffice/pt/alerts — { id, resolved } กดรับเรื่อง/ยกเลิกการรับเรื่อง */
export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "ต้องระบุรายการ" }, { status: 400 });
  const resolved = body.resolved !== false;

  const exists = await prisma.ptAlert.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "ไม่พบรายการเตือนนี้" }, { status: 404 });

  await prisma.ptAlert.update({
    where: { id },
    data: resolved
      ? { resolvedAt: new Date(), resolvedBy: staff.email }
      : { resolvedAt: null, resolvedBy: null },
  });
  return NextResponse.json({ ok: true, resolved });
}
