"use client";

/**
 * แท็บ "การเทรน" ในโปรไฟล์ลูกค้า (WO-PT-ENGINE §7.3)
 *
 * คนอ่านหน้านี้คือแอดมิน/โค้ชที่กำลังจะคุยกับลูกค้า — เรียงตาม "สิ่งที่ต้องตัดสินใจก่อน":
 *   เรื่องที่ต้องรีบดู → ข้อจำกัดร่างกาย → ตัวเลขรายท่า (+ ปุ่มสั่งข้ามระบบ) → ความพร้อม → ประวัติ
 *
 * 🔴 ปุ่ม override ต้องบอกให้ชัดว่ามีผลเมื่อไร — "ตั้งน้ำหนัก/สั่งพักฟื้น" ไปมีผลตอนแผนรอบหน้า
 *    ถ้าเขียนแค่ "บันทึกแล้ว" แอดมินจะไปบอกลูกค้าว่าวันนี้เปลี่ยนแล้ว ซึ่งไม่จริง
 * 🔴 ป้ายช่วงความพร้อมต้องมีตัวหนังสือกำกับเสมอ ห้ามสื่อด้วยสีอย่างเดียว
 *    (สีเหลือง "เบาลง" คอนทราสต์ต่ำบนพื้นขาว + คนตาบอดสีอ่านไม่ออก)
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* ── สีป้ายช่วงความพร้อม: ชุดสถานะ (ไม่ใช่สีของ "ซีรีส์") + มีตัวหนังสือกำกับทุกที่ ── */
const BAND_COLOR: Record<string, string> = {
  full: "#0ca30c",     // เต็มที่
  normal: "#2a78d6",   // ปกติ
  reduced: "#fab219",  // เบาลง
  recovery: "#d03b3b", // วันเบา
};
/** สีเส้นกราฟ e1RM — ซีรีส์เดียว ไม่ต้องมี legend (หัวข้อบอกอยู่แล้วว่าเป็นของท่าไหน) */
const LINE_COLOR = "#2a78d6";

interface E1rmPoint { date: string; label: string; e1rm: number; weightKg: number; reps: number }
interface ProgressionRow {
  exerciseKey: string; name: string; loadable: boolean; unit: string;
  e1rmKg: number | null; lastWeightKg: number | null; lastReps: number | null; lastSets: number | null;
  successStreak: number; stallCount: number; stalled: boolean; updatedAt: string; chart: E1rmPoint[];
}
interface ReadinessRow {
  date: string; label: string; score: number | null; band: string | null; bandLabel: string | null;
  energy: number | null; soreness: number | null; soreAreas: string[]; applied: boolean;
}
interface SessionRow {
  date: string; label: string; exercises: number; sets: number; volumeKg: number;
  items: { name: string; sets: number; bestWeightKg: number | null; bestReps: number | null; feel: string | null }[];
}
export interface TrainingView {
  member: { id: string; name: string | null };
  profile: {
    hasProfile: boolean; goalLabel: string | null; styleLabel: string | null;
    daysPerWeek: number | null; sessionMin: number | null; trainDays: string[];
    experienceMonths: number | null; calibration: boolean;
    likes: string[]; dislikes: string[]; lowMode: boolean; parqClearedAt: string | null;
  };
  injuries: { id: string; area: string; areaLabel: string; severity: string; note: string | null; expiresAt: string | null }[];
  equipment: { type: string; variant: string | null; minKg: number | null; maxKg: number | null; incrementKg: number | null }[];
  progression: ProgressionRow[];
  readiness: ReadinessRow[];
  sessions: SessionRow[];
  alerts: { kind: string; message: string }[];
  overrides: { at: string; label: string; staffEmail: string; note: string | null }[];
}

