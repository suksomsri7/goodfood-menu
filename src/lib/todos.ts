/**
 * "สิ่งที่ควรทำตอนนี้" — งานค้างที่คิดจากสถานะจริงของวันนี้ ไม่ใช่ประวัติแจ้งเตือน
 * (เจ้าของเคาะ 22 ส.ค. 69: หน้าแรกโชว์เฉพาะของที่ "กดแล้วทำได้จบ แล้วหายไปเอง")
 *
 * 🔴 26 ส.ค. 69 ย้ายมาจาก route เพราะ **แจ้งเตือนต้องอ่านรายการเดียวกันกับที่แอปโชว์** (เจ้าของเลือกข้อ ก)
 *    ของเดิม nudgeEngine คิดเงื่อนไขเอง → เตือนเรื่องน้ำทั้งที่ในแอปไม่ขึ้นรายการนั้นแล้ว
 *    ที่นี่คือจุดเดียวที่ตัดสินว่า "อะไรค้างอยู่ตอนนี้" — ห้าม copy เงื่อนไขไปไว้ที่อื่น
 *
 * กติกา: ทุกข้อต้องมีเงื่อนไข "หายเอง" เมื่อทำแล้ว — ห้ามมีข้อที่ค้างถาวร
 * action ที่แอปรู้จัก: readiness | water250 | addFood | weigh | bodyScan
 */
import { prisma } from "@/lib/prisma";

export type Todo = {
  key: string;
  title: string;
  sub?: string;
  action: string;
  skipLabel?: string;
};

/** สมาชิกเท่าที่ตัวคิดงานค้างต้องใช้ — รับเป็น object เพื่อไม่ต้อง query ซ้ำจากฝั่งที่โหลด member มาแล้ว */
export type TodoMember = {
  id: string;
  dailyWater: number | null;
  bodyConsentAt: Date | null;
};

/** ชั่วโมงตามเวลาไทยของ Date ใด ๆ */
const bkkHour = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000).getUTCHours();

