/**
 * "จำอาหารซ้ำ" — เมนูที่เคยวิเคราะห์แล้ว ไม่ต้องจ่ายค่า AI ซ้ำ
 *
 * ไม่ต้องมีตารางใหม่: MealLog ที่ user ยืนยันบันทึกไปแล้วคือแคชที่ดีที่สุดอยู่แล้ว
 * (ผ่านตาเจ้าตัวมาแล้วรอบหนึ่ง) — ของตัวเองก่อน ถ้าไม่มีค่อยดูของทั้งระบบ
 */
import { prisma } from "@/lib/prisma";

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

/** ตัดช่องว่าง/วรรณยุกต์ซ้ำ/คำบอกปริมาณท้ายชื่อ ให้ชื่อเทียบกันได้ */
export function normaliseFoodName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\d+(\.\d+)?\s*(ไม้|จาน|ชาม|ห่อ|ถ้วย|แก้ว|ชิ้น|ลูก|ml|มล\.|g|กรัม)\s*$/u, "")
    .trim();
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
