/**
 * ดึงกิจกรรมจาก Strava เข้า ExerciseLog
 *
 * ต่างจาก Fitbit ตรงที่ Strava ไม่มีข้อมูลรายวัน (ก้าว/นอน/น้ำหนัก) — มีแต่ "กิจกรรม"
 * จึงเขียนลงตารางเดียวคือ ExerciseLog
 *
 * 🔴 กันซ้ำกับ Apple Health: คนที่เปิด Strava→Apple Health ไว้จะได้ workout เดียวกัน 2 ทาง
 *    ตัดด้วย "เวลาเริ่มใกล้กันไม่เกิน 10 นาที + ยาวใกล้เคียงกัน" ไม่ใช่แค่ sourceId
 *    (sourceId ของสองทางคนละชุด จับซ้ำไม่ได้)
 */
import { prisma } from "@/lib/prisma";

const API = "https://www.strava.com/api/v3";

type Activity = {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  elapsed_time?: number;
  moving_time?: number;
  calories?: number;
  kilojoules?: number;
};

/** ชื่อกีฬาเป็นไทย — ที่เหลือใช้ชื่อกิจกรรมที่ user ตั้งเองบน Strava */
const SPORT_TH: Record<string, string> = {
  Run: "วิ่ง",
  TrailRun: "วิ่งเทรล",
  Ride: "ปั่นจักรยาน",
  VirtualRide: "ปั่นจักรยาน (ในร่ม)",
  Swim: "ว่ายน้ำ",
  Walk: "เดิน",
  Hike: "เดินป่า",
  WeightTraining: "เวทเทรนนิ่ง",
  Workout: "ออกกำลังกาย",
  Yoga: "โยคะ",
  Rowing: "พายเรือ",
  Elliptical: "เครื่องเดินวงรี",
};

export async function syncStrava(memberId: string, token: string, since: Date): Promise<{ workouts: number }> {
  const after = Math.floor(since.getTime() / 1000);
  const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { workouts: 0 };
  const list = (await res.json().catch(() => [])) as Activity[];

  let workouts = 0;
  for (const a of Array.isArray(list) ? list : []) {
    const startedAt = a.start_date ? new Date(a.start_date) : null;
    if (!startedAt || isNaN(startedAt.getTime())) continue;
    const minutes = Math.round((a.moving_time ?? a.elapsed_time ?? 0) / 60);
    if (minutes <= 0) continue;

    const sourceId = `strava:${a.id}`;
    if (await prisma.exerciseLog.findFirst({ where: { memberId, sourceId }, select: { id: true } })) continue;

    // ตัวเดียวกันที่เข้ามาทาง Apple Health แล้ว — เวลาเริ่มใกล้กัน + ความยาวต่างกันไม่เกิน 5 นาที
    const near = await prisma.exerciseLog.findFirst({
      where: {
        memberId,
        date: { gte: new Date(startedAt.getTime() - 10 * 60000), lte: new Date(startedAt.getTime() + 10 * 60000) },
        duration: { gte: minutes - 5, lte: minutes + 5 },
      },
      select: { id: true },
    });
    if (near) continue;

    const sport = a.sport_type ?? a.type ?? "";
    // Strava ให้ calories เฉพาะบางกรณี · kilojoules มีเฉพาะจักรยานที่มี power meter (1 kJ ≈ 1 kcal)
    const kcal = Math.round(a.calories ?? a.kilojoules ?? 0);
    await prisma.exerciseLog.create({
      data: {
        memberId,
        name: a.name?.trim() || SPORT_TH[sport] || "กิจกรรม Strava",
        type: SPORT_TH[sport] ? sport : null,
        duration: minutes,
        calories: kcal,
        date: startedAt,
        source: "strava",
        sourceId,
      },
    });
    workouts++;
  }
  return { workouts };
}
