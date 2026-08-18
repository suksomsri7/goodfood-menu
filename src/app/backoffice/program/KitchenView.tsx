"use client";

/**
 * เมนูครัว — "วันนี้ต้องชั่งอะไร ให้ใคร เท่าไร"
 *
 * 🔑 ต่างจากใบแพ็คเดิมตรงที่ไม่มีคำว่า S/M/L/XL อีกแล้ว
 *    ครัวเห็นเป็นกรัมของวัตถุดิบแต่ละอย่างต่อกล่อง ซึ่งคือสิ่งที่มือทำจริง
 *
 * 🔴 ลำดับบนหน้า: ของที่ต้องเตรียมรวม (ซื้อ/ชั่งล่วงหน้า) → ตารางรายคน (ตอนแพ็ค)
 *    ครัวทำงานตามลำดับนี้จริง ๆ สลับแล้วต้องเลื่อนขึ้นลงทั้งวัน
 * 🔴 แพ้อาหารต้องอยู่ติดชื่อคน ไม่ใช่ในหน้าโปรไฟล์ — คนแพ็คไม่เปิดอีกหน้าตอนมือเปื้อน
 */

import { AlertTriangle, ShoppingBasket } from "lucide-react";

export interface KitchenLine {
  ingredientId: string;
  name: string;
  role: string;
  unit: string;
  baseAmount: number;
  amount: number;
  delta: number;
  lockedReason: string | null;
  clamped: boolean;
  note: string | null;
}

export interface KitchenBox {
  memberName: string;
  allergies: string[];
  lines: KitchenLine[];
  delivered: { kcal: number; protein: number };
  target: { kcal: number; protein: number };
  warnings: string[];
}

export interface KitchenDish {
  track: string;
  trackLabel: string;
  foodId: string | null;
  foodName: string;
  noRecipe: boolean;
  boxes: KitchenBox[];
  ingredients: { id: string; name: string; unit: string }[];
  prep: { ingredientId: string; name: string; unit: string; total: number; boxes: number }[];
}

export interface KitchenSlot {
  slot: string;
  boxes: number;
  dishes: KitchenDish[];
}

const unitLabel = (u: string) => (u === "pc" ? "ชิ้น" : u === "ml" ? "มล." : "ก.");

/** "1.2 กก." / "850 ก." — ตรงกับ formatAmount ฝั่ง server (ครัวต้องอ่านได้เหมือนกันทั้งจอและกระดาษ) */
function fmt(amount: number, unit: string): string {
  if (unit === "pc") return `${Math.round(amount)} ชิ้น`;
  if (unit !== "ml" && amount >= 1000) return `${parseFloat((amount / 1000).toFixed(2))} กก.`;
  return `${Math.round(amount * 10) / 10} ${unitLabel(unit)}`;
}

export function KitchenView({ slots }: { slots: KitchenSlot[] }) {
  if (slots.length === 0) {
    return <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">วันนี้ไม่มีลูกค้าในโปรแกรม</div>;
  }

  return (
    <div className="space-y-5">
      {slots.map((s) => (
        <div key={s.slot} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-900">มื้อ{s.slot}</span>
            <span className="text-sm text-gray-500">{s.boxes} กล่อง</span>
          </div>

          <div className="divide-y divide-gray-100">
            {s.dishes.map((d, i) => (
              <Dish key={i} dish={d} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Dish({ dish }: { dish: KitchenDish }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{dish.trackLabel}</span>
        <span className="font-medium text-gray-900">{dish.foodName}</span>
        <span className="ml-auto text-sm font-semibold text-[#4CAF50]">{dish.boxes.length} กล่อง</span>
      </div>

      {dish.noRecipe && dish.foodId && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            เมนูนี้ยังไม่ได้ลงสูตร — ปรับปริมาณรายวัตถุดิบให้ลูกค้าไม่ได้
            <a href={`/backoffice/foods/${dish.foodId}/recipe`} className="underline font-semibold mx-1">
              ลงสูตรตอนนี้
            </a>
            (ระหว่างนี้ให้ดูวิธีตักแบบเดิมในแท็บใบแพ็ค)
          </div>
        </div>
      )}

      {/* ── ของที่ต้องเตรียมรวม ── */}
      {dish.prep.length > 0 && (
        <div className="rounded-lg bg-[#f6faf6] border border-[#dcecdc] p-3">
          <p className="text-xs font-semibold text-[#2e7d32] flex items-center gap-1.5 mb-2">
            <ShoppingBasket className="w-3.5 h-3.5" /> เตรียมรวมสำหรับ {dish.prep[0]?.boxes ?? 0} กล่อง
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {dish.prep.map((p) => (
              <span key={p.ingredientId} className="text-sm text-gray-800">
                {p.name} <b className="text-[#2e7d32]">{fmt(p.total, p.unit)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── ตารางรายคน ── */}
      {dish.ingredients.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3 whitespace-nowrap">ลูกค้า</th>
                {dish.ingredients.map((i) => (
                  <th key={i.id} className="py-2 px-2 text-right whitespace-nowrap">
                    {i.name}
                  </th>
                ))}
                <th className="py-2 pl-3 text-right whitespace-nowrap">ได้จริง</th>
              </tr>
            </thead>
            <tbody>
              {dish.boxes.map((b, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-gray-900 whitespace-nowrap">{b.memberName}</span>
                    {b.allergies.length > 0 && (
                      <span className="block mt-0.5 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[11px] font-semibold">
                        ⚠️ แพ้ {b.allergies.join(", ")}
                      </span>
                    )}
                  </td>

                  {dish.ingredients.map((ing) => {
                    const l = b.lines.find((x) => x.ingredientId === ing.id);
                    if (!l) return <td key={ing.id} className="py-2.5 px-2 text-right text-gray-300">—</td>;
                    return (
                      <td key={ing.id} className="py-2.5 px-2 text-right whitespace-nowrap">
                        <span className="font-semibold text-gray-900">{l.amount}</span>
                        <span className="text-xs text-gray-400"> {unitLabel(l.unit)}</span>
                        {/* ต่างจากมาตรฐานเท่าไร — คนตักเช็คตัวเองได้ว่าหยิบถูกทัพพีไหม */}
                        <span
                          className={`block text-[11px] ${
                            l.lockedReason ? "text-gray-400" : l.delta === 0 ? "text-gray-300" : l.delta > 0 ? "text-green-700" : "text-amber-700"
                          }`}
                        >
                          {l.lockedReason ? "ตายตัว" : l.delta === 0 ? "เท่ามาตรฐาน" : `${l.delta > 0 ? "+" : ""}${l.delta}`}
                        </span>
                      </td>
                    );
                  })}

                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    <span className="text-gray-900">{b.delivered.kcal} kcal</span>
                    <span className="block text-[11px] text-gray-400">
                      เป้า {b.target.kcal} · P {b.delivered.protein}/{b.target.protein}
                    </span>
                    {b.warnings.map((w, j) => (
                      <span key={j} className="block text-[11px] text-amber-700 max-w-[16rem] text-right">
                        {w}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
