import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets/store";
import { handleCommand, handleDecision, handleManualLink } from "@/lib/exerciseVideoReview";

export const dynamic = "force-dynamic";

/**
 * รับผลการกดปุ่มจาก content-bot (ตัวที่ถือ token ของ @Foodie_goodfood_bot อยู่)
 *
 * 🔴 ทำไมไม่ใช้ webhook ตรง ๆ: token ใบนี้ถูก content-bot@page3 long-poll อยู่ตลอด
 *    grammY จะเรียก deleteWebhook ทุกครั้งที่บูต → webhook ที่เราตั้งไว้หายเงียบ
 *    การ์ดส่งได้ แต่กดปุ่มแล้วไม่มีอะไรเกิดขึ้น (เจ้าของเจอกับตัว 27 ส.ค. 69)
 *    บอทหนึ่งตัวมีผู้บริโภค update ได้ทีละเจ้าเท่านั้น — จึงให้เจ้าที่ถืออยู่ส่งต่อมาแทน
 */
export async function POST(req: NextRequest) {
  const expected = await getSecret("FOODIE_WEBHOOK_SECRET");
  if (expected && req.headers.get("x-bridge-token") !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const { data, link } = (await req.json()) as { data?: string; link?: string };

    // เจ้าของพิมพ์ลิงก์เอง — คืน handled=false เมื่อไม่ได้รออะไรอยู่ เพื่อให้บอทเงียบ ไม่ไปทับ flow อื่น
    if (typeof link === "string") {
      // คำสั่งข้อความก่อน แล้วค่อยตีความว่าเป็นลิงก์
      const cmd = await handleCommand(link);
      if (cmd.handled) return NextResponse.json({ ok: true, handled: true, message: cmd.message ?? "" });
      const r = await handleManualLink(link);
      return NextResponse.json({ ok: true, handled: r.handled, message: r.message ?? "" });
    }

    if (!data?.startsWith("xv:")) return NextResponse.json({ message: "ไม่รู้จักปุ่มนี้" });
    const message = await handleDecision(data);
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("[telegram/foodie/decide]", e);
    return NextResponse.json({ message: "ระบบขัดข้อง ลองใหม่อีกครั้ง" }, { status: 200 });
  }
}
