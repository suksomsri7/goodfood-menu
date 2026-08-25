"use client";

/**
 * คลังวัตถุดิบ — ฐานของโภชนาการเฉพาะบุคคลทั้งระบบ + เมนูที่ลูกค้าเลือกเองในแอป
 *
 * 🔴 ทุกตัวเลขโภชนาการในหน้านี้คือ "ต่อ 100 ก./มล." ไม่ใช่ต่อจาน
 *    ย้ำไว้ทุกที่ในฟอร์มเพราะกรอกผิดฐานทีเดียว อาหารทุกกล่องที่ใช้วัตถุดิบนี้เพี้ยนพร้อมกัน
 *
 * 🔴 ส่วน "จอสั่งอาหารในแอป" (รูป / ขั้น / ปริมาณต่อ 1 ที่ / ราคาต่อที่) คือของที่ลูกค้าเห็นจริง
 *    ปริมาณต่อที่เป็นตัวแปลงค่าต่อ 100 → ต่อที่ ถ้าเว้นว่าง วัตถุดิบตัวนั้นจะไม่ขึ้นในแอปเลย
 *    ฟอร์มมีแถบ "ต่อ 1 ที่" คำนวณสดให้เห็นก่อนบันทึกเสมอ
 *
 * มีปุ่มค้นจากคลังอาหาร 856 รายการไว้ช่วยกรอก — แต่ค่าที่ได้ติดธง "ยังไม่ยืนยัน"
 * จนกว่าครัวจะกดแก้เอง เพราะคลังนั้นเป็นค่าประมาณและหลายแถวเป็นจานสำเร็จ ไม่ใช่วัตถุดิบเดี่ยว
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Header } from "@/components/backoffice/Header";
import { AlertTriangle, ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { ALLERGEN_OPTIONS, BOWL_STEPS, perPortion, portionLabel } from "@/lib/bowl";

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
  nameEn: string | null;
  displayName: string | null;
  imageUrl: string | null;
  bowlStep: string | null;
  portionSize: number | null;
  portionPrice: number;
  allergens: string[];
  sortOrder: number;
  soldOut: boolean;
  soldOutAt: string | null;
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

const EMPTY: Form = { unit: "g", defaultRole: "other", stepGrams: 10, isActive: true, portionPrice: 0, allergens: [] };

const FILTERS = [
  { value: "", label: "ทั้งหมด" },
  ...BOWL_STEPS.map((s) => ({ value: s.key, label: `${s.no}. ${s.th}` })),
  { value: "none", label: "ไม่ขึ้นในแอป" },
];

export default function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [step, setStep] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [authErr, setAuthErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: "1" });
      if (q) params.set("q", q);
      if (step) params.set("step", step);
      const res = await fetch(`/api/ingredients?${params}`, { credentials: "include" });
      if (res.status === 401) return setAuthErr(true);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, step]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // ครัวต้องกดได้เร็วตอนของหมดกลางวัน — คลิกเดียวจากตาราง ไม่ต้องเปิดฟอร์ม
  async function toggleSoldOut(item: Ingredient) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, soldOut: !x.soldOut } : x)));
    const res = await fetch(`/api/ingredients/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ soldOut: !item.soldOut, isEstimate: item.isEstimate }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "เปลี่ยนสถานะไม่สำเร็จ");
    }
    load();
  }

  async function remove(item: Ingredient) {
    if (!confirm(`ลบ "${item.name}" ออกจากคลัง?`)) return;
    const res = await fetch(`/api/ingredients/${item.id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "ลบไม่สำเร็จ");
    load();
  }

  // นับเฉพาะตัวที่ "พร้อมขึ้นแอปจริง" — มีขั้น มีปริมาณต่อที่ และเปิดใช้งาน
  const readyCount = items.filter((i) => i.bowlStep && i.portionSize && i.isActive && !i.soldOut).length;
  const soldOutCount = items.filter((i) => i.soldOut).length;
  const missingImage = items.filter((i) => i.bowlStep && !i.imageUrl).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="คลังวัตถุดิบ"
        subtitle="โภชนาการต่อ 100 ก./มล. + ของที่ลูกค้าเลือกเองในแอป (รูป · ปริมาณต่อที่ · ราคาต่อที่)"
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาวัตถุดิบ (ไทย/อังกฤษ)"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStep(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  step === f.value
                    ? "bg-[#4CAF50] text-white border-[#4CAF50]"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600">
            ขึ้นในแอปแล้ว <b className="text-gray-900">{readyCount}</b> รายการ
          </span>
          {soldOutCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700">
              ของหมดอยู่ {soldOutCount} รายการ — ไม่ขึ้นในแอปตอนนี้
            </span>
          )}
          {missingImage > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              ยังไม่มีรูป {missingImage} รายการ — ลูกค้าจะเห็นเป็นช่องว่าง
            </span>
          )}
        </div>

        <BowlConfigBar />

        {step && step !== "none" && (
          <p className="text-xs text-gray-500">
            ลูกค้าเลือกขั้นนี้ได้สูงสุด <b>{BOWL_STEPS.find((s) => s.key === step)?.limit} ที่</b> — นับเป็นจำนวนที่รวม
            เช่น 2 ที่ = สั่งอย่างเดียว 2 ที่ หรือ อย่างละ 1 ที่ 2 อย่างก็ได้
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <p className="text-gray-500 text-sm">
              {q || step ? "ไม่พบวัตถุดิบที่ค้น" : "ยังไม่มีวัตถุดิบในคลัง — เพิ่มตัวแรกเพื่อเริ่มลงสูตรอาหาร"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3">วัตถุดิบ</th>
                  <th className="px-4 py-3">ขั้นในแอป</th>
                  <th className="px-4 py-3">ต่อ 1 ที่</th>
                  <th className="px-4 py-3 text-right">kcal/ที่</th>
                  <th className="px-4 py-3 text-right">P/ที่</th>
                  <th className="px-4 py-3 text-right">ราคา/ที่</th>
                  <th className="px-4 py-3 text-right">kcal/100</th>
                  <th className="px-4 py-3">แพ้</th>
                  <th className="px-4 py-3">สถานะในแอป</th>
                  <th className="px-4 py-3">ใช้ในสูตร</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const per = i.portionSize ? perPortion(i) : null;
                  const stepDef = BOWL_STEPS.find((s) => s.key === i.bowlStep);
                  return (
                    <tr key={i.id} className={`border-b border-gray-50 last:border-0 ${i.isActive ? "" : "opacity-50"} ${i.soldOut ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {i.imageUrl ? (
                            <Image
                              src={i.imageUrl}
                              alt={i.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <ImagePlus className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => setForm({ ...i })}
                              className="font-medium text-gray-900 hover:text-[#4CAF50]"
                            >
                              {i.displayName || i.name}
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-400">
                                {i.nameEn ? `${i.nameEn} · ` : ""}ต่อ 100 {i.unit === "ml" ? "มล." : "ก."}
                              </span>
                              {i.isEstimate && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]">
                                  ยังไม่ยืนยัน
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {stepDef ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs">
                            {stepDef.no}. {stepDef.th}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">— ไม่ขึ้นในแอป</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{i.portionSize ? portionLabel(i) : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{per ? per.calories : "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{per ? per.protein : "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {i.bowlStep ? (i.portionPrice > 0 ? `${i.portionPrice} ฿` : "รวมในฐาน") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{i.calories}</td>
                      <td className="px-4 py-3">
                        {i.allergens.length > 0 ? (
                          <span className="text-xs text-red-600">
                            {i.allergens
                              .map((a) => ALLERGEN_OPTIONS.find((o) => o.value === a)?.label ?? a)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {i.bowlStep ? (
                          <button
                            onClick={() => toggleSoldOut(i)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                              i.soldOut
                                ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            }`}
                            title={i.soldOut ? "กดเพื่อเปลี่ยนเป็นมีของ" : "กดเพื่อแจ้งว่าของหมด (หายจากแอปทันที)"}
                          >
                            {i.soldOut ? "หมด — กดเพื่อเปิดขาย" : "มีของ"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && <IngredientForm form={form} setForm={setForm} onSaved={load} />}
    </div>
  );
}

/**
 * ราคาฐานของชาม + เพดานจำนวนที่ต่อขั้น
 * ราคาฐานคลุม base + ผัก + ซอส + ของโรยหน้าไว้แล้ว ตัวที่บวกเพิ่มคือ "ราคาต่อ 1 ที่" ของแต่ละวัตถุดิบ
 */
