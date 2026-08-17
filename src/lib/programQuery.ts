/**
 * คำถามเดียวที่หลังบ้านถามบ่อยที่สุด: "วันนี้ต้องทำอาหารให้ใครบ้าง คนละเท่าไร"
 *
 * ทั้งหน้ารายชื่อ (มุมนักโภชนาการ) และใบแพ็ค (มุมครัว) ใช้ฟังก์ชันนี้ตัวเดียวกัน
 * — ตัวเลขจะได้ไม่มีทางขัดกันเองระหว่างสองหน้า
 */
import { prisma } from "@/lib/prisma";
import {
  MealTarget,
  Portion,
  PROGRAM_SLOTS,
  dailyTarget,
  dayKey,
  enrollmentDays,
  mealTargets,
  portionFor,
  trackLabel,
} from "@/lib/program";
import { absoluteImageUrl } from "@/lib/articleFeed";

export interface ServedMeal {
  slot: string;
  target: MealTarget;
  food: {
    id: string;
    name: string;
    image: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sodium: number | null;
    sugar: number | null;
  } | null;
  /** วิธีตัก — null เมื่อยังไม่มีเมนูในปฏิทินช่องนั้น */
  portion: Portion | null;
  note: string | null;
}

export interface ServedMember {
  enrollmentId: string;
  memberId: string;
  name: string;
  phone: string | null;
  track: string;
  trackLabel: string;
  /** วันที่เท่าไรของคอร์ส (นับเฉพาะวันที่ได้รับจริง) */
  dayNumber: number;
  totalDays: number;
  /** วันนี้ขอหยุด — ยังอยู่ในรายชื่อเพื่อให้ครัวเห็นว่า "ไม่ต้องทำ" ไม่ใช่หายไปเงียบ ๆ */
  skipped: boolean;
  address: string | null;
  deliveryNote: string | null;
  daily: ReturnType<typeof dailyTarget>;
  meals: ServedMeal[];
}

/**
 * ใครได้รับอาหารในวันที่กำหนด + ต้องการสารอาหารเท่าไรต่อมื้อ + ตักยังไง
 *
 * 🔴 เลือก enrollment ด้วย startDate <= date <= endDate แล้วค่อยเช็ค dayNumber อีกที
 *    เพราะ endDate เลื่อนออกทุกครั้งที่ข้ามวัน — ใช้ startDate + totalDays คำนวณตรง ๆ ไม่ได้
 */
export async function membersServedOn(date: Date): Promise<ServedMember[]> {
  const enrollments = await prisma.programEnrollment.findMany({
    where: { status: "active", startDate: { lte: date }, endDate: { gte: date } },
    include: {
      member: {
        select: {
          id: true, name: true, displayName: true, phone: true,
          dailyCalories: true, dailyProtein: true, dailyCarbs: true, dailyFat: true,
          dailyFiber: true, dailySodium: true, dailySugar: true,
        },
      },
      address: { select: { address: true, subDistrict: true, district: true, province: true, postalCode: true } },
      skips: { select: { date: true } },
    },
  });
  if (enrollments.length === 0) return [];

  const tracks = [...new Set(enrollments.map((e) => e.track))];
  const menu = await prisma.menuCalendarItem.findMany({
    where: { date, track: { in: tracks } },
    include: {
      food: {
        select: {
          id: true, name: true, imageUrl: true,
          calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true,
        },
      },
    },
  });
  const menuAt = new Map(menu.map((m) => [`${m.track}|${m.slot}`, m]));

  const key = dayKey(date);
  const out: ServedMember[] = [];

  for (const e of enrollments) {
    const skipKeys = new Set(e.skips.map((s) => dayKey(s.date)));
    const days = enrollmentDays(e, skipKeys);
    const hit = days.find((d) => dayKey(d.date) === key);

    // ไม่อยู่ในวันส่งจริง (เลยคอร์สไปแล้วเพราะเคยข้าม) และไม่ได้ขอหยุดวันนี้ → ไม่เกี่ยว
    const skipped = skipKeys.has(key);
    if (!hit && !skipped) continue;

    const targets = mealTargets(e.member, e.slots);
    const meals: ServedMeal[] = targets.map((t) => {
      const cell = menuAt.get(`${e.track}|${t.slot}`);
      const food = cell?.food ?? null;
      return {
        slot: t.slot,
        target: t,
        food: food
          ? {
              id: food.id,
              name: food.name,
              image: absoluteImageUrl(food.imageUrl),
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
              sodium: food.sodium,
              sugar: food.sugar,
            }
          : null,
        portion: food ? portionFor(t, { calories: food.calories, protein: food.protein }) : null,
        note: cell?.note ?? null,
      };
    });

    const a = e.address;
    out.push({
      enrollmentId: e.id,
      memberId: e.member.id,
      name: e.member.name || e.member.displayName || "(ไม่มีชื่อ)",
      phone: e.member.phone,
      track: e.track,
      trackLabel: trackLabel(e.track),
      dayNumber: hit?.dayNumber ?? 0,
      totalDays: e.totalDays,
      skipped,
      address: a ? [a.address, a.subDistrict, a.district, a.province, a.postalCode].filter(Boolean).join(" ") : null,
      deliveryNote: e.deliveryNote,
      daily: dailyTarget(e.member),
      meals,
    });
  }

  return out.sort((a, b) => a.trackLabel.localeCompare(b.trackLabel, "th") || a.name.localeCompare(b.name, "th"));
}

