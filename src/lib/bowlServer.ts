import { prisma } from "@/lib/prisma";
import {
  BowlLine,
  BowlStepKey,
  DEFAULT_BOWL_BASE_PRICE,
  bowlTotals,
  perPortion,
  resolveStepLimits,
  validatePicks,
} from "@/lib/bowl";

/**
 * คิดราคา + โภชนาการของชามจากคลังจริง — ที่เดียวที่ตัดสินราคา
 *
 * 🔴 ทั้งเส้น quote (โชว์ในแอป) และเส้น order (ส่งเข้าแชทครัว) ต้องเรียกตัวนี้
 *    ถ้าแยกกันคิด วันหนึ่งราคาที่ลูกค้าเห็นกับที่ครัวได้จะไม่ตรงกันโดยไม่มีใครรู้
 * 🔴 ห้ามเชื่อราคา/แคลอรี่ที่แอปส่งมา — อ่านจาก DB ทุกครั้ง
 */
export type PickInput = { ingredientId?: string; qty?: number };

export type BowlPriceResult =
  | { ok: false; status: number; error: string; soldOutId?: string }
  | {
      ok: true;
      basePrice: number;
      lines: BowlLine[];
      totals: ReturnType<typeof bowlTotals>;
    };

export function normalizePicks(raw: PickInput[] | undefined) {
  return (raw ?? [])
    .map((p) => ({ ingredientId: String(p.ingredientId ?? ""), qty: Math.round(Number(p.qty ?? 0)) }))
    .filter((p) => p.ingredientId && p.qty > 0);
}

export async function priceBowl(raw: PickInput[] | undefined): Promise<BowlPriceResult> {
  const picks = normalizePicks(raw);
  if (picks.length === 0) return { ok: false, status: 400, error: "ยังไม่ได้เลือกวัตถุดิบ" };

  const [settings, rows] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { id: "system" } }),
    prisma.ingredient.findMany({ where: { id: { in: picks.map((p) => p.ingredientId) } } }),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines: BowlLine[] = [];
  for (const p of picks) {
    const ing = byId.get(p.ingredientId);
    if (!ing) return { ok: false, status: 400, error: "มีวัตถุดิบที่ไม่มีในคลังแล้ว — รีเฟรชเมนูอีกครั้ง" };
    if (ing.soldOut) {
      // เปิดจอค้างไว้แล้วครัวเพิ่งกดว่าหมด — ต้องบอกให้ตรงว่า "หมด" ไม่ใช่ error ลอย ๆ
      return {
        ok: false,
        status: 409,
        error: `"${ing.displayName || ing.name}" เพิ่งหมดพอดี — เลือกตัวอื่นแทนได้ครับ`,
        soldOutId: ing.id,
      };
    }
    if (!ing.isActive || !ing.bowlStep || !ing.portionSize) {
      return { ok: false, status: 400, error: `"${ing.displayName || ing.name}" สั่งไม่ได้ตอนนี้ — เลือกตัวอื่นแทนได้ครับ` };
    }
    lines.push({
      ingredientId: ing.id,
      qty: p.qty,
      step: ing.bowlStep as BowlStepKey,
      name: ing.displayName || ing.name,
      unitPrice: ing.portionPrice,
      nutrition: perPortion(ing),
    });
  }

  const steps = resolveStepLimits(settings?.bowlStepLimits);
  const byStep: Record<string, number> = {};
  for (const l of lines) byStep[l.step] = (byStep[l.step] ?? 0) + l.qty;
  const limitErr = validatePicks(byStep, steps);
  if (limitErr) return { ok: false, status: 400, error: limitErr };

  const basePrice = settings?.bowlBasePrice ?? DEFAULT_BOWL_BASE_PRICE;
  return { ok: true, basePrice, lines, totals: bowlTotals(lines, basePrice) };
}
