/**
 * "จำอาหารซ้ำ" — เมนูที่เคยวิเคราะห์แล้ว ไม่ต้องจ่ายค่า AI ซ้ำ
 *
 * ไม่ต้องมีตารางใหม่: MealLog ที่ user ยืนยันบันทึกไปแล้วคือแคชที่ดีที่สุดอยู่แล้ว
 * (ผ่านตาเจ้าตัวมาแล้วรอบหนึ่ง) — ของตัวเองก่อน ถ้าไม่มีค่อยดูของทั้งระบบ
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normaliseFoodName } from "@/lib/foodName";

// ตัวฟังก์ชันย้ายไป foodName.ts แล้ว (สคริปต์ QC เรียกได้โดยไม่ต้องมี prisma) — re-export ไว้ให้ของเดิมใช้ต่อได้
export { normaliseFoodName };

export interface CachedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
  source: "self" | "shared";
}

/** เมนูชื่อนี้เคยบันทึกไว้ไหม (ล่าสุดชนะ) */
export async function cachedFood(memberId: string, name: string): Promise<CachedFood | null> {
  const key = normaliseFoodName(name);
  if (key.length < 2) return null;

  const pick = (rows: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number; sodium: number | null; sugar: number | null }>) =>
    rows.find((r) => normaliseFoodName(r.name) === key) ?? null;

  const sel = { name: true, calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true } as const;
  const mine = await prisma.mealLog.findMany({
    where: { memberId, name: { contains: key.slice(0, 24), mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: sel,
  });
  const hit = pick(mine);
  if (hit) return { ...hit, source: "self" };

  const others = await prisma.mealLog.findMany({
    where: { name: { contains: key.slice(0, 24), mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: sel,
  });
  const shared = pick(others);
  return shared ? { ...shared, source: "shared" } : null;
}

export interface FrequentFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
  count: number;
  /** เคยกินในช่วงเวลาใกล้ ๆ ตอนนี้กี่ครั้ง (ใส่เมื่อส่ง nowHour มา) */
  nearCount?: number;
}

/**
 * เมนูที่กินบ่อย 60 วัน แบบ structured — ใช้ใน /api/coach/foods (แอปกรอกอาหารเอง)
 * แยกจาก frequentFoods() ที่คืนข้อความยาวสำหรับใส่ prompt AI (ห้ามเปลี่ยน shape ของตัวนั้น)
 * เกณฑ์ min 1 ครั้ง เพราะฝั่งแอปอยากเห็น "ของที่เคยกิน" ทั้งหมด ไม่ใช่แค่ที่ซ้ำ
 */
export async function frequentFoodsList(
  memberId: string,
  limit = 30,
  minCount = 1,
  /**
   * ชั่วโมงปัจจุบัน (เวลาไทย) — ส่งมาเมื่อไร รายการจะเรียง "ของที่เคยกินช่วงเวลานี้" ขึ้นก่อน
   *
   * 🔴 เจ้าของเคาะ 26 ส.ค. 69: ให้ยึด "ช่วงเวลา" ไม่ใช่ชื่อมื้อ (เช้า/กลางวัน/เย็น)
   *    เปิดตอน 7 โมงต้องเจอโจ๊ก/กาแฟ · เปิดบ่ายสามต้องเจอของว่างที่กินประจำ
   *    ใช้กรอบ ±90 นาที และคร่อมเที่ยงคืนได้ (23:00 ต้องจับคู่กับ 00:30)
   */
  nowHour?: number,
): Promise<FrequentFood[]> {
  const near =
    nowHour === undefined
      ? Prisma.sql`0`
      : /* ระยะห่างเป็นนาทีจากเวลานี้ แบบวนรอบ 24 ชม. → ≤90 นาที = "ช่วงเดียวกัน" */
        Prisma.sql`CASE WHEN LEAST(
            abs((extract(hour from ("date" + interval '7 hours')) * 60 + extract(minute from ("date" + interval '7 hours'))) - ${nowHour * 60}),
            1440 - abs((extract(hour from ("date" + interval '7 hours')) * 60 + extract(minute from ("date" + interval '7 hours'))) - ${nowHour * 60})
          ) <= 90 THEN 1 ELSE 0 END`;

  const rows = await prisma.$queryRaw<
    Array<{ name: string; kcal: number; p: number; c: number; f: number; na: number | null; su: number | null; n: number; near_n: number }>
  >`
    SELECT name,
           round(avg(calories))::int AS kcal, round(avg(protein))::int AS p,
           round(avg(carbs))::int AS c, round(avg(fat))::int AS f,
           round(avg(sodium))::int AS na, round(avg(sugar))::int AS su,
           count(*)::int AS n,
           sum(${near})::int AS near_n
    FROM meal_logs
    WHERE "memberId" = ${memberId} AND "date" >= now() - interval '60 days'
    GROUP BY name
    HAVING count(*) >= ${minCount}
    ORDER BY sum(${near}) DESC, count(*) DESC, max("date") DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    name: r.name,
    calories: r.kcal,
    protein: r.p,
    carbs: r.c,
    fat: r.f,
    sodium: r.na ?? null,
    sugar: r.su ?? null,
    count: r.n,
    /** เคยกินช่วงเวลานี้กี่ครั้ง — แอปเอาไปขึ้นว่า "เคยกินช่วงนี้ 12 ครั้ง" */
    nearCount: r.near_n ?? 0,
  }));
}

/**
 * ช่วงมื้อของวัน (เวลาไทย) — ใช้บอกว่า "ตอนนี้คือมื้ออะไร" เพื่อเสนอของที่กินประจำช่วงนั้น
 * เก็บเป็นนาทีนับจากเที่ยงคืนเพื่อรองรับขอบ :30
 * มื้อดึกคร่อมเที่ยงคืน (1290 → 299) — ตัวที่ start > end คือช่วงที่ข้ามวัน
 */
export interface MealWindow {
  key: string;
  label: string;
  /** นาทีจากเที่ยงคืน (เวลาไทย) */
  start: number;
  end: number;
}

export const MEAL_WINDOWS: MealWindow[] = [
  { key: "breakfast", label: "เช้า", start: 5 * 60, end: 10 * 60 + 29 },
  { key: "lunch", label: "กลางวัน", start: 10 * 60 + 30, end: 14 * 60 + 29 },
  { key: "snack", label: "ว่างบ่าย", start: 14 * 60 + 30, end: 17 * 60 + 29 },
  { key: "dinner", label: "เย็น", start: 17 * 60 + 30, end: 21 * 60 + 29 },
  { key: "late", label: "มื้อดึก", start: 21 * 60 + 30, end: 4 * 60 + 59 },
];

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** ช่วงมื้อที่ครอบนาทีนี้ (นาทีจากเที่ยงคืน เวลาไทย) */
export function mealWindowAt(minuteOfDay: number): MealWindow {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  for (const w of MEAL_WINDOWS) {
    const inside = w.start <= w.end ? m >= w.start && m <= w.end : m >= w.start || m <= w.end;
    if (inside) return w;
  }
  return MEAL_WINDOWS[MEAL_WINDOWS.length - 1];
}

/** ข้อความช่วงเวลาแบบอ่านรู้เรื่อง เช่น "10:30–14:29" */
export function mealWindowRange(w: MealWindow): string {
  return `${hhmm(w.start)}–${hhmm(w.end)}`;
}

/**
 * เมนูที่ user กินบ่อย "เฉพาะช่วงเวลานี้ของวัน" (60 วันย้อนหลัง)
 *
 * ต่างจาก frequentFoodsList() ที่รวมทั้งวัน — ตอนเที่ยงจะได้เมนูมื้อเที่ยงจริง ๆ ไม่ใช่กาแฟตอนเช้า
 * เวลาใน DB เป็น UTC แบบ timestamp ไม่มี timezone → บวก 7 ชม. เอาเวลาไทย (วิธีเดียวกับที่อื่นในระบบ)
 */
export async function frequentFoodsInWindow(
  memberId: string,
  w: MealWindow,
  limit = 6
): Promise<FrequentFood[]> {
  const wraps = w.start > w.end;
  const rows = await prisma.$queryRaw<
    Array<{ name: string; kcal: number; p: number; c: number; f: number; na: number | null; su: number | null; n: number }>
  >`
    WITH logs AS (
      SELECT name, calories, protein, carbs, fat, sodium, sugar, "date",
             (EXTRACT(HOUR FROM ("date" + interval '7 hours')) * 60
              + EXTRACT(MINUTE FROM ("date" + interval '7 hours')))::int AS mod
      FROM meal_logs
      WHERE "memberId" = ${memberId} AND "date" >= now() - interval '60 days'
    )
    SELECT name,
           round(avg(calories))::int AS kcal, round(avg(protein))::int AS p,
           round(avg(carbs))::int AS c, round(avg(fat))::int AS f,
           round(avg(sodium))::int AS na, round(avg(sugar))::int AS su,
           count(*)::int AS n
    FROM logs
    WHERE CASE WHEN ${wraps} THEN (mod >= ${w.start} OR mod <= ${w.end})
               ELSE (mod >= ${w.start} AND mod <= ${w.end}) END
    GROUP BY name
    ORDER BY count(*) DESC, max("date") DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    name: r.name,
    calories: r.kcal,
    protein: r.p,
    carbs: r.c,
    fat: r.f,
    sodium: r.na ?? null,
    sugar: r.su ?? null,
    count: r.n,
    /** เคยกินช่วงเวลานี้กี่ครั้ง — แอปเอาไปขึ้นว่า "เคยกินช่วงนี้ 12 ครั้ง" */
    nearCount: r.n,
  }));
}

/** เมนูที่กินบ่อย — ป้อนให้โค้ชใช้ค่าเดิมแทนเดาใหม่ทุกครั้ง (แม่นขึ้น + ไม่ต้องคิดซ้ำ) */
export async function frequentFoods(memberId: string, limit = 12): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ name: string; kcal: number; p: number; c: number; f: number; n: number }>>`
    SELECT name,
           round(avg(calories))::int AS kcal, round(avg(protein))::int AS p,
           round(avg(carbs))::int AS c, round(avg(fat))::int AS f, count(*)::int AS n
    FROM meal_logs
    WHERE "memberId" = ${memberId} AND "date" >= now() - interval '60 days'
    GROUP BY name
    HAVING count(*) >= 2
    ORDER BY count(*) DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return "";
  const list = rows.map((r) => `${r.name} ~${r.kcal} kcal (P${r.p} C${r.c} F${r.f})`).join(" · ");
  return `เมนูที่ user กินบ่อยและเคยบันทึกไว้แล้ว (ใช้ตัวเลขเดิมได้เลย ไม่ต้องประมาณใหม่): ${list}`;
}
