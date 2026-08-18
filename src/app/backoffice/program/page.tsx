"use client";

/**
 * คนในโปรแกรม — ข้อมูลชุดเดียว 3 มุมมอง
 *   ครัว   : มื้อ → จาน → ตักยังไง กี่กล่อง   (คนแพ็คตักทีละหม้อ ไม่ได้ไล่อ่านทีละคน)
 *   รายคน  : ใครต้องการสารอาหารเท่าไรในแต่ละมื้อ (มุมนักโภชนาการ)
 *   คอร์ส  : ใครสมัครถึงวันไหน เหลือกี่วัน
 */

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/backoffice/Header";
import { AlertTriangle, ChefHat, ChevronLeft, ChevronRight, Loader2, Package, Printer, Users, Utensils } from "lucide-react";
import { CustomerSheet } from "./CustomerSheet";
import { KitchenView, KitchenSlot } from "./KitchenView";

type View = "kitchen" | "packing" | "roster" | "courses";

interface Target {
  slot: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodiumMax: number;
  sugarMax: number;
}

interface Summary {
  date: string;
  label: string;
  serving: number;
  boxes: number;
  missingMenu: string[];
  offTarget: string[];
  noRecipe: string[];
  withAllergies: number;
}

interface PackingLine {
  portionLabel: string;
  note: string;
  warn: string | null;
  count: number;
  members: string[];
}

interface PackingDish {
  trackLabel: string;
  foodName: string;
  image: string | null;
  total: number;
  lines: PackingLine[];
}

interface PackingSlot {
  slot: string;
  total: number;
  dishes: PackingDish[];
}

interface ServedMeal {
  slot: string;
  target: Target;
  food: { name: string; calories: number; protein: number } | null;
  portion: { label: string; note: string; off: { message: string } | null } | null;
}

interface ServedMember {
  enrollmentId: string;
  memberId: string;
  name: string;
  phone: string | null;
  trackLabel: string;
  dayNumber: number;
  totalDays: number;
  address: string | null;
  meals: ServedMeal[];
  profile: { allergies: string[]; healthConditions: string[]; avoidMeats: string[]; dislikedVeggies: string[] } | null;
}

interface Course {
  id: string;
  member: { name: string; phone: string | null };
  trackLabel: string;
  startLabel: string;
  endLabel: string;
  totalDays: number;
  remaining: number;
  slots: string[];
  price: number;
  status: string;
}

const todayKey = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const shiftKey = (k: string, d: number) =>
  new Date(new Date(`${k}T00:00:00Z`).getTime() + d * 86400000).toISOString().slice(0, 10);

