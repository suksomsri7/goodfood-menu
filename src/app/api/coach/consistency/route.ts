import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { personalBurnGoal } from "@/lib/burnGoal";

export const dynamic = "force-dynamic";

/**
 * Heatmap ความสม่ำเสมอรายวัน (แบบ contribution graph)
 * GET /api/coach/consistency?days=91  (Bearer)
 *   → { days:[{ date:"YYYY-MM-DD", level:0|1|2|3 }], burnGoal, targets, range }
 *
 * ระดับ:
 *   0 = ไม่มีบันทึกเลย
 *   1 = มีบันทึกอย่างน้อย 1 อย่าง (มื้อ/น้ำ/ออกกำลัง/นอน/น้ำหนัก)
 *   2 = บันทึก ≥3 รายการ หรือติ๊กแผนครบมื้อหลัก (เช้า/กลางวัน/เย็น)
 *   3 = "วันเต็ม" ปิดครบ 3 วง: เผา ≥ เป้าเผาผลาญ · น้ำ ≥ เป้า · โปรตีน ≥ เป้า
 *
 * 🔴 ข้อสมมติที่ต้องรู้:
 *  - **เป้าย้อนหลังไม่มีเก็บไว้** — ใช้เป้า *ปัจจุบัน* (burnGoal/dailyWater/dailyProtein)
 *    เทียบกับทุกวันในอดีต · ถ้า user เพิ่งเปลี่ยนเป้า ระดับของวันเก่าจะขยับตาม
 *    (ทางเลือกคือเก็บ snapshot เป้ารายวัน ซึ่งยังไม่มีในสคีมา — ทำทีหลังได้ ไม่ต้องแก้ contract)
 *  - "เผา" = max(activeKcal จาก Apple Health, ผลรวม kcal ของ ExerciseLog วันนั้น)
 *    ใช้ max ไม่ใช่บวก เพราะ workout จากนาฬิกาถูกนับใน activeKcal อยู่แล้ว (กันนับซ้ำ)
 *  - วันคิดตามเวลาไทย (BKK) ทุกจุด
 *
 * ประสิทธิภาพ: รวบ query ต่อตาราง (7 ครั้ง ยิงขนานทีเดียว) แล้วจัดกลุ่มในโค้ด
 * — ห้ามไล่ query ทีละวัน (91 วัน = 91×n query)
 */
const BKK_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 86400_000;
const MAIN_SLOTS = ["เช้า", "กลางวัน", "เย็น"];

const bkkKey = (d: Date) => new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = Number(new URL(req.url).searchParams.get("days"));
  // clamp ขั้นต่ำ 1 — days=0.4 เคยปัดเป็น 0 แล้วได้ range ว่าง
  const days = Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.min(366, Math.round(raw))) : 91;

  // ต้นช่วง = เที่ยงคืนไทยของวันแรกในกราฟ (แปลงกลับเป็น UTC จริงเพื่อใช้ query)
  const todayKeyMs = Date.parse(`${bkkKey(new Date())}T00:00:00.000Z`);
  const startKeyMs = todayKeyMs - (days - 1) * DAY_MS;
  const startUtc = new Date(startKeyMs - BKK_OFFSET_MS);

  const where = { memberId: member.id, date: { gte: startUtc } };

  const [meals, waters, exercises, sleeps, weights, metrics, plans] = await Promise.all([
    prisma.mealLog.findMany({ where, select: { date: true, protein: true } }),
    prisma.waterLog.findMany({ where, select: { date: true, amount: true } }),
    prisma.exerciseLog.findMany({ where, select: { date: true, calories: true } }),
    prisma.sleepLog.findMany({ where, select: { date: true } }),
    prisma.weightLog.findMany({ where, select: { date: true } }),
    prisma.dailyMetric.findMany({ where, select: { date: true, activeKcal: true } }),
    prisma.dailyPlan.findMany({ where, select: { date: true, mealsDone: true } }),
  ]);

  // เป้าเผาผลาญ: helper กลางตัวเดียวกับวงแหวนในแอป
  // 🔴 ไม่ส่ง tdee เข้าไป → helper เรียก estimateEnergy เอง = ได้ TDEE ชุดเดียวกับ /api/cal/initial-data
  //    (เดิมส่ง member.tdee ซึ่งเป็นค่าที่บันทึกไว้ ทำให้เป้าของ heatmap ไม่ตรงกับวงแหวนในหน้าหลัก)
  const burnGoal = await personalBurnGoal(member).catch(() => null);
  const burnTarget = burnGoal?.value ?? 0;
  // ค่าเริ่มต้นชุดเดียวกับที่แอปใช้ตอนยังไม่ได้ตั้งเป้า — 0 จะทำให้ "ปิดวง" ง่ายเกินจริง
  const waterTarget = member.dailyWater ?? 2000;
  const proteinTarget = member.dailyProtein ?? 100;

  type Bucket = {
    entries: number; // จำนวน "รายการ" ที่บันทึกวันนั้น
    protein: number;
    water: number;
    exerciseKcal: number;
    activeKcal: number;
    planMainDone: boolean;
  };
  const byDay = new Map<string, Bucket>();
  const bucket = (k: string): Bucket => {
    let b = byDay.get(k);
    if (!b) {
      b = { entries: 0, protein: 0, water: 0, exerciseKcal: 0, activeKcal: 0, planMainDone: false };
      byDay.set(k, b);
    }
    return b;
  };

  for (const m of meals) { const b = bucket(bkkKey(m.date)); b.entries++; b.protein += m.protein || 0; }
  for (const w of waters) { const b = bucket(bkkKey(w.date)); b.entries++; b.water += w.amount || 0; }
  for (const e of exercises) { const b = bucket(bkkKey(e.date)); b.entries++; b.exerciseKcal += e.calories || 0; }
  for (const s of sleeps) bucket(bkkKey(s.date)).entries++;
  for (const w of weights) bucket(bkkKey(w.date)).entries++;
  // metric จากนาฬิกาไม่นับเป็น "บันทึกของ user" (ซิงก์อัตโนมัติ) — ใช้แค่ตัดสินวงเผาผลาญ
  for (const m of metrics) {
    const b = bucket(bkkKey(m.date));
    b.activeKcal = Math.max(b.activeKcal, m.activeKcal || 0);
  }
  for (const p of plans) {
    const done = (p.mealsDone as Record<string, boolean> | null) || {};
    if (MAIN_SLOTS.every((s) => done[s] === true)) bucket(bkkKey(p.date)).planMainDone = true;
  }

  const out: Array<{ date: string; level: 0 | 1 | 2 | 3 }> = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(startKeyMs + i * DAY_MS).toISOString().slice(0, 10);
    const b = byDay.get(key);
    let level: 0 | 1 | 2 | 3 = 0;
    if (b) {
      const burned = Math.max(b.activeKcal, b.exerciseKcal);
      const ringsClosed =
        burnTarget > 0 && burned >= burnTarget &&
        waterTarget > 0 && b.water >= waterTarget &&
        proteinTarget > 0 && b.protein >= proteinTarget;
      if (ringsClosed) level = 3;
      else if (b.entries >= 3 || b.planMainDone) level = 2;
      else if (b.entries >= 1) level = 1;
    }
    out.push({ date: key, level });
  }

  const res = NextResponse.json({
    days: out,
    burnGoal,
    targets: { burn: burnTarget, water: waterTarget, protein: proteinTarget },
    range: { from: out[0]?.date ?? null, to: out[out.length - 1]?.date ?? null, days },
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
