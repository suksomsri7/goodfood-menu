import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPush, hasDevice } from "@/lib/push";
import { buildAndSaveReport, MIN_SCANS_FOR_REPORT, REPORT_WINDOW_DAYS } from "@/lib/bodyReportStore";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * รายงานร่างกาย 4 สัปดาห์ (WO-BP-3 §B5) — cron รายวัน ทำงานจริงเฉพาะคนที่ถึงรอบ
 *
 * เกณฑ์เข้ารอบ: ยินยอมสแกน (bodyConsentAt) + มีสแกน ≥2 ครั้งใน 28 วัน
 * dedup: มีรายงาน periodEnd เดียวกันแล้ว = ข้าม (unique [memberId, periodEnd] กันซ้ำอีกชั้นใน DB)
 *
 * 🔴 VPS 2 core/3GB: ทำทีละคนเรียงกัน และจำกัด 20 คน/รอบ
 *    ยิงขนานกับ LLM หลายตัวพร้อมกันเคยทำให้ทั้งเครื่องหนืดจนงานอื่นล้มไปด้วย
 * 🔴 LLM ล้ม = ยังต้องมีรายงาน (buildAndSaveReport ตกไปย่อหน้า deterministic เอง)
 */
const MAX_PER_RUN = 20;
const DAY_MS = 24 * 3600 * 1000;

function checkSecret(req: NextRequest): boolean {
  const expected = process.env.ARTICLE_CRON_SECRET;
  return !!expected && req.headers.get("x-cron-secret") === expected;
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const since = new Date(now.getTime() - (REPORT_WINDOW_DAYS - 1) * DAY_MS);
  const onlyMemberId = req.nextUrl.searchParams.get("memberId");

  try {
    // คนที่มีสแกนพอในหน้าต่างนี้ (นับที่ DB ไม่ใช่ใน JS — สมาชิกทั้งระบบอาจเป็นหมื่น)
    const grouped = await prisma.bodyScan.groupBy({
      by: ["memberId"],
      where: { date: { gte: since }, ...(onlyMemberId ? { memberId: onlyMemberId } : {}) },
      _count: { _all: true },
    });
    const candidateIds = grouped
      .filter((g) => g._count._all >= MIN_SCANS_FOR_REPORT)
      .map((g) => g.memberId);

    if (candidateIds.length === 0) {
      return NextResponse.json({ ok: true, created: 0, checked: 0, details: [] });
    }

    // ยินยอมแล้วเท่านั้น — ไม่มี consent = ไม่ประมวลผลร่างกายของเขาเลย (WO-BODY §5 ข้อ 2)
    const members = await prisma.member.findMany({
      where: { id: { in: candidateIds }, isActive: true, bodyConsentAt: { not: null } },
      select: { id: true },
      take: MAX_PER_RUN,
    });

    let created = 0;
    const details: Array<{ memberId: string; status: string; source?: string }> = [];

    for (const m of members) {
      try {
        const out = await buildAndSaveReport(m.id, now);
        if (out.status !== "created") {
          details.push({ memberId: m.id, status: out.status });
          continue;
        }
        created++;
        details.push({ memberId: m.id, status: "created", source: out.source });

        if (await hasDevice(m.id)) {
          await sendPush(
            m.id,
            {
              title: "รายงานร่างกาย 4 สัปดาห์มาแล้ว 📋",
              body: "สรุปน้ำหนัก เอว และแรงของคุณในรอบนี้ — เปิดอ่านได้เลยครับ",
              data: { screen: "body-report", reportId: out.reportId },
            },
            "insight"
          );
        }
      } catch (e) {
        // คนหนึ่งพัง ต้องไม่ทำให้อีก 19 คนไม่ได้รายงาน
        console.error(`[cron/body-report] member=${m.id} ล้ม:`, e);
        details.push({ memberId: m.id, status: "error" });
      }
    }

    return NextResponse.json({ ok: true, created, checked: members.length, candidates: candidateIds.length, details });
  } catch (e: unknown) {
    console.error("[cron/body-report] GET", e);
    return NextResponse.json({ error: "สร้างรายงานไม่สำเร็จ" }, { status: 500 });
  }
}
