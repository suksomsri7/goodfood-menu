/**
 * เป้าเผาผลาญรายวันของแต่ละคน (วงแหวน "เผาผลาญ" ในแอป)
 *
 * ⚠️ เดิมแอปเอา `exercisePlan.caloriesTarget` ของวันนั้นมาเป็นเป้าแหวน — ผิดคอนเซ็ปต์
 * ค่านั้นคือ "เวิร์กเอาต์วันนี้ควรเผากี่แคล" (วันพักเหลือ 80, วันหนัก 300) ทำให้เป้าแหวน
 * เต้นไปมาทุกวัน · วงแหวนต้องเทียบกับเป้าที่ "คงเส้นคงวา" ถึงจะดูความสม่ำเสมอได้
 * caloriesTarget ยังอยู่เหมือนเดิม ไม่ถูกแตะ — แค่ไม่ใช่เป้าแหวนอีกต่อไป
 *
 * ลำดับความสำคัญ (ตัดสินที่เดียวในไฟล์นี้):
 *   1. custom   — Member.dailyBurnGoal ที่ user ตั้งเอง (ชนะทุกอย่าง)
 *   2. watch    — Move goal จริงบน Apple Watch (DailyMetric.moveGoal ล่าสุด)
 *   3. computed — คำนวณจาก TDEE × สัดส่วนตามเป้าหมาย
 */
import { prisma } from "@/lib/prisma";
import { estimateEnergy } from "@/lib/energyModel";

export type BurnGoalSource = "custom" | "watch" | "computed";
export type BurnGoal = { value: number; source: BurnGoalSource };

/** ขอบเขตที่ยอมรับได้ — ต่ำกว่านี้ไม่มีความหมาย สูงกว่านี้คือกรอกผิด */
export const BURN_GOAL_MIN = 100;
export const BURN_GOAL_MAX = 2000;
/** Move goal จากนาฬิกา (ค่าที่ Apple ให้ตั้งได้จริง) */
export const MOVE_GOAL_MIN = 50;
export const MOVE_GOAL_MAX = 2000;

/** พื้น/เพดานของค่าที่คำนวณเอง — กันคนตัวเล็กได้เป้าต่ำจนไร้ความหมาย และคนตัวใหญ่ได้เป้าโหด */
const COMPUTED_FLOOR = 250;
const COMPUTED_CAP = 800;

/** สัดส่วนของ TDEE ที่ควรมาจากการขยับ — คนลดน้ำหนักต้องขยับมากกว่าคนรักษาน้ำหนัก */
function ratioFor(goalType: string | null | undefined): number {
  const g = goalType || "maintain";
  if (g.includes("lose") || g.includes("ลด")) return 0.15;
  if (g.includes("gain") || g.includes("เพิ่ม") || g.includes("กล้าม")) return 0.08;
  return 0.1;
}

export function computeBurnGoalFromTdee(tdee: number, goalType: string | null | undefined): number {
  return Math.min(COMPUTED_CAP, Math.max(COMPUTED_FLOOR, Math.round(tdee * ratioFor(goalType))));
}

/** ค่าที่ user ตั้งเองใช้ได้ไหม (ใช้ตอน validate ฝั่ง API ด้วย) */
export function validBurnGoal(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= BURN_GOAL_MIN && r <= BURN_GOAL_MAX ? r : null;
}

/** Move goal จากนาฬิกาใช้ได้ไหม */
export function validMoveGoal(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= MOVE_GOAL_MIN && r <= MOVE_GOAL_MAX ? r : null;
}

/**
 * เป้าเผาผลาญของสมาชิกคนนี้
 * @param member ต้องมี id/dailyBurnGoal/goalType/tdee (ส่ง member ที่โหลดมาแล้วเข้ามาได้เลย)
 * @param baseTdee ถ้าผู้เรียกคำนวณ TDEE ไว้แล้ว ส่งมาเพื่อไม่ให้ query ซ้ำ
 */
export async function personalBurnGoal(
  member: { id: string; dailyBurnGoal?: number | null; goalType?: string | null; tdee?: number | null },
  opts?: { tdee?: number | null }
): Promise<BurnGoal> {
  // ① user ตั้งเอง = ชนะทุกอย่าง
  const custom = validBurnGoal(member.dailyBurnGoal);
  if (custom) return { value: custom, source: "custom" };

  // ② Move goal จริงบนนาฬิกา — เอาแถวล่าสุดที่มีค่า (user เปลี่ยนเป้าบนนาฬิกาเมื่อไหร่ก็ตามผลทันที)
  try {
    const row = await prisma.dailyMetric.findFirst({
      where: { memberId: member.id, moveGoal: { not: null } },
      orderBy: { date: "desc" },
      select: { moveGoal: true },
    });
    const watch = validMoveGoal(row?.moveGoal);
    if (watch) return { value: watch, source: "watch" };
  } catch {
    // อ่านไม่ได้ = ตกไปใช้ค่าคำนวณ ดีกว่าไม่มีเป้าให้ user เลย
  }

  // ③ คำนวณจากโปรไฟล์ — ใช้ TDEE ที่วัด/เรียนได้จริงถ้ามี ไม่งั้นใช้ค่าใน Member
  let tdee = opts?.tdee ?? null;
  if (!tdee) {
    const est = await estimateEnergy(member.id).catch(() => null);
    tdee = est?.tdee ?? member.tdee ?? null;
  }
  return {
    value: computeBurnGoalFromTdee(tdee ?? 2000, member.goalType),
    source: "computed",
  };
}