export default function ProgramPage() {
  const [view, setView] = useState<View>("packing");
  const [date, setDate] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [slots, setSlots] = useState<PackingSlot[]>([]);
  const [kitchen, setKitchen] = useState<KitchenSlot[]>([]);
  /** ลูกค้าที่กำลังเปิดโปรไฟล์อยู่ — null = ปิด */
  const [openCustomer, setOpenCustomer] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<ServedMember[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  /** คุกกี้พนักงานหมดอายุ (12 ชม.) ขณะที่ localStorage ยังจำ login อยู่ — ต้องบอกให้ชัด ไม่ใช่โชว์หน้าว่าง */
  const [authErr, setAuthErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "courses") {
        const res = await fetch("/api/program/enrollments", { credentials: "include" });
        setAuthErr(res.status === 401);
        if (res.ok) setCourses((await res.json()).enrollments);
        return;
      }
      const res = await fetch(`/api/program/members?date=${date}&view=${view}`, { credentials: "include" });
      setAuthErr(res.status === 401);
      if (!res.ok) return;
      const json = await res.json();
      setSummary(json.summary);
      if (view === "packing") setSlots(json.slots);
      else if (view === "kitchen") setKitchen(json.slots);
      else setMembers(json.members);
    } finally {
      setLoading(false);
    }
  }, [view, date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Header title="คนในโปรแกรม" subtitle="ใครได้รับอาหารวันนี้ · ต้องการสารอาหารเท่าไร · ตักยังไง" />

      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: "kitchen", label: "เมนูครัว", icon: <ChefHat className="w-4 h-4" /> },
              { key: "packing", label: "ใบแพ็ค (ย่อ)", icon: <Package className="w-4 h-4" /> },
              { key: "roster", label: "รายคน (โภชนาการ)", icon: <Users className="w-4 h-4" /> },
              { key: "courses", label: "คอร์สทั้งหมด", icon: <Utensils className="w-4 h-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border ${
                view === t.key
                  ? "bg-[#4CAF50] text-white border-[#4CAF50]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}

          {view !== "courses" && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setDate(shiftKey(date, -1))}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              <button
                onClick={() => setDate(shiftKey(date, 1))}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => window.print()}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                title="พิมพ์"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {view !== "courses" && summary && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="วันที่" value={summary.label} />
              <Stat label="ลูกค้าที่ต้องส่ง" value={`${summary.serving} คน`} accent />
              <Stat label="กล่องรวม" value={`${summary.boxes} กล่อง`} accent />
            </div>

            {summary.missingMenu.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-red-900">มีลูกค้ารออยู่แต่ปฏิทินยังว่าง — ต้องใส่เมนูก่อนถึงเวลาทำอาหาร</p>
                  <p className="text-red-800 mt-1">{summary.missingMenu.join(" · ")}</p>
                </div>
              </div>
            )}

            {summary.noRecipe?.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900">
                    เมนูวันนี้ที่ยังไม่ได้ลงสูตร — ปรับปริมาณรายวัตถุดิบให้ลูกค้าไม่ได้ ยังต้องตักแบบ S/M/L/XL
                  </p>
                  <p className="text-blue-800 mt-1">{summary.noRecipe.join(" · ")}</p>
                </div>
              </div>
            )}

            {summary.offTarget?.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900">
                    มีมื้อที่ตักยังไงก็ไม่ตรงเป้า — ต้องเปลี่ยนเมนูในปฏิทิน ไม่ใช่แก้ที่ปริมาณ
                  </p>
                  <p className="text-amber-800 mt-1">{summary.offTarget.join(" · ")}</p>
                </div>
              </div>
            )}
          </>
        )}

        {authErr && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            เซสชันหลังบ้านหมดอายุ — กรุณา
            <a href="/backoffice/login" className="underline font-semibold mx-1">
              เข้าสู่ระบบใหม่
            </a>
            แล้วเปิดหน้านี้อีกครั้ง
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        )}

        {/* ── เมนูครัว (รายวัตถุดิบ) ── */}
        {!loading && view === "kitchen" && <KitchenView slots={kitchen} />}

        {/* ── ใบแพ็ค ── */}
        {!loading &&
          view === "packing" &&
          (slots.length === 0 ? (
            <Empty text="วันนี้ไม่มีลูกค้าในโปรแกรม" />
          ) : (
            slots.map((s) => (
              <div key={s.slot} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">มื้อ{s.slot}</span>
                  <span className="text-sm text-gray-500">{s.total} กล่อง</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {s.dishes.map((d, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{d.trackLabel}</span>
                        <span className="font-medium text-gray-900">{d.foodName}</span>
                        <span className="ml-auto text-sm font-semibold text-[#4CAF50]">{d.total} กล่อง</span>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {d.lines.map((l, j) => (
                          <div key={j} className="flex items-start gap-3 text-sm">
                            <span className="w-10 shrink-0 font-mono font-semibold text-gray-700">{l.portionLabel}</span>
                            <span className="w-12 shrink-0 text-gray-500">× {l.count}</span>
                            <span className="flex-1 text-gray-600">
                              {l.note}
                              {l.warn && <span className="block text-xs text-amber-700 mt-0.5">{l.warn}</span>}
                              <span className="block text-xs text-gray-400 mt-0.5">{l.members.join(", ")}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ))}

        {/* ── รายคน ── */}
        {!loading &&
          view === "roster" &&
          (members.length === 0 ? (
            <Empty text="วันนี้ไม่มีลูกค้าในโปรแกรม" />
          ) : (
            members.map((m) => (
              <div
                key={m.enrollmentId}
                className="bg-white rounded-xl border border-gray-100 p-4"
              >
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <button
                    onClick={() => setOpenCustomer({ id: m.memberId, name: m.name })}
                    className="font-semibold text-gray-900 hover:text-[#4CAF50] underline decoration-dotted underline-offset-4"
                  >
                    {m.name}
                  </button>
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{m.trackLabel}</span>
                  <span className="text-xs text-gray-500">
                    วันที่ {m.dayNumber}/{m.totalDays}
                  </span>
                  {m.phone && <span className="text-xs text-gray-400">{m.phone}</span>}
                </div>

                {/* 🔴 แพ้อาหารต้องอยู่บนการ์ด ไม่ใช่ซ่อนในโปรไฟล์ — คนอ่านหน้านี้คือคนที่กำลังจะทำอาหาร */}
                {(m.profile?.allergies?.length ?? 0) > 0 && (
                  <p className="mb-2 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-semibold inline-block">
                    ⚠️ แพ้ {m.profile!.allergies.join(", ")}
                  </p>
                )}
                {(m.profile?.healthConditions?.length ?? 0) > 0 && (
                  <p className="mb-2 ml-2 px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs inline-block">
                    {m.profile!.healthConditions.join(", ")}
                  </p>
                )}

                {m.address && <p className="text-xs text-gray-500 mb-3">📍 {m.address}</p>}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="py-2 pr-3">มื้อ</th>
                        <th className="py-2 pr-3">ต้องการ</th>
                        <th className="py-2 pr-3">เมนูให้</th>
                        <th className="py-2">ตักยังไง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.meals.map((meal) => (
                        <tr key={meal.slot} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-3 font-medium text-gray-700 whitespace-nowrap">{meal.slot}</td>
                          <td className="py-2 pr-3 text-gray-600 text-xs">
                            {meal.target.kcal} kcal · P {meal.target.protein} · C {meal.target.carbs} · F{" "}
                            {meal.target.fat}
                            <span className="block text-gray-400">
                              ไฟเบอร์ {meal.target.fiber} ก. · โซเดียม ≤{meal.target.sodiumMax} มก.
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-xs">
                            {meal.food ? (
                              <>
                                <span className="text-gray-900">{meal.food.name}</span>
                                <span className="block text-gray-400">
                                  {Math.round(meal.food.calories)} kcal · P {Math.round(meal.food.protein)}
                                </span>
                              </>
                            ) : (
                              <span className="text-red-600">⚠️ ยังไม่มีเมนู</span>
                            )}
                          </td>
                          <td className="py-2 text-xs">
                            {meal.portion ? (
                              <>
                                <span className="font-mono font-semibold text-gray-700">{meal.portion.label}</span>
                                <span className="block text-gray-500">{meal.portion.note}</span>
                                {meal.portion.off && (
                                  <span className="block text-amber-700 mt-0.5">{meal.portion.off.message}</span>
                                )}
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ))}

        {/* ── คอร์สทั้งหมด ── */}
        {!loading &&
          view === "courses" &&
          (courses.length === 0 ? (
            <Empty text="ยังไม่มีใครสมัครโปรแกรม" />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3">ลูกค้า</th>
                    <th className="px-4 py-3">สาย</th>
                    <th className="px-4 py-3">ช่วงคอร์ส</th>
                    <th className="px-4 py-3">เหลือ</th>
                    <th className="px-4 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{c.member.name}</span>
                        {c.member.phone && <span className="block text-xs text-gray-400">{c.member.phone}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.trackLabel}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {c.startLabel} → {c.endLabel}
                        <span className="block text-gray-400">
                          {c.totalDays} วัน · {c.slots.join("/")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={c.remaining <= 2 ? "text-amber-600 font-semibold" : "text-gray-600"}>
                          {c.remaining} วัน
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.status === "active" ? "กำลังใช้งาน" : c.status === "completed" ? "จบแล้ว" : "ยกเลิก"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      {openCustomer && (
        <CustomerSheet memberId={openCustomer.id} name={openCustomer.name} onClose={() => setOpenCustomer(null)} />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${accent ? "text-[#4CAF50]" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-sm text-gray-400 py-12">{text}</p>;
}
