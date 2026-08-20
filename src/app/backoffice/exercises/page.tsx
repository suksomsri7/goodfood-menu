"use client";

/**
 * คลังท่าออกกำลังกาย — เพิ่มท่า + ใส่รูปสาธิต (สูงสุด 6) + ลิงก์คลิป YouTube
 *
 * รูป/คลิปที่ใส่ตรงนี้ขึ้นในแอปทันที (ชีต "ดูท่า" ของหน้าแผน) ไม่ต้องรอ build แอป
 * ท่ามาตรฐาน 46 ท่าลบไม่ได้ (แผนเก่า/ตัวจัดแผนยังอ้างถึง) — ปิดใช้งานแทน · ท่าที่เพิ่มเองลบจริงได้
 */

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/backoffice/Header";
import { Dumbbell, Loader2, Plus, Search, Trash2, X, Youtube } from "lucide-react";

const KIND_OPTIONS = [
  { value: "cardio", label: "คาร์ดิโอ" },
  { value: "strength", label: "เวท/แรงต้าน" },
  { value: "mobility", label: "ยืดเหยียด" },
];
const TIER_OPTIONS = [
  { value: "none", label: "ตัวเปล่า" },
  { value: "home", label: "ดัมเบล/ยางยืด" },
  { value: "gym", label: "ฟิตเนส" },
];
const UNIT_OPTIONS = [
  { value: "reps", label: "นับครั้ง (เซ็ต×ครั้ง)" },
  { value: "minutes", label: "จับเวลา (นาที)" },
];

interface Exercise {
  id: string;
  key: string;
  name: string;
  kind: string;
  equipment: string;
  impact: string;
  unit: string;
  met: number;
  muscles: string | null;
  cue: string | null;
  images: string[];
  videoUrl: string | null;
  isCustom: boolean;
  isActive: boolean;
}

type Form = Partial<Exercise> & { id?: string };
const EMPTY: Form = { kind: "strength", equipment: "none", impact: "low", unit: "reps", met: 4, isActive: true, images: [] };

const label = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

