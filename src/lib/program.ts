/**
 * โปรแกรมปิ่นโต — ตรรกะกลางที่ทั้งหลังบ้านและแอปใช้ร่วมกัน
 *
 * 🔑 หลักคิด: เมนูผูกกับ "วันที่" ไม่ใช่ผูกกับ "ลูกค้า"
 *    ครัวทำวันละชุดเดียว · ลูกค้าสมัครวันไหนก็ได้ · คอร์สคือหน้าต่างที่เลื่อนบนปฏิทิน
 */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

// ─────────────────────────── วันที่ (โซนเวลาไทย) ───────────────────────────

/** วันที่ไทยของ instant นั้น เก็บเป็น UTC midnight — ตรงกับที่คอลัมน์ @db.Date คาดหวัง */
export function bkkDay(d: Date = new Date()): Date {
  const bkk = new Date(d.getTime() + BKK_OFFSET_MS);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));
}

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** ผลต่างเป็นจำนวนวันเต็ม (a - b) */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

const THAI_DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "ศุกร์ 22 ส.ค." — ใช้ทั้งใบแพ็คของครัวและหน้าแอป */
export function thaiDate(d: Date, withDow = true): string {
  const s = `${d.getUTCDate()} ${THAI_MONTH[d.getUTCMonth()]}`;
  return withDow ? `${THAI_DOW[d.getUTCDay()]} ${s}` : s;
}

// ─────────────────────────── สายอาหาร ───────────────────────────

export type TrackKey = "standard" | "no_seafood" | "no_meat" | "vegetarian";

export interface Track {
  key: TrackKey;
  label: string;
  /** คีย์เวิร์ดที่ห้ามมีในชื่อ/ส่วนผสมของเมนูในสายนี้ */
  forbid: string[];
}

/**
 * 🔴 เรียงจากกว้างไปแคบ — สายท้ายสุดเลือกเมนูได้น้อยที่สุด
 *    "ไม่ทานเนื้อ" ในที่นี้ = ไม่กินเนื้อสัตว์บก (ปลา/ทะเลยังกินได้)
 *    "มังสวิรัติ" = ไม่กินเนื้อสัตว์ทุกชนิด แต่ไข่/นมได้
 */
export const TRACKS: Track[] = [
  { key: "standard", label: "มาตรฐาน", forbid: [] },
  { key: "no_seafood", label: "ไม่มีอาหารทะเล", forbid: ["กุ้ง", "ปลาหมึก", "หอย", "ปู", "ทะเล", "แซลมอน", "ทูน่า", "ปลา"] },
  { key: "no_meat", label: "ไม่ทานเนื้อ", forbid: ["หมู", "ไก่", "เนื้อ", "เบคอน", "ไส้กรอก"] },
  {
    key: "vegetarian",
    label: "มังสวิรัติ",
    forbid: ["กุ้ง", "ปลาหมึก", "หอย", "ปู", "ทะเล", "แซลมอน", "ทูน่า", "ปลา", "หมู", "ไก่", "เนื้อ", "เบคอน", "ไส้กรอก"],
  },
];

export const TRACK_KEYS = TRACKS.map((t) => t.key);
export const trackLabel = (key: string): string => TRACKS.find((t) => t.key === key)?.label ?? key;
export const isTrack = (v: unknown): v is TrackKey => typeof v === "string" && TRACK_KEYS.includes(v as TrackKey);

/**
 * เมนูนี้ขัดกับสายนี้ไหม — คืนคีย์เวิร์ดที่ชนเพื่อบอก admin ได้ตรง ๆ ว่าชนเพราะอะไร
 * ⚠️ เป็นแค่ "ตัวเตือน" ไม่ใช่ตัวบล็อก — ชื่อเมนูภาษาไทยกำกวมได้ (เช่น "ปลาท่องโก๋" ไม่ใช่ปลา)
 *    คนตัดสินใจสุดท้ายคือ admin เสมอ
 */
