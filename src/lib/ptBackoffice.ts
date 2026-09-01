/**
 * ข้อมูลแท็บ "การเทรน" ในโปรไฟล์ลูกค้าหลังบ้าน (WO-PT-ENGINE §7.3)
 *
 * ทำไมต้องมี: engine ทั้ง 5 ตัวตัดสินใจจากตัวเลขที่ไม่มีใครมองเห็น — เวลาลูกค้าโทรมาถามว่า
 * "ทำไมสัปดาห์นี้เบาลง" แอดมินต้องตอบได้จากหน้าเดียว ไม่ใช่ต้องให้คนเขียนโค้ดไป query DB ให้
 *
 * 🔴 ทุกตัวเลขบนหน้านี้ต้อง derive จากบันทึกจริง (SetLog / ReadinessCheckin) —
 *    ห้ามเติมค่าประมาณให้ช่องว่าง เพราะแอดมินจะเอาไปคุยกับลูกค้าเหมือนเป็นของจริง
 * 🔴 e1RM คิดเฉพาะเซ็ตที่มี "น้ำหนักจริง + ครั้งจริง" ครบคู่ — ขาดข้างใดข้างหนึ่งคือไม่มีข้อมูล ไม่ใช่ศูนย์
 */
import { prisma } from "@/lib/prisma";
import { epley, DELOAD_STALL_WEEKS } from "@/lib/progression";
import { collectAlertsFor, areaLabel } from "@/lib/ptAlerts";
import { intensityCap, isCalibrationWeek, tagLabel } from "@/lib/trainingProfile";

/** ย้อนหลังกี่วันสำหรับกราฟ e1RM */
export const CHART_DAYS = 90;
/** ย้อนหลังกี่วันสำหรับความพร้อม */
export const READINESS_DAYS = 30;
/** ย้อนหลังกี่วันสำหรับรายการเซสชัน */
export const SESSION_DAYS = 21;

const dayKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiShort = (d: Date): string => `${d.getUTCDate()} ${TH_MONTH[d.getUTCMonth()]}`;

const BAND_TH: Record<string, string> = {
  full: "เต็มที่", normal: "ปกติ", reduced: "เบาลง", recovery: "วันเบา",
};
const FEEL_TH: Record<string, string> = {
  too_easy: "ง่ายไป", easy: "ง่าย", good: "กำลังดี", hard: "หนัก", too_hard: "หนักไป",
};
const GOAL_TH: Record<string, string> = {
  fat_loss: "ลดไขมัน", muscle_gain: "เพิ่มกล้าม", strength: "เพิ่มแรง",
  endurance: "ความอึด", general: "สุขภาพทั่วไป", athletic: "สมรรถนะกีฬา",
};
const STYLE_TH: Record<string, string> = {
  strength: "เน้นแรง", hypertrophy: "เน้นขนาดกล้าม", fatloss_hybrid: "ลดไขมันแบบผสม",
  endurance: "เน้นอึด", athletic: "เน้นสมรรถนะ", balanced: "สมดุล",
};

export interface E1rmPoint { date: string; label: string; e1rm: number; weightKg: number; reps: number }

export interface ProgressionRow {
  exerciseKey: string;
  name: string;
  loadable: boolean;
  unit: string;
  e1rmKg: number | null;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastSets: number | null;
  successStreak: number;
  stallCount: number;
  /// นิ่งจนถึงเกณฑ์สั่งพักฟื้นแล้ว — หน้าจอเน้นสีให้เห็นก่อนแถวอื่น
  stalled: boolean;
  updatedAt: string;
  chart: E1rmPoint[];
}

export interface ReadinessRow {
  date: string; label: string; score: number | null; band: string | null; bandLabel: string | null;
  energy: number | null; soreness: number | null; soreAreas: string[]; applied: boolean;
}

export interface SessionRow {
  date: string; label: string; exercises: number; sets: number; volumeKg: number;
  items: { name: string; sets: number; bestWeightKg: number | null; bestReps: number | null; feel: string | null }[];
}

export interface TrainingView {
  member: { id: string; name: string | null };
  profile: {
    hasProfile: boolean;
    goalLabel: string | null; styleLabel: string | null;
    daysPerWeek: number | null; sessionMin: number | null; trainDays: string[];
    experienceMonths: number | null; calibration: boolean;
    likes: string[]; dislikes: string[];
    lowMode: boolean; parqClearedAt: string | null;
  };
  injuries: { id: string; area: string; areaLabel: string; severity: string; note: string | null; expiresAt: string | null }[];
  equipment: { type: string; variant: string | null; minKg: number | null; maxKg: number | null; incrementKg: number | null }[];
  progression: ProgressionRow[];
  readiness: ReadinessRow[];
  sessions: SessionRow[];
  alerts: { kind: string; message: string }[];
  overrides: { at: string; label: string; staffEmail: string; note: string | null }[];
}

