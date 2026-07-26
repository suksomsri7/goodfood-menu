"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  UtensilsCrossed,
  Check,
  Lock,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";

interface ExItem {
  name: string;
  sets?: number;
  reps?: number;
  minutes?: number;
  note?: string;
}
interface MealItem {
  slot: string;
  menu: string;
  ingredients?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
}
interface PlanDay {
  id: string;
  date: string; // YYYY-MM-DD
  status: string;
  exerciseDone: boolean;
  mealsDone: Record<string, boolean> | null;
  exercisePlan: { title: string; durationMin: number; items: ExItem[]; caloriesTarget: number };
  mealPlan: { meals: MealItem[]; totalKcal: number };
  aiNote: string | null;
}

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function todayStr(): string {
  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

export default function PlanPage() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const lineUserId = profile?.userId;

  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth()); // 0-based
  const [plans, setPlans] = useState<Record<string, PlanDay>>({});
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchPlans = useCallback(async () => {
    if (!lineUserId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/plan?lineUserId=${lineUserId}&month=${monthStr}`);
      if (res.status === 403) {
        setLocked(true);
        setPlans({});
        return;
      }
      setLocked(false);
      const data = await res.json();
      const map: Record<string, PlanDay> = {};
      for (const p of data.plans ?? []) map[p.date] = p;
      setPlans(map);
    } catch {
      // เงียบ — แสดงว่าง
    } finally {
      setLoading(false);
    }
  }, [lineUserId, monthStr]);

  useEffect(() => {
    if (isReady && lineUserId) fetchPlans();
  }, [isReady, lineUserId, fetchPlans]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const generate = async (start: "today" | "nextWeek") => {
    if (!lineUserId || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, start }),
      });
      const data = await res.json();
      if (res.status === 403) { setLocked(true); return; }
      if (res.ok || res.status === 409) await fetchPlans();
      else alert(data.error || "สร้างแผนไม่สำเร็จ");
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setGenerating(false);
    }
  };

  const patchDay = async (plan: PlanDay, patch: { exerciseDone?: boolean; mealsDone?: Record<string, boolean> }) => {
    if (!lineUserId) return;
    // optimistic
    const optimistic: PlanDay = {
      ...plan,
      exerciseDone: patch.exerciseDone ?? plan.exerciseDone,
      mealsDone: { ...(plan.mealsDone ?? {}), ...(patch.mealsDone ?? {}) },
    };
    setPlans((prev) => ({ ...prev, [plan.date]: optimistic }));
    try {
      const res = await fetch(`/api/plan/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, ...patch }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlans((prev) => ({
          ...prev,
          [plan.date]: { ...optimistic, status: data.status, mealsDone: data.mealsDone, exerciseDone: data.exerciseDone },
        }));
      } else {
        fetchPlans(); // rollback จาก server
      }
    } catch {
      fetchPlans();
    }
  };

  // ── Loading / auth ──
  if (!isReady || (!isLoggedIn && !lineUserId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // ── Lock page ──
  if (locked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <Lock className="w-9 h-9 text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">แผนรายวันสำหรับสมาชิกคอร์ส</h1>
        <p className="text-gray-500 mb-6 leading-relaxed">
          ฟีเจอร์วางแผนออกกำลังกายและมื้ออาหารรายวัน<br />เปิดให้สมาชิกคอร์สโค้ช ติดต่อแอดมินเพื่อเริ่มใช้งาน
        </p>
        <a
          href="https://line.me/R/ti/p/@385xnbxz"
          className="px-6 py-3 bg-emerald-500 text-white rounded-full font-semibold shadow-sm active:scale-95 transition"
        >
          ติดต่อแอดมิน
        </a>
      </div>
    );
  }

  // ── ปฏิทิน ──
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = todayStr();

  const dotColor = (day: number): string => {
    const ds = `${monthStr}-${String(day).padStart(2, "0")}`;
    const p = plans[ds];
    if (!p) return "";
    if (p.status === "done") return "bg-emerald-500";
    if (p.status === "partial") return "bg-amber-400";
    if (ds < today && p.status === "planned") return "bg-rose-400"; // อดีตยังไม่ทำ
    return "bg-gray-300";
  };

  const hasAnyPlan = Object.keys(plans).length > 0;
  const selectedPlan = selected ? plans[selected] : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-800 mb-3">แผนรายวันของฉัน</h1>
        <div className="flex items-center justify-between">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full active:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800">
            {MONTHS_TH[month]} {year + 543}
          </span>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full active:bg-gray-100">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const ds = `${monthStr}-${String(day).padStart(2, "0")}`;
              const isToday = ds === today;
              const hasPlan = !!plans[ds];
              return (
                <button
                  key={ds}
                  onClick={() => hasPlan && setSelected(ds)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative ${
                    isToday ? "ring-2 ring-emerald-500" : ""
                  } ${hasPlan ? "bg-white shadow-sm active:scale-95" : "bg-transparent"} transition`}
                >
                  <span className={`text-sm ${isToday ? "font-bold text-emerald-600" : "text-gray-700"}`}>
                    {day}
                  </span>
                  {hasPlan && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor(day)}`} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />ทำครบ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />บางส่วน</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />ยังไม่ทำ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" />รอทำ</span>
      </div>

      {/* Generate button */}
      <div className="px-5 mt-6 space-y-2">
        {!hasAnyPlan && !loading && (
          <p className="text-center text-gray-400 text-sm mb-2">ยังไม่มีแผนในเดือนนี้</p>
        )}
        <button
          onClick={() => generate("today")}
          disabled={generating}
          className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-semibold shadow-sm active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {generating ? "กำลังสร้างแผน..." : "สร้างแผน 7 วัน (เริ่มวันนี้)"}
        </button>
        <button
          onClick={() => generate("nextWeek")}
          disabled={generating}
          className="w-full py-3 bg-white text-emerald-600 border border-emerald-200 rounded-2xl font-medium active:scale-95 transition disabled:opacity-60"
        >
          สร้างแผนสัปดาห์หน้า
        </button>
      </div>

      {/* Day bottom sheet */}
      {selectedPlan && (
        <div className="fixed inset-0 z-30 flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slideup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400">{selectedPlan.date}</p>
                <h2 className="font-bold text-gray-800">แผนวันนี้</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-full active:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {selectedPlan.aiNote && (
                <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                  💡 {selectedPlan.aiNote}
                </p>
              )}

              {/* Exercise */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-orange-500" />
                    <span className="font-semibold text-gray-800">{selectedPlan.exercisePlan.title}</span>
                  </div>
                  <button
                    onClick={() => patchDay(selectedPlan, { exerciseDone: !selectedPlan.exerciseDone })}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 transition ${
                      selectedPlan.exerciseDone
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {selectedPlan.exerciseDone ? "ทำแล้ว" : "ทำแล้ว?"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  {selectedPlan.exercisePlan.durationMin} นาที · เผาผลาญ ~{selectedPlan.exercisePlan.caloriesTarget} kcal
                </p>
                <ul className="space-y-1">
                  {selectedPlan.exercisePlan.items.map((it, idx) => (
                    <li key={idx} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      {it.name}
                      {it.sets ? ` · ${it.sets} เซ็ต` : ""}
                      {it.reps ? ` × ${it.reps} ครั้ง` : ""}
                      {it.minutes ? ` · ${it.minutes} นาที` : ""}
                      {it.note ? <span className="text-gray-400"> ({it.note})</span> : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Meals */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold text-gray-800">มื้ออาหาร</span>
                  <span className="text-xs text-gray-400">รวม ~{selectedPlan.mealPlan.totalKcal} kcal</span>
                </div>
                <div className="space-y-2">
                  {selectedPlan.mealPlan.meals.map((m) => {
                    const done = !!selectedPlan.mealsDone?.[m.slot];
                    return (
                      <div key={m.slot} className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-emerald-600">{m.slot}</span>
                          <button
                            onClick={() => patchDay(selectedPlan, { mealsDone: { [m.slot]: !done } })}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                              done ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">{m.menu}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat}
                          {m.sodium != null ? ` · Na${m.sodium}` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideup {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideup { animation: slideup 0.25s ease-out; }
      `}</style>
    </div>
  );
}
