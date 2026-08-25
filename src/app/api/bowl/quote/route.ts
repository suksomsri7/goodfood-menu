import { NextRequest, NextResponse } from "next/server";
import { trustedMember } from "@/lib/memberAuth";
import { priceBowl } from "@/lib/bowlServer";

export const dynamic = "force-dynamic";

/**
 * คิดราคา + โภชนาการของชามที่ลูกค้าจัด — ฝั่งเซิร์ฟเวอร์เป็นคนตัดสิน
 *
 * 🔴 ห้ามเชื่อราคาที่แอปส่งมา ราคาต้องอ่านจากคลังวัตถุดิบทุกครั้ง (priceBowl)
 * 🔴 ของหมด/ปิดขาย = ตอบเป็นภาษาคนว่าตัวไหน ไม่ใช่ error ลอย ๆ
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const member = await trustedMember(req, searchParams.get("lineUserId"));
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { picks?: { ingredientId?: string; qty?: number }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const r = await priceBowl(body.picks);
  if (!r.ok) {
    return NextResponse.json({ error: r.error, ...(r.soldOutId ? { soldOutId: r.soldOutId } : {}) }, { status: r.status });
  }

  return NextResponse.json({
    basePrice: r.basePrice,
    lines: r.lines.map((l) => ({
      ingredientId: l.ingredientId,
      name: l.name,
      step: l.step,
      qty: l.qty,
      price: l.unitPrice * l.qty,
      calories: l.nutrition.calories * l.qty,
    })),
    totals: r.totals,
  });
}