const DAY_TH: Record<string, string> = {
  mon: "จ", tue: "อ", wed: "พ", thu: "พฤ", fri: "ศ", sat: "ส", sun: "อา",
};
const EQUIP_TH: Record<string, string> = {
  dumbbell: "ดัมเบล", barbell: "บาร์เบล", kettlebell: "เคตเทิลเบล", band: "ยางยืด",
  bench: "ม้านั่ง", pullup_bar: "บาร์โหน", machine: "เครื่อง", treadmill: "ลู่วิ่ง",
  bike: "จักรยาน", full_gym: "ยิมเต็มรูปแบบ",
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

export function TrainingTab({ memberId }: { memberId: string }) {
  const [data, setData] = useState<TrainingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/backoffice/pt/${memberId}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setErr(json.error || "โหลดข้อมูลการเทรนไม่สำเร็จ");
      else {
        setData(json);
        /* กางท่าที่นิ่งให้เลย — คนเปิดหน้านี้มักมาเพราะเรื่องนั้น
           (ถ้าปล่อยหุบหมด แอดมินต้องเดาว่าต้องกดแถวไหนถึงจะเห็นกราฟ/ปุ่มสั่ง) */
        const first = (json.progression ?? []).find((r: ProgressionRow) => r.stalled);
        if (first) setOpenKey((cur) => cur ?? first.exerciseKey);
      }
    } catch {
      setErr("เชื่อมต่อไม่ได้");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { void load(); }, [load]);

  /** ยิงคำสั่ง override — โหลดใหม่เสมอหลังสำเร็จ ไม่เดาสถานะหน้าจอเอง */
  async function sendOverride(action: string, extra: Record<string, unknown> = {}, tag = action) {
    setBusy(tag);
    setFlash(null);
    try {
      const res = await fetch(`/api/backoffice/pt/${memberId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setFlash(json.error || "สั่งไม่สำเร็จ"); return; }
      setFlash(json.message ?? "บันทึกแล้ว");
      await load();
    } catch {
      setFlash("เชื่อมต่อไม่ได้");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
      </div>
    );
  }
  if (err) return <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{err}</div>;
  if (!data) return null;

  const p = data.profile;

  return (
    <div className="space-y-4">
      {flash && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{flash}</div>
      )}

      {/* ── เรื่องที่ต้องรีบดู ── */}
      {data.alerts.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <p className="font-bold text-amber-900 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" /> ต้องดูก่อน
          </p>
          <ul className="space-y-1 text-sm text-amber-900">
            {data.alerts.map((a, i) => <li key={i}>· {a.message}</li>)}
          </ul>
        </div>
      )}

      {!p.hasProfile ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>ยังไม่เคยตั้งโปรไฟล์การเทรน</b> — ระบบยังจัดโปรแกรมให้ไม่ได้ ต้องให้ลูกค้าตอบใน
          แอป (ตั้งค่า › โปรไฟล์การเทรน) ก่อน
        </div>
      ) : (
        <Card title="โปรไฟล์การเทรน">
          <div className="space-y-2 text-sm">
            <Row label="เป้าหมาย" value={p.goalLabel ?? "—"} />
            <Row label="สไตล์" value={p.styleLabel ?? "ให้ระบบเลือกตามเป้าหมาย"} />
            <Row
              label="ตารางเทรน"
              value={`${p.daysPerWeek ?? "—"} วัน/สัปดาห์ · ครั้งละ ${p.sessionMin ?? "—"} นาที${
                p.trainDays.length ? ` · ${p.trainDays.map((d) => DAY_TH[d] ?? d).join(" ")}` : ""
              }`}
            />
            <Row
              label="ประสบการณ์"
              value={p.experienceMonths != null ? `${p.experienceMonths} เดือน` : "ยังไม่ระบุ"}
            />
            <Row label="ชอบ" value={p.likes.length ? p.likes.join(", ") : "—"} />
            <Row label="ไม่ชอบ" value={p.dislikes.length ? p.dislikes.join(", ") : "—"} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {p.calibration && <Tag text="อยู่ในสัปดาห์สอบเทียบ" tone="blue" />}
            {p.lowMode && <Tag text="โหมดเบา (PAR-Q ยังไม่ปลด)" tone="amber" />}
            {p.parqClearedAt && <Tag text={`ยืนยันพบแพทย์ ${fmtDate(p.parqClearedAt)}`} tone="green" />}
          </div>
          {p.calibration && (
            <button
              onClick={() => sendOverride("clear_calibration")}
              disabled={busy === "clear_calibration"}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === "clear_calibration" ? "กำลังสั่ง..." : "ปิดสัปดาห์สอบเทียบให้เลย"}
            </button>
          )}
        </Card>
      )}

      {/* ── ข้อจำกัดร่างกาย + อุปกรณ์ ── */}
      {data.injuries.length > 0 && (
        <Card title="จุดที่ต้องระวัง">
          <div className="space-y-2 text-sm">
            {data.injuries.map((i) => (
              <div key={i.id} className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{i.areaLabel}</span>
                <Tag text={i.severity === "avoid" ? "ตัดท่าออก" : "ลดน้ำหนัก"} tone={i.severity === "avoid" ? "red" : "amber"} />
                {i.expiresAt && <span className="text-xs text-gray-400">ถึง {fmtDate(i.expiresAt)}</span>}
                {i.note && <span className="text-gray-600">· {i.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="อุปกรณ์ที่ลูกค้ามี">
        {data.equipment.length ? (
          <div className="space-y-1.5 text-sm">
            {data.equipment.map((e, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="text-gray-900">{EQUIP_TH[e.type] ?? e.type}</span>
                <span className="text-xs text-gray-500">
                  {[
                    e.variant === "adjustable" ? "ปรับน้ำหนักได้" : e.variant === "fixed" ? "น้ำหนักตายตัว" : null,
                    e.minKg != null && e.maxKg != null ? `${e.minKg}-${e.maxKg} กก.` : null,
                    e.incrementKg != null ? `ก้าวละ ${e.incrementKg} กก.` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            ยังไม่ได้ลงทะเบียนอุปกรณ์ — ระบบจะเพิ่มน้ำหนักทีละ 2.5 กก. เป็นค่าปริยาย
          </p>
        )}
      </Card>

      {/* ── ตัวเลขรายท่า ── */}
      <Card title={`ความคืบหน้ารายท่า (${data.progression.length} ท่า)`}>
        {data.progression.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีบันทึกรายเซ็ต — ตัวเลขจะขึ้นหลังลูกค้าเล่นครั้งแรก</p>
        ) : (
          <div className="space-y-2">
            {data.progression.map((r) => {
              const open = openKey === r.exerciseKey;
              return (
                <div key={r.exerciseKey} className={`rounded-lg border ${r.stalled ? "border-amber-300 bg-amber-50/50" : "border-gray-100"}`}>
                  <button
                    onClick={() => setOpenKey(open ? null : r.exerciseKey)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                      <p className="text-xs text-gray-500">
                        {r.lastWeightKg != null
                          ? `ล่าสุด ${r.lastWeightKg} กก. × ${r.lastReps ?? "—"} ครั้ง × ${r.lastSets ?? "—"} เซ็ต`
                          : r.lastReps != null
                            ? `ล่าสุด ${r.lastReps} ครั้ง × ${r.lastSets ?? "—"} เซ็ต`
                            : "ยังไม่มีตัวเลขล่าสุด"}
                        {r.e1rmKg != null && ` · แรงสูงสุดประเมิน ${r.e1rmKg} กก.`}
                      </p>
                    </div>
                    {r.stalled ? (
                      <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                        <TrendingDown className="w-3.5 h-3.5" /> นิ่ง {r.stallCount} สัปดาห์
                      </span>
                    ) : r.successStreak > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                        <TrendingUp className="w-3.5 h-3.5" /> ขึ้น {r.successStreak} สัปดาห์
                      </span>
                    ) : null}
                  </button>

                  {open && (
                    <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
                      {r.chart.length >= 2 ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            แรงสูงสุดประเมิน (กก.) — ดีที่สุดของแต่ละวัน
                          </p>
                          <div className="h-32">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={r.chart} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                                <CartesianGrid stroke="#f1f1ef" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a8a85" }} tickLine={false} axisLine={false} minTickGap={18} />
                                {/* 🔴 ไม่บังคับให้เริ่มที่ 0 — ค่าที่ดูจริงคือ 40→46 กก. ถ้าลากลงถึง 0 เส้นจะแบนจนมองไม่เห็นว่าขยับ
                                    (กราฟเส้นตัดฐานได้ ต่างจากกราฟแท่งที่ต้องเริ่ม 0 เสมอ) */}
                                <YAxis
                                  tick={{ fontSize: 10, fill: "#8a8a85" }} tickLine={false} axisLine={false} width={38}
                                  domain={["dataMin - 2", "dataMax + 2"]}
                                  tickFormatter={(v: number) => String(Math.round(v))}
                                />
                                <Tooltip
                                  cursor={{ stroke: "#c9c9c4", strokeWidth: 1 }}
                                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e2" }}
                                  labelStyle={{ color: "#52514e" }}
                                  formatter={(v, _n, item) => {
                                    const pt = item?.payload as E1rmPoint | undefined;
                                    return [`${v ?? "—"} กก.${pt ? ` (ยก ${pt.weightKg}×${pt.reps})` : ""}`, "แรงสูงสุดประเมิน"];
                                  }}
                                />
                                <Line
                                  type="monotone" dataKey="e1rm" stroke={LINE_COLOR} strokeWidth={2}
                                  dot={{ r: 2.5, fill: LINE_COLOR, strokeWidth: 0 }}
                                  activeDot={{ r: 4.5, fill: LINE_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          ยังมีข้อมูลไม่พอวาดกราฟ (ต้องมีอย่างน้อย 2 วันที่บันทึกน้ำหนัก+ครั้งครบ)
                        </p>
                      )}

                      <div className="flex items-end gap-2 flex-wrap">
                        {r.loadable && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">ตั้งน้ำหนักรอบหน้าเอง (กก.)</label>
                            <div className="flex gap-1.5">
                              <input
                                type="number" step="0.5" min="0"
                                value={weightDraft[r.exerciseKey] ?? ""}
                                onChange={(e) => setWeightDraft((d) => ({ ...d, [r.exerciseKey]: e.target.value }))}
                                placeholder={r.lastWeightKg != null ? String(r.lastWeightKg) : "—"}
                                className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                              />
                              <button
                                onClick={() => sendOverride("set_weight", {
                                  exerciseKey: r.exerciseKey,
                                  weightKg: Number(weightDraft[r.exerciseKey]),
                                }, `w:${r.exerciseKey}`)}
                                disabled={busy === `w:${r.exerciseKey}` || !weightDraft[r.exerciseKey]}
                                className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white disabled:opacity-40"
                              >
                                {busy === `w:${r.exerciseKey}` ? "..." : "สั่ง"}
                              </button>
                            </div>
                          </div>
                        )}
                        {r.stallCount > 0 && (
                          <button
                            onClick={() => sendOverride("reset_stall", { exerciseKey: r.exerciseKey }, `s:${r.exerciseKey}`)}
                            disabled={busy === `s:${r.exerciseKey}`}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {busy === `s:${r.exerciseKey}` ? "กำลังสั่ง..." : "ล้างตัวนับนิ่ง"}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        น้ำหนักที่สั่งจะไปแทนที่ตัวเลขของระบบใน<b>แผนรอบถัดไป</b> ครั้งเดียว
                        หลังจากนั้นระบบเดินต่อจากที่ลูกค้าทำได้จริงเหมือนเดิม
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={() => sendOverride("force_deload")}
          disabled={busy === "force_deload"}
          className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy === "force_deload" ? "กำลังสั่ง..." : "สั่งให้สัปดาห์หน้าเป็นสัปดาห์พักฟื้น"}
        </button>
      </Card>

      {/* ── ความพร้อมย้อนหลัง ── */}
      <Card title="ความพร้อม 30 วันล่าสุด">
        {data.readiness.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่เคยเช็คอินความพร้อม</p>
        ) : (
          <div className="space-y-2">
            {data.readiness.slice(0, 12).map((c) => (
              <div key={c.date} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-gray-400 w-14 shrink-0">{c.label}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: c.band ? BAND_COLOR[c.band] ?? "#c9c9c4" : "#c9c9c4" }}
                  aria-hidden
                />
                <span className="text-gray-900 w-16 shrink-0">{c.bandLabel ?? "ไม่มีคะแนน"}</span>
                <span className="text-xs text-gray-500 flex-1">
                  {c.score != null ? `${c.score}/100` : "ข้อมูลไม่พอให้คะแนน"}
                  {c.soreAreas.length > 0 && ` · ปวด ${c.soreAreas.join(", ")}`}
                  {c.applied && " · ปรับแผนแล้ว"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── เซสชันย้อนหลัง ── */}
      <Card title="เล่นจริงย้อนหลัง 21 วัน">
        {data.sessions.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีบันทึกรายเซ็ต</p>
        ) : (
          <div className="space-y-3">
            {data.sessions.map((s) => (
              <div key={s.date} className="border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <p className="text-sm text-gray-900">
                  {s.label} · {s.exercises} ท่า · {s.sets} เซ็ต
                  {s.volumeKg > 0 && <span className="text-xs text-gray-500"> · รวม {s.volumeKg.toLocaleString("th-TH")} กก.</span>}
                </p>
                <div className="mt-1 space-y-0.5">
                  {s.items.map((it, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      {it.name} · {it.sets} เซ็ต
                      {it.bestWeightKg != null && ` · ดีสุด ${it.bestWeightKg} กก.${it.bestReps ? ` × ${it.bestReps}` : ""}`}
                      {it.feel && ` · รู้สึก "${it.feel}"`}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── ประวัติคำสั่งของคน ── */}
      {data.overrides.length > 0 && (
        <Card title="ประวัติคำสั่งของโค้ช">
          <div className="space-y-1.5">
            {data.overrides.map((o, i) => (
              <div key={i} className="flex items-baseline gap-2 text-xs text-gray-600">
                <Check className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="text-gray-900">{o.label}</span>
                <span className="text-gray-400">{fmtDate(o.at)} · {o.staffEmail}</span>
                {o.note && <span>· {o.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
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

function Tag({ text, tone }: { text: string; tone: "red" | "amber" | "green" | "blue" }) {
  const cls = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
  }[tone];
  return <span className={`px-1.5 py-0.5 rounded text-[11px] ${cls}`}>{text}</span>;
}
