/**
 * สมัคร / ขอหยุด — ตรรกะร่วมของทั้งฝั่งลูกค้า (แอป) และฝั่งแอดมิน (หลังบ้าน)
 * เขียนที่เดียวเพราะกติกาสองอย่างนี้ห้ามต่างกัน:
 *   1. ห้ามขายคอร์สถ้าปฏิทินยังไม่เต็ม
 *   2. ข้ามวัน = เลื่อนวันจบ ไม่ใช่ตัดวันทิ้ง
 */
import { prisma } from "@/lib/prisma";
import {
  PROGRAM_SLOTS,
  TrackKey,
  addDays,
  bkkDay,
  canSkip,
  dayKey,
  enrollmentDays,
  isTrack,
  missingSlots,
  recomputeEndDate,
  thaiDate,
  trackLabel,
} from "@/lib/program";

const DEFAULT_SLOTS = ["เช้า", "กลางวัน", "เย็น"];

export interface EnrollInput {
  memberId: string;
  track?: string;
  startDate?: Date;
  totalDays?: number;
  slots?: string[];
  price?: number;
  addressId?: string | null;
  deliveryNote?: string | null;
  allowIncompleteRunway?: boolean;
}

export async function createEnrollment(
  input: EnrollInput,
): Promise<{ enrollment: Awaited<ReturnType<typeof prisma.programEnrollment.create>> } | { error: string }> {
  const track: TrackKey = isTrack(input.track) ? input.track : "standard";
  const totalDays = Math.min(Math.max(input.totalDays ?? 7, 1), 30);
  const slots = (input.slots ?? DEFAULT_SLOTS).filter((s) => PROGRAM_SLOTS.includes(s as never));
  if (slots.length === 0) return { error: "ต้องเลือกอย่างน้อย 1 มื้อ" };

  /*
   * เริ่มพรุ่งนี้เป็นค่าเริ่มต้น — ครัวซื้อของล่วงหน้า สมัครบ่ายนี้แล้วได้กินเย็นนี้เป็นไปไม่ได้
   */
  const start = input.startDate ?? addDays(bkkDay(), 1);
  if (start < bkkDay()) return { error: "วันเริ่มต้องไม่ใช่วันที่ผ่านมาแล้ว" };

  const existing = await prisma.programEnrollment.findFirst({
    where: { memberId: input.memberId, status: "active", endDate: { gte: start } },
  });
  if (existing) {
    return { error: `มีคอร์สที่ยังไม่จบอยู่แล้ว (ถึง ${thaiDate(existing.endDate)})` };
  }

  // 🔴 กติกาข้อ 1 — ปฏิทินต้องเต็มตลอดช่วงคอร์ส ไม่งั้นลูกค้าจ่ายเงินแล้วไม่มีเมนู
  if (!input.allowIncompleteRunway) {
    const filled = await prisma.menuCalendarItem.findMany({
      where: { date: { gte: start, lt: addDays(start, totalDays) }, track },
      select: { date: true, track: true, slot: true },
    });
    const gaps = missingSlots(filled, start, totalDays, slots).filter((g) => g.track === track);
    if (gaps.length > 0) {
      return {
        error: `ปฏิทินเมนูสาย "${trackLabel(track)}" ยังไม่ครบ ${totalDays} วัน (ขาด ${gaps.length} มื้อ เริ่มจาก ${thaiDate(gaps[0].date)} มื้อ${gaps[0].slot})`,
      };
    }
  }

  const enrollment = await prisma.programEnrollment.create({
    data: {
      memberId: input.memberId,
      track,
      startDate: start,
      endDate: addDays(start, totalDays - 1),
      totalDays,
      slots,
      price: input.price ?? 0,
      addressId: input.addressId ?? null,
      deliveryNote: input.deliveryNote ?? null,
    },
  });

  return { enrollment };
}

/**
 * ขอหยุด 1 วัน — บันทึกวันที่หยุดแล้วเลื่อน endDate ออกให้ได้ครบ totalDays จริง
 * 🔴 จ่ายค่าคอร์ส 7 วันต้องได้อาหาร 7 วัน ไม่ใช่ 7 วันปฏิทิน
 */
export async function skipDay(
  enrollmentId: string,
  date: Date,
  reason?: string,
): Promise<{ ok: true; endDate: Date } | { error: string }> {
  const e = await prisma.programEnrollment.findUnique({ where: { id: enrollmentId }, include: { skips: true } });
  if (!e) return { error: "ไม่พบคอร์ส" };
  if (e.status !== "active") return { error: "คอร์สนี้ไม่ได้ใช้งานอยู่" };

  const gate = canSkip(date);
  if (!gate.ok) return { error: gate.reason ?? "ขอหยุดวันนี้ไม่ได้" };

  const skipKeys = new Set(e.skips.map((s) => dayKey(s.date)));
  const key = dayKey(date);
  if (skipKeys.has(key)) return { error: "ขอหยุดวันนี้ไว้แล้ว" };

  // ต้องเป็นวันที่อยู่ในคอร์สจริง ไม่ใช่วันไหนก็ได้
  if (!enrollmentDays(e, skipKeys).some((d) => dayKey(d.date) === key)) {
    return { error: "วันนี้ไม่ได้อยู่ในคอร์ส" };
  }

  skipKeys.add(key);
  const endDate = recomputeEndDate(e, skipKeys);

  await prisma.$transaction([
    prisma.programSkip.create({ data: { enrollmentId, date, reason: reason ?? null } }),
    prisma.programEnrollment.update({ where: { id: enrollmentId }, data: { endDate } }),
  ]);

  return { ok: true, endDate };
}

/** ยกเลิกการขอหยุด — ดึงวันจบกลับเข้ามาตามเดิม */
export async function unskipDay(
  enrollmentId: string,
  date: Date,
): Promise<{ ok: true; endDate: Date } | { error: string }> {
  const e = await prisma.programEnrollment.findUnique({ where: { id: enrollmentId }, include: { skips: true } });
  if (!e) return { error: "ไม่พบคอร์ส" };

  const key = dayKey(date);
  if (!e.skips.some((s) => dayKey(s.date) === key)) return { error: "ไม่ได้ขอหยุดวันนี้ไว้" };

  // กันย้อนอดีต: ถ้าวันนั้นเลยมาแล้ว ครัวไม่ได้ทำไปแล้ว จะดึงกลับไม่ได้
  const gate = canSkip(date);
  if (!gate.ok) return { error: `ยกเลิกไม่ได้ — ${gate.reason}` };

  const skipKeys = new Set(e.skips.map((s) => dayKey(s.date)));
  skipKeys.delete(key);
  const endDate = recomputeEndDate(e, skipKeys);

  await prisma.$transaction([
    prisma.programSkip.deleteMany({ where: { enrollmentId, date } }),
    prisma.programEnrollment.update({ where: { id: enrollmentId }, data: { endDate } }),
  ]);

  return { ok: true, endDate };
}
