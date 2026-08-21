"use client";

/**
 * เพิ่มลูกค้าเข้าโปรแกรมจากหลังบ้าน
 *
 * ทำไมต้องมี: ลูกค้ากดปุ่ม "สั่งอาหาร" ในแอปแล้วทักมาทาง LINE — ปลายทางคือแอดมินต้องพาเข้าโปรแกรมให้
 * API `POST /api/program/members` มีมาตั้งแต่ต้น แต่ไม่เคยมีปุ่มให้กด (ต้องยิง API เอง)
 *
 * 🔴 ข้อความ error จาก server เขียนเป็นไทยมาแล้ว (ปฏิทินเมนูไม่ครบ / มีคอร์สค้างอยู่) → โชว์ตรง ๆ ห้ามกลืน
 * 🔴 "ข้ามการเช็คปฏิทิน" ต้องติ๊กเอง — ลูกค้าจ่ายเงินแล้วไม่มีเมนูคือความผิดพลาดที่แพงที่สุดของระบบนี้
 */

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

const TRACKS = [
  { key: "standard", label: "มาตรฐาน" },
  { key: "no_seafood", label: "ไม่มีอาหารทะเล" },
  { key: "no_meat", label: "ไม่ทานเนื้อ" },
  { key: "vegetarian", label: "มังสวิรัติ" },
];
const SLOTS = ["เช้า", "กลางวัน", "ว่าง", "เย็น"];
const DAY_OPTIONS = [7, 14, 30];

interface MemberRow {
  id: string;
  name: string | null;
  displayName: string | null;
  phone: string | null;
}

/** พรุ่งนี้ (เวลาไทย) — ครัวซื้อของล่วงหน้า สมัครวันนี้กินวันนี้ไม่ได้ */
const tomorrowKey = () => new Date(Date.now() + 7 * 3600 * 1000 + 86400000).toISOString().slice(0, 10);

export function EnrollSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<MemberRow | null>(null);

  const [track, setTrack] = useState("standard");
  const [startDate, setStartDate] = useState(tomorrowKey());
  const [totalDays, setTotalDays] = useState(7);
  const [slots, setSlots] = useState<string[]>(["เช้า", "กลางวัน", "เย็น"]);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ค้นหาแบบหน่วง — พิมพ์เร็ว ๆ ไม่ควรยิงทุกตัวอักษร
  useEffect(() => {
    if (picked) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/members?search=${encodeURIComponent(q)}&limit=8`, { credentials: "include" });
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : (data.members ?? []));
      } catch {
        setMembers([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, picked]);

  const toggleSlot = (s: string) =>
    setSlots((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function submit() {
    if (!picked) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/program/members", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: picked.id,
          track,
          startDate,
          totalDays,
          slots,
          price: price.trim() === "" ? 0 : Number(price),
          deliveryNote: note.trim() || undefined,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "เพิ่มเข้าโปรแกรมไม่สำเร็จ");
        return;
      }
      onDone();
    } catch {
      setErr("ต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (m: MemberRow) => m.displayName || m.name || "(ไม่มีชื่อ)";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">เพิ่มลูกค้าเข้าโปรแกรม</h2>
            <p className="text-xs text-gray-500">ใช้ตอนลูกค้าทักมาสั่งทาง LINE หรือโทรมา</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ── เลือกสมาชิก ── */}
          <div>
            <label className="text-sm font-medium text-gray-700">ลูกค้า</label>
            {picked ? (
              <div className="mt-2 flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">{nameOf(picked)}</p>
                  {picked.phone && <p className="text-xs text-gray-500">{picked.phone}</p>}
                </div>
                <button onClick={() => setPicked(null)} className="text-xs text-emerald-700 underline">
                  เปลี่ยน
                </button>
              </div>
            ) : (
              <>
                <div className="mt-2 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ค้นชื่อ / เบอร์ / อีเมล"
                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="mt-2 border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-52 overflow-y-auto">
                  {searching && <p className="px-4 py-3 text-sm text-gray-400">กำลังค้น...</p>}
                  {!searching && members.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400">ไม่พบสมาชิกที่ตรงกับที่ค้น</p>
                  )}
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPicked(m)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-900">{nameOf(m)}</span>
                      {m.phone && <span className="block text-xs text-gray-400">{m.phone}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── สายอาหาร ── */}
          <div>
            <label className="text-sm font-medium text-gray-700">สายอาหาร</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTrack(t.key)}
                  className={`px-4 py-2 rounded-full text-sm border ${
                    track === t.key
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── มื้อที่ส่ง ── */}
          <div>
            <label className="text-sm font-medium text-gray-700">มื้อที่ส่ง</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSlot(s)}
                  className={`px-4 py-2 rounded-full text-sm border ${
                    slots.includes(s)
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {slots.length === 0 && <p className="mt-2 text-xs text-red-500">เลือกอย่างน้อย 1 มื้อ</p>}
          </div>

          {/* ── ช่วงคอร์ส ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">เริ่มวันที่</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">จำนวนวัน</label>
              <div className="mt-2 flex gap-2">
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setTotalDays(d)}
                    className={`flex-1 py-3 rounded-xl text-sm border ${
                      totalDays === d
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── ราคา + โน้ตส่ง ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">ราคาที่ตกลง (บาท)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">โน้ตการส่ง</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ฝากไว้ รปภ."
                className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* ── ข้ามการเช็คปฏิทิน ── */}
          <label className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-1" />
            <span className="text-xs text-amber-800">
              ปฏิทินเมนูยังไม่ครบก็ให้สมัครไปก่อน
              <span className="block text-amber-700">
                ติ๊กเฉพาะตอนที่คุณกำลังจะไปกรอกปฏิทินต่อทันที — ไม่งั้นลูกค้าจ่ายแล้วไม่มีเมนูให้ตัก
              </span>
            </span>
          </label>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</p>}
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100">
          <button
            onClick={submit}
            disabled={!picked || slots.length === 0 || saving}
            className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            เพิ่มเข้าโปรแกรม
          </button>
        </div>
      </div>
    </div>
  );
}