export function trackConflicts(track: string, food: { name: string; ingredients?: string[] }): string[] {
  const def = TRACKS.find((t) => t.key === track);
  if (!def || def.forbid.length === 0) return [];
  const blob = `${food.name} ${(food.ingredients ?? []).join(" ")}`;
  return def.forbid.filter((kw) => blob.includes(kw));
}

// ─────────────────────────── มื้ออาหาร ───────────────────────────

export const PROGRAM_SLOTS = ["เช้า", "กลางวัน", "ว่าง", "เย็น"] as const;
export type ProgramSlot = (typeof PROGRAM_SLOTS)[number];

/**
 * มื้อที่ขายจริงในคอร์สมาตรฐาน — ใช้เป็นเกณฑ์ว่า "ปฏิทินเต็มหรือยัง"
 * 🔴 ต้องไม่รวมมื้อว่าง ไม่งั้นแถบรันเวย์จะขึ้นแดงตลอดทั้งที่ขายได้ปกติ
 *    (มื้อว่างเป็นตัวเลือกเสริม admin กรอกหรือไม่กรอกก็ได้)
 */
export const SOLD_SLOTS = ["เช้า", "กลางวัน", "เย็น"] as const;

/**
 * สัดส่วนพลังงานต่อวันของแต่ละมื้อ — ตรงกับ SLOT_RATIO ใน goodfoodMealPicker
 * (เช้า .25 · กลางวัน .35 · เย็น .30 รวม .90 ที่เหลือ .10 เป็นมื้อว่าง)
 */
export const SLOT_SHARE: Record<ProgramSlot, number> = {
  เช้า: 0.25,
  กลางวัน: 0.35,
  ว่าง: 0.1,
  เย็น: 0.3,
};

// ─────────────────────── สารอาหารที่ต้องการต่อมื้อ ───────────────────────

export interface NutrientTarget {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** เพดาน ไม่ใช่เป้า — เกินคือไม่ดี ต่ำกว่าคือดี */
  sodiumMax: number;
  sugarMax: number;
}

export interface MealTarget extends NutrientTarget {
  slot: ProgramSlot;
  /** สัดส่วนของทั้งวันที่มื้อนี้รับผิดชอบ หลังเกลี่ยตามมื้อที่ซื้อจริงแล้ว */
  share: number;
}

/** ค่ามาตรฐานเมื่อสมาชิกยังไม่ได้ onboard — ใช้ค่ากลางคนไทย ไม่ปล่อยหน้าจอว่าง */
const FALLBACK = { kcal: 1800, protein: 90, carbs: 200, fat: 60, sodium: 2000, sugar: 45 };

/** ไฟเบอร์ตามเกณฑ์ DRI: 14 ก. ต่อพลังงาน 1,000 kcal */
export const fiberFor = (kcal: number): number => Math.round((kcal / 1000) * 14);

export interface TargetSource {
  dailyCalories?: number | null;
  dailyProtein?: number | null;
  dailyCarbs?: number | null;
  dailyFat?: number | null;
  dailyFiber?: number | null;
  dailySodium?: number | null;
  dailySugar?: number | null;
}

export function dailyTarget(m: TargetSource): NutrientTarget {
  const kcal = m.dailyCalories ?? FALLBACK.kcal;
  return {
    kcal,
    protein: m.dailyProtein ?? FALLBACK.protein,
    carbs: m.dailyCarbs ?? FALLBACK.carbs,
    fat: m.dailyFat ?? FALLBACK.fat,
    fiber: m.dailyFiber ?? fiberFor(kcal),
    sodiumMax: m.dailySodium ?? FALLBACK.sodium,
    sugarMax: m.dailySugar ?? FALLBACK.sugar,
  };
}

/**
 * แตกเป้ารายวัน → เป้ารายมื้อ นี่คือ "งานของ Coach AI" ที่ backoffice เอาไปตักอาหาร
 *
 * 🔴 เกลี่ยสัดส่วนใหม่ตามมื้อที่ซื้อจริง — คนที่ซื้อแค่กลางวัน+เย็น
 *    สองมื้อนั้นต้องรับพลังงานทั้งวัน ไม่ใช่ได้แค่ 65% แล้วอดตาย
 */
