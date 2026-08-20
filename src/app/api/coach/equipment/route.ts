import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { normalizeEquipmentItems, legacyEquipmentTier } from "@/lib/memberEquipment";

export const dynamic = "force-dynamic";

/**
 * คลังอุปกรณ์รายชิ้นของสมาชิก (ดีไซน์ข้อ 4-5)
 *
 * GET → { items, legacy }  legacy = Member.equipment เดิม (none|home|gym) ที่ planGenerator ยังใช้อยู่
 * PUT { items:[{type,variant?,minKg?,maxKg?,incrementKg?,isPair?}] } → ลบของเดิมทั้งหมดแล้วสร้างใหม่
 *
 * ทำไม replace-all ไม่ diff: ของแต่ละคนมีไม่กี่ชิ้น การ diff เพิ่มโอกาสพลาดมากกว่าที่ประหยัดได้
 * 🔴 ทุกครั้งที่บันทึกต้อง sync Member.equipment ด้วย — ถ้าไม่ sync ตัวจัดแผนเดิมจะยังคิดว่า user ไม่มีอุปกรณ์
 */

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await prisma.memberEquipment.findMany({
    where: { memberId: member.id },
    orderBy: { createdAt: "asc" },
  });
  const res = NextResponse.json({ items, legacy: member.equipment ?? "none" });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export async function PUT(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = normalizeEquipmentItems(body?.items);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const legacy = legacyEquipmentTier(parsed.items);
    // ลบ+สร้าง+sync ใน transaction เดียว — ถ้าพังกลางทาง user ต้องไม่เหลือคลังว่างเปล่า
    await prisma.$transaction([
      prisma.memberEquipment.deleteMany({ where: { memberId: member.id } }),
      ...(parsed.items.length
        ? [prisma.memberEquipment.createMany({ data: parsed.items.map((i) => ({ ...i, memberId: member.id })) })]
        : []),
      prisma.member.update({ where: { id: member.id }, data: { equipment: legacy } }),
    ]);

    const items = await prisma.memberEquipment.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "asc" },
    });
    const res = NextResponse.json({ ok: true, items, legacy });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/equipment]", e);
    return NextResponse.json({ error: "บันทึกอุปกรณ์ไม่สำเร็จ ลองใหม่อีกครั้งนะ" }, { status: 500 });
  }
}
