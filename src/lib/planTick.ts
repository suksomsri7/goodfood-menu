/**
 * ติ๊กแผนรายวัน — ตรรกะที่ PATCH /api/plan/[id] (ติ๊กมือ) กับ POST /api/coach/sets (Workout Player) ใช้ร่วมกัน
 *
 * 🔴 ห้าม copy ไปไว้สองที่: ถ้าเงื่อนไข "ครบทุกท่า = exerciseDone" หรือกติกา status ต่างกันแม้นิดเดียว
 *    ผู้ใช้จะเห็นแผนวันเดียวกันสถานะไม่ตรงกันขึ้นกับว่าติ๊กจากจอไหน
 *
 * ทุกฟังก์ชันในไฟล์นี้เป็นคณิต/ตรรกะล้วน (ไม่แตะ DB)
 */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface PlanExerciseItem {
  key?: string;
  name: string;
  sets?: number;
  reps?: number;
  minutes?: number;
}

/**
 * ขอบเขต "วันของแผน" — plan.date = UTC midnight ของวัน BKK → วันจริงใน UTC = [−7h, +17h)
 * ใช้ทั้งตอนหาบันทึกเดิมของวันนั้นและตอนบีบเวลาที่แอปส่งมาให้อยู่ในวันของแผน
 */
export function planDayWindow(planDate: Date): { dayStart: Date; dayEnd: Date } {
  return {
    dayStart: new Date(planDate.getTime() - 7 * 3600 * 1000),
    dayEnd: new Date(planDate.getTime() + 17 * 3600 * 1000),
  };
}

/** ขอบเขตวัน BKK ของเวลาหนึ่ง ๆ — ใช้ตอนเล่นนอกแผน (ไม่มี plan.date ให้ยึด) */
export function bkkDayWindow(instant: Date): { dayStart: Date; dayEnd: Date } {
  const bkk = new Date(instant.getTime() + BKK_OFFSET_MS);
  const key = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate(), 0, 0, 0, 0));
  return planDayWindow(key);
}

/** รวมค่าติ๊กใหม่ทับของเดิม (patch ไม่ใช่ object = ไม่ได้ส่งมา → คงของเดิม) */
export function mergeExerciseItemsDone(
  prev: Record<string, boolean> | null,
  patch: unknown
): Record<string, boolean> | null {
  if (patch && typeof patch === "object") return { ...(prev ?? {}), ...(patch as Record<string, boolean>) };
  return prev;
}

/**
 * exerciseDone หลังติ๊ก: ถ้ามีการติ๊กรายท่าและแผนมีรายท่าอยู่ → ครบทุกท่าเท่านั้นถึงจะจบ
 * ไม่มีรายท่า (ทาง LIFF เดิม) → ใช้ค่าที่ผู้เรียกส่งมาตรง ๆ
 */
export function deriveExerciseDone(opts: {
  items: PlanExerciseItem[];
  itemsDone: Record<string, boolean> | null;
  itemsPatched: boolean;
  explicit?: unknown;
  current: boolean;
}): boolean {
  let next = typeof opts.explicit === "boolean" ? opts.explicit : opts.current;
  if (opts.itemsPatched && opts.items.length > 0) {
    next = opts.items.every((it) => (opts.itemsDone ?? {})[it.name]);
  }
  return next;
}

/** สถานะแผน: ครบทั้งออกกำลังกาย+ทุกมื้อ = done · ทำอะไรไปบ้าง = partial · ยังไม่แตะ = planned */
export function derivePlanStatus(
  exerciseDone: boolean,
  mealsDone: Record<string, boolean> | null,
  totalMeals: number
): "planned" | "partial" | "done" {
  const doneMeals = mealsDone ? Object.values(mealsDone).filter(Boolean).length : 0;
  const allMealsDone = totalMeals > 0 && doneMeals >= totalMeals;
  if (exerciseDone && allMealsDone) return "done";
  if (exerciseDone || doneMeals > 0) return "partial";
  return "planned";
}

/**
 * หาท่าในแผนที่ตรงกับที่เพิ่งเล่นจบ — เทียบ key ก่อน (ชื่อในแผนเปลี่ยนได้) แล้วค่อยเทียบชื่อ
 * ไม่เจอ = เล่นท่านอกแผน (คืน null → ไม่ติ๊กอะไร ไม่ใช่ error)
 */
export function findPlanItem(
  items: PlanExerciseItem[],
  exerciseKey: string,
  exerciseName: string
): PlanExerciseItem | null {
  const byKey = items.find((it) => it.key && it.key === exerciseKey);
  if (byKey) return byKey;
  const name = (exerciseName || "").trim();
  return name ? items.find((it) => it.name === name) ?? null : null;
}