export function mealTargets(m: TargetSource, slots: readonly string[] = PROGRAM_SLOTS): MealTarget[] {
  const day = dailyTarget(m);
  const active = PROGRAM_SLOTS.filter((s) => slots.includes(s));
  if (active.length === 0) return [];
  const totalShare = active.reduce((n, s) => n + SLOT_SHARE[s], 0);

  return active.map((slot) => {
    const share = SLOT_SHARE[slot] / totalShare;
    return {
      slot,
      share,
      kcal: Math.round(day.kcal * share),
      protein: Math.round(day.protein * share),
      carbs: Math.round(day.carbs * share),
      fat: Math.round(day.fat * share),
      fiber: Math.round(day.fiber * share),
      sodiumMax: Math.round(day.sodiumMax * share),
      sugarMax: Math.round(day.sugarMax * share),
    };
  });
}

// ─────────────────────── ส่วนต่างจากกล่องมาตรฐาน ───────────────────────

export interface Portion {
  /** ตัวคูณปริมาณเทียบกล่องมาตรฐาน — ปัดเป็นขั้นแล้ว ครัวตักตามได้จริง */
  scale: number;
  label: string;
  /** สิ่งที่ต้องเพิ่ม/ลดเป็นคำพูด — คนแพ็คอ่านแล้วทำได้เลยโดยไม่ต้องคิดเลข */
  note: string;
  /**
   * 🔴 เมนูนี้ตักยังไงก็ไม่ถึงเป้า (หรือเกินเป้า) แม้ขยาย/ย่อสุดขั้นบันไดแล้ว
   *    ต้องบอกให้ชัด ไม่ใช่ปัดเป็น XL เงียบ ๆ แล้วปล่อยให้ลูกค้าได้ครึ่งเดียวของที่ควรได้
   *    สาเหตุคือ "เมนูไม่เข้ากับเป้า" ซึ่งแก้ที่ปฏิทิน ไม่ใช่แก้ที่ทัพพี
   */
  off: null | { kcalShort: number; message: string };
}

/** ขนาดที่ครัวทำได้จริง — ตักทัพพีครึ่งได้ แต่ชั่ง 12 กล่องทีละกล่องตอนตี 5 ไม่ได้ */
const SIZES: { scale: number; label: string }[] = [
  { scale: 0.75, label: "S" },
  { scale: 1.0, label: "M" },
  { scale: 1.25, label: "L" },
  { scale: 1.5, label: "XL" },
];

/**
 * แปลง "ต้องการเท่าไร" + "กล่องมาตรฐานให้เท่าไร" → "ตักยังไง"
 * นี่คือจุดที่ทำให้ระบบใช้งานได้จริง — ถ้าบอกแค่ตัวเลขเป้า คนแพ็คก็ยังเดาอยู่ดี
 */
