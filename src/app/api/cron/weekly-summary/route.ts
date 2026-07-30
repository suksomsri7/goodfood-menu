import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { sendPush, hasDevice } from "@/lib/push";
import { bkkTodayKey } from "@/lib/planGenerator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * สรุปสัปดาห์เป็น push เช้าจันทร์ (BKK 08:00) — ประกอบจาก BehaviorInsight ที่ cron insights คำนวณไว้แล้ว
 * ไม่เรียก AI เลย (deterministic, ฟรี) · dedup ด้วย coachDispatchLog type=weekly_summary
 */
function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  return !!expected && req.headers.get("x-cron-secret") === expected;
}

const fmtMin = (m: number) => `${Math.floor(m / 60)}.${String(Math.round(((m % 60) / 60) * 10)).slice(0, 1)}`;

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const todayKey = bkkTodayKey();
  const members = await prisma.member.findMany({
    where: { isActive: true, isOnboarded: true },
    include: { memberType: true },
  });

  let sent = 0;
  const details: Array<{ memberId: string; status: string }> = [];

  for (const m of members) {
    if (!isAiCoachActive(m)) continue;
    if (!(await hasDevice(m.id))) { details.push({ memberId: m.id, status: "no-device" }); continue; }
    if (!m.notifyWeeklyInsights) { details.push({ memberId: m.id, status: "opted-out" }); continue; }

    const already = await prisma.coachDispatchLog.findUnique({
      where: { memberId_date_type: { memberId: m.id, date: todayKey, type: "weekly_summary" } },
    });
    if (already) { details.push({ memberId: m.id, status: "already-sent" }); continue; }

    // insight ล่าสุดของแต่ละ metric (cron insights รันทุกเช้าอยู่แล้ว)
    const rows = await prisma.behaviorInsight.findMany({
      where: { memberId: m.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const latest = new Map<string, any>();
    for (const r of rows) if (!latest.has(r.metric)) latest.set(r.metric, r.value);

    const parts: string[] = [];
    const adh = latest.get("adherence") as { score?: number; plans?: number } | undefined;
    if (adh?.plans) parts.push(`ทำตามแผน ${Math.round((adh.score || 0) * 100)}%`);
    const wt = latest.get("weight_trend") as { deltaKg?: number } | undefined;
    if (wt && typeof wt.deltaKg === "number" && wt.deltaKg !== 0)
      parts.push(`น้ำหนัก ${wt.deltaKg > 0 ? "+" : ""}${wt.deltaKg} กก.`);
    const sl = latest.get("sleep_avg") as { avgMin?: number } | undefined;
    if (sl?.avgMin) parts.push(`นอนเฉลี่ย ${fmtMin(sl.avgMin)} ชม.`);
    const na = latest.get("sodium_trend") as { overDays?: number } | undefined;
    if (na && (na.overDays || 0) >= 3) parts.push(`โซเดียมเกินเป้า ${na.overDays} วัน`);

    if (parts.length === 0) { details.push({ memberId: m.id, status: "no-data" }); continue; }

    const n = await sendPush(
      m.id,
      { title: "สรุปสัปดาห์ที่แล้ว 📊", body: parts.join(" · "), data: { screen: "insights" } },
      "insight"
    );
    if (n > 0) {
      await prisma.coachDispatchLog.create({
        data: { memberId: m.id, date: todayKey, type: "weekly_summary" },
      });
      sent++;
      details.push({ memberId: m.id, status: "sent" });
    } else {
      details.push({ memberId: m.id, status: "push-failed" });
    }
  }

  return NextResponse.json({ ok: true, sent, checked: members.length, details });
}
