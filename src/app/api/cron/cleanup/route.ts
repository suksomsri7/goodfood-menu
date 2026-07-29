import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * S6: ตารางโตไม่มีวันหมด (ศูนย์แจ้งเตือน + บทสนทนาโค้ช) — ล้างของเก่ารายวัน
 * เก็บ: แจ้งเตือน 90 วัน · บทสนทนา 90 วัน (agent ใช้แค่ 10 ข้อความล่าสุด)
 * cron: วันละครั้ง (X-Cron-Secret เดียวกับ cron อื่น)
 */
export async function GET(req: NextRequest) {
  // secret เดียวกับ cron ตัวอื่นทั้งระบบ (morning-coach/nudges/insights ใช้ ARTICLE_CRON_SECRET)
  const expected = process.env.ARTICLE_CRON_SECRET;
  if (!expected || req.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const [notifications, chats] = await Promise.all([
    prisma.coachNotification.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.coachChatLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);

  return NextResponse.json({ ok: true, deleted: { notifications: notifications.count, chats: chats.count } });
}
