import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseYouTubeId } from "@/lib/youtubeUrl";
import { sendNextCard } from "@/lib/exerciseVideoReview";
import { getSecret } from "@/lib/secrets/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * เฝ้าคลิปสอนท่าที่ผูกไว้ — ช่อง YouTube ลบ/ตั้งเป็นส่วนตัว/ปิดการฝังเมื่อไหร่ก็ได้
 *
 * 🔴 ไม่มีตัวนี้ = วันหนึ่งลูกค้ากด ▶ แล้วเจอ "วิดีโอนี้ไม่พร้อมใช้งาน" โดยไม่มีใครรู้
 *    (คลาสเดียวกับบทเรียน "ข้อสอบเน่าตามเวลา" — ของที่เคยผ่านไม่ได้แปลว่าจะผ่านตลอดไป)
 * 🔴 เจอตายแล้ว **ถอดลิงก์ออกทันที** ไม่ใช่แค่แจ้ง — ปุ่ม ▶ จะได้หายไปเอง
 *    ดีกว่าปล่อยให้ค้างไว้จนกว่าจะมีคนมาแก้
 * 🔴 ตรวจด้วย oEmbed: คลิปที่ถูกลบ/ปิดฝัง จะตอบ 400/401/404 — ไม่ต้องใช้โควตา API
 */
export async function GET(req: NextRequest) {
  const secret = process.env.ARTICLE_CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.exercise.findMany({
    where: { videoUrl: { not: null } },
    select: { key: true, name: true, videoUrl: true },
  });

  const dead: Array<{ key: string; name: string }> = [];
  for (const r of rows) {
    const id = parseYouTubeId(r.videoUrl);
    if (!id) { dead.push({ key: r.key, name: r.name }); continue; }
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      // 5xx = ฝั่ง YouTube มีปัญหาชั่วคราว ไม่ใช่คลิปตาย → ข้ามไว้ รอบหน้าค่อยเช็คใหม่
      if (res.status >= 500) continue;
      if (!res.ok) dead.push({ key: r.key, name: r.name });
    } catch {
      // ต่อเน็ตไม่ได้ = ไม่ใช่ความผิดของคลิป ห้ามถอดลิงก์
      continue;
    }
  }

  if (dead.length) {
    await prisma.exercise.updateMany({
      where: { key: { in: dead.map((d) => d.key) } },
      data: { videoUrl: null },
    });
    // เปิดคิวให้หาใหม่: ปลดใบที่เคยข้ามของท่านั้นกลับมาเป็นตัวเลือก
    await prisma.exerciseVideoCandidate.updateMany({
      where: { exerciseKey: { in: dead.map((d) => d.key) }, status: { in: ["approved", "skipped"] } },
      data: { status: "pending", decidedAt: null },
    });

    const [token, chatId] = await Promise.all([getSecret("FOODIE_BOT_TOKEN"), getSecret("FOODIE_BOT_CHAT_ID")]);
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            `⚠️ คลิปสอนท่าใช้ไม่ได้แล้ว ${dead.length} ท่า (ถอดปุ่ม ▶ ออกให้แล้ว):\n` +
            dead.map((d) => `• ${d.name}`).join("\n") +
            `\n\nเดี๋ยวผมส่งตัวเลือกใหม่ให้ตรวจครับ`,
        }),
      }).catch(() => {});
    }
    await sendNextCard().catch(() => {});
  }

  return NextResponse.json({ ok: true, checked: rows.length, dead: dead.length, deadKeys: dead.map((d) => d.key) });
}
