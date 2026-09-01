/**
 * คำสั่ง "ข้าม engine" ของโค้ชมนุษย์ (WO-PT-ENGINE §7.3)
 *
 * 🔴 ทำไมต้องมีตารางแยก ไม่แก้ ProgressionState ตรง ๆ:
 *    `updateProgressionState()` คิด state ใหม่จาก SetLog ทุกครั้งที่ลูกค้าบันทึกเซ็ต
 *    ค่าที่แอดมินพิมพ์ทับลงไปจะหายทันทีที่ลูกค้าเล่นครั้งถัดไป = แอดมินเห็นว่าสั่งแล้ว แต่ของจริงไม่เปลี่ยน
 *    คำสั่งจึงเก็บเป็น "ใบสั่งค้าง" แล้วไปมีผลตอนเขียนแผน (applyProgression) ซึ่งเป็นจุดที่ตัวเลขถึงมือลูกค้าจริง
 *
 * 🔴 ใบสั่งใช้ได้ครั้งเดียว (consumedAt) — โค้ชสั่ง "งวดนี้ยก 40" ไม่ได้แปลว่า "ยก 40 ตลอดไป"
 *    หลังจากนั้น engine เดินต่อจากของจริงที่ลูกค้าทำได้เหมือนเดิม
 */
import { prisma } from "@/lib/prisma";

export type OverrideAction = "set_weight" | "reset_stall" | "force_deload" | "clear_calibration" | "note";

/** คำสั่งที่ต้องรอแผนรอบถัดไป (ที่เหลือมีผลทันทีตอนกด) */
const DEFERRED: ReadonlySet<OverrideAction> = new Set(["set_weight", "force_deload"]);
export const isDeferred = (a: OverrideAction): boolean => DEFERRED.has(a);

export interface PendingOverrides {
  /** exerciseKey → น้ำหนักที่โค้ชสั่ง (กก.) */
  weightByKey: Map<string, number>;
  /** สั่งให้สัปดาห์ถัดไปเป็นสัปดาห์พักฟื้น */
  forceDeload: boolean;
  /** id ของใบสั่งที่ถูกใช้ในรอบนี้ — ตัวเรียกต้องปั๊ม consumedAt หลังเขียนแผนสำเร็จ */
  ids: string[];
}

export const EMPTY_PENDING: PendingOverrides = { weightByKey: new Map(), forceDeload: false, ids: [] };

export interface OverrideRow {
  id: string;
  action: string;
  exerciseKey: string | null;
  after: unknown;
}

/**
 * รวมใบสั่งค้างเป็นชุดเดียว — แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพื่อให้มีข้อสอบได้
 * 🔴 ต้องส่ง rows แบบเรียง "เก่า → ใหม่" · ท่าเดียวกันสั่งซ้ำ ใบหลังทับใบก่อน
 *    (แอดมินพิมพ์ผิดแล้วสั่งใหม่ ต้องได้เลขที่สั่งครั้งหลัง ไม่ใช่ครั้งแรก)
 * 🔴 ใบที่ค่าใช้ไม่ได้ (น้ำหนักติดลบ/ไม่ใช่ตัวเลข) ยังนับเป็น "ใช้แล้ว" —
 *    ไม่งั้นใบเสียจะค้างในคิวตลอดกาลและถูกอ่านซ้ำทุกสัปดาห์
 */
export function mergeOverrideRows(rows: OverrideRow[]): PendingOverrides {
  const weightByKey = new Map<string, number>();
  let forceDeload = false;
  const ids: string[] = [];

  for (const r of rows) {
    ids.push(r.id);
    if (r.action === "force_deload") { forceDeload = true; continue; }
    if (r.action !== "set_weight" || !r.exerciseKey) continue;
    const kg = Number((r.after as { weightKg?: unknown } | null)?.weightKg);
    if (!Number.isFinite(kg) || kg <= 0) continue;
    weightByKey.set(r.exerciseKey, kg);
  }
  return { weightByKey, forceDeload, ids };
}

/** ใบสั่งค้างของคนนี้ (อ่านจาก DB แล้วส่งต่อให้ตัวรวมด้านบน) */
export async function pendingOverrides(memberId: string): Promise<PendingOverrides> {
  const rows = await prisma.ptOverride.findMany({
    where: { memberId, consumedAt: null, action: { in: [...DEFERRED] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, exerciseKey: true, after: true },
  });
  return mergeOverrideRows(rows);
}

/** ปั๊มว่าใช้ไปแล้ว — เรียกหลังแผนถูกเขียนจริงเท่านั้น (เขียนไม่สำเร็จแล้วปั๊ม = คำสั่งหายเปล่า) */
export async function markConsumed(ids: string[], now = new Date()): Promise<void> {
  if (!ids.length) return;
  await prisma.ptOverride.updateMany({ where: { id: { in: ids }, consumedAt: null }, data: { consumedAt: now } });
}
