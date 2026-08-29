import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets/store";
import { answerCallback, handleDecision, sendNextCard } from "@/lib/exerciseVideoReview";

export const dynamic = "force-dynamic";

/**
 * Webhook ของบอท Foodie — รับเฉพาะการกดปุ่มบนการ์ดตรวจคลิปท่าออกกำลังกาย
 *
 * 🔴 ใช้ webhook ไม่ใช่ polling เพราะ token เดียวมีผู้บริโภคได้ทีละเจ้า
 *    (systemd foodie-bot ตัวเดิมเป็น long-polling — ถ้าเปิดพร้อมกันจะแย่ง update กัน)
 *    ตอนนี้ service นั้น disabled อยู่แล้ว · ถ้าจะกลับไปใช้บอทคุยกับ Claude ต้องถอน webhook ก่อน
 * 🔴 กันคนอื่นยิงมั่ว: Telegram ให้ตั้ง secret_token แล้วมันจะแนบมาทุก request
 */
export async function POST(req: NextRequest) {
  const expected = await getSecret("FOODIE_WEBHOOK_SECRET");
  if (expected && req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const update = (await req.json()) as {
      callback_query?: { id: string; data?: string; from?: { id?: number } };
    };
    const cb = update.callback_query;
    if (cb?.data?.startsWith("xv:")) {
      const msg = await handleDecision(cb.data);
      await answerCallback(cb.id, msg);
    }
  } catch (e) {
    // ตอบ 200 เสมอ — ถ้าตอบ error Telegram จะยิงซ้ำ ๆ จนกลายเป็นการ์ดซ้ำ
    console.error("[telegram/foodie]", e);
  }
  return NextResponse.json({ ok: true });
}

/** GET ?start=1 — เริ่มคิว/ส่งใบถัดไปด้วยมือ (ใช้ตอนตั้งค่าเสร็จหรือคิวค้าง) */
export async function GET(req: NextRequest) {
  const secret = process.env.ARTICLE_CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const sent = await sendNextCard();
  return NextResponse.json({ ok: true, sent });
}
