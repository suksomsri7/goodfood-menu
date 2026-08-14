import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

/**
 * สั่งซื้อแผนผูกปิ่นโต
 * POST /api/coach/meal-design/{id}/order → { orderNumber, url, message, total }
 *
 * 🔴 ต้องสร้าง Order จริงใน DB ก่อนเปิด LINE เสมอ
 *    ของเดิม (order-link) แค่ปั้นสตริงรหัสแล้วเปิดแชท → แอดมินเปิดหลังบ้านหาไม่เจอ
 *    ตอนนี้เขียนลง orders + order_items ครบทุกวัน/ทุกมื้อ (ใช้ dayNumber/mealType ที่ตารางมีอยู่แล้ว)
 *
 * 🔴 idempotent: กดปุ่มรัว ๆ ต้องได้ออเดอร์เดียว — แผนที่สั่งแล้วจะคืนใบเดิม
 *
 * ที่อยู่/ค่าส่ง/วันเริ่มส่ง = คุยกันใน LINE (user เคาะ 14 ส.ค.) จึงยังไม่บังคับตอนสร้างออเดอร์
 * แต่ต้องติดหมายเหตุไว้ให้แอดมินรู้ว่ายังขาดข้อมูลส่วนนี้
 */

/** เลขที่ออเดอร์แบบอ่านง่าย: C-260814-0007 (วันไทย + ลำดับของวันนั้น) */
async function nextOrderNumber(): Promise<string> {
  const bkkNow = new Date(Date.now() + 7 * 3600_000);
  const ymd = bkkNow.toISOString().slice(2, 10).replace(/-/g, "");
  const dayStart = new Date(Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth(), bkkNow.getUTCDate()) - 7 * 3600_000);
  const count = await prisma.order.count({ where: { createdAt: { gte: dayStart } } });
  return `C-${ymd}-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const design = await prisma.mealPlanDesign.findFirst({
      where: { id, memberId: member.id },
      include: { items: { orderBy: [{ dayNumber: "asc" }, { id: "asc" }] } },
    });
    if (!design) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (design.items.length === 0) return NextResponse.json({ error: "แผนนี้ไม่มีเมนู" }, { status: 409 });

    const settings = await prisma.systemSetting
      .findUnique({ where: { id: "system" }, select: { lineOaId: true } })
      .catch(() => null);
    const rawOa = (settings?.lineOaId || "").trim();

    // ── กดซ้ำ = คืนใบเดิม ไม่สร้างใหม่ ──
    let order = design.orderId
      ? await prisma.order.findUnique({ where: { id: design.orderId } })
      : null;

    if (!order) {
      const total = Math.round(design.items.reduce((a, i) => a + i.price * i.servings, 0));
      const orderNumber = await nextOrderNumber();
      order = await prisma.order.create({
        data: {
          orderNumber,
          memberId: member.id,
          coursePlan: `ผูกปิ่นโต ${design.days} วัน`,
          packageName: `ผูกปิ่นโต ${design.days} วัน`,
          totalDays: design.days,
          totalPrice: total,
          finalPrice: total,
          status: "pending",
          note: "สั่งจากแอป Coach — รอยืนยันที่อยู่จัดส่ง/วันเริ่มส่ง/การชำระเงินทาง LINE",
          items: {
            create: design.items.map((i) => ({
              foodId: i.foodId,
              foodName: i.foodName,
              price: i.price,
              quantity: i.servings,
              dayNumber: i.dayNumber,
              mealType: i.slot,
              calories: i.calories,
            })),
          },
        },
      });
      await prisma.mealPlanDesign.update({
        where: { id: design.id },
        data: { status: "ordered", orderId: order.id, totalPrice: total },
      });
    }

    // ── ข้อความที่พิมพ์รอไว้ในแชท LINE ──
    // จงใจไม่ยัดเมนูครบ 30 วันลงข้อความ (ยาวเกินอ่าน) — ให้แอดมินเปิดหลังบ้านตามเลขที่แทน
    const perDay = Math.round(order.totalPrice / Math.max(1, design.days));
    const firstDay = design.items
      .filter((i) => i.dayNumber === 1)
      .map((i) => `• ${i.slot}: ${i.foodName}`);
    const message = [
      `สั่งผูกปิ่นโต ${design.days} วันครับ`,
      `เลขที่ออเดอร์: ${order.orderNumber}`,
      "",
      "ตัวอย่างวันที่ 1:",
      ...firstDay,
      "",
      `รวม ${order.totalPrice.toLocaleString()} บาท (เฉลี่ยวันละ ${perDay.toLocaleString()} บาท)`,
      "",
      "รบกวนแจ้งที่อยู่จัดส่ง วันเริ่มส่ง และวิธีชำระเงินด้วยครับ",
    ].join("\n");

    // LINE deep link ต้องเป็น basic ID พร้อม @ และ encode (@goodfood → %40goodfood)
    const oaId = rawOa ? (rawOa.startsWith("@") ? rawOa : `@${rawOa}`) : "";
    const url = oaId
      ? `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`
      : null;

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: Math.round(order.totalPrice),
      perDay,
      days: design.days,
      itemCount: design.items.length,
      message,
      url,
      // ยังไม่ตั้ง LINE OA = สั่งได้แต่เปิดแชทอัตโนมัติไม่ได้ (แอปต้องบอกให้ทักเองพร้อมเลขที่)
      oaConfigured: !!oaId,
    });
  } catch (e: any) {
    console.error("[coach/meal-design/order]", e);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }
}
