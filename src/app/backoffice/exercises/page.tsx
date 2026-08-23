"use client";

/**
 * คลังท่าออกกำลังกาย — เพิ่มท่า + ใส่รูปสาธิต (สูงสุด 6) + ลิงก์คลิป YouTube
 *
 * รูป/คลิปที่ใส่ตรงนี้ขึ้นในแอปทันที (ชีต "ดูท่า" ของหน้าแผน) ไม่ต้องรอ build แอป
 * ท่ามาตรฐาน (จากคลังโค้ด exerciseCatalog.ts) ลบไม่ได้ (แผนเก่า/ตัวจัดแผนยังอ้างถึง) — ปิดใช้งานแทน
 * ท่าที่เพิ่มเองลบจริงได้ · คลังโตเกิน 100 ท่าแล้ว จึงมีแถบตัวกรองด้านบนไว้หาท่าให้เจอ
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

/* metadata ของ engine เทรน (เฟส A) — ค่าตรงนี้คือสิ่งที่ระบบใช้หา "ท่าแทน" ตอนลูกค้าเจ็บ/ไม่มีอุปกรณ์
   จึงเป็นชิป/ดรอปดาวน์ให้เลือก ไม่ใช่ช่องพิมพ์อิสระ (คำที่พิมพ์เองระบบจับคู่ไม่ได้) */
const PATTERN_OPTIONS = [
  { value: "", label: "— ยังไม่ระบุ —" },
  { value: "squat", label: "ย่อเข่า (squat)" },
  { value: "hinge", label: "พับสะโพก (hinge)" },
  { value: "push_h", label: "ดันแนวนอน (push_h)" },
  { value: "push_v", label: "ดันเหนือหัว (push_v)" },
  { value: "pull_h", label: "ดึงแนวนอน (pull_h)" },
  { value: "pull_v", label: "ดึงแนวดิ่ง (pull_v)" },
  { value: "lunge", label: "ก้าวขาเดียว (lunge)" },
  { value: "core", label: "แกนกลาง (core)" },
  { value: "carry", label: "ถือเดิน (carry)" },
  { value: "cardio", label: "คาร์ดิโอ" },
  { value: "mobility", label: "ยืดเหยียด" },
];
const MUSCLE_OPTIONS: { value: string; label: string }[] = [
  { value: "quads", label: "ต้นขาหน้า" },
  { value: "hamstrings", label: "ต้นขาหลัง" },
  { value: "glutes", label: "ก้น" },
  { value: "calves", label: "น่อง" },
  { value: "adductors", label: "ต้นขาด้านใน" },
  { value: "hip_flexors", label: "สะโพกหน้า" },
  { value: "chest", label: "อก" },
  { value: "back", label: "หลัง" },
  { value: "lats", label: "ปีก" },
  { value: "traps", label: "บ่า" },
  { value: "shoulders", label: "ไหล่" },
  { value: "biceps", label: "แขนหน้า" },
  { value: "triceps", label: "แขนหลัง" },
  { value: "forearms", label: "ปลายแขน" },
  { value: "core", label: "แกนกลาง" },
  { value: "obliques", label: "เอว" },
  { value: "lower_back", label: "หลังล่าง" },
  { value: "full_body", label: "ทั้งตัว" },
];
const EQUIPMENT_NEEDED_OPTIONS: { value: string; label: string }[] = [
  { value: "dumbbell", label: "ดัมเบล" },
  { value: "barbell", label: "บาร์เบล" },
  { value: "kettlebell", label: "เคตเทิลเบล" },
  { value: "band", label: "ยางยืด" },
  { value: "bench", label: "ม้านั่ง" },
  { value: "pullup_bar", label: "บาร์โหน" },
  { value: "machine", label: "เครื่องฟิตเนส" },
  { value: "treadmill", label: "ลู่วิ่ง" },
  { value: "bike", label: "จักรยาน" },
];

interface Exercise {
  id: string;
  key: string;
  name: string;
  nameEn: string | null;
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
  pattern: string | null;
  primaryMuscles: string[];
  loadable: boolean;
  equipmentNeeded: string[];
  difficulty: number;
  progressionGroup: string | null;
  commonMistakes: string | null;
}

type Form = Partial<Exercise> & { id?: string };
const EMPTY: Form = {
  kind: "strength", equipment: "none", impact: "low", unit: "reps", met: 4, isActive: true, images: [],
  pattern: "", primaryMuscles: [], loadable: false, equipmentNeeded: [], difficulty: 2,
};