export default function ExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [authErr, setAuthErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exercises", { credentials: "include" });
      if (res.status === 401) return setAuthErr(true);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch(form.id ? `/api/exercises/${form.id}` : "/api/exercises", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return alert(json.error || "บันทึกไม่สำเร็จ");
      setForm(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Exercise) {
    const msg = item.isCustom
      ? `ลบ "${item.name}" ถาวร?`
      : `"${item.name}" เป็นท่ามาตรฐาน จะปิดใช้งานแทนการลบ — ท่านี้จะไม่ถูกจัดลงแผนอีก ตกลง?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/exercises/${item.id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "ลบไม่สำเร็จ");
    load();
  }

  /** อ่านไฟล์รูปเป็น base64 — API อัปโหลดให้เอง (แพตเทิร์นเดียวกับเมนูอาหาร) */
  function addImages(files: FileList | null) {
    if (!files || !form) return;
    const room = 6 - (form.images?.length ?? 0);
    Array.from(files)
      .slice(0, room)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () =>
          setForm((f) => (f ? { ...f, images: [...(f.images ?? []), String(reader.result)] } : f));
        reader.readAsDataURL(file);
      });
  }

  const shown = q.trim() ? items.filter((i) => `${i.name} ${i.muscles ?? ""}`.includes(q.trim())) : items;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="ท่าออกกำลังกาย"
        subtitle="รูปสาธิต + คลิป YouTube ต่อท่า — ขึ้นในแอปทันที ไม่ต้องรอ build"
        actions={
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium hover:bg-[#43a047]"
          >
            <Plus className="w-4 h-4" /> เพิ่มท่า
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {authErr && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            เซสชันหลังบ้านหมดอายุ —
            <a href="/backoffice/login" className="underline font-semibold mx-1">เข้าสู่ระบบใหม่</a>
          </div>
        )}

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาท่า / กล้ามเนื้อ"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3">ท่า</th>
                  <th className="px-4 py-3">ชนิด</th>
                  <th className="px-4 py-3">อุปกรณ์</th>
                  <th className="px-4 py-3">หน่วย</th>
                  <th className="px-4 py-3">สื่อ</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setForm({ ...it })}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {it.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{it.name}</div>
                          <div className="text-xs text-gray-400">{it.muscles || (it.isCustom ? "ท่าที่เพิ่มเอง" : it.key)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{label(KIND_OPTIONS, it.kind)}</td>
                    <td className="px-4 py-3">{label(TIER_OPTIONS, it.equipment)}</td>
                    <td className="px-4 py-3">{it.unit === "reps" ? "เซ็ต×ครั้ง" : "นาที"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {it.images.length > 0 && `🖼 ${it.images.length}`}
                        {it.images.length > 0 && it.videoUrl && " · "}
                        {it.videoUrl && "▶ คลิป"}
                        {it.images.length === 0 && !it.videoUrl && "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {it.isActive ? (
                        <span className="text-xs text-green-600">ใช้งาน</span>
                      ) : (
                        <span className="text-xs text-gray-400">ปิดอยู่</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(it); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
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

      {/* ── ฟอร์มเพิ่ม/แก้ ── */}
      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 my-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{form.id ? `แก้ไข: ${form.name}` : "เพิ่มท่าออกกำลังกาย"}</h2>
              <button onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500">ชื่อท่า (ภาษาไทย)</label>
                <input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น สควอทน้ำหนักตัว"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">ชนิด</label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">อุปกรณ์</label>
                <select
                  value={form.equipment}
                  onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  {TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500">วิธีนับ</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">แรงกระแทก (เข่า/กระโดด)</label>
                <select
                  value={form.impact}
                  onChange={(e) => setForm({ ...form, impact: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  <option value="low">ต่ำ</option>
                  <option value="high">สูง (มีกระโดด)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500">MET (ความหนัก — ใช้คิดแคลอรี่)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.met ?? 4}
                  onChange={(e) => setForm({ ...form, met: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">เดินเร็ว 4.3 · วิ่งเหยาะ 7 · เวทปานกลาง 5 · ยืดเหยียด 2.3</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">กล้ามเนื้อที่ใช้</label>
                <input
                  value={form.muscles ?? ""}
                  onChange={(e) => setForm({ ...form, muscles: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น ต้นขา · สะโพก · แกนกลาง"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500">วิธีทำ / ทิปฟอร์ม (โชว์ในแอป)</label>
                <textarea
                  value={form.cue ?? ""}
                  onChange={(e) => setForm({ ...form, cue: e.target.value })}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น ยืนกว้างเท่าไหล่ ดันสะโพกไปหลังเหมือนนั่งเก้าอี้ เข่าไม่เลยปลายเท้า"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Youtube className="w-3.5 h-3.5" /> คลิป YouTube
                </label>
                <input
                  type="text"
                  value={form.videoUrl ?? ""}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="https://www.youtube.com/shorts/... (วางแบบไหนก็ได้)"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500">รูปสาธิต (สูงสุด 6 — ลูกค้าปัดดูในแอปได้)</label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {(form.images ?? []).map((img, i) => (
                    <div key={i} className="relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={() => setForm({ ...form, images: (form.images ?? []).filter((_, j) => j !== i) })}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(form.images?.length ?? 0) < 6 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-300">
                      <Plus className="w-5 h-5 text-gray-400" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>

              {form.id && (
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="active"
                    type="checkbox"
                    checked={form.isActive !== false}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <label htmlFor="active" className="text-sm text-gray-700">เปิดใช้งาน (ปิด = ไม่ถูกจัดลงแผน และหายจากแอป)</label>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg bg-[#4CAF50] text-white text-sm font-medium hover:bg-[#43a047] disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => setForm(null)} className="px-6 py-2.5 rounded-lg border border-gray-200 text-sm">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
