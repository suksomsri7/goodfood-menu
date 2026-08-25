import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trustedMember } from "@/lib/memberAuth";
import { priceBowl } from "@/lib/bowlServer";
import { BOWL_STEPS } from "@/lib/bowl";
import { bkkTodayKey } from "@/lib/planGenerator";
import { orderCode } from "@/app/api/coach/order-link/route";

export const dynamic = "force-dynamic";

/**
 * สั่งชามที่จัดเอง — ประกอบข้อความ + deep link ทักแชท LINE OA ของร้าน
 *
 * 🔴 ราคาคิดใหม่จากคลังเสมอ (priceBowl) ไม่ใช้ยอดที่แอปส่งมา
 * 🔴 ยังไม่ตั้ง LINE OA ที่หลังบ้าน = ตอบ available:false ให้แอปซ่อนปุ่ม
 *    (ปุ่มที่กดแล้วไม่เกิดอะไร แย่กว่าไม่มีปุ่ม)
 * 🔴 ข้อความขึ้นต้นว่า "สนใจสั่ง" ไม่ใช่ "สั่งแล้ว" — ลูกค้ายังไม่ได้ตกลงอะไรกับใคร
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const member = await trustedMember(req, searchParams.get("lineUserId"));
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { picks?: { ingredientId?: string; qty?: number }[]; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const priced = await priceBowl(body.picks);
  if (!priced.ok) {
    return NextResponse.json(
      { error: priced.error, ...(priced.soldOutId ? { soldOutId: priced.soldOutId } : {}) },
      { status: priced.status },
    );
  }

  const settings = await prisma.systemSetting
    .findUnique({ where: { id: "system" }, select: { lineOaId: true } })
    .catch(() => null);
  const rawOa = (settings?.lineOaId || "").trim();
  if (!rawOa) return NextResponse.json({ available: false, reason: "no_oa_configured" });

  const dateKey = bkkTodayKey();
  const code = orderCode(member.id, dateKey);
  const stepLabel = new Map(BOWL_STEPS.map((s) => [s.key, s.th]));

  const lines = [
    "สนใจสั่งชามจัดเอง",
    "",
    ...priced.lines.map(
      (l) => `• ${stepLabel.get(l.step) ?? l.step}: ${l.name}${l.qty > 1 ? ` ×${l.qty} ที่` : ""}`,
    ),
    "",
    `รวม ${priced.totals.price} บาท · ${priced.totals.calories} kcal · โปรตีน ${priced.totals.protein} ก.`,
    ...(body.note?.trim() ? ["", `หมายเหตุ: ${body.note.trim()}`] : []),
    "",
    `รหัสอ้างอิง: ${code}`,
  ];
  const message = lines.join("\n");

  // LINE deep link ต้องเป็น basic ID พร้อม @ และ encode (@goodfood → %40goodfood)
  const oaId = rawOa.startsWith("@") ? rawOa : `@${rawOa}`;
  const url = `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`;

  const res = NextResponse.json({
    available: true,
    url,
    message,
    oaId,
    code,
    total: priced.totals.price,
    totals: priced.totals,
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
