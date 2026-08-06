import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { sendPush, hasDevice } from "@/lib/push";
import { bkkTodayKey } from "@/lib/planGenerator";

export const dynamic = "force-dynamic";

/**
 * เตือนชั่งน้ำหนัก (จันทร์+พฤหัส BKK 07:30) — weight trend คือหัวใจของ weeklyAdjust
 * แต่เดิมไม่มีอะไรกระตุ้นให้ชั่งเลย · ข้ามถ้าชั่งไปแล้วใน 3 วัน · เคารพ notifyWeightReminder
 */
function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  return !!expected && req.headers.get("x-cron-secret") === expected;
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const todayKey = bkkTodayKey();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const members = await prisma.member.findMany({
    where: { isActive: true, isOnboarded: true, notifyWeightReminder: true },
    include: { memberType: true },
  });

  let sent = 0;
  // เก็บเหตุผลที่ข้ามไว้ด้วย — เดิม continue เงียบ ๆ ทำให้อ่าน log ไม่ออกว่าทำไมไม่ส่ง
  const details: Array<{ memberId: string; status: string }> = [];
  for (const m of members) {
    if (!isAiCoachActive(m)) { details.push({ memberId: m.id, status: "no-access" }); continue; }
    if (!(await hasDevice(m.id))) { details.push({ memberId: m.id, status: "no-device" }); continue; }

    const recent = await prisma.weightLog.count({
      where: { memberId: m.id, date: { gte: threeDaysAgo } },
    });
    if (recent > 0) { details.push({ memberId: m.id, status: "weighed-recently" }); continue; } // ชั่งไปแล้ว ไม่กวน

    const already = await prisma.coachDispatchLog.findUnique({
      where: { memberId_date_type: { memberId: m.id, date: todayKey, type: "weigh_reminder" } },
    });
    if (already) { details.push({ memberId: m.id, status: "already-sent" }); continue; }

    const n = await sendPush(
      m.id,
      {
        title: "ชั่งน้ำหนักหน่อยครับ ⚖️",
        body: "ชั่งตอนเช้าก่อนกินอะไรแม่นสุด แล้วบอกโค้ชได้เลย เช่น “หนัก 92.5 โล”",
        data: { screen: "today" },
      },
      "nudge"
    );
    if (n > 0) {
      await prisma.coachDispatchLog.create({
        data: { memberId: m.id, date: todayKey, type: "weigh_reminder" },
      });
      sent++;
      details.push({ memberId: m.id, status: "sent-push" });
    } else {
      details.push({ memberId: m.id, status: "push-failed" });
    }
  }

  return NextResponse.json({ ok: true, sent, checked: members.length, details });
}