function BowlConfigBar() {
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/bowl/config", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setBasePrice(d.basePrice);
        setLimits(Object.fromEntries((d.steps ?? []).map((s: { key: string; limit: number }) => [s.key, s.limit])));
      })
      .catch(() => {});
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/bowl/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ basePrice, limits }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return alert(json.error || "บันทึกไม่สำเร็จ");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  if (basePrice === null) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ราคาฐานของชาม (บาท)</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(parseInt(e.target.value || "0", 10))}
            className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
          <p className="text-[11px] text-gray-400 mt-0.5">รวม ฐาน + ผัก + ซอส + โรยหน้าแล้ว</p>
        </div>
        {BOWL_STEPS.map((s) => (
          <div key={s.key}>
            <label className="block text-xs text-gray-500 mb-1">
              {s.no}. {s.th} (ที่)
            </label>
            <input
              type="number"
              min={1}
              max={9}
              value={limits[s.key] ?? s.limit}
              onChange={(e) => setLimits({ ...limits, [s.key]: parseInt(e.target.value || "1", 10) })}
              className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>
        ))}
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก..." : saved ? "บันทึกแล้ว ✓" : "บันทึกราคาฐาน"}
        </button>
      </div>
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
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Form) => setForm({ ...form, ...patch });

  // ตัวเลข "ต่อ 1 ที่" ที่ลูกค้าจะเห็นจริง — คำนวณสดจากค่าต่อ 100 ในฟอร์ม
  const preview = useMemo(() => {
    if (!form.portionSize) return null;
    return perPortion({
      unit: form.unit ?? "g",
      gramsPerPiece: form.gramsPerPiece ?? null,
      calories: form.calories ?? 0,
      protein: form.protein ?? 0,
      carbs: form.carbs ?? 0,
      fat: form.fat ?? 0,
      fiber: form.fiber ?? null,
      sodium: form.sodium ?? null,
      sugar: form.sugar ?? null,
      portionSize: form.portionSize,
    });
  }, [form]);

  async function search() {
    if (lookup.trim().length < 2) return;
    setLooking(true);
    try {
      const res = await fetch(`/api/ingredients/suggest?q=${encodeURIComponent(lookup.trim())}`, {
        credentials: "include",
      });
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

  function pickImage(file: File) {
    if (file.size > 4 * 1024 * 1024) return setErr("รูปใหญ่เกิน 4MB — ย่อก่อนอัปโหลด");
    const reader = new FileReader();
    reader.onload = () => set({ imageUrl: String(reader.result) });
    reader.readAsDataURL(file);
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

  const unitWord = form.unit === "ml" ? "มล." : form.unit === "pc" ? "ชิ้น" : "ก.";

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
            ตัวเลขโภชนาการทุกช่องเป็น <b>ค่าต่อ 100 ก. (หรือ 100 มล.)</b> ไม่ใช่ต่อจาน — เช่น อกไก่ย่างใส่ 180 kcal /
            โปรตีน 32 · ส่วนราคากับปริมาณที่ลูกค้าเห็นอยู่ในหัวข้อ &ldquo;จอสั่งอาหารในแอป&rdquo; ด้านล่าง
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
                {suggestions.length === 0 && (
                  <p className="text-xs text-gray-400">ไม่พบ หรือแกะน้ำหนักหน่วยบริโภคไม่ออก — กรอกเองได้เลย</p>
                )}
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => apply(s)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100"
                  >
                    <span className="text-sm text-gray-900">{s.name}</span>
                    <span className="block text-[11px] text-gray-500">
                      {s.portionText} → ต่อ 100 {s.unit === "ml" ? "มล." : "ก."}: {s.calories} kcal · P {s.protein} · C{" "}
                      {s.carbs} · F {s.fat}
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อวัตถุดิบ (ไทย)</label>
              <input
                value={form.name ?? ""}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="อกไก่ย่าง"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่ออังกฤษ (โชว์ในแอป)</label>
              <input
                value={form.nameEn ?? ""}
                onChange={(e) => set({ nameEn: e.target.value })}
                placeholder="Grilled Chicken"
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
              เปิดใช้งาน (ปิดแล้วจะไม่ขึ้นให้เลือกในสูตรใหม่และในแอป แต่สูตรเดิมยังใช้ได้)
            </label>
          </div>

          {/* ── จอสั่งอาหารในแอป ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">จอสั่งอาหารในแอป</p>
              <p className="text-[11px] text-gray-500">
                กรอกครบ = ลูกค้าเลือกวัตถุดิบตัวนี้เองได้ · เว้นช่อง &ldquo;ขั้น&rdquo; ไว้ = ใช้หลังบ้านอย่างเดียว
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- รองรับ data URL ตอนเลือกไฟล์ก่อนอัปโหลด
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="w-24 h-24 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">รูปวัตถุดิบ</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                    >
                      เลือกรูป
                    </button>
                    {form.imageUrl && (
                      <button
                        onClick={() => set({ imageUrl: null })}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-red-600 hover:bg-red-50"
                      >
                        เอารูปออก
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    ถ่ายจากมุมบน พื้นหลังสีอ่อน เห็นของเต็มจาน — รูปสี่เหลี่ยมจัตุรัสจะสวยที่สุดในแอป
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ขั้นที่ลูกค้าเลือกตัวนี้</label>
                  <select
                    value={form.bowlStep ?? ""}
                    onChange={(e) => set({ bowlStep: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="">— ไม่ขึ้นในแอป —</option>
                    {BOWL_STEPS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.no}. {s.title} ({s.th}) · สูงสุด {s.limit} ที่
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">ชื่อที่โชว์ในแอป (เว้นไว้ = ใช้ชื่อในคลัง)</label>
                  <input
                    value={form.displayName ?? ""}
                    onChange={(e) => set({ displayName: e.target.value })}
                    placeholder={form.name ?? "ข้าวโพด"}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    ใช้ตอนของเดียวกันขายคนละขั้น — คลังต้องแยกแถว (&ldquo;ข้าวโพด (ฐาน)&rdquo; / &ldquo;ข้าวโพด (ผัก)&rdquo;)
                    แต่ลูกค้าเห็นแค่ &ldquo;ข้าวโพด&rdquo;
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">ลำดับที่โชว์</label>
                  <input
                    type="number"
                    value={form.sortOrder ?? 0}
                    onChange={(e) => set({ sortOrder: parseInt(e.target.value || "0", 10) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">เลขน้อยขึ้นก่อน (1, 2, 3…)</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">ปริมาณต่อ 1 ที่ ({unitWord})</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.portionSize ?? ""}
                    onChange={(e) => set({ portionSize: e.target.value === "" ? null : parseFloat(e.target.value) })}
                    placeholder={form.unit === "pc" ? "2" : "100"}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {form.unit === "pc"
                      ? "จำนวนชิ้นต่อ 1 ที่ เช่น ไข่ 2 ฟอง"
                      : "ครัวตักจริงกี่กรัมต่อ 1 ที่ — ตัวนี้เป็นตัวแปลงแคลอรี่ให้แอป"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">ราคาบวกเพิ่มต่อ 1 ที่ (บาท)</label>
                  <input
                    type="number"
                    value={form.portionPrice ?? 0}
                    onChange={(e) => set({ portionPrice: parseInt(e.target.value || "0", 10) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">0 = รวมอยู่ในราคาฐานของชามแล้ว (ตั้งราคาฐานที่หน้าตั้งค่า)</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">สารก่อภูมิแพ้ในวัตถุดิบนี้</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGEN_OPTIONS.map((a) => {
                    const on = (form.allergens ?? []).includes(a.value);
                    return (
                      <button
                        key={a.value}
                        onClick={() =>
                          set({
                            allergens: on
                              ? (form.allergens ?? []).filter((x) => x !== a.value)
                              : [...(form.allergens ?? []), a.value],
                          })
                        }
                        className={`px-2.5 py-1 rounded-full text-xs border ${
                          on ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-gray-600 border-gray-200"
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  ติดไว้แล้วแอปจะล็อกปุ่มไม่ให้คนที่แพ้กดเลือก พร้อมบอกเหตุผลบนรูป
                </p>
              </div>

              {/* กันกรอกผิดฐาน: โชว์ของจริงที่ลูกค้าจะเห็นก่อนกดบันทึก */}
              {preview && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs font-medium text-emerald-900 mb-1">
                    ลูกค้าจะเห็นแบบนี้ต่อ 1 ที่ ({portionLabel({ unit: form.unit ?? "g", gramsPerPiece: form.gramsPerPiece ?? null, calories: 0, protein: 0, carbs: 0, fat: 0, portionSize: form.portionSize })})
                  </p>
                  <p className="text-sm text-emerald-800">
                    <b>{preview.calories} kcal</b> · โปรตีน {preview.protein} ก. · คาร์บ {preview.carbs} ก. · ไขมัน{" "}
                    {preview.fat} ก. · โซเดียม {preview.sodium} มก. · น้ำตาล {preview.sugar} ก.
                    {" · "}
                    <b>{(form.portionPrice ?? 0) > 0 ? `+${form.portionPrice} ฿` : "รวมในราคาฐาน"}</b>
                  </p>
                </div>
              )}
            </div>
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