const label = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

export default function ExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // ตัวกรอง: คลังโตเกิน 100 ท่าแล้ว เลื่อนหาด้วยตาไม่ไหว
  const [fKind, setFKind] = useState("");
  const [fEquip, setFEquip] = useState("");
  const [fPattern, setFPattern] = useState("");
  const [fActive, setFActive] = useState(false);
  const [fNoImage, setFNoImage] = useState(false);
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

  /** ชิปเลือกได้หลายค่า (กล้ามเนื้อหลัก / อุปกรณ์ที่ต้องใช้) — กดซ้ำ = เอาออก */
  function toggleTag(field: "primaryMuscles" | "equipmentNeeded", value: string) {
    setForm((f) => {
      if (!f) return f;
      const cur = f[field] ?? [];
      return { ...f, [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }

  /* กรองฝั่งเบราว์เซอร์ทั้งหมด — คลังมีหลักร้อยท่า โหลดครั้งเดียวแล้วกรองในเครื่องเร็วกว่ายิง API ทุกคีย์
     ค้นหาจับทั้งชื่อไทย/ชื่ออังกฤษ/key/กล้ามเนื้อ (เจ้าของร้านพิมพ์ "squat" ก็ต้องเจอ "สควอทน้ำหนักตัว") */
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) => {
    if (needle && !`${i.name} ${i.nameEn ?? ""} ${i.key} ${i.muscles ?? ""}`.toLowerCase().includes(needle)) return false;
    if (fKind && i.kind !== fKind) return false;
    // ช่องอุปกรณ์รวม 2 เรื่องไว้ด้วยกัน: ระดับอุปกรณ์ (tier:none/home/gym) กับอุปกรณ์รายชิ้น
    if (fEquip.startsWith("tier:") && i.equipment !== fEquip.slice(5)) return false;
    if (fEquip.startsWith("need:") && !(i.equipmentNeeded ?? []).includes(fEquip.slice(5))) return false;
    if (fPattern === "none" ? !!i.pattern : fPattern && i.pattern !== fPattern) return false;
    if (fActive && !i.isActive) return false;
    if (fNoImage && (i.images?.length ?? 0) > 0) return false;
    return true;
  });
  const filterOn = !!(needle || fKind || fEquip || fPattern || fActive || fNoImage);
  const selectCls = "px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white";
  const toggleCls = (on: boolean) =>
    `px-3 py-2 rounded-lg border text-sm ${on ? "bg-[#4CAF50] text-white border-[#4CAF50]" : "bg-white text-gray-600 border-gray-200"}`;

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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา: ชื่อไทย / ชื่ออังกฤษ / key / กล้ามเนื้อ"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
            />
          </div>

          <select value={fKind} onChange={(e) => setFKind(e.target.value)} className={selectCls}>
            <option value="">ชนิด: ทั้งหมด</option>
            {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select value={fEquip} onChange={(e) => setFEquip(e.target.value)} className={selectCls}>
            <option value="">อุปกรณ์: ทั้งหมด</option>
            <optgroup label="ระดับอุปกรณ์">
              {TIER_OPTIONS.map((o) => <option key={o.value} value={`tier:${o.value}`}>{o.label}</option>)}
            </optgroup>
            <optgroup label="ต้องใช้ชิ้นนี้">
              {EQUIPMENT_NEEDED_OPTIONS.map((o) => <option key={o.value} value={`need:${o.value}`}>{o.label}</option>)}
            </optgroup>
          </select>

          <select value={fPattern} onChange={(e) => setFPattern(e.target.value)} className={selectCls}>
            <option value="">รูปแบบ: ทั้งหมด</option>
            <option value="none">ยังไม่ระบุ</option>
            {PATTERN_OPTIONS.filter((o) => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <button type="button" onClick={() => setFActive((v) => !v)} className={toggleCls(fActive)}>
            เฉพาะที่เปิดใช้งาน
          </button>
          {/* ปุ่มนี้มีไว้ให้เจ้าของไล่อัปรูปทีละท่าจนครบ — ไม่มีรูป = ลูกค้าเห็นแต่ชื่อในแอป */}
          <button type="button" onClick={() => setFNoImage((v) => !v)} className={toggleCls(fNoImage)}>
            ยังไม่มีรูป
          </button>

          {filterOn && (
            <button
              type="button"
              onClick={() => { setQ(""); setFKind(""); setFEquip(""); setFPattern(""); setFActive(false); setFNoImage(false); }}
              className="px-3 py-2 text-sm text-gray-500 underline"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">แสดง {shown.length} จาก {items.length} ท่า</p>

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
                  <th className="px-4 py-3">รูปแบบ</th>
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
                          {/* ชื่ออังกฤษไว้ใต้ชื่อไทย — ใช้เทียบกับคลิปฝรั่ง/คุยกับเทรนเนอร์ */}
                          <div className="text-xs text-gray-500">{it.nameEn || "—"}</div>
                          <div className="text-xs text-gray-400">{it.muscles || (it.isCustom ? "ท่าที่เพิ่มเอง" : it.key)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{label(KIND_OPTIONS, it.kind)}</td>
                    <td className="px-4 py-3">
                      {it.pattern ? (
                        <span className="text-xs text-gray-600">{label(PATTERN_OPTIONS, it.pattern)}</span>
                      ) : (
                        // ยังไม่กรอก = engine จัดท่าแทนให้ท่านี้ไม่ได้ → ทำให้เห็นชัดว่าต้องเติม
                        <span className="text-xs text-amber-600">ยังไม่ระบุ</span>
                      )}
                    </td>
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
              <div>
                <label className="text-xs text-gray-500">ชื่อท่า (ภาษาไทย)</label>
                <input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น สควอทน้ำหนักตัว"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">ชื่อสากล (อังกฤษ)</label>
                <input
                  value={form.nameEn ?? ""}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น Bodyweight Squat"
                />
                <p className="text-[11px] text-gray-400 mt-1">ใช้ค้นหาในหลังบ้าน + หาคลิปอ้างอิง (ไม่โชว์ในแอปลูกค้า)</p>
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

              {/* ── metadata สำหรับระบบเทรน: ท่าแทน + บันไดความยาก ── */}
              <div className="col-span-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700">ข้อมูลสำหรับระบบเทรน</p>
                <p className="text-[11px] text-gray-400">ใช้หาท่าแทนตอนลูกค้าเจ็บ/ไม่มีอุปกรณ์ และเรียงบันไดความยาก</p>
              </div>

              <div>
                <label className="text-xs text-gray-500">รูปแบบการเคลื่อนไหว (pattern)</label>
                <select
                  value={form.pattern ?? ""}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  {PATTERN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">ความยาก 1-5</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.difficulty ?? 2}
                  onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">1 = มือใหม่ทำได้เลย · 5 = ต้องมีพื้นฐานแน่น</p>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500">กล้ามเนื้อหลัก (เลือกได้หลายมัด)</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MUSCLE_OPTIONS.map((o) => {
                    const on = (form.primaryMuscles ?? []).includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleTag("primaryMuscles", o.value)}
                        className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-[#4CAF50] text-white border-[#4CAF50]" : "bg-white text-gray-600 border-gray-200"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500">อุปกรณ์ที่ต้องใช้ (ไม่เลือก = ตัวเปล่า)</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EQUIPMENT_NEEDED_OPTIONS.map((o) => {
                    const on = (form.equipmentNeeded ?? []).includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleTag("equipmentNeeded", o.value)}
                        className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-[#4CAF50] text-white border-[#4CAF50]" : "bg-white text-gray-600 border-gray-200"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input
                  id="loadable"
                  type="checkbox"
                  checked={form.loadable === true}
                  onChange={(e) => setForm({ ...form, loadable: e.target.checked })}
                />
                <label htmlFor="loadable" className="text-sm text-gray-700">
                  เพิ่มน้ำหนักได้จริง (ดัมเบล/บาร์เบล/เคตเทิล) — ระบบจะสั่งขึ้นน้ำหนักเป็นกิโล
                </label>
              </div>

              <div>
                <label className="text-xs text-gray-500">กลุ่มบันไดความยาก</label>
                <input
                  value={form.progressionGroup ?? ""}
                  onChange={(e) => setForm({ ...form, progressionGroup: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น pushup · squat_bw · plank · row"
                />
                <p className="text-[11px] text-gray-400 mt-1">ท่ากลุ่มเดียวกันเรียงตามความยาก — ห้ามปนท่ากระโดดกับท่าไม่กระโดด</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">ข้อผิดพลาดที่พบบ่อย</label>
                <input
                  value={form.commonMistakes ?? ""}
                  onChange={(e) => setForm({ ...form, commonMistakes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="เช่น เข่าบิดเข้าใน · หลังงอตอนลง"
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
