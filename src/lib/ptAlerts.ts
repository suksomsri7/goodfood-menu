/**
 * Alert แอดมินสำหรับสาย PT (WO-PT-ENGINE §7.4)
 *
 * 3 เรื่องที่แอดมินต้องรู้ "ก่อน" ลูกค้าบ่น:
 *   1. นิ่ง ≥3 สัปดาห์ต่อท่า  → engine สั่งพักฟื้นเองได้ แต่ถ้านิ่งซ้ำแปลว่าโปรแกรมไม่เหมาะกับคนนี้
 *   2. ความพร้อมต่ำติดกัน 5 วัน → นอนไม่พอ/เครียด/เทรนหนักเกิน — เป็นสัญญาณเลิกเล่นก่อนที่จะเลิกจริง
 *   3. รายงานเจ็บใหม่           → ต้องมีคนดู ไม่ใช่ปล่อยให้ระบบตัดท่าเงียบ ๆ
 *
 * 🔴 กติกาทั้ง 3 ข้อจะ "เป็นจริง" ทุกวันจนกว่าจะมีคนแก้ ถ้ายิงตรง ๆ ทุกวัน Telegram จะเด้ง
 *    เรื่องเดิมซ้ำจนไม่มีใครอ่าน → กันด้วย dedupeKey ที่ผูกกับช่วงเวลา (unique ใน DB ไม่ใช่ตัวแปรในหน่วยความจำ
 *    เพราะ cron รันคนละ process กับเว็บ)
 * 🔴 ข้อความห้ามวินิจฉัยโรค — บอกสิ่งที่ข้อมูลเห็นเท่านั้น แล้วให้คนตัดสิน
 */
import { prisma } from "@/lib/prisma";
import { isAiCoachActive } from "@/lib/coaching";
import { bkkTodayKey, addDays } from "@/lib/planGenerator";
import { DELOAD_STALL_WEEKS } from "@/lib/progression";

/** ความพร้อมต่ำกี่วันติดกันถึงเรียกว่า "ต้องมีคนดู" */
export const READINESS_LOW_DAYS = 5;
/** ช่วงที่ถือว่า "เจ็บใหม่" นับจากตอนที่ user บันทึก */
export const NEW_INJURY_HOURS = 36;
/** band ที่ถือว่าต่ำ — full/normal ไม่นับ */
const LOW_BANDS = new Set(["reduced", "recovery"]);

export type AlertKind = "stall" | "readiness_low" | "new_injury";

export interface PtAlertDraft {
  memberId: string;
  memberName: string | null;
  kind: AlertKind;
  subject: string;
  dedupeKey: string;
  message: string;
  detail: Record<string, unknown>;
}

/** กุญแจสัปดาห์แบบ UTC (ปี+เลขสัปดาห์) — ใช้ผูก dedupe ของเรื่องที่ควรเตือนสัปดาห์ละครั้ง */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // ISO week: เลื่อนไปวันพฤหัสของสัปดาห์นั้นก่อนแล้วค่อยนับ
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000));
  return `${t.getUTCFullYear()}W${String(week).padStart(2, "0")}`;
}

const dayStr = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/**
 * นับว่าช่วงความพร้อม "ต่ำ" ติดกันกี่วันนับจากวันล่าสุดย้อนลง
 * 🔴 วันที่ไม่ได้ตอบ = สตรีคขาด ไม่ใช่ "ต่ำ" — ไม่ตอบเพราะไม่ได้เล่นก็มี
 *    ถ้าเหมาว่าต่ำ จะไปเตือนคนที่แค่หายไปเฉย ๆ แล้วแอดมินจะเลิกเชื่อการเตือนนี้
 * 🔴 วันที่ยังไม่ได้ตอบ "ของวันนี้" ก็ทำให้ขาดเหมือนกัน — ตั้งใจ: กวาดตอนเช้าก่อนคนตื่นจะได้ไม่เตือนผิด
 *    (cron ตั้งไว้ตอนสายหลังคนเช็คอินแล้ว)
 */
