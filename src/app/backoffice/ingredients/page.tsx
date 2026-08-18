"use client";

/**
 * คลังวัตถุดิบ — ฐานของโภชนาการเฉพาะบุคคลทั้งระบบ
 *
 * 🔴 ทุกตัวเลขในหน้านี้คือ "ต่อ 100 ก./มล." ไม่ใช่ต่อจาน
 *    ย้ำไว้ทุกที่ในฟอร์มเพราะกรอกผิดฐานทีเดียว อาหารทุกกล่องที่ใช้วัตถุดิบนี้เพี้ยนพร้อมกัน
 *
 * มีปุ่มค้นจากคลังอาหาร 856 รายการไว้ช่วยกรอก — แต่ค่าที่ได้ติดธง "ยังไม่ยืนยัน"
 * จนกว่าครัวจะกดแก้เอง เพราะคลังนั้นเป็นค่าประมาณและหลายแถวเป็นจานสำเร็จ ไม่ใช่วัตถุดิบเดี่ยว
 */

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/backoffice/Header";
import { AlertTriangle, Loader2, Plus, Search, Trash2, X } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "protein", label: "โปรตีน" },
  { value: "carb", label: "คาร์บ" },
  { value: "veg", label: "ผัก" },
  { value: "fat", label: "ไขมัน/ซอส" },
  { value: "other", label: "อื่น ๆ" },
];

const UNIT_OPTIONS = [
  { value: "g", label: "กรัม (ชั่ง)" },
  { value: "ml", label: "มิลลิลิตร (ตวง)" },
  { value: "pc", label: "ชิ้น/ฟอง (นับ)" },
];

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  gramsPerPiece: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  sugar: number | null;
  defaultRole: string;
  stepGrams: number;
  isEstimate: boolean;
  source: string | null;
  isActive: boolean;
  usedIn: number;
}

interface Suggestion {
  name: string;
  unit: "g" | "ml";
  portionGrams: number;
  portionText: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
  source: string;
}

type Form = Partial<Ingredient> & { id?: string };

const EMPTY: Form = { unit: "g", defaultRole: "other", stepGrams: 10, isActive: true };