export async function buildTodos(member: TodoMember, now = new Date()): Promise<Todo[]> {
  // เวลาไทย — กติกา date key เดียวกับ DailyPlan (UTC midnight ของวัน BKK)
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const hour = bkk.getUTCHours();
  const dayKey = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));
  const dayStartUtc = new Date(dayKey.getTime() - 7 * 3600 * 1000); // 00:00 BKK ในเวลา UTC จริง
  const since14 = new Date(dayKey.getTime() - 14 * 86400000);

  const todos: Todo[] = [];

  const [checkin, waterAgg, meals, lastWeight, lastScan, plan, skips] = await Promise.all([
    prisma.readinessCheckin.findFirst({ where: { memberId: member.id, date: dayKey } }),
    prisma.waterLog.aggregate({ where: { memberId: member.id, date: { gte: dayStartUtc } }, _sum: { amount: true } }),
    prisma.mealLog.findMany({
      where: { memberId: member.id, date: { gte: dayStartUtc } },
      select: { date: true, createdAt: true },
    }),
    prisma.weightLog.findFirst({ where: { memberId: member.id }, orderBy: { date: "desc" }, select: { date: true } }),
    member.bodyConsentAt
      ? prisma.bodyScan.findFirst({
          where: { memberId: member.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : Promise.resolve(null),
    prisma.dailyPlan.findFirst({ where: { memberId: member.id, date: dayKey }, select: { id: true } }),
    // ประวัติการกด "ไม่ได้กินมื้อนี้" 14 วันล่าสุด — ใช้ทั้งเช็ควันนี้และดูพฤติกรรมประจำ
    prisma.todoSkip.findMany({
      where: { memberId: member.id, date: { gte: since14 } },
      select: { key: true, date: true },
    }),
  ]);

  const skippedToday = (key: string) => skips.some((s) => s.key === key && s.date.getTime() === dayKey.getTime());
  /** ข้ามมื้อนี้บ่อยจนถือว่าเป็นปกติของเขา (เช่นคนทำ IF ไม่กินมื้อเช้า) → เลิกถามไปเลย */
  const skipsOften = (key: string) => skips.filter((s) => s.key === key).length >= 3;

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
        sub: `วันนี้ ${water.toLocaleString("th-TH")}/${waterGoal.toLocaleString("th-TH")} มล. — แตะเพื่อบันทึกน้ำ`,
        action: "water250",
      });
    }
  }

  /* มื้ออาหาร: นับจาก "เวลากินที่ติดมากับบันทึก" หรือ "เวลาที่กดบันทึก" อย่างใดอย่างหนึ่งก็พอ
     (บันทึกย้อนหลังตอนบ่ายว่ากินเที่ยง กับ กดบันทึกตอนบ่ายโดยไม่แก้เวลา ต้องนับว่าทำแล้วทั้งคู่) */
  const loggedFrom = (h: number) => meals.some((m) => bkkHour(m.date) >= h || bkkHour(m.createdAt) >= h);
  const loggedBefore = (h: number) => meals.some((m) => bkkHour(m.date) < h || bkkHour(m.createdAt) < h);

  // 3) มื้อเช้า — ถามช่วงสาย ๆ ของวัน (ยังไม่มีบันทึกก่อน 11:00)
  //    🔴 ต้องกด "ไม่ได้กินมื้อนี้" ได้ เพราะหลายคนอดมื้อเช้าเป็นปกติ — และถ้าข้ามบ่อยจะเลิกถามให้เอง
  if (hour >= 8 && hour < 12 && !skippedToday("breakfast") && !skipsOften("breakfast") && !loggedBefore(11)) {
    todos.push({
      key: "breakfast",
      title: "บันทึกมื้อเช้า",
      sub: "ถ่ายรูปหรือบอกโค้ชก็ได้",
      action: "addFood",
      skipLabel: "ไม่ได้กินมื้อนี้",
    });
  }

  // 4) มื้อกลางวัน — เลยบ่ายแล้วยังไม่มีบันทึกอะไรเลยตั้งแต่ 11:00
  if (hour >= 13 && hour < 17 && !skippedToday("lunch") && !skipsOften("lunch") && !loggedFrom(11)) {
    todos.push({
      key: "lunch",
      title: "บันทึกมื้อกลางวัน",
      sub: "ถ่ายรูปหรือบอกโค้ชก็ได้",
      action: "addFood",
      skipLabel: "ไม่ได้กินมื้อนี้",
    });
  }

  // 5) รอบชั่งน้ำหนัก (จันทร์/พฤหัส แบบเดียวกับ cron เตือน) — เกิน 3 วันแล้วยังไม่ชั่ง
  const dow = dayKey.getUTCDay();
  if ((dow === 1 || dow === 4) && hour >= 6) {
    const days = lastWeight ? (now.getTime() - lastWeight.date.getTime()) / 86400000 : Infinity;
    if (days > 3) {
      todos.push({ key: "weigh", title: "ชั่งน้ำหนักประจำสัปดาห์", sub: "เทรนด์แม่นเมื่อชั่งสม่ำเสมอ", action: "weigh" });
    }
  }

  // 6) ถึงรอบสแกนร่างกาย (ทุก 14 วัน — เฉพาะคนที่เคย consent และเคยสแกนแล้ว)
  if (lastScan) {
    const days = (now.getTime() - lastScan.createdAt.getTime()) / 86400000;
    if (days >= 14) {
      todos.push({ key: "bodyScan", title: "ถึงรอบสแกนร่างกาย", sub: "เทียบพัฒนาการทุก 2 สัปดาห์", action: "bodyScan" });
    }
  }

  /* 🔴 28 ส.ค. 69 เจ้าของสั่ง: ปัดซ้ายที่การ์ด = ลบข้อนั้นทิ้ง
     เดิมกดข้ามได้เฉพาะมื้ออาหาร (มีปุ่ม "ไม่ได้กินมื้อนี้") ข้ออื่นปิดไม่ได้เลย
     ตอนนี้ปัดทิ้งได้ทุกข้อ แต่ "ทิ้งวันนี้" เท่านั้น — พรุ่งนี้ถ้ายังค้างอยู่ก็ขึ้นใหม่ */
  return todos.filter((t) => !skippedToday(t.key));
}
