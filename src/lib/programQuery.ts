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
import { PersonalPlan, PrepLine, personalize, prepTotals, rowsToLines } from "@/lib/recipe";

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
  /**
   * วิธีตัก — null เมื่อยังไม่มีเมนูในปฏิทินช่องนั้น
   * 🔴 ยังเก็บไว้เป็นทางถอย: เมนูที่ครัวยังไม่ได้ลงสูตร จะมีแค่ S/M/L/XL แบบเดิม
   *    ตัดทิ้งเลยไม่ได้ ไม่งั้นวันที่เปลี่ยนระบบครัวจะไม่มีอะไรอ่านเลย
   */
  portion: Portion | null;
  /** ปริมาณรายวัตถุดิบของคนนี้ — null = เมนูนี้ยังไม่มีสูตร (ให้ใช้ portion แทน) */
  plan: PersonalPlan | null;
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
  address: string | null;
  deliveryNote: string | null;
  daily: ReturnType<typeof dailyTarget>;
  meals: ServedMeal[];
}

/** ใครได้รับอาหารในวันที่กำหนด + ต้องการสารอาหารเท่าไรต่อมื้อ + ตักยังไง */
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
          recipe: { include: { ingredient: true }, orderBy: { order: "asc" } },
        },
      },
    },
  });
  const menuAt = new Map(menu.map((m) => [`${m.track}|${m.slot}`, m]));

  const key = dayKey(date);
  const out: ServedMember[] = [];

  for (const e of enrollments) {
    const hit = enrollmentDays(e).find((d) => dayKey(d.date) === key);
    if (!hit) continue;

    const targets = mealTargets(e.member, e.slots);
    const meals: ServedMeal[] = targets.map((t) => {
      const cell = menuAt.get(`${e.track}|${t.slot}`);
      const food = cell?.food ?? null;
      const lines = food?.recipe?.length ? rowsToLines(food.recipe) : [];
      return {
        slot: t.slot,
        target: t,
        plan:
          lines.length > 0
            ? personalize(lines, { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, fiber: t.fiber })
            : null,
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
      dayNumber: hit.dayNumber,
      totalDays: e.totalDays,
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

// ─────────────────────────── เมนูครัว (รายวัตถุดิบ) ───────────────────────────

export interface KitchenBox {
  memberName: string;
  /** 🔴 ต้องติดไปกับทุกกล่อง — คนแพ็คมองใบเดียวจบ ไม่ต้องเปิดอีกหน้า */
  allergies: string[];
  /** ปริมาณของคนนี้ เรียงตามลำดับในสูตร */
  lines: PersonalPlan["lines"];
  delivered: PersonalPlan["delivered"];
  target: { kcal: number; protein: number };
  warnings: string[];
}

export interface KitchenDish {
  track: string;
  trackLabel: string;
  foodId: string | null;
  foodName: string;
  /** true = เมนูนี้ยังไม่มีสูตร → ครัวจะเห็นแบบ S/M/L/XL เดิมแทน */
  noRecipe: boolean;
  boxes: KitchenBox[];
  /** วัตถุดิบทั้งหมดที่จานนี้ใช้ เรียงตามสูตร — ใช้เป็นหัวตาราง */
  ingredients: { id: string; name: string; unit: string }[];
  /** ต้องเตรียมรวมกี่กรัม ต่อวัตถุดิบ */
  prep: PrepLine[];
}

export interface KitchenSlot {
  slot: string;
  boxes: number;
  dishes: KitchenDish[];
}

/**
 * "มื้อ → จาน → ตารางวัตถุดิบ × ลูกค้า" + แถวรวมของที่ต้องเตรียม
 *
 * ทำไมต้องมีแถวรวม: ครัวซื้อของเป็นกิโล ไม่ได้ซื้อเป็นกล่อง
 * ถ้าไม่รวมให้ คนครัวต้องนั่งบวกเลขเองตอนตี 5 ซึ่งเป็นจุดที่ผิดพลาดง่ายที่สุด
 */
export function toKitchenSheet(members: ServedMember[], allergiesOf: Map<string, string[]>): KitchenSlot[] {
  const bySlot = new Map<string, Map<string, KitchenDish>>();

  for (const m of members) {
    for (const meal of m.meals) {
      if (!bySlot.has(meal.slot)) bySlot.set(meal.slot, new Map());
      const dishes = bySlot.get(meal.slot)!;
      const key = `${m.track}|${meal.food?.id ?? "none"}`;

      if (!dishes.has(key)) {
        dishes.set(key, {
          track: m.track,
          trackLabel: m.trackLabel,
          foodId: meal.food?.id ?? null,
          foodName: meal.food?.name ?? "⚠️ ยังไม่ได้ใส่เมนูในปฏิทิน",
          noRecipe: !!meal.food && !meal.plan,
          boxes: [],
          ingredients: [],
          prep: [],
        });
      }
      const dish = dishes.get(key)!;

      if (meal.plan) {
        dish.boxes.push({
          memberName: m.name,
          allergies: allergiesOf.get(m.memberId) ?? [],
          lines: meal.plan.lines,
          delivered: meal.plan.delivered,
          target: { kcal: meal.target.kcal, protein: meal.target.protein },
          warnings: meal.plan.warnings,
        });
        // หัวตาราง = ลำดับวัตถุดิบตามสูตร (กล่องแรกที่เจอเป็นตัวกำหนด — ทุกกล่องของจานเดียวกันใช้สูตรเดียวกัน)
        if (dish.ingredients.length === 0) {
          dish.ingredients = meal.plan.lines.map((l) => ({ id: l.ingredientId, name: l.name, unit: l.unit }));
        }
      } else {
        dish.boxes.push({
          memberName: m.name,
          allergies: allergiesOf.get(m.memberId) ?? [],
          lines: [],
          delivered: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 },
          target: { kcal: meal.target.kcal, protein: meal.target.protein },
          warnings: meal.food ? ["ยังไม่ได้ลงสูตรของเมนูนี้ — ดูวิธีตักแบบเดิมในแท็บใบแพ็ค"] : [],
        });
      }
    }
  }

  return PROGRAM_SLOTS.filter((s) => bySlot.has(s)).map((slot) => {
    const dishes = [...bySlot.get(slot)!.values()].sort((a, b) => b.boxes.length - a.boxes.length);
    for (const d of dishes) {
      d.prep = prepTotals(
        d.boxes
          .filter((b) => b.lines.length > 0)
          .map((b) => ({ lines: b.lines, delivered: b.delivered, target: { kcal: 0, protein: 0 }, gap: { kcal: 0, protein: 0 }, warnings: [] })),
      );
    }
    return { slot, boxes: dishes.reduce((n, d) => n + d.boxes.length, 0), dishes };
  });
}

/** จัดข้อมูลคนเดิมใหม่ให้เป็น "มื้อ → สาย → จาน → วิธีตัก" ซึ่งคือลำดับที่ครัวทำงานจริง */
export function toPackingList(members: ServedMember[]): PackingSlot[] {
  const bySlot = new Map<string, Map<string, PackingDish>>();

  for (const m of members) {
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
