/**
 * Proactive nudges ระหว่างวัน (WO-3.5) — เตือนเชิงรุกตามบริบท ไม่ต้องรอ user ถาม
 * ส่งเฉพาะสมาชิกที่ลงแอป (มี device) ผ่าน push — ไม่กินโควตา LINE
 * กันสแปม: cap/วัน + dedup ต่อชนิด/วัน (CoachDispatchLog) + เคารพ pause/preference + ทำแล้ว/on-track = เงียบ
 * ข้อความเป็น template + ตัวเลขจริง (ไม่เรียก AI → เร็ว/ถูก/ไม่แต่งข้อมูล)
 */
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { isAiCoachActive } from "@/lib/coaching";
import { bkkTodayKey } from "@/lib/planGenerator";
import { buildRiskWindow, dayKeyRange } from "@/lib/statCards";

const DAILY_CAP = 3; // จำนวน nudge สูงสุด/วัน/คน
const THRESH = 0.8;

type Nudge = {
  type: string;
  pref: keyof PrefFlags;
  title: string;
  body: string;
  /** หมวด notification (iOS) — ใส่เฉพาะ nudge ที่มีปุ่มลัดในแจ้งเตือน */
  categoryId?: string;
};
type PrefFlags = {
  notifyWaterReminder: boolean;
  notifyMorningCoach: boolean;
  notifyEveningSummary: boolean;
};

function bkkNow(now: Date) {
  const b = new Date(now.getTime() + 7 * 3600 * 1000);
  return { hour: b.getUTCHours() };
}