const OVERRIDE_TH: Record<string, string> = {
  set_weight: "ตั้งน้ำหนักเอง",
  reset_stall: "ล้างตัวนับนิ่ง",
  force_deload: "สั่งสัปดาห์พักฟื้น",
  clear_calibration: "ปิดสัปดาห์สอบเทียบ",
  note: "บันทึกโน้ต",
};
export const overrideLabel = (a: string): string => OVERRIDE_TH[a] ?? a;

export async function getTrainingView(memberId: string, now = new Date()): Promise<TrainingView | null> {
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, name: true } });
  if (!member) return null;

  const chartSince = new Date(now.getTime() - CHART_DAYS * 24 * 3600 * 1000);
  const sessionSince = new Date(now.getTime() - SESSION_DAYS * 24 * 3600 * 1000);
  const readinessSince = new Date(now.getTime() - READINESS_DAYS * 24 * 3600 * 1000);

  const [profile, injuries, equipment, states, checkins, sets, overrides] = await Promise.all([
    prisma.trainingProfile.findUnique({ where: { memberId } }),
    prisma.injuryLimitation.findMany({
      where: { memberId, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.memberEquipment.findMany({ where: { memberId }, orderBy: { type: "asc" } }),
    prisma.progressionState.findMany({ where: { memberId }, orderBy: [{ stallCount: "desc" }, { updatedAt: "desc" }] }),
    prisma.readinessCheckin.findMany({
      where: { memberId, date: { gte: readinessSince } },
      orderBy: { date: "desc" },
    }),
    prisma.setLog.findMany({
      where: { memberId, date: { gte: chartSince } },
      select: {
        date: true, exerciseKey: true, exerciseName: true, setNo: true,
        actualWeightKg: true, actualReps: true, actualSec: true, feel: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.ptOverride.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const keys = Array.from(new Set([...states.map((s) => s.exerciseKey), ...sets.map((s) => s.exerciseKey)]));
  const exercises = keys.length
    ? await prisma.exercise.findMany({ where: { key: { in: keys } }, select: { key: true, name: true, unit: true, loadable: true } })
    : [];
  const exMeta = new Map(exercises.map((e) => [e.key, e]));

  // ── กราฟ e1RM: ต่อท่า เอา "เซ็ตที่ดีที่สุดของวันนั้น" วันละจุด ─────────
  // (ทุกเซ็ตเป็นจุด = กราฟฟันเลื่อยอ่านไม่ออก · เซ็ตที่ดีที่สุดคือสิ่งที่ engine ใช้ตัดสินอยู่แล้ว)
  const chartOf = new Map<string, Map<string, E1rmPoint>>();
  for (const s of sets) {
    if (s.actualWeightKg == null || !s.actualReps) continue;
    const e = epley(s.actualWeightKg, s.actualReps);
    if (!Number.isFinite(e) || e <= 0) continue;
    const k = dayKey(s.date);
    let byDay = chartOf.get(s.exerciseKey);
    if (!byDay) { byDay = new Map(); chartOf.set(s.exerciseKey, byDay); }
    const prev = byDay.get(k);
    if (!prev || e > prev.e1rm) {
      byDay.set(k, {
        date: k, label: thaiShort(s.date),
        e1rm: Math.round(e * 10) / 10, weightKg: s.actualWeightKg, reps: s.actualReps,
      });
    }
  }

  const progression: ProgressionRow[] = states.map((st) => {
    const meta = exMeta.get(st.exerciseKey);
    return {
      exerciseKey: st.exerciseKey,
      name: meta?.name ?? st.exerciseKey,
      loadable: meta?.loadable ?? false,
      unit: meta?.unit ?? "reps",
      e1rmKg: st.e1rmKg,
      lastWeightKg: st.lastWeightKg,
      lastReps: st.lastReps,
      lastSets: st.lastSets,
      successStreak: st.successStreak,
      stallCount: st.stallCount,
      stalled: st.stallCount >= DELOAD_STALL_WEEKS,
      updatedAt: st.updatedAt.toISOString(),
      chart: Array.from(chartOf.get(st.exerciseKey)?.values() ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  // ── เซสชันย้อนหลัง: รวมรายวันจาก SetLog ────────────────────────────
  const sessionMap = new Map<string, SessionRow & { _byEx: Map<string, SessionRow["items"][number]> }>();
  for (const s of sets) {
    if (s.date < sessionSince) continue;
    const k = dayKey(s.date);
    let row = sessionMap.get(k);
    if (!row) {
      row = { date: k, label: thaiShort(s.date), exercises: 0, sets: 0, volumeKg: 0, items: [], _byEx: new Map() };
      sessionMap.set(k, row);
    }
    row.sets++;
    if (s.actualWeightKg != null && s.actualReps) row.volumeKg += s.actualWeightKg * s.actualReps;
    const name = exMeta.get(s.exerciseKey)?.name ?? s.exerciseName;
    let it = row._byEx.get(s.exerciseKey);
    if (!it) {
      it = { name, sets: 0, bestWeightKg: null, bestReps: null, feel: null };
      row._byEx.set(s.exerciseKey, it);
      row.items.push(it);
      row.exercises++;
    }
    it.sets++;
    if (s.actualWeightKg != null && (it.bestWeightKg == null || s.actualWeightKg > it.bestWeightKg)) {
      it.bestWeightKg = s.actualWeightKg;
      it.bestReps = s.actualReps ?? null;
    }
    // feel ล่าสุดของท่านั้นในวันนั้น = ความรู้สึกหลังเซ็ตท้าย ซึ่งเป็นตัวที่ engine ใช้
    if (s.feel) it.feel = FEEL_TH[s.feel] ?? s.feel;
  }
  const sessions: SessionRow[] = Array.from(sessionMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ _byEx, ...r }) => ({ ...r, volumeKg: Math.round(r.volumeKg) }));

  const alerts = await collectAlertsFor({ id: member.id, name: member.name }, now);

  return {
    member,
    profile: {
      hasProfile: !!profile,
      goalLabel: profile ? GOAL_TH[profile.primaryGoal] ?? profile.primaryGoal : null,
      styleLabel: profile?.style ? STYLE_TH[profile.style] ?? profile.style : null,
      daysPerWeek: profile?.daysPerWeek ?? null,
      sessionMin: profile?.sessionMin ?? null,
      trainDays: profile?.trainDays ?? [],
      experienceMonths: profile?.experienceMonths ?? null,
      calibration: isCalibrationWeek(profile, now),
      likes: (profile?.likes ?? []).map(tagLabel),
      dislikes: (profile?.dislikes ?? []).map(tagLabel),
      // ใช้ตัวเดียวกับที่ engine ใช้ตัดสิน — ถ้าหลังบ้านคิดเองจะมีวันที่จอบอกคนละเรื่องกับแผนจริง
      lowMode: intensityCap(profile) === "low",
      parqClearedAt: parqClearedAtOf(profile?.parq),
    },
    injuries: injuries.map((i) => ({
      id: i.id, area: i.area, areaLabel: areaLabel(i.area), severity: i.severity,
      note: i.note, expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
    })),
    equipment: equipment.map((e) => ({
      type: e.type, variant: e.variant, minKg: e.minKg, maxKg: e.maxKg, incrementKg: e.incrementKg,
    })),
    progression,
    readiness: checkins.map((c) => ({
      date: dayKey(c.date), label: thaiShort(c.date), score: c.score, band: c.band,
      bandLabel: c.band ? BAND_TH[c.band] ?? c.band : null,
      energy: c.energy, soreness: c.soreness, soreAreas: c.soreAreas, applied: c.applied,
    })),
    sessions,
    alerts: alerts.map((a) => ({ kind: a.kind, message: a.message })),
    overrides: overrides.map((o) => ({
      at: o.createdAt.toISOString(),
      label: `${overrideLabel(o.action)}${o.exerciseKey ? ` · ${exMeta.get(o.exerciseKey)?.name ?? o.exerciseKey}` : ""}`,
      staffEmail: o.staffEmail,
      note: o.note,
    })),
  };
}

/** วันที่ user ยืนยันว่าไปพบแพทย์แล้ว — เก็บอยู่ใน parq JSON ไม่ใช่คอลัมน์แยก */
function parqClearedAtOf(parq: unknown): string | null {
  if (!parq || typeof parq !== "object") return null;
  const v = (parq as Record<string, unknown>).clearedAt;
  return typeof v === "string" && v ? v : null;
}
