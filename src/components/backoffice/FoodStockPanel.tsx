"use client";

/**
 * คลังอาหารรายคน (ฝั่งแอดมิน)
 *
 * ใช้ 2 ที่: ปุ่มในห้องแชท (ตอนกำลังคุยกับลูกค้า) และการ์ดในหน้าโปรไฟล์สมาชิก
 * 🔴 เพิ่มได้เฉพาะ "เมนูของครัว" ที่เปิดขายอยู่ (เจ้าของเคาะ 26 ส.ค. 69)
 * 🔴 ลูกค้ากดบันทึกในแอป = ตัดยอดอัตโนมัติ · ลบบันทึกทิ้ง = คืนของ
 *    ที่นี่จึงเป็น "ของจริงที่เขาถืออยู่" ไม่ใช่แค่บันทึกการสั่ง
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { STOCK_UNITS } from "@/lib/foodStock";

type StockItem = {
  id: string;
  foodId: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  remaining: number;
  expiresAt: string | null;
  expiryText: string | null;
  isEmpty: boolean;
  isLow: boolean;
  isExpired: boolean;
  calories: number;
  protein: number;
  addedBy: string | null;
  createdAt: string;
};

type MenuFood = {
  id: string;
  name: string;
  imageUrl: string | null;
  calories: number;
  protein: number;
  isActive: boolean;
};

/** แถวที่แอดมินกำลังจะเพิ่ม (ยังไม่บันทึก) */
type Draft = { food: MenuFood; quantity: number; unit: string; expiresAt: string };