// ─────────────────────────── มุมครัว ───────────────────────────

export interface PackingLine {
  /** รวมกล่องที่ตักเหมือนกันไว้ด้วยกัน — คนแพ็คตักทีละหม้อ ไม่ได้ไล่อ่านทีละคน */
  portionLabel: string;
  note: string;
  /** เมนูนี้ตักยังไงก็ไม่ถึงเป้าของคนกลุ่มนี้ — ต้องเห็นบนใบแพ็ค ไม่ใช่ซ่อนไว้ */
  warn: string | null;
  count: number;
  members: string[];
}

export interface PackingDish {
  track: string;
  trackLabel: string;
  foodId: string | null;
  foodName: string;
  image: string | null;
  total: number;
  lines: PackingLine[];
}

export interface PackingSlot {
  slot: string;
  total: number;
  dishes: PackingDish[];
}

/** จัดข้อมูลคนเดิมใหม่ให้เป็น "มื้อ → สาย → จาน → วิธีตัก" ซึ่งคือลำดับที่ครัวทำงานจริง */
export function toPackingList(members: ServedMember[]): PackingSlot[] {
  const bySlot = new Map<string, Map<string, PackingDish>>();

  for (const m of members) {
    if (m.skipped) continue; // ขอหยุด = ไม่ต้องทำ
    for (const meal of m.meals) {
      if (!bySlot.has(meal.slot)) bySlot.set(meal.slot, new Map());
      const dishes = bySlot.get(meal.slot)!;
      const dishKey = `${m.track}|${meal.food?.id ?? "none"}`;

      if (!dishes.has(dishKey)) {
        dishes.set(dishKey, {
          track: m.track,
          trackLabel: m.trackLabel,
          foodId: meal.food?.id ?? null,
          foodName: meal.food?.name ?? "⚠️ ยังไม่ได้ใส่เมนูในปฏิทิน",
          image: meal.food?.image ?? null,
          total: 0,
          lines: [],
        });
      }
      const dish = dishes.get(dishKey)!;
      dish.total++;

      const label = meal.portion?.label ?? "-";
      const note = meal.portion?.note ?? "";
      const warn = meal.portion?.off?.message ?? null;
      let line = dish.lines.find((l) => l.portionLabel === label && l.note === note && l.warn === warn);
      if (!line) {
        line = { portionLabel: label, note, warn, count: 0, members: [] };
        dish.lines.push(line);
      }
      line.count++;
      line.members.push(m.name);
    }
  }

  return PROGRAM_SLOTS.filter((s) => bySlot.has(s)).map((slot) => {
    const dishes = [...bySlot.get(slot)!.values()].sort((a, b) => b.total - a.total);
    for (const d of dishes) d.lines.sort((a, b) => b.count - a.count);
    return { slot, total: dishes.reduce((n, d) => n + d.total, 0), dishes };
  });
}
