/**
 * แปลงแผนที่เก็บใน DB ให้เป็นรูปแบบที่แอปใช้วาดหน้าสรุปได้เลย
 * จัดกลุ่มเป็น "รายวัน" + รวมโภชนาการต่อวัน (แอปไม่ต้องคำนวณเอง = ตัวเลขตรงกันแน่นอน)
 */
import { MAIN_SLOTS } from "@/lib/goodfoodMealPicker";
// 🔴 รูปใน DB เก็บเป็น path สั้น (/uploads/...) แอปเรนเดอร์ตรง ๆ ไม่ได้
//    เคยพลาดมาแล้วกับรูปปกบทความ (6 ส.ค.) — ต้องแปลงเป็น URL เต็มทุกทางออก
import { absoluteImageUrl } from "@/lib/articleFeed";

/** ลำดับแสดงผลของมื้อ — ต้องเรียงตามเวลาจริงของวัน ไม่ใช่ลำดับที่บันทึกลง DB */
const SLOT_ORDER = ["เช้า", "ว่าง", "กลางวัน", "เย็น"];
const slotRank = (s: string) => {
  const i = SLOT_ORDER.indexOf(s);
  return i < 0 ? 99 : i;
};

export type DesignItemRow = {
  id: string;
  dayNumber: number;
  slot: string;
  foodId: string;
  foodName: string;
  imageUrl: string | null;
  price: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
  swapCount: number;
};

export type DesignRow = {
  id: string;
  days: number;
  status: string;
  targetKcal: number;
  totalPrice: number;
  offTargetDays: number;
  orderId: string | null;
  createdAt: Date;
  items: DesignItemRow[];
};

export function serializeDesign(d: DesignRow) {
  const byDay = new Map<number, DesignItemRow[]>();
  for (const it of d.items) {
    byDay.set(it.dayNumber, [...(byDay.get(it.dayNumber) ?? []), it]);
  }

  const dayRows = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, items]) => {
      const sorted = [...items].sort((a, b) => slotRank(a.slot) - slotRank(b.slot));
      const sum = (pick: (i: DesignItemRow) => number) => Math.round(sorted.reduce((a, i) => a + pick(i), 0));
      return {
        dayNumber,
        meals: sorted.map((i) => ({
          id: i.id, slot: i.slot, foodId: i.foodId, name: i.foodName,
          imageUrl: absoluteImageUrl(i.imageUrl), price: i.price, servings: i.servings,
          kcal: Math.round(i.calories), protein: Math.round(i.protein),
          carbs: Math.round(i.carbs), fat: Math.round(i.fat),
          sodium: i.sodium == null ? null : Math.round(i.sodium),
          sugar: i.sugar == null ? null : Math.round(i.sugar),
          swapCount: i.swapCount,
        })),
        total: {
          kcal: sum((i) => i.calories), protein: sum((i) => i.protein),
          carbs: sum((i) => i.carbs), fat: sum((i) => i.fat),
          sodium: sum((i) => i.sodium ?? 0), sugar: sum((i) => i.sugar ?? 0),
          price: sum((i) => i.price),
        },
      };
    });

  const kcals = dayRows.map((x) => x.total.kcal);
  return {
    id: d.id,
    days: d.days,
    status: d.status,
    targetKcal: d.targetKcal,
    totalPrice: Math.round(d.totalPrice),
    offTargetDays: d.offTargetDays,
    orderId: d.orderId,
    createdAt: d.createdAt,
    mainSlots: MAIN_SLOTS,
    summary: {
      dayCount: dayRows.length,
      avgKcal: kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : 0,
      minKcal: kcals.length ? Math.min(...kcals) : 0,
      maxKcal: kcals.length ? Math.max(...kcals) : 0,
      avgPerDayPrice: dayRows.length ? Math.round(d.totalPrice / dayRows.length) : 0,
      /** เมนูที่ไม่ซ้ำกันทั้งแผน — ยิ่งน้อยแปลว่ายิ่งเจอเมนูเดิมบ่อย */
      uniqueFoods: new Set(d.items.map((i) => i.foodId)).size,
    },
    dayPlans: dayRows,
  };
}
