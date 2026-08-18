/**
 * สมัครเข้าโปรแกรม — ตรรกะร่วมของทั้งฝั่งลูกค้า (แอป) และฝั่งแอดมิน (หลังบ้าน)
 * เขียนที่เดียวเพราะกติกาข้อนี้ห้ามต่างกันสองฝั่ง: ห้ามขายคอร์สถ้าปฏิทินยังไม่เต็ม
 */
import { prisma } from "@/lib/prisma";
import { PROGRAM_SLOTS, TrackKey, addDays, bkkDay, isTrack, missingSlots, thaiDate, trackLabel } from "@/lib/program";

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
