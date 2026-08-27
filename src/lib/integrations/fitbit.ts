/**
 * ดึงข้อมูลจาก Fitbit Web API เข้าโครงข้อมูลเดิมของแอป
 *
 * 🔴 ทำไมต้องมี: Fitbit **ไม่เขียนลง Apple Health** (Google เป็นเจ้าของ) — ต่างจาก Garmin/Oura/
 *    Whoop/Withings ที่เขียนได้เอง · คนใช้ Fitbit จึงไม่มีทางอื่นเลยนอกจากต่อตรง
 *
 * 🔴 ปลายทางต้องเป็นตารางเดิมทั้งหมด (DailyMetric / WeightLog / SleepLog / ExerciseLog)
 *    ห้ามสร้างตารางแยกตามผู้ให้บริการ ไม่งั้นทุกการ์ด/กราฟ/สรุปต้องรู้จัก Fitbit เป็นกรณีพิเศษ
 *
 * 🔴 กันบันทึกซ้ำกับ Apple Health: คนหนึ่งอาจมีทั้งนาฬิกา Apple และ Fitbit
 *    · workout ใช้ sourceId `fitbit:<logId>` (unique อยู่แล้วในตาราง)
 *    · น้ำหนักเช็คช่วง ±12 ชม. แบบเดียวกับ /api/health/sync
 *    · DailyMetric เขียนเฉพาะช่องที่ยังว่าง — ของ Apple มาก่อนถือว่าแม่นกว่าเพราะเป็นข้อมูลบนเครื่อง
 */
import { prisma } from "@/lib/prisma";

const API = "https://api.fitbit.com";

// ข้อมูลจาก Fitbit เป็น JSON อิสระ — อ่านเป็น unknown แล้วกรองด้วย num() ทุกจุดที่ใช้จริง
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function get(token: string, path: string): Promise<Json | null> {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Json | null;
}

