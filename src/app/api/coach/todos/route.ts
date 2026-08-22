import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

export const dynamic = "force-dynamic";

/**
 * "สิ่งที่ต้องทำวันนี้" — งานค้างที่คิดจากสถานะจริงของวันนี้ ไม่ใช่ประวัติแจ้งเตือน
 * (เจ้าของเคาะ 22 ส.ค. 69: หน้าแรกโชว์เฉพาะของที่ "กดแล้วทำได้จบ แล้วหายไปเอง")
 *
 * กติกา: ทุกข้อต้องมีเงื่อนไข "หายเอง" เมื่อทำแล้ว — ห้ามมีข้อที่ค้างถาวร
 * action ที่แอปรู้จัก: readiness | water250 | addFood | weigh | bodyScan
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // เวลาไทย — กติกา date key เดียวกับ DailyPlan (UTC midnight ของวัน BKK)
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const hour = bkk.getUTCHours();
  const dayKey = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));
  const dayStartUtc = new Date(dayKey.getTime() - 7 * 3600 * 1000); // 00:00 BKK ในเวลา UTC จริง

  const todos: { key: string; title: string; sub?: string; action: string }[] = [];

  const [checkin, waterAgg, meals, lastWeight, lastScan, plan] = await Promise.all([
    prisma.readinessCheckin.findFirst({ where: { memberId: member.id, date: dayKey } }),
    prisma.waterLog.aggregate({ where: { memberId: member.id, date: { gte: dayStartUtc } }, _sum: { amount: true } }),
    prisma.mealLog.findMany({ where: { memberId: member.id, date: { gte: dayStartUtc } }, select: { date: true } }),
    prisma.weightLog.findFirst({ where: { memberId: member.id }, orderBy: { date: "desc" }, select: { date: true } }),
    member.bodyConsentAt
      ? prisma.bodyScan.findFirst({
          where: { memberId: member.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : Promise.resolve(null),
    prisma.dailyPlan.findFirst({ where: { memberId: member.id, date: dayKey }, select: { id: true } }),
  ]);

  // 1) เช็คอินเช้า — มีแผนวันนี้แต่ยังไม่ตอบ (ไม่มีแผน = ไม่มีอะไรให้ปรับ ไม่ถาม)
  if (plan && !checkin) {
    todos.push({ key: "readiness", title: "วิเคราะห์ร่างกายวันนี้", sub: "ตอบ 10 วิ — ปรับความหนักให้พอดี", action: "readiness" });
  }

  // 2) น้ำตามหลังเป้าตามเวลา — เทียบสัดส่วนของวัน (ตื่น ~16 ชม.) ไม่ใช่เป้าเต็มวัน
  const waterGoal = member.dailyWater ?? 2000;
  const water = waterAgg._sum.amount ?? 0;
  if (hour >= 12 && hour < 21) {
    const expected = waterGoal * Math.min(1, Math.max(0, (hour - 6) / 16));
    if (water < expected * 0.6) {
      todos.push({
        key: "water",
        title: "จิบน้ำให้ทันเป้า",
        sub: `วันนี้ ${water.toLocaleString("th-TH")}/${waterGoal.toLocaleString("th-TH")} มล. — แตะเพื่อบันทึก +250`,
        action: "water250",
      });
    }
  }

  // 3) เลยเที่ยงแล้วยังไม่มีบันทึกมื้อกลางวัน (นับมื้อในช่วง 11:00-15:00 BKK)
  if (hour >= 13 && hour < 17) {
    const lunch = meals.some((m) => {
      const h = new Date(m.date.getTime() + 7 * 3600 * 1000).getUTCHours();
      return h >= 11 && h < 15;
    });
    if (!lunch) {
      todos.push({ key: "lunch", title: "บันทึกมื้อกลางวัน", sub: "ถ่ายรูปหรือบอกโค้ชก็ได้", action: "addFood" });
    }
  }

  // 4) รอบชั่งน้ำหนัก (จันทร์/พฤหัส แบบเดียวกับ cron เตือน) — เกิน 3 วันแล้วยังไม่ชั่ง
  const dow = dayKey.getUTCDay();
  if ((dow === 1 || dow === 4) && hour >= 6) {
    const days = lastWeight ? (now.getTime() - lastWeight.date.getTime()) / 86400000 : Infinity;
    if (days > 3) {
      todos.push({ key: "weigh", title: "ชั่งน้ำหนักประจำสัปดาห์", sub: "เทรนด์แม่นเมื่อชั่งสม่ำเสมอ", action: "weigh" });
    }
  }

  // 5) ถึงรอบสแกนร่างกาย (ทุก 14 วัน — เฉพาะคนที่เคย consent และเคยสแกนแล้ว)
  if (lastScan) {
    const days = (now.getTime() - lastScan.createdAt.getTime()) / 86400000;
    if (days >= 14) {
      todos.push({ key: "bodyScan", title: "ถึงรอบสแกนร่างกาย", sub: "เทียบพัฒนาการทุก 2 สัปดาห์", action: "bodyScan" });
    }
  }

  const res = NextResponse.json({ todos });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
