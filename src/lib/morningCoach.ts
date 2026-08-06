import { prisma } from "@/lib/prisma";
import { sendPush, hasDevice } from "@/lib/push";
import {
  gatherMemberContext,
  generateCoachingMessage,
  isAiCoachActive,
} from "@/lib/coaching";
import { bkkTodayKey } from "@/lib/planGenerator";

function bkkNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}
function bkkNowHHMM(): string {
  const b = bkkNow();
  return `${String(b.getUTCHours()).padStart(2, "0")}:${String(b.getUTCMinutes()).padStart(2, "0")}`;
}
function bkkMonthStartUtc(): Date {
  const b = bkkNow();
  // ต้นเดือน BKK 00:00 → เป็นเวลา UTC จริง (ลบ 7 ชม.)
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

/** คำเตือนโซเดียม/น้ำตาลจากเมื่อวาน (BKK) — คืน array ข้อความ */
async function yesterdayWarnings(
  memberId: string,
  targetSodium: number | null,
  targetSugar: number | null
): Promise<string[]> {
  const b = bkkNow();
  // ช่วงเมื่อวาน BKK เป็นเวลา UTC จริง
  const yStartBkkAsUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() - 1, 0, 0, 0);
  const start = new Date(yStartBkkAsUtc - 7 * 60 * 60 * 1000);
  const end = new Date(yStartBkkAsUtc + 24 * 60 * 60 * 1000 - 7 * 60 * 60 * 1000);
  const meals = await prisma.mealLog.findMany({
    where: { memberId, date: { gte: start, lt: end } },
    select: { sodium: true, sugar: true },
  });
  if (meals.length === 0) return [];
  const sodium = meals.reduce((s, m) => s + (m.sodium || 0), 0);
  const sugar = meals.reduce((s, m) => s + (m.sugar || 0), 0);
  const warns: string[] = [];
  if (targetSodium && sodium >= targetSodium * 0.8) {
    warns.push(`โซเดียมเมื่อวาน ${Math.round(sodium)} mg (เป้า ${Math.round(targetSodium)})`);
  }
  if (targetSugar && sugar >= targetSugar * 0.8) {
    warns.push(`น้ำตาลเมื่อวาน ${Math.round(sugar)} g (เป้า ${Math.round(targetSugar)})`);
  }
  return warns;
}

export interface MorningCoachResult {
  sent: number;
  skipped: number;
  capped: boolean;
  sentThisMonth: number;
  nowHHMM: string;
  details: Array<{ memberId: string; name: string | null; status: string }>;
}

/**
 * ยิงโค้ชเช้า: ส่งให้สมาชิกที่มีสิทธิ์ + เปิด notify + ไม่ pause + ถึงเวลาโค้ชของ type + ยังไม่ส่งวันนี้
 * @param opts.force ข้ามการเช็คเวลา (สำหรับเทสด้วยมือ) · opts.onlyMemberId ยิงเฉพาะคนเดียว
 */