/** วัน BKK ในรูป YYYY-MM-DD (Fitbit คิดตามโซนเวลาของบัญชีผู้ใช้ ซึ่งลูกค้าเราคือไทย) */
function bkkDayString(d: Date): string {
  return new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
}
/** key ของ DailyMetric = UTC midnight ของวัน BKK (กติกาเดียวกับทั้งระบบ) */
function dayKeyOf(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export type SyncCounts = { metrics: number; weights: number; sleeps: number; workouts: number };

/**
 * ดึงย้อนหลัง `days` วัน (รวมวันนี้) — cron เรียกด้วยเลขน้อย ๆ (2-3 วัน) ก็พอ
 * เพราะข้อมูลย้อนหลังไกลจะถูกดึงครบตั้งแต่รอบแรกหลังเชื่อม
 */
export async function syncFitbit(memberId: string, token: string, days = 3): Promise<SyncCounts> {
  const counts: SyncCounts = { metrics: 0, weights: 0, sleeps: 0, workouts: 0 };
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const ymd = bkkDayString(new Date(today.getTime() - i * 86400e3));
    const dayKey = dayKeyOf(ymd);

    const [activity, sleep, weight, fat, heart] = await Promise.all([
      get(token, `/1/user/-/activities/date/${ymd}.json`),
      get(token, `/1.2/user/-/sleep/date/${ymd}.json`),
      get(token, `/1/user/-/body/log/weight/date/${ymd}.json`),
      get(token, `/1/user/-/body/log/fat/date/${ymd}.json`),
      get(token, `/1/user/-/activities/heart/date/${ymd}/1d.json`),
    ]);

    // ── ตัวเลขรายวัน ──
    const sum = activity?.summary ?? {};
    const restingHR = num(heart?.["activities-heart"]?.[0]?.value?.restingHeartRate);
    const distanceKm = num((sum.distances as Json[] | undefined)?.find((d) => d.activity === "total")?.distance);
    const patch: Record<string, number> = {};
    const putIf = (k: string, v: number | null) => { if (v != null && v > 0) patch[k] = Math.round(v); };
    putIf("steps", num(sum.steps));
    putIf("activeKcal", num(sum.activityCalories));
    putIf("exerciseMin", (num(sum.fairlyActiveMinutes) ?? 0) + (num(sum.veryActiveMinutes) ?? 0));
    putIf("flights", num(sum.floors));
    putIf("distanceM", distanceKm != null ? distanceKm * 1000 : null);
    putIf("restingHR", restingHR);
    const bodyFat = num(fat?.fat?.[fat.fat.length - 1]?.fat);
    if (bodyFat != null) patch.bodyFatPct = bodyFat;

    if (Object.keys(patch).length) {
      const existing = await prisma.dailyMetric.findFirst({
        where: { memberId, date: dayKey },
        select: { id: true, steps: true, activeKcal: true, exerciseMin: true, flights: true, distanceM: true, restingHR: true, bodyFatPct: true },
      });
      if (!existing) {
        await prisma.dailyMetric.create({ data: { memberId, date: dayKey, ...patch } });
        counts.metrics++;
      } else {
        // เติมเฉพาะช่องที่ยังว่าง — ห้ามทับของที่มาจากเครื่องผู้ใช้เอง
        const fill = Object.fromEntries(
          Object.entries(patch).filter(([k]) => (existing as Record<string, unknown>)[k] == null)
        );
        if (Object.keys(fill).length) {
          await prisma.dailyMetric.update({ where: { id: existing.id }, data: fill });
          counts.metrics++;
        }
      }
    }

    // ── น้ำหนัก ──
    for (const w of (weight?.weight ?? []) as Json[]) {
      const kg = num(w.weight);
      if (kg == null || kg <= 0 || kg > 500) continue;
      const at = new Date(`${w.date}T${w.time ?? "12:00:00"}+07:00`);
      if (isNaN(at.getTime())) continue;
      const dup = await prisma.weightLog.findFirst({
        where: { memberId, weight: kg, date: { gte: new Date(at.getTime() - 12 * 3600e3), lte: new Date(at.getTime() + 12 * 3600e3) } },
      });
      if (dup) continue;
      await prisma.weightLog.create({ data: { memberId, weight: kg, date: at, note: "fitbit" } });
      counts.weights++;
    }

    // ── การนอน (เอาเฉพาะรอบหลัก ไม่นับงีบ) ──
    const main = ((sleep?.sleep ?? []) as Json[]).find((s) => s.isMainSleep) ?? null;
    const minutes = num(main?.minutesAsleep);
    if (main && minutes != null && minutes > 0) {
      const night = dayKeyOf(String(main.dateOfSleep));
      const exists = await prisma.sleepLog.findFirst({ where: { memberId, date: night } });
      if (!exists) {
        const lv = main.levels?.summary ?? {};
        await prisma.sleepLog.create({
          data: {
            memberId,
            date: night,
            minutesAsleep: Math.round(minutes),
            source: "fitbit",
            // 🔴 quality ทั้งระบบเก็บเป็นสัดส่วน 0-1 (series คูณ 100 ตอนแสดง) แต่ Fitbit ให้มาเป็น 0-100
            quality: num(main.efficiency) != null ? (num(main.efficiency) as number) / 100 : null,
            stages: {
              deep: num(lv.deep?.minutes) ?? 0,
              rem: num(lv.rem?.minutes) ?? 0,
              core: num(lv.light?.minutes) ?? 0, // Fitbit เรียก light · ทั้งระบบใช้ core ตามชื่อของ Apple
              awake: num(lv.wake?.minutes) ?? 0,
            },
          },
        });
        counts.sleeps++;
      }
    }

    // ── กิจกรรมที่บันทึกไว้ (เดิน/วิ่ง/เวท ฯลฯ) ──
    for (const a of (activity?.activities ?? []) as Json[]) {
      const sourceId = `fitbit:${a.logId}`;
      const dup = await prisma.exerciseLog.findFirst({ where: { memberId, sourceId } });
      if (dup) continue;
      const startedAt = new Date(`${a.startDate ?? ymd}T${a.startTime ?? "12:00"}:00+07:00`);
      await prisma.exerciseLog.create({
        data: {
          memberId,
          name: String(a.name ?? a.activityName ?? "กิจกรรม Fitbit"),
          duration: Math.round((num(a.duration) ?? 0) / 60000) || 1,
          calories: Math.round(num(a.calories) ?? 0),
          date: isNaN(startedAt.getTime()) ? dayKey : startedAt,
          source: "fitbit",
          sourceId,
        },
      });
      counts.workouts++;
    }
  }

  return counts;
}

/** ดึง user id ตอนเชื่อมครั้งแรก — ใช้ตรวจว่าเป็นบัญชีเดิมไหมตอนเชื่อมซ้ำ */
export async function fitbitProfileId(token: string): Promise<string> {
  const j = await get(token, "/1/user/-/profile.json");
  return String(j?.user?.encodedId ?? "");
}
