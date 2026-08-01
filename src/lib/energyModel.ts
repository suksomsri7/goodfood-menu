/**
 * เครื่องคำนวณ "พลังงานที่ควรกิน" ของโค้ช — จุดเดียวของระบบ (ห้าม copy logic ไปที่อื่น)
 *
 * ปัญหาที่แก้ (user เจอเอง 1 ส.ค. 2026): สูตร BMR × ตัวคูณกิจกรรม ให้ TDEE 3,074
 * ทั้งที่ Apple Health บอกว่าเผาจากการเคลื่อนไหวจริงวันละ ~260 kcal → เป้าสูงเกินจริงเกือบ 800 kcal
 * และมาโครคิดเป็น % ของแคลอรี่ ทำให้โปรตีนพุ่งไป 258 g/วัน (กินจริงไม่ไหว)
 *
 * ลำดับความน่าเชื่อถือ (ใช้ตัวที่ดีที่สุดที่ข้อมูลรองรับ):
 *   1) adaptive — เรียนจากผลจริง: TDEE = แคลอรี่ที่กินเฉลี่ย + (น้ำหนักที่เปลี่ยน × 7700 ÷ วัน)
 *   2) measured — วัดจาก Apple Health: TDEE = (BMR + Active Energy เฉลี่ย) ÷ 0.9  (เผื่อ TEF 10%)
 *   3) formula  — สูตรเดิม BMR × ตัวคูณ (ใช้เมื่อยังไม่มีข้อมูล — บอก user ตรง ๆ ว่าเป็นค่าเริ่มต้น)
 */
import { prisma } from "@/lib/prisma";
import { calculateAge, calculateBMR, calculateTDEE, type ActivityLevel } from "@/lib/health-calculator";

/** พลังงานสะสมต่อไขมัน 1 กก. */
const KCAL_PER_KG = 7700;
/** Thermic Effect of Food ~10% ของที่กิน */
const TEF = 0.1;
/** ส่วนขาด/เกินต่อวัน = ~0.5 กก./สัปดาห์ */
const ADJUST = 500;

export type EnergySource = "adaptive" | "measured" | "formula";

export interface EnergyEstimate {
  tdee: number;
  /** พลังงานของ "วันที่ไม่ได้ออกกำลังกาย" — ใช้เป็นฐานของงบรายวัน (ดู dailyBudget.ts) */
  baseTdee: number;
  target: number; // แคลอรี่ที่ควรกินต่อวัน (ฐาน — ยังไม่รวมที่คืนจากการออกกำลังกาย)
  bmr: number;
  source: EnergySource;
  confidence: "high" | "medium" | "low";
  dataDays: number; // จำนวนวันของข้อมูลที่ใช้
  explain: string; // อธิบายที่มาให้ user อ่านได้ (แสดงในแอป)
  macros: { protein: number; carbs: number; fat: number };
  proteinBasis: number; // น้ำหนักที่ใช้คิดโปรตีน (กก.)
  warning?: string; // เตือนเมื่อค่าที่ user ตั้งไว้ดูไม่ตรงกับความจริง
}

/**
 * มาโคร: โปรตีนก่อน (ก./กก.) → ไขมันขั้นต่ำ → ที่เหลือเป็นคาร์บ
 * ของเดิมคิดเป็น % ของแคลอรี่ ทำให้คนแคลสูงได้โปรตีนเกินจริง
 * คนลดน้ำหนักคิดจาก "น้ำหนักเป้าหมาย" (ไขมันส่วนเกินไม่ต้องการโปรตีนไปเลี้ยง)
 */
export function macroTargets(
  calories: number,
  weight: number,
  goalWeight: number | null,
  goalType: string
): { macros: { protein: number; carbs: number; fat: number }; basis: number } {
  const losing = (goalType || "").includes("lose") || (goalType || "").includes("ลด");
  // ลดน้ำหนักและยังหนักกว่าเป้า → ใช้น้ำหนักเป้าหมาย (แต่ไม่ต่ำกว่า 60% ของน้ำหนักปัจจุบัน กันค่าเพี้ยน)
  const basis =
    losing && goalWeight && goalWeight < weight ? Math.max(goalWeight, weight * 0.6) : weight;

  let protein = Math.round(basis * 1.8); // ช่วงที่มีหลักฐานรองรับ 1.6–2.2 ก./กก.
  let fat = Math.round(Math.max(basis * 0.8, (calories * 0.22) / 9)); // ไขมันต่ำกว่า 0.8 ก./กก. กระทบฮอร์โมน

  // โปรตีนไม่ควรเกิน 40% ของพลังงานทั้งวัน (กินจริงไม่ไหว)
  const maxProteinKcal = calories * 0.4;
  if (protein * 4 > maxProteinKcal) protein = Math.round(maxProteinKcal / 4);

  let carbKcal = calories - protein * 4 - fat * 9;
  if (carbKcal < calories * 0.15) {
    // แคลอรี่น้อยจนคาร์บเหลือน้อยเกินไป → ลดไขมันลงหาขั้นต่ำจริง ๆ ก่อน
    fat = Math.round(Math.max(basis * 0.6, (calories * 0.18) / 9));
    carbKcal = calories - protein * 4 - fat * 9;
  }
  const carbs = Math.max(0, Math.round(carbKcal / 4));
  return { macros: { protein, carbs, fat }, basis };
}

