"use client";

/**
 * ลงสูตรมาตรฐานของเมนู 1 กล่อง
 *
 * 🔑 หน้านี้แทนที่แนวคิด "ไซต์ S/M/L/XL" — ครัวบอกว่ากล่องมาตรฐานมีอะไรกี่กรัม
 *    แล้วระบบคำนวณให้เองว่าลูกค้าแต่ละคนต้องได้วัตถุดิบไหนเท่าไร
 *
 * 🔴 ต้องมีตัวอย่างจาน 3 แบบให้เห็นทันทีที่ลงสูตรเสร็จ — ไม่งั้นครัวจะไม่รู้เลยว่า
 *    สูตรที่เพิ่งกรอกไปใช้ได้จริงกับลูกค้าตัวจริงหรือเปล่า จนกว่าจะถึงเช้าวันส่งของ
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/backoffice/Header";
import { AlertTriangle, ArrowLeft, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "protein", label: "โปรตีน" },
  { value: "carb", label: "คาร์บ" },
  { value: "veg", label: "ผัก" },
  { value: "fat", label: "ไขมัน/ซอส" },
  { value: "other", label: "อื่น ๆ" },
];

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  defaultRole: string;
  calories: number;
  protein: number;
  isActive: boolean;
}

interface Item {
  ingredientId: string;
  name: string;
  unit: string;
  role: string;
  baseAmount: number | string;
  scalable: boolean;
  minAmount: number | string | null;
  maxAmount: number | string | null;
  note: string | null;
}

interface PlanLine {
  name: string;
  unit: string;
  baseAmount: number;
  amount: number;
  delta: number;
  lockedReason: string | null;
}

interface Preview {
  label: string;
  plan: { lines: PlanLine[]; delivered: { kcal: number; protein: number }; warnings: string[] };
}

interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
}

const unitLabel = (u: string) => (u === "pc" ? "ชิ้น" : u === "ml" ? "มล." : "ก.");

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [foodName, setFoodName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [computed, setComputed] = useState<Nutrition | null>(null);
  const [preview, setPreview] = useState<Preview[]>([]);
  const [library, setLibrary] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/foods/${id}/recipe`, { credentials: "include" }),
        fetch("/api/ingredients", { credentials: "include" }),
      ]);
      if (r1.status === 401 || r2.status === 401) {
        setErr("เซสชันหลังบ้านหมดอายุ — เข้าสู่ระบบใหม่แล้วเปิดหน้านี้อีกครั้ง");
        return;
      }
      const j1 = await r1.json();
      const j2 = await r2.json();
      setFoodName(j1.food?.name ?? "");
      setItems(j1.items ?? []);
      setComputed(j1.computed ?? null);
      setPreview(j1.preview ?? []);
      setLibrary(j2.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (i: number, p: Partial<Item>) => setItems(items.map((x, n) => (n === i ? { ...x, ...p } : x)));

  function addRow(ingredientId: string) {
    const ing = library.find((l) => l.id === ingredientId);
    if (!ing) return;
    if (items.some((x) => x.ingredientId === ingredientId)) return alert(`"${ing.name}" อยู่ในสูตรแล้ว`);
    setItems([
      ...items,
      {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        role: ing.defaultRole,
        baseAmount: "",
        scalable: true,
        minAmount: null,
        maxAmount: null,
        note: null,
      },
    ]);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/foods/${id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json.error || "บันทึกไม่สำเร็จ");
      setSaved(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const available = library.filter((l) => l.isActive && !items.some((x) => x.ingredientId === l.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`สูตรมาตรฐาน${foodName ? ` — ${foodName}` : ""}`} subtitle="กล่องมาตรฐาน 1 กล่อง มีวัตถุดิบอะไร อย่างละเท่าไร" />

      <div className="p-6 space-y-4 max-w-5xl">
        <button
          onClick={() => router.push(`/backoffice/foods/${id}/edit`)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> กลับไปหน้าแก้ไขเมนู
        </button>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : (
          <>
            {library.length === 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                ยังไม่มีวัตถุดิบในคลัง — ต้อง
                <a href="/backoffice/ingredients" className="underline font-semibold mx-1">
                  เพิ่มวัตถุดิบก่อน
                </a>
                ถึงจะลงสูตรได้
              </div>
            )}

            {/* ── ตารางสูตร ── */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-3 py-3 w-8"></th>
                    <th className="px-3 py-3">วัตถุดิบ</th>
                    <th className="px-3 py-3">บทบาท</th>
                    <th className="px-3 py-3 w-28">มาตรฐาน</th>
                    <th className="px-3 py-3 w-24">ต่ำสุด</th>
                    <th className="px-3 py-3 w-24">สูงสุด</th>
                    <th className="px-3 py-3 w-24">ปรับตามคน</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                        ยังไม่มีสูตร — เมนูนี้จะยังใช้วิธีตักแบบเดิม (S/M/L/XL) จนกว่าจะลงสูตร
                      </td>
                    </tr>
                  )}
                  {items.map((it, i) => (
                    <tr key={it.ingredientId} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2 text-gray-300">
                        <GripVertical className="w-4 h-4" />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-900">{it.name}</span>
                        <span className="block text-[11px] text-gray-400">หน่วย {unitLabel(it.unit)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={it.role}
                          onChange={(e) => patch(i, { role: e.target.value })}
                          className="px-2 py-1.5 rounded border border-gray-200 text-sm bg-white"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={it.baseAmount}
                            onChange={(e) => patch(i, { baseAmount: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-gray-200 text-sm"
                          />
                          <span className="text-xs text-gray-400">{unitLabel(it.unit)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={it.minAmount ?? ""}
                          onChange={(e) => patch(i, { minAmount: e.target.value === "" ? null : e.target.value })}
                          placeholder="อัตโนมัติ"
                          disabled={!it.scalable}
                          className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={it.maxAmount ?? ""}
                          onChange={(e) => patch(i, { maxAmount: e.target.value === "" ? null : e.target.value })}
                          placeholder="อัตโนมัติ"
                          disabled={!it.scalable}
                          className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={it.scalable}
                            onChange={(e) => patch(i, { scalable: e.target.checked })}
                            className="rounded"
                          />
                          {it.scalable ? "ปรับได้" : "ตายตัว"}
                        </label>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setItems(items.filter((_, n) => n !== i))}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-gray-100 p-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-400" />
                <select
                  value=""
                  onChange={(e) => e.target.value && addRow(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  <option value="">เพิ่มวัตถุดิบเข้าสูตร...</option>
                  {available.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.calories} kcal · P {l.protein} ต่อ 100 {unitLabel(l.unit)})
                    </option>
                  ))}
                </select>
                <a href="/backoffice/ingredients" className="text-xs text-[#4CAF50] hover:underline ml-1">
                  จัดการคลังวัตถุดิบ
                </a>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              เว้น "ต่ำสุด/สูงสุด" ว่างไว้ = ระบบยอมให้ปรับ 0.5–2.5 เท่าของมาตรฐาน · ติ๊ก "ตายตัว" กับซอส/เครื่องปรุงที่เพิ่มแล้วเค็มเกิน
            </p>

            {err && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {err}
              </div>
            )}
            {saved && !err && (
              <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
                บันทึกแล้ว — โภชนาการของเมนูนี้ถูกคำนวณใหม่จากสูตรเรียบร้อย
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-[#4CAF50] text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "บันทึกสูตร"}
              </button>
            </div>

            {/* ── โภชนาการของกล่องมาตรฐาน ── */}
            {computed && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-1">กล่องมาตรฐานให้อะไรบ้าง</h3>
                <p className="text-xs text-gray-500 mb-3">คิดจากสูตรด้านบน — ค่านี้ถูกเขียนกลับไปที่เมนูอัตโนมัติแล้ว</p>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 text-sm">
                  <Cell label="kcal" value={computed.kcal} accent />
                  <Cell label="โปรตีน" value={`${computed.protein} ก.`} />
                  <Cell label="คาร์บ" value={`${computed.carbs} ก.`} />
                  <Cell label="ไขมัน" value={`${computed.fat} ก.`} />
                  <Cell label="ไฟเบอร์" value={`${computed.fiber} ก.`} />
                  <Cell label="โซเดียม" value={`${computed.sodium} มก.`} />
                  <Cell label="น้ำตาล" value={`${computed.sugar} ก.`} />
                </div>
              </div>
            )}

            {/* ── ตัวอย่างจานของลูกค้า 3 แบบ ── */}
            {preview.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-1">สูตรนี้ออกมาเป็นจานจริงแบบไหน</h3>
                <p className="text-xs text-gray-500 mb-4">ลองกับลูกค้า 3 แบบ — ถ้ามีคำเตือน แปลว่าสูตรยังครอบเป้าคนกลุ่มนั้นไม่ได้</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {preview.map((p, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 p-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">{p.label}</p>
                      <div className="space-y-1">
                        {p.plan.lines.map((l, j) => (
                          <div key={j} className="flex items-baseline justify-between text-xs">
                            <span className="text-gray-600">{l.name}</span>
                            <span className={l.delta === 0 ? "text-gray-400" : l.delta > 0 ? "text-green-700" : "text-amber-700"}>
                              {l.baseAmount} → <b>{l.amount}</b> {unitLabel(l.unit)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-50">
                        ได้จริง {p.plan.delivered.kcal} kcal · โปรตีน {p.plan.delivered.protein} ก.
                      </p>
                      {p.plan.warnings.map((w, j) => (
                        <p key={j} className="text-[11px] text-amber-700 mt-1">
                          {w}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-semibold ${accent ? "text-[#4CAF50]" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