export function portionFor(target: MealTarget, base: { calories: number; protein: number }): Portion {
  if (!base.calories || base.calories <= 0) {
    return { scale: 1, label: "M", note: "ไม่มีข้อมูลโภชนาการของเมนูนี้", off: null };
  }

  const want = target.kcal / base.calories;
  const size = SIZES.reduce((best, s) => (Math.abs(s.scale - want) < Math.abs(best.scale - want) ? s : best), SIZES[0]);

  const notes: string[] = [];
  if (size.scale > 1) notes.push(`ข้าว/กับข้าว ${size.scale} เท่า`);
  else if (size.scale < 1) notes.push(`ลดข้าวเหลือ ${size.scale} เท่า`);

  /*
   * โปรตีนคิดแยกจากการย่อขยายทั้งกล่อง
   * เพราะคนลดน้ำหนักมักต้องการ "โปรตีนเท่าเดิม แต่คาร์บน้อยลง" — ย่อทั้งกล่องจะได้โปรตีนไม่พอ
   */
  const proteinGap = target.protein - base.protein * size.scale;
  if (proteinGap >= 8) notes.push(`เพิ่มโปรตีน ~${Math.round(proteinGap)} ก.`);

  /*
   * ตรวจว่าขั้นบันไดครอบเป้าได้จริงไหม
   * เคสจริงที่เจอ: เป้ามื้อเช้า 496 kcal แต่เมนูเช้าในคลังมี 190 kcal
   * → ต้องขยาย 2.6 เท่า แต่บันไดสุดแค่ 1.5 เท่า = ลูกค้าได้ 285 kcal (ขาดไป 211)
   * ถ้าไม่บอก คนแพ็คจะเห็นแค่ "XL" แล้วนึกว่าถูกต้องแล้ว
   */
  const delivered = base.calories * size.scale;
  const diff = target.kcal - delivered;
  const off =
    Math.abs(diff) > target.kcal * 0.2
      ? {
          kcalShort: Math.round(diff),
          message:
            diff > 0
              ? `⚠️ เมนูนี้เล็กเกินไปสำหรับเป้า — ตักสุดแล้วยังขาด ${Math.round(diff)} kcal ควรเปลี่ยนเมนูในปฏิทินหรือเพิ่มเครื่องเคียง`
              : `⚠️ เมนูนี้ใหญ่เกินเป้า — ย่อสุดแล้วยังเกิน ${Math.abs(Math.round(diff))} kcal`,
        }
      : null;

  return { scale: size.scale, label: size.label, note: notes.join(" · ") || "ตักตามสูตรมาตรฐาน", off };
}

// ─────────────────────────── คอร์สของลูกค้า ───────────────────────────

export interface EnrollmentLike {
  startDate: Date;
  totalDays: number;
  slots: string[];
  status: string;
}

/** กางคอร์สออกเป็นรายวัน — วันที่ 1 ถึง totalDays ต่อเนื่องกัน */
export function enrollmentDays(e: EnrollmentLike): { dayNumber: number; date: Date }[] {
  return Array.from({ length: e.totalDays }, (_, i) => ({
    dayNumber: i + 1,
    date: addDays(e.startDate, i),
  }));
}

// ─────────────────────────── รันเวย์ปฏิทิน ───────────────────────────

/** จำนวนวันข้างหน้าที่ปฏิทินต้องเต็มเสมอ — เท่ากับความยาวคอร์สที่ขาย */
export const RUNWAY_DAYS = 7;

export interface CalendarSlotRef {
  date: Date;
  track: string;
  slot: string;
}

/**
 * ช่องที่ยังว่างในช่วง [from, from+days) — ครบทุกสาย ทุกมื้อที่ขาย
 * 🔴 ห้ามขายคอร์สถ้ารายการนี้ไม่ว่าง ไม่งั้นลูกค้าจ่ายเงินแล้วไม่มีเมนู
 */
export function missingSlots(
  filled: { date: Date; track: string; slot: string }[],
  from: Date,
  days = RUNWAY_DAYS,
  slots: readonly string[] = SOLD_SLOTS,
): CalendarSlotRef[] {
  const have = new Set(filled.map((f) => `${dayKey(f.date)}|${f.track}|${f.slot}`));
  const gaps: CalendarSlotRef[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const track of TRACK_KEYS) {
      for (const slot of slots) {
        if (!have.has(`${dayKey(date)}|${track}|${slot}`)) gaps.push({ date, track, slot });
      }
    }
  }
  return gaps;
}

/** ปฏิทินเต็มถึงวันไหน (นับต่อเนื่องจาก from เท่านั้น — วันโหว่ตรงกลางถือว่าจบ) */
export function runwayEnd(
  filled: { date: Date; track: string; slot: string }[],
  from: Date,
  slots: readonly string[] = SOLD_SLOTS,
): { lastFullDate: Date | null; days: number } {
  const have = new Set(filled.map((f) => `${dayKey(f.date)}|${f.track}|${f.slot}`));
  let days = 0;
  for (let i = 0; i < 120; i++) {
    const date = addDays(from, i);
    const full = TRACK_KEYS.every((t) => slots.every((s) => have.has(`${dayKey(date)}|${t}|${s}`)));
    if (!full) break;
    days++;
  }
  return { lastFullDate: days ? addDays(from, days - 1) : null, days };
}