export function FoodStockPanel({
  memberId,
  lineUserId,
  memberName,
  compact,
}: {
  memberId?: string;
  lineUserId?: string;
  memberName?: string;
  /** true = ใช้ในกล่องแชท (พื้นที่แคบ) */
  compact?: boolean;
}) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (memberId) p.set("memberId", memberId);
    else if (lineUserId) p.set("lineUserId", lineUserId);
    return p.toString();
  }, [memberId, lineUserId]);

  const load = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/backoffice/food-stock?${query}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "โหลดคลังไม่สำเร็จ");
      setItems(json.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดคลังไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/backoffice/food-stock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "แก้ไม่สำเร็จ");
    void load();
  }

  async function remove(item: StockItem) {
    if (!confirm(`ลบ "${item.name}" ออกจากคลังของลูกค้า?`)) return;
    const res = await fetch(`/api/backoffice/food-stock?id=${item.id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "ลบไม่สำเร็จ");
    void load();
  }

  const active = items.filter((i) => !i.isEmpty);
  const empty = items.filter((i) => i.isEmpty);

  return (
    <div className={compact ? "" : "bg-white rounded-xl border border-gray-200 overflow-hidden"}>
      {!compact && (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">คลังอาหาร{memberName ? `ของ${memberName}` : ""}</h3>
            <p className="text-xs text-gray-500">ลูกค้าเห็นรายการนี้ในแอป · ตัดยอดอัตโนมัติเมื่อกดบันทึก</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium hover:bg-[#43a047]"
          >
            <Plus className="w-4 h-4" /> เพิ่ม
          </button>
        </div>
      )}

      {compact && (
        <button
          onClick={() => setAdding(true)}
          className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium hover:bg-[#43a047]"
        >
          <Plus className="w-4 h-4" /> เพิ่มอาหารเข้าคลัง
        </button>
      )}

      <div className={compact ? "" : "px-5 py-3"}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : err ? (
          <p className="text-sm text-red-600 py-3">{err}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">ยังไม่มีของในคลัง — กดเพิ่มหลังลูกค้าสั่งได้เลย</p>
        ) : (
          <>
            {[...active, ...empty].map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                {i.imageUrl ? (
                  <Image src={i.imageUrl} alt={i.name} width={42} height={42} className="w-[42px] h-[42px] rounded-lg object-cover" />
                ) : (
                  <div className="w-[42px] h-[42px] rounded-lg bg-gray-100" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{i.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {new Date(i.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    {i.addedBy ? ` · ${i.addedBy}` : ""}
                    {i.quantity > i.remaining ? ` · ใช้ไป ${i.quantity - i.remaining}` : ""}
                    {i.expiryText ? ` · ${i.expiryText}` : ""}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                    i.isEmpty ? "bg-red-50 text-red-600" : i.isLow || i.isExpired ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {i.isEmpty ? "หมด" : `เหลือ ${i.remaining} ${i.unit}`}
                </span>
                <button
                  onClick={() => {
                    const v = prompt(`เติม "${i.name}" อีกกี่${i.unit}?`, "1");
                    const n = Number(v);
                    if (v && Number.isFinite(n) && n > 0) void patch(i.id, { addQuantity: Math.round(n) });
                  }}
                  className="p-1.5 rounded text-gray-400 hover:text-[#4CAF50] hover:bg-green-50"
                  title="เติมของ"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void remove(i)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                  title="ลบออกจากคลัง"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {adding && (
        <AddStockModal
          memberId={memberId}
          lineUserId={lineUserId}
          memberName={memberName}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); void load(); }}
        />
      )}
    </div>
  );
}

/** เลือกเมนูครัว → ใส่จำนวน/หน่วย/วันหมดอายุ → เพิ่มเข้าคลัง */
function AddStockModal({
  memberId, lineUserId, memberName, onClose, onSaved,
}: {
  memberId?: string; lineUserId?: string; memberName?: string; onClose: () => void; onSaved: () => void;
}) {
  const [menu, setMenu] = useState<MenuFood[]>([]);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/foods?isActive=true", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setMenu((Array.isArray(j) ? j : j.foods ?? []) as MenuFood[]))
      .catch(() => setErr("โหลดเมนูครัวไม่สำเร็จ"));
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pool = menu.filter((m) => !drafts.some((d) => d.food.id === m.id));
    return (term ? pool.filter((m) => m.name.toLowerCase().includes(term)) : pool).slice(0, 8);
  }, [menu, q, drafts]);

  function add(food: MenuFood) {
    setDrafts((d) => [...d, { food, quantity: 1, unit: "กล่อง", expiresAt: "" }]);
    setQ("");
  }
  const setDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  async function save() {
    if (drafts.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/backoffice/food-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          memberId,
          lineUserId,
          items: drafts.map((d) => ({
            foodId: d.food.id,
            quantity: d.quantity,
            unit: d.unit,
            expiresAt: d.expiresAt || null,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "เพิ่มไม่สำเร็จ");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">เพิ่มเข้าคลังอาหาร{memberName ? `ของ${memberName}` : ""}</h3>
            <p className="text-xs text-gray-500">ลูกค้าจะเห็นในแอปทันที และกดบันทึกได้โดยไม่ต้องพิมพ์เอง</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นเมนูของครัว เช่น อกไก่"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          {results.length > 0 && (
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {results.map((f) => (
                <button key={f.id} onClick={() => add(f)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left">
                  {f.imageUrl ? (
                    <Image src={f.imageUrl} alt={f.name} width={36} height={36} className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{f.name}</p>
                    <p className="text-[11px] text-gray-400">{Math.round(f.calories)} kcal · P {Math.round(f.protein)} ก.</p>
                  </div>
                  <Plus className="w-4 h-4 text-[#4CAF50]" />
                </button>
              ))}
            </div>
          )}

          {drafts.map((d, i) => (
            <div key={d.food.id} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                {d.food.imageUrl ? (
                  <Image src={d.food.imageUrl} alt={d.food.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.food.name}</p>
                  <p className="text-[11px] text-gray-400">เมนูครัว · {Math.round(d.food.calories)} kcal</p>
                </div>
                <button onClick={() => setDrafts((x) => x.filter((_, k) => k !== i))} className="p-1.5 rounded text-gray-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">จำนวน</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDraft(i, { quantity: Math.max(1, d.quantity - 1) })} className="w-8 h-9 rounded-lg border border-gray-200 text-[#2563eb]">−</button>
                    <input
                      type="number"
                      value={d.quantity}
                      onChange={(e) => setDraft(i, { quantity: Math.max(1, Math.min(60, parseInt(e.target.value || "1", 10))) })}
                      className="w-full h-9 text-center rounded-lg border border-gray-200 text-sm"
                    />
                    <button onClick={() => setDraft(i, { quantity: Math.min(60, d.quantity + 1) })} className="w-8 h-9 rounded-lg border border-gray-200 text-[#2563eb]">+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">หน่วย</label>
                  <select
                    value={d.unit}
                    onChange={(e) => setDraft(i, { unit: e.target.value })}
                    className="w-full h-9 rounded-lg border border-gray-200 text-sm bg-white px-2"
                  >
                    {STOCK_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">หมดอายุ (ไม่บังคับ)</label>
                  <input
                    type="date"
                    value={d.expiresAt}
                    onChange={(e) => setDraft(i, { expiresAt: e.target.value })}
                    className="w-full h-9 rounded-lg border border-gray-200 text-sm px-2"
                  />
                </div>
              </div>
            </div>
          ))}

          {drafts.length === 0 && <p className="text-sm text-gray-400">ค้นแล้วกดเมนูเพื่อใส่ในรายการ</p>}
          {!!err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">ยกเลิก</button>
          <button
            onClick={() => void save()}
            disabled={busy || drafts.length === 0}
            className="px-4 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "กำลังเพิ่ม..." : `เพิ่มเข้าคลัง${drafts.length ? ` (${drafts.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