export function lowBandStreak(
  checkins: { date: Date; band: string | null }[],
  today: Date,
  maxLook = READINESS_LOW_DAYS + 2,
): number {
  const byDay = new Map(checkins.map((c) => [dayStr(c.date), c]));
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < maxLook; i++) {
    const c = byDay.get(dayStr(cursor));
    if (!c || !c.band || !LOW_BANDS.has(c.band)) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

const AREA_TH: Record<string, string> = {
  knee: "เข่า", back: "หลัง", shoulder: "ไหล่", hip: "สะโพก",
  ankle: "ข้อเท้า", wrist: "ข้อมือ", neck: "คอ", elbow: "ข้อศอก", other: "อื่น ๆ",
};
export const areaLabel = (a: string): string => AREA_TH[a] ?? a;

/**
 * หาเรื่องที่ต้องเตือนของคนเดียว — ไม่แตะ DB เพื่อเขียน (คืน draft ให้ตัวเรียกตัดสินใจ)
 * แยกออกมาเพราะหน้าหลังบ้านอยากเห็น "ตอนนี้คนนี้มีอะไรค้าง" โดยไม่ต้องยิงแจ้งเตือน
 */
export async function collectAlertsFor(
  member: { id: string; name: string | null },
  now = new Date(),
): Promise<PtAlertDraft[]> {
  const out: PtAlertDraft[] = [];
  const wk = weekKey(now);

  // ── 1. นิ่งยาวรายท่า ────────────────────────────────────────────────
  const stalled = await prisma.progressionState.findMany({
    where: { memberId: member.id, stallCount: { gte: DELOAD_STALL_WEEKS } },
    select: { exerciseKey: true, stallCount: true, lastWeightKg: true, e1rmKg: true, updatedAt: true },
    orderBy: { stallCount: "desc" },
    take: 10,
  });
  if (stalled.length) {
    const keys = stalled.map((s) => s.exerciseKey);
    const names = await prisma.exercise.findMany({
      where: { key: { in: keys } },
      select: { key: true, name: true },
    });
    const nameOf = new Map(names.map((n) => [n.key, n.name]));
    for (const s of stalled) {
      const label = nameOf.get(s.exerciseKey) ?? s.exerciseKey;
      out.push({
        memberId: member.id,
        memberName: member.name,
        kind: "stall",
        subject: s.exerciseKey,
        // เตือนสัปดาห์ละครั้งต่อท่า — นิ่งต่อสัปดาห์หน้าก็ยังเตือนอีก (เรื่องยังไม่จบ) แต่ไม่ใช่ทุกวัน
        dedupeKey: `stall:${s.exerciseKey}:${wk}`,
        message: `${member.name ?? "ลูกค้า"} — ท่า "${label}" ตัวเลขไม่ขยับมา ${s.stallCount} สัปดาห์${
          s.lastWeightKg ? ` (ค้างที่ ${s.lastWeightKg} กก.)` : ""
        }`,
        detail: { exerciseKey: s.exerciseKey, exerciseName: label, stallCount: s.stallCount, lastWeightKg: s.lastWeightKg },
      });
    }
  }

  // ── 2. ความพร้อมต่ำติดกัน ───────────────────────────────────────────
  const today = bkkTodayKey();
  const checkins = await prisma.readinessCheckin.findMany({
    where: { memberId: member.id, date: { gte: addDays(today, -(READINESS_LOW_DAYS + 2)), lte: today } },
    select: { date: true, band: true, score: true },
    orderBy: { date: "desc" },
  });
  const streak = lowBandStreak(checkins, today);
  if (streak >= READINESS_LOW_DAYS) {
    const scores = checkins
      .slice(0, streak)
      .map((c) => c.score)
      .filter((s): s is number => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    out.push({
      memberId: member.id,
      memberName: member.name,
      kind: "readiness_low",
      subject: "-",
      // ผูกกับวันล่าสุดของสตรีค — ต่ำต่ออีกวันคือเรื่องเดิมที่ยาวขึ้น ยังไม่ต้องเตือนซ้ำในสัปดาห์นั้น
      dedupeKey: `readiness_low:${wk}`,
      message: `${member.name ?? "ลูกค้า"} — ความพร้อมอยู่ช่วงต่ำ ${streak} วันติด${avg != null ? ` (เฉลี่ย ${avg}/100)` : ""}`,
      detail: { days: streak, avgScore: avg },
    });
  }

  // ── 3. เจ็บใหม่ ─────────────────────────────────────────────────────
  const since = new Date(now.getTime() - NEW_INJURY_HOURS * 3600 * 1000);
  const injuries = await prisma.injuryLimitation.findMany({
    where: {
      memberId: member.id,
      active: true,
      createdAt: { gte: since },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, area: true, severity: true, note: true, expiresAt: true },
  });
  for (const inj of injuries) {
    out.push({
      memberId: member.id,
      memberName: member.name,
      kind: "new_injury",
      subject: inj.area,
      // ผูกกับ id ของรายการ — รายงานใบเดิมเตือนครั้งเดียวตลอดกาล
      dedupeKey: `new_injury:${inj.id}`,
      message: `${member.name ?? "ลูกค้า"} — แจ้งเจ็บใหม่ที่${areaLabel(inj.area)}${
        inj.severity === "avoid" ? " (ระดับตัดท่าออก)" : " (ระดับระวัง)"
      }${inj.note ? ` · "${inj.note}"` : ""}`,
      detail: { area: inj.area, severity: inj.severity, note: inj.note, expiresAt: inj.expiresAt },
    });
  }

  return out;
}

/** ส่งเข้าท่อ ops ที่มีอยู่แล้ว — ไม่มี webhook = ข้ามเงียบ ๆ (alert ยังถูกเก็บลง DB ให้หลังบ้านเห็น) */
async function notifyOps(text: string): Promise<boolean> {
  const url = process.env.OPS_ALERT_WEBHOOK;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface AlertRunResult {
  scanned: number;
  found: number;
  created: number;
  notified: number;
  items: { memberId: string; kind: AlertKind; message: string; isNew: boolean }[];
}

/**
 * กวาดสมาชิกที่ยังมีสิทธิ์โค้ช → เก็บ alert ใหม่ลง DB → ยิง ops เฉพาะใบที่เพิ่งเกิด
 * 🔴 การกันซ้ำต้องจบที่ DB (unique memberId+dedupeKey) ไม่ใช่เช็คก่อนแล้วค่อยเขียน —
 *    cron กับปุ่มในหลังบ้านยิงพร้อมกันได้ ถ้าเช็คแยกจะได้ 2 ใบแล้วแจ้งซ้ำ
 */
export async function runPtAlerts(opts?: { onlyMemberId?: string; dryRun?: boolean }): Promise<AlertRunResult> {
  const now = new Date();
  // 🔴 dryRun ต้องไม่เขียน DB ด้วย ไม่ใช่แค่ไม่ยิง Telegram — เขียนแล้วไม่ยิง = กุญแจกันซ้ำถูกใช้ไปเปล่า ๆ
  //    รอบจริงจะเงียบใส่เรื่องนั้นทั้งสัปดาห์ (กับดักที่เจอตอนจะลองรันดูเฉย ๆ)
  const dry = opts?.dryRun === true;
  const members = await prisma.member.findMany({
    where: { ...(opts?.onlyMemberId ? { id: opts.onlyMemberId } : {}) },
    select: { id: true, name: true, memberType: true, aiCoachExpireDate: true, createdAt: true },
  });

  const result: AlertRunResult = { scanned: 0, found: 0, created: 0, notified: 0, items: [] };

  for (const m of members) {
    if (!isAiCoachActive(m as Parameters<typeof isAiCoachActive>[0])) continue;
    result.scanned++;
    const drafts = await collectAlertsFor({ id: m.id, name: m.name }, now);
    result.found += drafts.length;

    for (const d of drafts) {
      let isNew = false;
      if (dry) {
        result.items.push({ memberId: d.memberId, kind: d.kind, message: d.message, isNew: false });
        continue;
      }
      try {
        await prisma.ptAlert.create({
          data: {
            memberId: d.memberId,
            kind: d.kind,
            subject: d.subject,
            dedupeKey: d.dedupeKey,
            message: d.message,
            detail: d.detail as object,
          },
        });
        isNew = true;
        result.created++;
      } catch {
        // ชนกุญแจ = เคยเตือนเรื่องนี้ไปแล้วในช่วงนี้ ปล่อยผ่าน
      }
      if (isNew) {
        const ok = await notifyOps(`⚠️ โค้ช PT · ${d.message}`);
        if (ok) {
          result.notified++;
          await prisma.ptAlert.updateMany({
            where: { memberId: d.memberId, dedupeKey: d.dedupeKey },
            data: { notifiedAt: new Date() },
          });
        }
      }
      result.items.push({ memberId: d.memberId, kind: d.kind, message: d.message, isNew });
    }
  }

  return result;
}
