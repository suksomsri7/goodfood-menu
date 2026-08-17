import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { addDays, dayKey, daysBetween, thaiDate } from "@/lib/program";

export const dynamic = "force-dynamic";

/**
 * ทำซ้ำช่วงวันที่ — เครื่องมือที่ทำให้ "เติมรันเวย์" ใช้เวลา 5 วินาทีแทน 20 นาที
 * เมนูปิ่นโตหมุน 3-4 สัปดาห์อยู่แล้ว การก๊อปสัปดาห์เก่ามาแก้บางวันคือวิธีทำงานจริง
 *
 * POST { from, to, days, overwrite? }
 *   from = วันแรกของช่วงต้นฉบับ · to = วันแรกของช่วงปลายทาง
 *   overwrite=false (ค่าเริ่มต้น) จะไม่ทับช่องที่กรอกไว้แล้ว — กันเผลอลบงานที่ทำไปแล้ว
 */

function parseDay(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = await req.json().catch(() => null);
  const from = parseDay(body?.from);
  const to = parseDay(body?.to);
  const days = Math.min(Math.max(Number(body?.days) || 7, 1), 31);
  const overwrite = body?.overwrite === true;

  if (!from || !to) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });

  // กันช่วงต้นทาง/ปลายทางทับกันเอง — จะได้ผลลัพธ์ที่คาดเดาไม่ได้
  const shift = daysBetween(to, from);
  if (Math.abs(shift) < days) {
    return NextResponse.json({ error: "ช่วงต้นฉบับกับปลายทางซ้อนกัน — เลือกวันที่ห่างกันอย่างน้อย 1 สัปดาห์" }, { status: 400 });
  }

  const source = await prisma.menuCalendarItem.findMany({
    where: { date: { gte: from, lt: addDays(from, days) } },
    select: { date: true, track: true, slot: true, foodId: true, note: true },
  });
  if (source.length === 0) {
    return NextResponse.json({ error: `ช่วง ${thaiDate(from)} ยังไม่มีเมนูให้ทำซ้ำ` }, { status: 400 });
  }

  const targetStart = to;
  const existing = await prisma.menuCalendarItem.findMany({
    where: { date: { gte: targetStart, lt: addDays(targetStart, days) } },
    select: { date: true, track: true, slot: true },
  });
  const taken = new Set(existing.map((e) => `${dayKey(e.date)}|${e.track}|${e.slot}`));

  let copied = 0;
  let skipped = 0;

  for (const s of source) {
    const date = addDays(s.date, shift);
    const key = `${dayKey(date)}|${s.track}|${s.slot}`;
    if (taken.has(key) && !overwrite) {
      skipped++;
      continue;
    }
    await prisma.menuCalendarItem.upsert({
      where: { date_track_slot: { date, track: s.track, slot: s.slot } },
      create: { date, track: s.track, slot: s.slot, foodId: s.foodId, note: s.note },
      update: { foodId: s.foodId, note: s.note },
    });
    copied++;
  }

  return NextResponse.json({
    ok: true,
    copied,
    skipped,
    message: skipped
      ? `ทำซ้ำ ${copied} มื้อ · ข้าม ${skipped} มื้อที่กรอกไว้แล้ว`
      : `ทำซ้ำ ${copied} มื้อ`,
  });
}