/** เป้ากินจาก TDEE ตามเป้าหมาย — ห้ามต่ำกว่า BMR และไม่ต่ำกว่า 1200 (กฎความปลอดภัยเดิม) */
export function targetFromTdee(tdee: number, goalType: string, bmr: number): number {
  const g = goalType || "maintain";
  if (g.includes("lose") || g.includes("ลด")) return Math.max(1200, bmr, tdee - ADJUST);
  if (g.includes("gain") || g.includes("เพิ่ม") || g.includes("กล้าม")) return tdee + ADJUST;
  return tdee;
}

const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");

/**
 * ประเมินพลังงานจากข้อมูลที่ดีที่สุดที่มี
 * @param days ช่วงข้อมูลที่ใช้ (ค่าเริ่ม 21 วัน)
 */
export async function estimateEnergy(memberId: string, days = 21): Promise<EnergyEstimate | null> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  const weight = member.weight ?? 70;
  const goalType = member.goalType ?? "maintain";
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const bmr =
    member.birthDate && member.height && member.gender
      ? calculateBMR(weight, member.height, calculateAge(member.birthDate), member.gender as "male" | "female")
      : Math.round(member.bmr ?? weight * 22);

  const [mealRows, weights, metrics, exerciseRows] = await Promise.all([
    // แคลอรี่ต่อวัน (วัน BKK) — ใช้ดูทั้งค่าเฉลี่ยและความสม่ำเสมอของการบันทึก
    prisma.$queryRaw<Array<{ d: Date; kcal: number }>>`
      SELECT ("date" + interval '7 hours')::date AS d, SUM(calories)::float AS kcal
      FROM meal_logs WHERE "memberId" = ${memberId} AND "date" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.weightLog.findMany({
      where: { memberId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    }),
    prisma.dailyMetric.findMany({
      where: { memberId, date: { gte: since } },
      select: { activeKcal: true, date: true },
    }),
    // แคลอรี่จากการออกกำลังกายที่บันทึกไว้ — ใช้ถอดออกจาก TDEE เพื่อหา "ฐานวันไม่ออกกำลังกาย"
    prisma.exerciseLog.findMany({
      where: { memberId, date: { gte: since } },
      select: { calories: true, date: true },
    }),
  ]);

  const loggedDays = mealRows.filter((r) => Number(r.kcal) > 300); // วันที่บันทึกจริง (ไม่ใช่แค่แตะ ๆ)
  const avgIntake = loggedDays.length ? loggedDays.reduce((s, r) => s + Number(r.kcal), 0) / loggedDays.length : 0;
  const activeDays = metrics.filter((m) => (m.activeKcal ?? 0) > 0);
  const avgActive = activeDays.length ? activeDays.reduce((s, m) => s + (m.activeKcal ?? 0), 0) / activeDays.length : 0;

  const activity = (member.activityLevel ?? "moderate") as ActivityLevel;
  const formulaTdee = calculateTDEE(bmr, activity);
  // เฉลี่ยแคลอรี่ออกกำลังกายต่อวัน (หารด้วยจำนวนวันทั้งช่วง ไม่ใช่เฉพาะวันที่ออก)
  const avgExercisePerDay = exerciseRows.reduce((s2, e) => s2 + (e.calories || 0), 0) / days;

  let tdee = formulaTdee;
  let source: EnergySource = "formula";
  let confidence: EnergyEstimate["confidence"] = "low";
  let dataDays = 0;
  let explain = `ค่าเริ่มต้นจากสูตร: BMR ${fmt(bmr)} × ระดับกิจกรรมที่เลือกไว้ = ${fmt(formulaTdee)} kcal/วัน — ยังไม่ได้วัดจากข้อมูลจริง`;
  let warning: string | undefined;

  // ── ชั้น 2: วัดจาก Apple Health ──
  if (activeDays.length >= 4) {
    const measured = Math.round((bmr + avgActive) / (1 - TEF));
    tdee = measured;
    source = "measured";
    confidence = activeDays.length >= 10 ? "high" : "medium";
    dataDays = activeDays.length;
    explain = `วัดจาก Apple Health ${activeDays.length} วัน: BMR ${fmt(bmr)} + ขยับจริงเฉลี่ย ${fmt(avgActive)} + อาหารเผาผลาญ ~${fmt(measured * TEF)} = ${fmt(measured)} kcal/วัน`;
    if (Math.abs(formulaTdee - measured) > 400) {
      warning = `ระดับกิจกรรมที่ตั้งไว้ให้ค่า ${fmt(formulaTdee)} kcal แต่ของจริงวัดได้ ${fmt(measured)} kcal — โค้ชใช้ค่าที่วัดจริง`;
    }
  }

  // ── ชั้น 1: เรียนจากผลจริง (แม่นที่สุด) ──
  if (weights.length >= 2 && loggedDays.length >= 7) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    const spanDays = (last.date.getTime() - first.date.getTime()) / 86400000;
    const coverage = loggedDays.length / Math.max(spanDays, 1);
    if (spanDays >= 10 && coverage >= 0.7) {
      const deltaKg = last.weight - first.weight;
      const adaptive = Math.round(avgIntake - (deltaKg * KCAL_PER_KG) / spanDays);
      // กันค่าเพี้ยน (บันทึกไม่ครบ/ชั่งคนละเวลา) — ต้องอยู่ในช่วงที่เป็นไปได้ทางสรีรวิทยา
      if (adaptive >= bmr * 0.9 && adaptive <= bmr * 2.4) {
        tdee = adaptive;
        source = "adaptive";
        confidence = spanDays >= 14 && coverage >= 0.85 ? "high" : "medium";
        dataDays = Math.round(spanDays);
        const dir = deltaKg < 0 ? "ลดลง" : deltaKg > 0 ? "เพิ่มขึ้น" : "คงที่";
        explain = `เรียนจากผลจริง ${Math.round(spanDays)} วัน: กินเฉลี่ย ${fmt(avgIntake)} kcal/วัน แล้วน้ำหนัก${dir} ${Math.abs(deltaKg).toFixed(1)} กก. → ร่างกายเผาจริงราว ${fmt(adaptive)} kcal/วัน`;
      }
    }
  }

  // ฐาน = พลังงานของ "วันที่ไม่ได้ออกกำลังกาย"
  //  · source=formula → ใช้ NEAT อย่างเดียว (BMR × 1.35) ไม่ใช้ตัวคูณกิจกรรมที่ user เลือก
  //    เพราะส่วนออกกำลังกายถูกคืนให้เป็นรายวันแล้ว (dailyBudget.ts) — ไม่งั้นนับซ้ำ
  //  · source=measured/adaptive → ถอดแคลอรี่ออกกำลังกายเฉลี่ยออกจาก TDEE ที่วัดได้
  // clamp: NEAT ล้วนอยู่ในช่วง BMR×1.2 – BMR×1.6
  const rawBase = source === "formula" ? bmr * 1.35 : tdee - avgExercisePerDay;
  const baseTdee = Math.round(Math.min(Math.max(rawBase, bmr * 1.2), bmr * 1.6));
  const target = targetFromTdee(tdee, goalType, bmr);
  const { macros, basis } = macroTargets(target, weight, member.goalWeight, goalType);

  return { tdee: Math.round(tdee), baseTdee, target: Math.round(target), bmr, source, confidence, dataDays, explain, macros, proteinBasis: basis, warning };
}

/** ข้อความบอกว่า "ยังต้องการอะไรอีก" เพื่อให้โค้ชคำนวณแม่นขึ้น */
export function nextStepHint(e: EnergyEstimate): string {
  if (e.source === "adaptive") return "โค้ชใช้ผลจริงของคุณคำนวณแล้ว — ชั่งน้ำหนักสัปดาห์ละ 2 ครั้งพอ";
  if (e.source === "measured") return "บันทึกอาหารให้ครบ 10 วัน + ชั่งน้ำหนัก 2 ครั้ง แล้วโค้ชจะคำนวณจากผลจริงให้แม่นขึ้น";
  return "เชื่อม Apple Health หรือบันทึกอาหาร/ชั่งน้ำหนักสม่ำเสมอ แล้วโค้ชจะเลิกใช้ค่าประมาณ";
}
