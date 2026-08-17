"use client";

/**
 * ปฏิทินเมนู — งานหลักของ admin คือ "เติมรันเวย์ให้เต็มเสมอ"
 *
 * เลย์เอาต์: 1 การ์ดต่อ 1 วัน · ในการ์ดแบ่งเป็น 4 สาย × มื้อที่ขาย
 * เลือกแบบนี้แทนตารางใหญ่เพราะ 7 วัน × 4 สาย × 4 มื้อ = 112 ช่อง
 * ถ้าอัดเป็นตารางเดียวจะเล็กจนกดผิด และเลื่อนซ้ายขวาแล้วหลงว่าอยู่วันไหน
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/backoffice/Header";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  X,
} from "lucide-react";

interface FoodOpt {
  id: string;
  name: string;
  image: string | null;
  price: number;
  category: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  sugar: number | null;
  tracks: string[];
}

interface Cell {
  id: string;
  date: string;
  track: string;
  slot: string;
  note: string | null;
  food: Omit<FoodOpt, "category" | "tracks">;
  conflicts: string[];
}

interface Data {
  from: string;
  days: { date: string; label: string }[];
  tracks: { key: string; label: string }[];
  slots: string[];
  cells: Cell[];
  runway: {
    days: number;
    lastFullLabel: string | null;
    required: number;
    ok: boolean;
    missing: { date: string; track: string; slot: string }[];
  };
  foods: FoodOpt[];
}

const todayKey = () => {
  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
};

const shiftKey = (key: string, days: number) =>
  new Date(new Date(`${key}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

export default function MenuCalendarPage() {
  const [from, setFrom] = useState(todayKey);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ date: string; track: string; slot: string } | null>(null);
  const [copying, setCopying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/program/calendar?from=${from}&days=7`, { credentials: "include" });
      if (res.ok) setData(await res.json());
      else if (res.status === 401) setToast("เซสชันหลังบ้านหมดอายุ — กรุณาเข้าสู่ระบบใหม่ที่ /backoffice/login");
      else setToast((await res.json().catch(() => ({}))).error ?? "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const cellAt = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of data?.cells ?? []) m.set(`${c.date}|${c.track}|${c.slot}`, c);
    return m;
  }, [data]);

  async function setCell(date: string, track: string, slot: string, foodId: string | null) {
    const key = `${date}|${track}|${slot}`;
    setSaving(key);
    try {
      const res = await fetch("/api/program/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, track, slot, foodId }),
      });
      const json = await res.json();
      if (!res.ok) setToast(json.error ?? "บันทึกไม่สำเร็จ");
      else await load();
    } finally {
      setSaving(null);
      setPicker(null);
    }
  }

  async function copyWeek() {
    setCopying(true);
    try {
      const res = await fetch("/api/program/calendar/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ from: shiftKey(from, -7), to: from, days: 7 }),
      });
      const json = await res.json();
      setToast(json.error ?? json.message);
      if (res.ok) await load();
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
      <Header title="ปฏิทินเมนู" subtitle="วางเมนูล่วงหน้า — ครัวทำวันละชุดเดียว ทุกคนกินเหมือนกัน" />

      <div className="p-6 space-y-5">
        {/* แถบรันเวย์ — ตัวเลขที่สำคัญที่สุดของหน้านี้ */}
        {data && (
          <div
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              data.runway.ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-300"
            }`}
          >
            {data.runway.ok ? (
              <Check className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div className="text-sm">
              {data.runway.ok ? (
                <p className="font-semibold text-green-800">
                  ปฏิทินเต็มถึง {data.runway.lastFullLabel} — ขายคอร์สได้ตามปกติ
                </p>
              ) : (
                <>
                  <p className="font-semibold text-amber-900">
                    ปฏิทินเต็มแค่ {data.runway.days} วัน (ต้องการ {data.runway.required} วัน) — ยังขายคอร์สใหม่ไม่ได้
                  </p>
                  <p className="text-amber-800 mt-1">
                    ขาดอีก {data.runway.missing.length} มื้อ · เริ่มจาก{" "}
                    {data.runway.missing[0] &&
                      `${data.runway.missing[0].date} · ${
                        data.tracks.find((t) => t.key === data.runway.missing[0].track)?.label
                      } · ${data.runway.missing[0].slot}`}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* เลื่อนสัปดาห์ */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setFrom(shiftKey(from, -7))}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
          <button
            onClick={() => setFrom(shiftKey(from, 7))}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFrom(todayKey())}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50"
          >
            วันนี้
          </button>

          <button
            onClick={copyWeek}
            disabled={copying}
            className="ml-auto px-4 py-2 rounded-lg bg-[#4CAF50] text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            title="คัดลอกเมนูของสัปดาห์ก่อนหน้ามาใส่สัปดาห์นี้ (ไม่ทับช่องที่กรอกไว้แล้ว)"
          >
            {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            ทำซ้ำสัปดาห์ก่อน
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        )}

        {/* การ์ดรายวัน */}
        {data?.days.map((day) => (
          <div key={day.date} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{day.label}</span>
              <span className="text-xs text-gray-400">{day.date}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2 w-40">สาย</th>
                    {data.slots.map((s) => (
                      <th key={s} className="px-3 py-2">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.tracks.map((track) => (
                    <tr key={track.key} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 font-medium text-gray-700">{track.label}</td>
                      {data.slots.map((slot) => {
                        const key = `${day.date}|${track.key}|${slot}`;
                        const cell = cellAt.get(key);
                        return (
                          <td key={slot} className="px-3 py-2 align-top">
                            <button
                              onClick={() => setPicker({ date: day.date, track: track.key, slot })}
                              className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${
                                cell
                                  ? cell.conflicts.length
                                    ? "border-red-300 bg-red-50 hover:bg-red-100"
                                    : "border-gray-200 bg-white hover:bg-gray-50"
                                  : "border-dashed border-gray-300 text-gray-400 hover:border-[#4CAF50] hover:text-[#4CAF50]"
                              }`}
                            >
                              {saving === key ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : cell ? (
                                <>
                                  <span className="font-medium text-gray-900 block">{cell.food.name}</span>
                                  <span className="text-gray-500">
                                    {Math.round(cell.food.calories)} kcal · P {Math.round(cell.food.protein)}
                                  </span>
                                  {cell.conflicts.length > 0 && (
                                    <span className="block text-red-600 mt-0.5">
                                      ⚠️ มี{cell.conflicts.join("/")} — ขัดกับสายนี้
                                    </span>
                                  )}
                                </>
                              ) : (
                                "+ เลือกเมนู"
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {picker && data && (
        <FoodPicker
          foods={data.foods}
          track={picker.track}
          trackLabel={data.tracks.find((t) => t.key === picker.track)?.label ?? picker.track}
          slot={picker.slot}
          current={cellAt.get(`${picker.date}|${picker.track}|${picker.slot}`)?.food.id ?? null}
          onClose={() => setPicker(null)}
          onPick={(id) => setCell(picker.date, picker.track, picker.slot, id)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-lg bg-gray-900 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

/** เลือกเมนู — เรียงเมนูที่ "ใช้ได้กับสายนี้" ขึ้นก่อนเสมอ ไม่ซ่อนตัวที่ขัด เพราะชื่อไทยกำกวมได้ */
function FoodPicker({
  foods,
  track,
  trackLabel,
  slot,
  current,
  onClose,
  onPick,
}: {
  foods: FoodOpt[];
  track: string;
  trackLabel: string;
  slot: string;
  current: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim();
    const filtered = term ? foods.filter((f) => f.name.includes(term)) : foods;
    return [...filtered].sort((a, b) => {
      const ao = a.tracks.includes(track) ? 0 : 1;
      const bo = b.tracks.includes(track) ? 0 : 1;
      return ao - bo || a.name.localeCompare(b.name, "th");
    });
  }, [foods, q, track]);

  const usable = list.filter((f) => f.tracks.includes(track)).length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              เลือกเมนู · {trackLabel} · มื้อ{slot}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">ใช้ได้กับสายนี้ {usable} เมนู จากทั้งหมด {foods.length}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 relative">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {current && (
            <button
              onClick={() => onPick(null)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
            >
              ✕ เอาเมนูออกจากช่องนี้
            </button>
          )}
          {list.map((f) => {
            const ok = f.tracks.includes(track);
            return (
              <button
                key={f.id}
                onClick={() => onPick(f.id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 hover:bg-gray-50 ${
                  f.id === current ? "bg-green-50" : ""
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-900 text-sm truncate">
                    {f.name}
                    {!ok && <span className="ml-2 text-xs text-red-600">⚠️ ขัดกับสายนี้</span>}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {Math.round(f.calories)} kcal · P {Math.round(f.protein)} · C {Math.round(f.carbs)} · F{" "}
                    {Math.round(f.fat)}
                    {f.fiber != null && ` · ไฟเบอร์ ${Math.round(f.fiber)}`}
                  </span>
                </span>
                <span className="text-sm text-gray-400 shrink-0">{f.price}฿</span>
              </button>
            );
          })}
          {list.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ไม่พบเมนู</p>}
        </div>
      </div>
    </div>
  );
}
