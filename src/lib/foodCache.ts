/**
 * "จำอาหารซ้ำ" — เมนูที่เคยวิเคราะห์แล้ว ไม่ต้องจ่ายค่า AI ซ้ำ
 *
 * ไม่ต้องมีตารางใหม่: MealLog ที่ user ยืนยันบันทึกไปแล้วคือแคชที่ดีที่สุดอยู่แล้ว
 * (ผ่านตาเจ้าตัวมาแล้วรอบหนึ่ง) — ของตัวเองก่อน ถ้าไม่มีค่อยดูของทั้งระบบ
 */
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
}

/**
 * เมนูที่กินบ่อย 60 วัน แบบ structured — ใช้ใน /api/coach/foods (แอปกรอกอาหารเอง)
 * แยกจาก frequentFoods() ที่คืนข้อความยาวสำหรับใส่ prompt AI (ห้ามเปลี่ยน shape ของตัวนั้น)
 * เกณฑ์ min 1 ครั้ง เพราะฝั่งแอปอยากเห็น "ของที่เคยกิน" ทั้งหมด ไม่ใช่แค่ที่ซ้ำ
 */
export async function frequentFoodsList(memberId: string, limit = 30, minCount = 1): Promise<FrequentFood[]> {
  const rows = await prisma.$queryRaw<
    Array<{ name: string; kcal: number; p: number; c: number; f: number; na: number | null; su: number | null; n: number }>
  >`
    SELECT name,
           round(avg(calories))::int AS kcal, round(avg(protein))::int AS p,
           round(avg(carbs))::int AS c, round(avg(fat))::int AS f,
           round(avg(sodium))::int AS na, round(avg(sugar))::int AS su,
           count(*)::int AS n
    FROM meal_logs
    WHERE "memberId" = ${memberId} AND "date" >= now() - interval '60 days'
    GROUP BY name
    HAVING count(*) >= ${minCount}
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
