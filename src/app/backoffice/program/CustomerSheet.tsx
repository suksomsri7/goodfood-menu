"use client";

/**
 * โปรไฟล์ลูกค้าในโปรแกรม — เปิดจากชื่อในหน้าไหนก็ได้
 *
 * 🔴 ลำดับบนแผ่นนี้เรียงตาม "ความเสียหายถ้าพลาด" ไม่ใช่ตามความน่าสนใจ
 *    แพ้อาหาร/โรคประจำตัว → รสนิยม → เป้าโภชนาการ → คอร์ส → ที่อยู่/ประวัติ
 * 🔴 "ยังไม่เคยทำแบบสำรวจ" ต้องเขียนให้ต่างจาก "ไม่แพ้อะไร" ให้ชัด
 *    ช่องว่างเปล่า ๆ ทำให้คนอ่านสรุปเองว่าปลอดภัย ซึ่งเป็นคนละเรื่องกัน
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface Customer {
  member: {
    id: string; name: string; phone: string | null; email: string | null;
    gender: string | null; age: number | null; height: number | null;
    weight: number | null; goalWeight: number | null; goalLabel: string | null;
    activityLevel: string | null; dietType: string | null; targetMonths: number | null;
    bmr: number | null; tdee: number | null; isOnboarded: boolean; joinedLabel: string;
  };
  safety: { allergies: string[]; healthConditions: string[]; hasProfile: boolean };
  preference: {
    avoidMeats: string[]; dislikedVeggies: string[]; eatsVegetables: boolean;
    spiceLabel: string | null; tastePref: string | null; cuisines: string[];
    mealSlots: string[]; budgetPerDay: number | null;
  } | null;
  nutrition: {
    daily: { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodiumMax: number; sugarMax: number };
    perMeal: { slot: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number }[];
  };
  program: {
    active: {
      trackLabel: string; startLabel: string; endLabel: string; totalDays: number;
      slots: string[]; price: number; deliveryNote: string | null; address: string | null; enrolledLabel: string;
    } | null;
    history: { id: string; trackLabel: string; startLabel: string; endLabel: string; totalDays: number; status: string; price: number }[];
  };
  addresses: { id: string; text: string | null; isDefault: boolean }[];
  weights: { date: string; weight: number }[];
  swaps: { createdAt: string; reason: string; from: string | null; to: string | null }[];
  orders: { id: string; orderNumber: string; totalPrice: number; status: string; createdAt: string }[];
}

const SWAP_REASON: Record<string, string> = { dislike: "ไม่ชอบ", bored: "เบื่อ", variety: "อยากลองอย่างอื่น" };
const ACTIVITY: Record<string, string> = {
  sedentary: "นั่งทำงานเป็นหลัก", light: "ขยับเบา ๆ", moderate: "ออกกำลังกายปานกลาง",
  active: "ออกกำลังกายหนัก", very_active: "ออกกำลังกายหนักมาก",
};

export function CustomerSheet({ memberId, name, onClose }: { memberId: string; name: string; onClose: () => void }) {
  const [data, setData] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/program/customer/${memberId}`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setErr(json.error || "โหลดข้อมูลลูกค้าไม่สำเร็จ");
        else setData(json);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [memberId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-gray-50 w-full max-w-xl h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-semibold text-gray-900">{data?.member.name ?? name}</h2>
            {data && (
              <p className="text-xs text-gray-500">
                {[data.member.gender === "male" ? "ชาย" : data.member.gender === "female" ? "หญิง" : null,
                  data.member.age ? `${data.member.age} ปี` : null,
                  data.member.height ? `${data.member.height} ซม.` : null,
                  `เป็นสมาชิกตั้งแต่ ${data.member.joinedLabel}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
            </div>
          )}
          {err && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{err}</div>}

          {data && (
            <>
              {/* ── ความปลอดภัย ── */}
              {data.safety.allergies.length > 0 ? (
                <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4">
                  <p className="font-bold text-red-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> แพ้อาหาร — ห้ามใส่เด็ดขาด
                  </p>
                  <p className="text-red-900 mt-1 text-lg font-semibold">{data.safety.allergies.join(" · ")}</p>
                </div>
              ) : data.safety.hasProfile ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                  ลูกค้าระบุว่า <b>ไม่มีอาหารที่แพ้</b>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <b>ยังไม่เคยทำแบบสำรวจอาหาร</b> — ไม่ได้แปลว่าไม่แพ้อะไร ควรถามก่อนทำอาหารมื้อแรก
                </div>
              )}

              {data.safety.healthConditions.length > 0 && (
                <Card title="โรคประจำตัว">
                  <div className="flex flex-wrap gap-1.5">
                    {data.safety.healthConditions.map((c) => (
                      <Chip key={c} text={c} tone="amber" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">ระบบคุมโซเดียม/น้ำตาลเข้มขึ้นให้อัตโนมัติแล้วในเป้าด้านล่าง</p>
                </Card>
              )}

              {/* ── รสนิยม ── */}
              <Card title="ชอบ / ไม่ชอบอะไร">
                {data.preference ? (
                  <div className="space-y-2 text-sm">
                    <Row label="ไม่กินเนื้อ" value={data.preference.avoidMeats.length ? data.preference.avoidMeats.join(", ") : "—"} />
                    <Row label="ผักที่ไม่ชอบ" value={data.preference.dislikedVeggies.length ? data.preference.dislikedVeggies.join(", ") : "—"} />
                    <Row label="กินผัก" value={data.preference.eatsVegetables ? "กิน" : "ไม่ค่อยกิน"} />
                    <Row label="ความเผ็ด" value={data.preference.spiceLabel ?? "—"} />
                    <Row label="แนวรสชาติ" value={data.preference.tastePref ?? "—"} />
                    <Row label="แนวอาหารที่ชอบ" value={data.preference.cuisines.length ? data.preference.cuisines.join(", ") : "—"} />
                    <Row label="มื้อที่รับ" value={data.preference.mealSlots.join(" · ")} />
                    <Row label="งบต่อวัน" value={data.preference.budgetPerDay ? `${data.preference.budgetPerDay} บาท` : "—"} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">ยังไม่เคยทำแบบสำรวจ</p>
                )}
              </Card>

              {/* ── เมนูที่เปลี่ยนออก ── */}
              {data.swaps.length > 0 && (
                <Card title="เมนูที่เคยเปลี่ยนออก">
                  <p className="text-xs text-gray-500 mb-2">พฤติกรรมจริง บอกรสนิยมได้ตรงกว่าแบบสำรวจ</p>
                  <div className="space-y-1 text-sm">
                    {data.swaps.map((s, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-gray-900">{s.from}</span>
                        {s.to && <span className="text-gray-400">→ {s.to}</span>}
                        <Chip text={SWAP_REASON[s.reason] ?? s.reason} tone={s.reason === "dislike" ? "red" : "gray"} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── เป้าโภชนาการ ── */}
              <Card title="ต้องการสารอาหารเท่าไร">
                <div className="grid grid-cols-4 gap-3 text-sm mb-3">
                  <Stat label="ต่อวัน" value={`${data.nutrition.daily.kcal}`} unit="kcal" />
                  <Stat label="โปรตีน" value={`${data.nutrition.daily.protein}`} unit="ก." />
                  <Stat label="คาร์บ" value={`${data.nutrition.daily.carbs}`} unit="ก." />
                  <Stat label="ไขมัน" value={`${data.nutrition.daily.fat}`} unit="ก." />
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  ไฟเบอร์ {data.nutrition.daily.fiber} ก. · โซเดียมไม่เกิน {data.nutrition.daily.sodiumMax} มก. · น้ำตาลไม่เกิน{" "}
                  {data.nutrition.daily.sugarMax} ก.
                  {data.member.bmr && data.member.tdee ? ` · BMR ${data.member.bmr} / TDEE ${data.member.tdee}` : ""}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-1.5">มื้อ</th>
                      <th className="py-1.5 text-right">kcal</th>
                      <th className="py-1.5 text-right">P</th>
                      <th className="py-1.5 text-right">C</th>
                      <th className="py-1.5 text-right">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.nutrition.perMeal.map((m) => (
                      <tr key={m.slot} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-700">{m.slot}</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">{m.kcal}</td>
                        <td className="py-1.5 text-right text-gray-600">{m.protein}</td>
                        <td className="py-1.5 text-right text-gray-600">{m.carbs}</td>
                        <td className="py-1.5 text-right text-gray-600">{m.fat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* ── เป้าหมายส่วนตัว ── */}
              <Card title="เป้าหมายของลูกค้า">
                <div className="space-y-2 text-sm">
                  <Row label="เป้าหมาย" value={data.member.goalLabel ?? "—"} />
                  <Row
                    label="น้ำหนัก"
                    value={
                      data.member.weight
                        ? `${data.member.weight} กก.${data.member.goalWeight ? ` → เป้า ${data.member.goalWeight} กก.` : ""}`
                        : "—"
                    }
                  />
                  <Row label="ระยะเวลาที่ตั้งไว้" value={data.member.targetMonths ? `${data.member.targetMonths} เดือน` : "—"} />
                  <Row label="กิจกรรมประจำวัน" value={data.member.activityLevel ? ACTIVITY[data.member.activityLevel] ?? data.member.activityLevel : "—"} />
                  <Row label="รูปแบบอาหาร" value={data.member.dietType ?? "—"} />
                  {data.weights.length > 0 && (
                    <Row
                      label="ชั่งล่าสุด"
                      value={data.weights.map((w) => `${w.weight} กก.`).join(" · ")}
                    />
                  )}
                </div>
              </Card>

              {/* ── คอร์ส ── */}
              <Card title="คอร์สปิ่นโต">
                {data.program.active ? (
                  <div className="space-y-2 text-sm">
                    <Row label="สายอาหาร" value={data.program.active.trackLabel} />
                    <Row label="ช่วงคอร์ส" value={`${data.program.active.startLabel} → ${data.program.active.endLabel} (${data.program.active.totalDays} วัน)`} />
                    <Row label="สมัครเมื่อ" value={data.program.active.enrolledLabel} />
                    <Row label="มื้อที่รับ" value={data.program.active.slots.join(" · ")} />
                    <Row label="ราคา" value={`${data.program.active.price.toLocaleString("th-TH")} บาท`} />
                    <Row label="ที่อยู่จัดส่ง" value={data.program.active.address ?? "⚠️ ยังไม่มี — ต้องขอทาง LINE"} />
                    {data.program.active.deliveryNote && <Row label="โน้ตจัดส่ง" value={data.program.active.deliveryNote} />}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">ตอนนี้ไม่มีคอร์สที่กำลังใช้งาน</p>
                )}

                {data.program.history.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1.5">คอร์สที่ผ่านมา</p>
                    {data.program.history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
                        <span>{h.startLabel}–{h.endLabel}</span>
                        <span className="text-gray-400">{h.trackLabel}</span>
                        <Chip
                          text={h.status === "active" ? "กำลังใช้งาน" : h.status === "completed" ? "จบแล้ว" : "ยกเลิก"}
                          tone={h.status === "active" ? "green" : "gray"}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ── ติดต่อ / ออเดอร์ ── */}
              <Card title="ติดต่อและออเดอร์">
                <div className="space-y-2 text-sm">
                  <Row label="โทร" value={data.member.phone ?? "—"} />
                  <Row label="อีเมล" value={data.member.email ?? "—"} />
                  {data.addresses.map((a) => (
                    <Row key={a.id} label={a.isDefault ? "ที่อยู่หลัก" : "ที่อยู่"} value={a.text ?? "—"} />
                  ))}
                </div>
                {data.orders.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {data.orders.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-mono">{o.orderNumber}</span>
                        <span>{o.totalPrice.toLocaleString("th-TH")} บาท</span>
                        <Chip text={o.status} tone="gray" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-gray-500 text-xs w-28 shrink-0">{label}</span>
      <span className="text-gray-900 flex-1">{value}</span>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">
        {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
      </p>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "red" | "amber" | "green" | "gray" }) {
  const cls = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    gray: "bg-gray-100 text-gray-600",
  }[tone];
  return <span className={`px-1.5 py-0.5 rounded text-[11px] ${cls}`}>{text}</span>;
}