export async function runMorningCoach(opts?: {
  force?: boolean;
  onlyMemberId?: string;
}): Promise<MorningCoachResult> {
  const todayKey = bkkTodayKey();
  const nowHHMM = bkkNowHHMM();
  const now = new Date();

  // เก็บไว้เป็นตัวเลขรายงานเฉย ๆ (เดิมใช้คุมโควตา LINE 300/เดือน — ตอนนี้ push แอปไม่มีโควตา)
  const sentThisMonth = await prisma.coachDispatchLog.count({
    where: { type: "morning", createdAt: { gte: bkkMonthStartUtc() } },
  });

  const members = await prisma.member.findMany({
    where: {
      notifyMorningCoach: true,
      // รวมสมาชิก native (lineUserId = null) ด้วย — จะส่งผ่าน push แทน
      OR: [{ notificationsPausedUntil: null }, { notificationsPausedUntil: { lt: now } }],
      ...(opts?.onlyMemberId ? { id: opts.onlyMemberId } : {}),
    },
    include: { memberType: true },
  });

  const details: MorningCoachResult["details"] = [];
  let sent = 0;
  let skipped = 0;
  const capped = false; // เดิมใช้กับโควตา LINE — คงไว้ใน response เพื่อไม่ให้ผู้เรียกเดิมพัง

  for (const m of members) {
    if (!isAiCoachActive(m)) { skipped++; details.push({ memberId: m.id, name: m.name, status: "no-access" }); continue; }

    const coachTime = m.memberType?.morningCoachTime || "07:00";
    if (!opts?.force && nowHHMM < coachTime) { skipped++; details.push({ memberId: m.id, name: m.name, status: "not-time-yet" }); continue; }

    // กันส่งซ้ำวันนี้
    const already = await prisma.coachDispatchLog.findUnique({
      where: { memberId_date_type: { memberId: m.id, date: todayKey, type: "morning" } },
    });
    if (already) { skipped++; details.push({ memberId: m.id, name: m.name, status: "already-sent" }); continue; }

    // 🔴 6 ส.ค. 2026: เหลือช่องทางเดียว = push ของแอป (LINE_PROACTIVE_DISABLED ใน lib/line.ts)
    // เดิมคนที่ไม่ได้ลงแอปแต่ผูก LINE ไว้ จะโดน Flex ยิงเข้า LINE ทุกเช้า — ตอนนี้ข้ามไปเลย
    if (!(await hasDevice(m.id))) {
      skipped++;
      details.push({ memberId: m.id, name: m.name, status: "no-device" });
      continue;
    }

    const context = await gatherMemberContext(m.id);
    if (!context) { skipped++; details.push({ memberId: m.id, name: m.name, status: "no-context" }); continue; }

    // แผนวันนี้ (ถ้ามี)
    const plan = await prisma.dailyPlan.findUnique({
      where: { memberId_date: { memberId: m.id, date: todayKey } },
    });
    if (plan) {
      const mp = plan.mealPlan as { meals?: { slot: string; menu: string }[]; totalKcal?: number };
      const ep = plan.exercisePlan as { title?: string; durationMin?: number };
      context.todayPlan = {
        exerciseTitle: ep?.title || "ออกกำลังกาย",
        exerciseMinutes: ep?.durationMin || 30,
        mealSummary: (mp?.meals || []).map((x) => `${x.slot}: ${x.menu}`).join(" · "),
        totalKcal: mp?.totalKcal || 0,
      };
    }

    // คำเตือนโซเดียม/น้ำตาลเมื่อวาน (เฟส 4 tie-in)
    context.warnings = await yesterdayWarnings(m.id, m.dailySodium, m.dailySugar);

    // การปรับแผนล่าสุด 2 วัน (เฟส 5 tie-in) → ให้โค้ชเช้าบอกเหตุผล
    const recentAdjust = await prisma.planAdjustment.findFirst({
      where: { memberId: m.id, date: { gte: new Date(now.getTime() - 2 * 24 * 3600 * 1000) } },
      orderBy: { date: "desc" },
    });
    context.planAdjustNote = recentAdjust?.reason ?? null;

    let msg = await generateCoachingMessage("morning", context);

    // ④ ไม่มีข้อมูลการนอนของเมื่อคืน (ไม่มี Watch = แหวนนอนว่างตลอด) → ชวนบอกโค้ชด้วยเสียง
    const sleptLastNight = await prisma.sleepLog.count({
      where: { memberId: m.id, date: todayKey },
    });
    if (sleptLastNight === 0) {
      msg += "\n\n💤 เมื่อคืนนอนกี่ชั่วโมงครับ? แตะวงกลมแล้วบอกโค้ชได้เลย";
    }
    const n = await sendPush(m.id, { title: "โค้ชเช้า 🌅", body: msg, data: { screen: "plan" } }, "morning");
    if (n > 0) {
      await prisma.coachDispatchLog.create({
        data: { memberId: m.id, date: todayKey, type: "morning" },
      });
      sent++;
      details.push({ memberId: m.id, name: m.name, status: "sent-push" });
    } else {
      skipped++;
      details.push({ memberId: m.id, name: m.name, status: "push-failed" });
    }
  }

  return { sent, skipped, capped, sentThisMonth, nowHHMM, details };
}
