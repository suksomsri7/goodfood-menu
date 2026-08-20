import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { bkkDayKey } from "@/lib/readinessStore";
import { bkkDayWindow } from "@/lib/planTick";
import { sanitizeLogInstant } from "@/lib/coachLogTime";
import { remeasureScansNear } from "@/lib/bodyMeasureStore";
// ป้ายไทยย้ายไปอยู่กับ SITE_TO_ESTIMATE ใน bodyMeasure.ts — สองที่ที่ใช้ต้องอ่านชุดเดียวกัน
import { SITE_LABELS_TH } from "@/lib/bodyMeasure";

export const dynamic = "force-dynamic";

/**
 * สายวัดมือของลูกค้า (WO-BODY §4 · §6 "Manual fallback")
 *
 * ตารางนี้คือ ground truth: สายวัดแม่นกว่ากล้องเสมอ
 * BP-2 จะใช้ค่านี้ทั้ง (1) แสดงแทนค่าที่ CV ประมาณ และ (2) เรียน offset ของคนคนนี้เพื่อ calibrate ทั้งเส้น
 * ดังนั้นค่าที่รับเข้ามาต้องสะอาด — เลขที่พิมพ์ผิดหนึ่งตัวจะไปบิดกราฟย้อนหลังทั้งเส้น
 *
 * POST { site, valueCm, date? } → บันทึก (วัดซ้ำวันเดิมจุดเดิม = แก้ค่าเดิม ไม่ใช่เพิ่มแถว)
 * GET  ?site=&limit= → รายการล่าสุด
 */

/** จุดที่วัดได้ — allowlist เพราะชื่อ site ไปเป็น key ของกราฟ/การเทียบค่ากับ CV ตรง ๆ */
export const MEASUREMENT_SITES = [
  "waist",
  "hip",
  "chest",
  "shoulder",
  "neck",
  "arm_l",
  "arm_r",
  "thigh_l",
  "thigh_r",
  "calf_l",
  "calf_r",
] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

/** ช่วงที่เป็นไปได้ของเส้นรอบวงมนุษย์ (ซม.) — กันพิมพ์ผิดหน่วย (นิ้ว/มิลลิเมตร) และกันนิ้วลั่น */
const MIN_CM = 10;
const MAX_CM = 250;

const ALLOWED_SOURCES = ["tape", "scale"];

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));

    const site = String(body?.site ?? "").trim().toLowerCase();
    if (!(MEASUREMENT_SITES as readonly string[]).includes(site)) {
      return NextResponse.json({ error: "ไม่รู้จักจุดที่วัด — เลือกจากรายการที่มีให้นะครับ" }, { status: 400 });
    }

    const valueCm = Number(body?.valueCm);
    if (!Number.isFinite(valueCm) || valueCm < MIN_CM || valueCm > MAX_CM) {
      return NextResponse.json(
        { error: `ค่าที่วัดต้องอยู่ระหว่าง ${MIN_CM}-${MAX_CM} เซนติเมตร — ลองตรวจหน่วยอีกครั้งนะครับ` },
        { status: 400 }
      );
    }

    const source = ALLOWED_SOURCES.includes(String(body?.source ?? "")) ? String(body.source) : "tape";
    // วัดย้อนหลังได้ แต่วัดล่วงหน้าไม่ได้ (กติกาเดียวกับบันทึกอื่น ๆ ในระบบ)
    const date = bkkDayKey(sanitizeLogInstant(body?.date));

    /* วัดซ้ำจุดเดิมวันเดิม = แก้ค่าเดิม
       สายวัดรอบเอวสองครั้งห่างกัน 5 นาทีไม่ใช่ "ข้อมูลสองจุด" แต่คือคนคนเดิมที่วัดใหม่ให้แม่นขึ้น
       ถ้าเก็บทั้งคู่ กราฟจะมีจุดซ้อนในวันเดียวและค่าเฉลี่ยจะเอนไปทางครั้งที่ผิด */
    const { dayStart, dayEnd } = bkkDayWindow(date);
    const existing = await prisma.bodyMeasurement.findFirst({
      where: { memberId: member.id, site, date: { gte: dayStart, lt: dayEnd } },
      select: { id: true },
    });

    const row = existing
      ? await prisma.bodyMeasurement.update({ where: { id: existing.id }, data: { valueCm, source, date } })
      : await prisma.bodyMeasurement.create({ data: { memberId: member.id, site, valueCm, source, date } });

    /* สายวัดเข้ามาแล้ว = ระบบเรียน offset ของคนนี้ได้ทันที (WO-BP-2 §B3)
       วัดสแกนที่อยู่ในระยะ ±3 วันใหม่ ให้กราฟขยับตั้งแต่วินาทีที่เขากดบันทึก ไม่ใช่รอสแกนครั้งหน้า
       🔴 ล้มตรงนี้ห้ามกระทบการบันทึก — สายวัดถูกเก็บไปแล้ว (remeasureScansNear กลืน error ให้ในตัว) */
    const recalibrated = await remeasureScansNear(member.id, date);

    const res = NextResponse.json({
      ok: true,
      /** จำนวนสแกนที่ถูกคิดใหม่ด้วยค่านี้ — จอเอาไปบอกได้ว่า "ปรับค่าประมาณให้แล้ว" */
      recalibrated,
      measurement: {
        id: row.id,
        site: row.site,
        label: SITE_LABELS_TH[row.site] ?? row.site,
        valueCm: row.valueCm,
        source: row.source,
        date: row.date.toISOString().slice(0, 10),
      },
      replaced: !!existing,
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-measurement] POST", e);
    return NextResponse.json({ error: "บันทึกค่าที่วัดไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const rawSite = String(sp.get("site") ?? "").trim().toLowerCase();
    const site = (MEASUREMENT_SITES as readonly string[]).includes(rawSite) ? rawSite : null;
    const rawLimit = Number(sp.get("limit"));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.round(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;

    const rows = await prisma.bodyMeasurement.findMany({
      where: { memberId: member.id, ...(site ? { site } : {}) },
      orderBy: { date: "desc" },
      take: limit,
      select: { id: true, site: true, valueCm: true, source: true, date: true },
    });

    /** ค่าล่าสุดต่อจุด — จอ Body Progress อยากได้แค่นี้ ไม่ต้องไล่ทั้งรายการเอง */
    const latest: Record<string, { valueCm: number; date: string; source: string }> = {};
    for (const r of rows) {
      if (latest[r.site]) continue; // rows เรียงใหม่→เก่าแล้ว
      latest[r.site] = { valueCm: r.valueCm, date: r.date.toISOString().slice(0, 10), source: r.source };
    }

    const res = NextResponse.json({
      measurements: rows.map((r) => ({
        id: r.id,
        site: r.site,
        label: SITE_LABELS_TH[r.site] ?? r.site,
        valueCm: r.valueCm,
        source: r.source,
        date: r.date.toISOString().slice(0, 10),
      })),
      latest,
      sites: MEASUREMENT_SITES.map((s) => ({ key: s, label: SITE_LABELS_TH[s] })),
    });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (e: unknown) {
    console.error("[coach/body-measurement] GET", e);
    return NextResponse.json({ error: "ดึงค่าที่วัดไม่สำเร็จ ลองอีกครั้งนะ" }, { status: 500 });
  }
}
