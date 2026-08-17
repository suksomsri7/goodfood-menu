import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import {
  PROGRAM_SLOTS,
  RUNWAY_DAYS,
  TRACKS,
  TRACK_KEYS,
  addDays,
  bkkDay,
  dayKey,
  isTrack,
  missingSlots,
  runwayEnd,
  thaiDate,
  trackConflicts,
} from "@/lib/program";
import { absoluteImageUrl } from "@/lib/articleFeed";

export const dynamic = "force-dynamic";

/**
 * ปฏิทินเมนู — งานหลักของ admin คือ "เติมรันเวย์ให้เต็มเสมอ"
 *
 * GET ?from=YYYY-MM-DD&days=7  → ตาราง วัน × สาย × มื้อ + สถานะรันเวย์
 * PUT                          → ใส่/ลบเมนู 1 ช่อง
 *
 * 🔴 ห้ามขายคอร์สถ้ารันเวย์ไม่เต็ม — ลูกค้าจะจ่ายเงินแล้วไม่มีเมนูให้กิน
 *    ตัวเลข runway ในนี้คือแหล่งความจริงเดียวที่ทั้ง admin และ API สมัครใช้ร่วมกัน
 */

function parseDay(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const { searchParams } = new URL(req.url);
  const from = parseDay(searchParams.get("from")) ?? bkkDay();
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 7, 1), 31);

  const [items, foods] = await Promise.all([
    prisma.menuCalendarItem.findMany({
      where: { date: { gte: from, lt: addDays(from, days) } },
      include: {
        food: {
          select: {
            id: true, name: true, imageUrl: true, price: true, ingredients: true,
            calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true,
          },
        },
      },
    }),
    prisma.food.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, imageUrl: true, price: true, ingredients: true,
        calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true,
        category: { select: { slug: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  /*
   * รันเวย์นับจาก "พรุ่งนี้" เสมอ ไม่ใช่จากวันที่กำลังเปิดดู
   *   - ไม่นับจากวันที่เปิดดู เพราะเลื่อนไปดูอนาคตแล้วจะได้ไฟเขียวหลอกตา
   *   - ไม่นับจากวันนี้ เพราะคอร์สเริ่มได้เร็วสุดพรุ่งนี้ (ครัวเตรียมของล่วงหน้า)
   *     ถ้านับวันนี้ด้วย แถบจะขึ้นแดงตลอดกาลจากช่องที่ไม่มีทางขายได้แล้ว
   */
  const anchor = addDays(bkkDay(), 1);
  const horizon = await prisma.menuCalendarItem.findMany({
    where: { date: { gte: anchor, lt: addDays(anchor, 120) } },
    select: { date: true, track: true, slot: true },
  });
  const runway = runwayEnd(horizon, anchor);
  const gaps = missingSlots(horizon, anchor, RUNWAY_DAYS);

  const cells = items.map((it) => ({
    id: it.id,
    date: dayKey(it.date),
    track: it.track,
    slot: it.slot,
    note: it.note,
    food: {
      id: it.food.id,
      name: it.food.name,
      image: absoluteImageUrl(it.food.imageUrl),
      price: it.food.price,
      calories: it.food.calories,
      protein: it.food.protein,
      carbs: it.food.carbs,
      fat: it.food.fat,
      fiber: it.food.fiber,
      sodium: it.food.sodium,
      sugar: it.food.sugar,
    },
    /** เตือนเมื่อเมนูขัดกับสายที่วางไว้ — เตือนอย่างเดียว ไม่บล็อก คนตัดสินคือ admin */
    conflicts: trackConflicts(it.track, { name: it.food.name, ingredients: it.food.ingredients }),
  }));

  return NextResponse.json({
    from: dayKey(from),
    days: Array.from({ length: days }, (_, i) => {
      const d = addDays(from, i);
      return { date: dayKey(d), label: thaiDate(d) };
    }),
    tracks: TRACKS.map((t) => ({ key: t.key, label: t.label })),
    slots: PROGRAM_SLOTS,
    cells,
    runway: {
      days: runway.days,
      lastFullDate: runway.lastFullDate ? dayKey(runway.lastFullDate) : null,
      lastFullLabel: runway.lastFullDate ? thaiDate(runway.lastFullDate) : null,
      required: RUNWAY_DAYS,
      ok: runway.days >= RUNWAY_DAYS,
      missing: gaps.map((g) => ({ date: dayKey(g.date), track: g.track, slot: g.slot })),
    },
    foods: foods.map((f) => ({
      id: f.id,
      name: f.name,
      image: absoluteImageUrl(f.imageUrl),
      price: f.price,
      category: f.category?.slug ?? null,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      fiber: f.fiber,
      sodium: f.sodium,
      sugar: f.sugar,
      /** สายที่เมนูนี้ใช้ได้ — ให้ admin กรองได้ทันทีว่าสายมังสวิรัติเหลืออะไรบ้าง */
      tracks: TRACK_KEYS.filter((t) => trackConflicts(t, { name: f.name, ingredients: f.ingredients }).length === 0),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "payload ไม่ถูกต้อง" }, { status: 400 });

  const date = parseDay(body.date);
  const { track, slot, foodId } = body as { track?: string; slot?: string; foodId?: string | null };

  if (!date) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  if (!isTrack(track)) return NextResponse.json({ error: "สายอาหารไม่ถูกต้อง" }, { status: 400 });
  if (!slot || !PROGRAM_SLOTS.includes(slot as never)) {
    return NextResponse.json({ error: "มื้อไม่ถูกต้อง" }, { status: 400 });
  }

  // ลบเมนูออกจากช่อง
  if (!foodId) {
    await prisma.menuCalendarItem.deleteMany({ where: { date, track, slot } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const food = await prisma.food.findUnique({
    where: { id: foodId },
    select: { id: true, name: true, ingredients: true, isActive: true },
  });
  if (!food) return NextResponse.json({ error: "ไม่พบเมนูนี้" }, { status: 404 });
  if (!food.isActive) return NextResponse.json({ error: "เมนูนี้ถูกปิดใช้งานอยู่" }, { status: 400 });

  const item = await prisma.menuCalendarItem.upsert({
    where: { date_track_slot: { date, track, slot } },
    create: { date, track, slot, foodId: food.id, note: body.note ?? null },
    update: { foodId: food.id, note: body.note ?? null },
  });

  return NextResponse.json({
    ok: true,
    id: item.id,
    conflicts: trackConflicts(track, { name: food.name, ingredients: food.ingredients }),
  });
}