export async function runNudges(now = new Date()) {
  const { hour } = bkkNow(now);
  const todayKey = bkkTodayKey();
  const start = new Date(todayKey); // UTC-midnight ของ BKK date
  const end = new Date(start.getTime() + 24 * 3600 * 1000);

  // เฉพาะคนที่ลงแอป (มี device) + ไม่ pause
  const members = await prisma.member.findMany({
    where: {
      deviceTokens: { some: {} },
      OR: [{ notificationsPausedUntil: null }, { notificationsPausedUntil: { lt: now } }],
    },
    include: { memberType: true },
  });

  let sent = 0;
  const details: Array<{ memberId: string; type?: string; status: string }> = [];

  for (const m of members) {
    if (!isAiCoachActive(m)) { details.push({ memberId: m.id, status: "no-access" }); continue; }

    // cap/วัน
    const nudgesToday = await prisma.coachDispatchLog.count({
      where: { memberId: m.id, date: todayKey, type: { startsWith: "nudge_" } },
    });
    if (nudgesToday >= DAILY_CAP) { details.push({ memberId: m.id, status: "capped" }); continue; }

    // รวมข้อมูลวันนี้
    const [mealAgg, waterAgg, mealCount, sleeps, metrics] = await Promise.all([
      prisma.mealLog.aggregate({ where: { memberId: m.id, date: { gte: start, lt: end } }, _sum: { calories: true, protein: true, sodium: true, sugar: true } }),
      prisma.waterLog.aggregate({ where: { memberId: m.id, date: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.mealLog.count({ where: { memberId: m.id, date: { gte: start, lt: end } } }),
      prisma.sleepLog.findMany({ where: { memberId: m.id }, orderBy: { date: "desc" }, take: 3 }),
      // วง Stand/Exercise จาก Apple Watch (ถ้าเชื่อมไว้) — ใช้เตือนเรื่องนั่งนาน/ยังไม่ได้ขยับ
      prisma.dailyMetric.findMany({
        where: { memberId: m.id, date: { gte: start, lt: end } },
        select: { standHours: true, exerciseMin: true },
      }),
    ]);

    const protein = mealAgg._sum.protein || 0;
    const sodium = mealAgg._sum.sodium || 0;
    const sugar = mealAgg._sum.sugar || 0;
    const water = waterAgg._sum.amount || 0;
    const tProtein = m.dailyProtein || 100;
    const tSodium = m.dailySodium || 2300;
    const tSugar = m.dailySugar || 50;
    const tWater = m.dailyWater || 2000;
    // Apple: ยืนครบ 12 ชม. · ออกกำลังกาย 30 นาที · มีค่าเฉพาะคนที่ใส่ Watch
    const standHours = metrics.reduce((s2, x) => Math.max(s2, x.standHours ?? 0), 0);
    const exerciseMin = metrics.reduce((s2, x) => Math.max(s2, x.exerciseMin ?? 0), 0);
    const hasWatch = metrics.some((x) => (x.standHours ?? 0) > 0);

    // เลือก nudge ที่เหมาะที่สุด 1 อัน (เรียงความสำคัญ) ที่ยังไม่ส่งวันนี้
    const candidates: Nudge[] = [];

    // ── เตือนก่อน "ช่วงเวลาเสี่ยง" 30 นาที (การ์ด #5) ──
    // ยิงเฉพาะชั่วโมงก่อนหน้าช่วงนั้น และเฉพาะคนที่โดนบ่อยจริง (≥1/3 ของวันในช่วงข้อมูล)
    // คิดเฉพาะช่วงบ่าย-ค่ำ เพื่อไม่ให้ต้อง query ประวัติ 30 วันทุกรอบ cron
    if (hour >= 14 && hour <= 22) {
      const meals30 = await prisma.mealLog.findMany({
        where: { memberId: m.id, date: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) } },
        select: { date: true, name: true, calories: true, protein: true, via: true },
      });
      const rw = buildRiskWindow(meals30, dayKeyRange(30, now));
      if (rw.ready && rw.startHour - 1 === hour && rw.daysHit >= rw.totalDays / 3) {
        candidates.push({
          type: "nudge_riskwindow",
          pref: "notifyEveningSummary",
          title: "อีกเดี๋ยวถึงช่วงที่มักหลุด 🕒",
          body: `ช่วง ${rw.startHour}:00-${rw.endHour}:00 วันที่หลุด คุณกินเพิ่มเฉลี่ย ~${rw.avgKcal} kcal เตรียมของว่างดี ๆ ไว้ก่อนนะครับ`,
        });
      }
    }
    if (sodium >= tSodium * THRESH && sodium < tSodium * 1.5)
      candidates.push({ type: "nudge_sodium", pref: "notifyEveningSummary", title: "ระวังโซเดียม 🧂", body: `วันนี้ได้โซเดียม ~${Math.round(sodium)} mg (เกือบถึงเป้า ${tSodium}) มื้อถัดไปเลี่ยงของเค็ม/น้ำจิ้มนะครับ` });
    if (sugar >= tSugar * THRESH && sugar < tSugar * 1.5)
      candidates.push({ type: "nudge_sugar", pref: "notifyEveningSummary", title: "ระวังน้ำตาล 🍬", body: `น้ำตาลวันนี้ ~${Math.round(sugar)} g ใกล้เป้า ${tSugar} แล้ว ลดของหวาน/เครื่องดื่มหวานนะครับ` });
    if (hour >= 15 && protein < tProtein * 0.6)
      candidates.push({ type: "nudge_protein", pref: "notifyEveningSummary", title: "เติมโปรตีน 🥩", body: `วันนี้ได้โปรตีน ${Math.round(protein)}/${tProtein} g ยังห่างเป้า มื้อเย็นเพิ่มไข่/อกไก่/เต้าหู้หน่อยนะครับ` });
    if (hour >= 14 && water < tWater * 0.5)
      candidates.push({
        type: "nudge_water", pref: "notifyWaterReminder", title: "ดื่มน้ำ 💧",
        body: `วันนี้ดื่มน้ำ ${water}/${tWater} ml ยังน้อยอยู่ จิบน้ำเพิ่มหน่อยนะครับ`,
        // ปุ่ม "ดื่มแล้ว +250" กดจากแจ้งเตือน/นาฬิกาได้เลย ไม่ต้องเปิดแอป
        categoryId: "NUDGE_WATER",
      });
    if (hour >= 13 && mealCount === 0)
      candidates.push({ type: "nudge_nolog", pref: "notifyMorningCoach", title: "ยังไม่ได้บันทึกมื้อเลย 🍽️", body: "วันนี้ยังไม่มีบันทึกอาหารเลยครับ กดถ่ายรูปหรือพูดกับโค้ชได้เลย" });
    // นั่งติดเก้าอี้: บ่ายแล้วแต่ยืนไม่ถึงครึ่งของชั่วโมงที่ผ่านมา (เทียบเวลาตื่นคร่าว ๆ 07:00)
    if (hasWatch && hour >= 14 && standHours < Math.floor((hour - 7) * 0.5))
      candidates.push({ type: "nudge_stand", pref: "notifyWaterReminder", title: "ลุกยืดเส้นหน่อย 🧍", body: `วันนี้ลุกยืนไป ${standHours}/12 ชม. นั่งนานเกินไปแล้วครับ ลุกเดิน 2-3 นาทีทุกชั่วโมงช่วยได้เยอะ` });
    if (hour >= 18 && exerciseMin > 0 && exerciseMin < 15)
      candidates.push({ type: "nudge_move", pref: "notifyWaterReminder", title: "ขยับอีกนิด 🏃", body: `วันนี้ขยับไป ${exerciseMin} นาที (เป้า 30) เดินเร็ว 15 นาทีก็ครบแล้วครับ` });
    if (sleeps.length >= 3 && sleeps.every((sl) => sl.minutesAsleep < 360) && hour >= 20)
      candidates.push({ type: "nudge_sleep", pref: "notifyEveningSummary", title: "พักผ่อนหน่อยนะ 😴", body: "3 คืนที่ผ่านมานอนน้อยกว่า 6 ชม. คืนนี้ลองเข้านอนเร็วขึ้นเพื่อให้ร่างกายฟื้นตัวนะครับ" });

    let picked: Nudge | null = null;
    for (const c of candidates) {
      if ((m as any)[c.pref] === false) continue; // ปิด preference
      const already = await prisma.coachDispatchLog.findUnique({
        where: { memberId_date_type: { memberId: m.id, date: todayKey, type: c.type } },
      }).catch(() => null);
      if (!already) { picked = c; break; }
    }
    if (!picked) { details.push({ memberId: m.id, status: "nothing" }); continue; }

    const n = await sendPush(
      m.id,
      {
        title: picked.title,
        body: picked.body,
        data: { screen: "today", nudge: picked.type },
        ...(picked.categoryId ? { categoryId: picked.categoryId } : {}),
      },
      "nudge"
    );
    if (n > 0) {
      await prisma.coachDispatchLog.create({ data: { memberId: m.id, date: todayKey, type: picked.type } });
      sent++;
      details.push({ memberId: m.id, type: picked.type, status: "sent" });
    } else {
      details.push({ memberId: m.id, type: picked.type, status: "push-failed" });
    }
  }

  return { sent, checked: members.length, details };
}