export default function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [authErr, setAuthErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ingredients?all=1${q ? `&q=${encodeURIComponent(q)}` : ""}`, { credentials: "include" });
      if (res.status === 401) return setAuthErr(true);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function remove(item: Ingredient) {
    if (!confirm(`ลบ "${item.name}" ออกจากคลัง?`)) return;
    const res = await fetch(`/api/ingredients/${item.id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "ลบไม่สำเร็จ");
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="คลังวัตถุดิบ"
        subtitle="โภชนาการต่อ 100 ก./มล. — ใช้เป็นฐานคำนวณสูตรและปริมาณเฉพาะบุคคล"
        actions={
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium hover:bg-[#43a047]"
          >
            <Plus className="w-4 h-4" /> เพิ่มวัตถุดิบ
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {authErr && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            เซสชันหลังบ้านหมดอายุ —
            <a href="/backoffice/login" className="underline font-semibold mx-1">
              เข้าสู่ระบบใหม่
            </a>
          </div>
        )}

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาวัตถุดิบ"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <p className="text-gray-500 text-sm">
              {q ? "ไม่พบวัตถุดิบที่ค้น" : "ยังไม่มีวัตถุดิบในคลัง — เพิ่มตัวแรกเพื่อเริ่มลงสูตรอาหาร"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3">วัตถุดิบ</th>
                  <th className="px-4 py-3">บทบาท</th>
                  <th className="px-4 py-3 text-right">kcal</th>
                  <th className="px-4 py-3 text-right">P</th>
                  <th className="px-4 py-3 text-right">C</th>
                  <th className="px-4 py-3 text-right">F</th>
                  <th className="px-4 py-3 text-right">โซเดียม</th>
                  <th className="px-4 py-3">ชั่งทีละ</th>
                  <th className="px-4 py-3">ใช้ในสูตร</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className={`border-b border-gray-50 last:border-0 ${i.isActive ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => setForm({ ...i })} className="font-medium text-gray-900 hover:text-[#4CAF50]">
                        {i.name}
                      </button>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">
                          ต่อ 100 {i.unit === "ml" ? "มล." : "ก."}
                          {i.unit === "pc" && i.gramsPerPiece ? ` · 1 ชิ้น ≈ ${i.gramsPerPiece} ก.` : ""}
                        </span>
                        {i.isEstimate && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]">ยังไม่ยืนยัน</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ROLE_OPTIONS.find((r) => r.value === i.defaultRole)?.label ?? i.defaultRole}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{i.calories}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{i.protein}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{i.carbs}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{i.fat}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{i.sodium ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{i.unit === "pc" ? "1 ชิ้น" : `${i.stepGrams} ก.`}</td>
                    <td className="px-4 py-3 text-gray-500">{i.usedIn > 0 ? `${i.usedIn} เมนู` : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(i)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title={i.usedIn > 0 ? "ยังมีสูตรใช้อยู่" : "ลบ"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && <IngredientForm form={form} setForm={setForm} onSaved={load} />}
    </div>
  );
}

function IngredientForm({
  form,
  setForm,
  onSaved,
}: {
  form: Form;
  setForm: (f: Form | null) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [looking, setLooking] = useState(false);

  const set = (patch: Form) => setForm({ ...form, ...patch });

  async function search() {
    if (lookup.trim().length < 2) return;
    setLooking(true);
    try {
      const res = await fetch(`/api/ingredients/suggest?q=${encodeURIComponent(lookup.trim())}`, { credentials: "include" });
      const json = await res.json();
      setSuggestions(json.items ?? []);
    } finally {
      setLooking(false);
    }
  }

  function apply(s: Suggestion) {
    setForm({
      ...form,
      name: form.name || s.name,
      unit: s.unit,
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
      sodium: s.sodium,
      sugar: s.sugar,
      source: s.source,
      isEstimate: true,
    });
    setSuggestions(null);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(form.id ? `/api/ingredients/${form.id}` : "/api/ingredients", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json.error || "บันทึกไม่สำเร็จ");
      setForm(null);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const numField = (key: keyof Ingredient, label: string, hint?: string) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        step="0.1"
        value={(form[key] as number | null | undefined) ?? ""}
        onChange={(e) => set({ [key]: e.target.value === "" ? null : parseFloat(e.target.value) } as Form)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
      />
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{form.id ? "แก้ไขวัตถุดิบ" : "เพิ่มวัตถุดิบ"}</h2>
          <button onClick={() => setForm(null)} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900">
            ตัวเลขทุกช่องเป็น <b>ค่าต่อ 100 ก. (หรือ 100 มล.)</b> ไม่ใช่ต่อจาน — เช่น อกไก่ย่างใส่ 180 kcal / โปรตีน 32
          </div>

          {/* ตัวช่วยกรอกจากคลังอาหาร */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">ช่วยกรอกจากคลังอาหาร (ไม่บังคับ)</p>
            <div className="flex gap-2">
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="พิมพ์ชื่อ เช่น อกไก่ย่าง"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              <button
                onClick={search}
                disabled={looking}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : "ค้นหา"}
              </button>
            </div>
            {suggestions && (
              <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                {suggestions.length === 0 && <p className="text-xs text-gray-400">ไม่พบ หรือแกะน้ำหนักหน่วยบริโภคไม่ออก — กรอกเองได้เลย</p>}
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => apply(s)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100"
                  >
                    <span className="text-sm text-gray-900">{s.name}</span>
                    <span className="block text-[11px] text-gray-500">
                      {s.portionText} → ต่อ 100 {s.unit === "ml" ? "มล." : "ก."}: {s.calories} kcal · P {s.protein} · C {s.carbs} · F {s.fat}
                    </span>
                  </button>
                ))}
                <p className="text-[11px] text-amber-700 flex items-start gap-1 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  ค่าที่เติมให้เป็นการหารจากน้ำหนักโดยประมาณในคลัง — ครัวต้องตรวจกับของจริงก่อนใช้ขาย
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">ชื่อวัตถุดิบ</label>
              <input
                value={form.name ?? ""}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="อกไก่ย่าง"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">หน่วย</label>
              <select
                value={form.unit ?? "g"}
                onChange={(e) => set({ unit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">บทบาทในจาน</label>
              <select
                value={form.defaultRole ?? "other"}
                onChange={(e) => set({ defaultRole: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-0.5">ระบบใช้บทบาทนี้เลือกว่าจะขยายตัวไหนเพื่อไล่มาโครตัวไหน</p>
            </div>

            {form.unit === "pc" && (
              <div className="col-span-2">
                {numField("gramsPerPiece", "น้ำหนักต่อ 1 ชิ้น (กรัม)", "ไข่ไก่ 1 ฟอง ≈ 50 ก. — ไม่ใส่จะคิดโภชนาการไม่ได้")}
              </div>
            )}

            {numField("calories", "แคลอรี่ (kcal)")}
            {numField("protein", "โปรตีน (ก.)")}
            {numField("carbs", "คาร์บ (ก.)")}
            {numField("fat", "ไขมัน (ก.)")}
            {numField("fiber", "ไฟเบอร์ (ก.)")}
            {numField("sodium", "โซเดียม (มก.)")}
            {numField("sugar", "น้ำตาล (ก.)")}

            <div>
              <label className="block text-xs text-gray-500 mb-1">ชั่งได้ทีละ (กรัม)</label>
              <input
                type="number"
                value={form.stepGrams ?? 10}
                onChange={(e) => set({ stepGrams: parseInt(e.target.value || "10", 10) })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">เนื้อ/ข้าว 10 · ซอส/เครื่องปรุง 5 — ระบบจะปัดปริมาณให้ลงตัวเสมอ</p>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">ที่มาของตัวเลข</label>
              <input
                value={form.source ?? ""}
                onChange={(e) => set({ source: e.target.value })}
                placeholder="ฉลากข้างถุง / ชั่งเอง / คลังอาหาร"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>

            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => set({ isActive: e.target.checked })}
                className="rounded"
              />
              เปิดใช้งาน (ปิดแล้วจะไม่ขึ้นให้เลือกในสูตรใหม่ แต่สูตรเดิมยังใช้ได้)
            </label>
          </div>

          {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-2 justify-end">
          <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
