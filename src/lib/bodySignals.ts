/**
 * สัญญาณร่างกาย 4 สัปดาห์ → การกระทำ (WO-BP-3 §B3 · ตาราง WO-BODY §7)
 *
 * ทั้งไฟล์คือ "ตารางกติกา" ที่เทสได้ทีละแถว — LLM ไม่มีส่วนตัดสินใจตรงนี้เลย
 * เหตุผล: การตีความสัญญาณคือสิ่งที่ทำให้แผนของ user เปลี่ยน ถ้าให้ LLM ตัดสิน
 * คนเดิมข้อมูลเดิมอาจได้คำแนะนำคนละอย่างในสองวัน และเราจะอธิบายไม่ได้ว่าทำไม
 *
 * 🔴 input ตัวไหน null = ข้ามแถวนั้นเงียบ ๆ
 *    "ไม่มีข้อมูล" ≠ "ไม่มีปัญหา" ≠ "มีปัญหา" — การเดาแทนช่องว่างคือการโกหกที่ดูน่าเชื่อ
 * 🔴 ข้อความทุกบรรทัดโทนบวก ห้ามโทษ user (เอวไม่ลง = ไปดูข้อมูลด้วยกัน ไม่ใช่ "คุณกินเกิน")
 *
 * pure ทั้งไฟล์ (ห้าม prisma / fetch / new Date())
 */

export type BodyTrend = "up" | "down" | "flat";

export type BodySignalKey =
  | "recomp_working"
  | "losing_too_fast"
  | "check_adherence"
  | "imbalance"
  | "posture_note";

export type BodySignalAction =
  | "keep_program"
  | "energy_up_volume_down"
  | "ask_adherence"
  | "unilateral_hint"
  | "mobility_hint";

export interface BodySignal {
  key: BodySignalKey;
  action: BodySignalAction;
  /** ข้อความไทยที่พูดกับ user ได้ตรง ๆ (โค้ช/รายงานใช้ก้อนนี้) */
  message: string;
  /** ป้ายกำกับเพิ่ม เช่น "ข้อสังเกตด้านฟิตเนส ไม่ใช่การวินิจฉัย" */
  note?: string;
  /** ตัวเลขที่ทำให้แถวนี้ติด — ทุกเลขที่โผล่ในข้อความต้องอ้างกลับมาที่นี่ได้ */
  detail?: Record<string, number>;
}

/** น้ำหนักลงเร็วกว่านี้ = ขาดพลังงานเกิน (WO-BODY §7: >1%/สัปดาห์) */
export const FAST_LOSS_PCT_PER_WEEK = -1;
/** ซ้าย-ขวาต่างกันเกินนี้ถือว่าเป็น imbalance จริง (ซม.) */
export const IMBALANCE_DIFF_CM = 1.5;

export interface BodySignalInput {
  waistTrend4w: BodyTrend | null;
  e1rmTrend4w: BodyTrend | null;
  /** อัตราเปลี่ยนน้ำหนัก %/สัปดาห์ (ลบ = ลด) */
  weightRatePctPerWk: number | null;
  /** อยู่ในภาวะขาดพลังงานตามเป้าที่ตั้งไว้หรือไม่ (คิดไม่ได้ = null) */
  inDeficit: boolean | null;
  thighDiffCm: number | null;
  calfDiffCm: number | null;
  /** ค่าความต่างซ้าย-ขวา conf สูงติดกัน 2 สแกน (สแกนเดียวยังเป็นเรื่องท่ายืนได้) */
  diffConfHigh2x: boolean;
  /** posture flag เดิมติดกัน 2 สแกน */
  postureFlag2x: { headForward: boolean; shoulderTilt: boolean };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * ตาราง §7 ทีละแถว — คืนเฉพาะแถวที่ข้อมูลพอจะตัดสินจริง
 * ลำดับผลลัพธ์คงที่เสมอ (ตามลำดับแถวในตาราง) เพื่อให้ปลายทาง/เทสอ่านได้แน่นอน
 */
export function computeBodySignals(input: BodySignalInput): BodySignal[] {
  const out: BodySignal[] = [];
  const waist = input?.waistTrend4w ?? null;
  const e1rm = input?.e1rmTrend4w ?? null;
  const rate = isNum(input?.weightRatePctPerWk) ? input.weightRatePctPerWk : null;

  // แถว 1 — เอว↓ + แรง↑/คงที่ = recomposition กำลังเวิร์ก
  if (waist === "down" && (e1rm === "up" || e1rm === "flat")) {
    out.push({
      key: "recomp_working",
      action: "keep_program",
      message: "ที่ทำอยู่ได้ผล — เอวลดโดยแรงไม่ตก อย่าเพิ่งเปลี่ยนอะไร",
    });
  }

  // แถว 2 — น้ำหนักลงเร็วเกิน + แรงตก = ขาดพลังงาน/ฟื้นตัวไม่พอ
  if (rate !== null && rate <= FAST_LOSS_PCT_PER_WEEK && e1rm === "down") {
    out.push({
      key: "losing_too_fast",
      action: "energy_up_volume_down",
      message:
        `น้ำหนักลงเร็วกว่าที่ร่างกายตามทัน (${r1(Math.abs(rate))}% ต่อสัปดาห์) และแรงเริ่มตก — ` +
        "สัปดาห์นี้โค้ชขอเพิ่มแคลอรี่ให้อีกนิด ลดปริมาณเวทลง 1 ระดับ และเน้นโปรตีนให้ครบทุกวัน " +
        "กล้ามที่รักษาไว้ตอนนี้คือสิ่งที่ทำให้น้ำหนักที่ลดไปไม่กลับมาครับ",
      detail: { weightRatePctPerWk: r1(rate) },
    });
  }

  // แถว 3 — เอวคงที่ 4 สัปดาห์ทั้งที่ตั้งเป้าแบบขาดพลังงาน → ไปดูข้อมูลก่อน ห้ามปรับแผนทันที
  if (waist === "flat" && input?.inDeficit === true) {
    out.push({
      key: "check_adherence",
      action: "ask_adherence",
      message:
        "เอวคงที่มา 4 สัปดาห์ทั้งที่เป้าตั้งไว้แบบลด — ยังไม่ต้องเปลี่ยนแผนตอนนี้ครับ " +
        "ขอชวนดูบันทึกอาหารด้วยกันก่อน หลายครั้งมันคือมื้อที่ลืมบันทึก ไม่ใช่แผนที่ผิด",
    });
  }

  // แถว 4 — ซ้าย-ขวาต่างกันเกิน 1.5 ซม. โดย conf สูง 2 สแกนติด
  const thigh = isNum(input?.thighDiffCm) ? Math.abs(input.thighDiffCm) : null;
  const calf = isNum(input?.calfDiffCm) ? Math.abs(input.calfDiffCm) : null;
  const maxDiff = thigh !== null || calf !== null ? Math.max(thigh ?? 0, calf ?? 0) : null;
  if (maxDiff !== null && maxDiff > IMBALANCE_DIFF_CM && input?.diffConfHigh2x === true) {
    const which = (thigh ?? 0) >= (calf ?? 0) ? "ต้นขา" : "น่อง";
    out.push({
      key: "imbalance",
      action: "unilateral_hint",
      message:
        `${which}สองข้างต่างกันประมาณ ${r1(maxDiff)} ซม. — บล็อกหน้าโค้ชจะใส่ท่าฝึกทีละข้างเพิ่มให้ ` +
        "เพื่อให้ข้างที่ตามอยู่ไล่ทัน เรื่องนี้พบได้บ่อยและแก้ได้ด้วยการฝึกครับ",
      detail: {
        ...(thigh !== null ? { thighDiffCm: r1(thigh) } : {}),
        ...(calf !== null ? { calfDiffCm: r1(calf) } : {}),
      },
    });
  }

  // แถว 5 — posture flag ติดกัน 2 สแกน (ข้อสังเกต ไม่ใช่การวินิจฉัย)
  const headForward = input?.postureFlag2x?.headForward === true;
  const shoulderTilt = input?.postureFlag2x?.shoulderTilt === true;
  if (headForward || shoulderTilt) {
    const what = headForward && shoulderTilt
      ? "ศีรษะยื่นไปหน้าและไหล่สองข้างสูงต่ำไม่เท่ากัน"
      : headForward
        ? "ศีรษะยื่นไปข้างหน้า"
        : "ไหล่สองข้างสูงต่ำไม่เท่ากัน";
    out.push({
      key: "posture_note",
      action: "mobility_hint",
      message:
        `สแกน 2 ครั้งล่าสุดเห็น${what}เหมือนกัน — โค้ชจะแถมยืดเหยียด 5 นาทีท้ายวันเทรนให้ ` +
        "ทำก็ดี ไม่ทำก็ไม่ผิดกติกาครับ",
      note: "ข้อสังเกตด้านฟิตเนส ไม่ใช่การวินิจฉัยทางการแพทย์",
    });
  }

  return out;
}

/** ใช้ตอนต่อเข้า Generator/โค้ช — มีสัญญาณนี้อยู่ไหม */
export function hasSignal(signals: BodySignal[], key: BodySignalKey): boolean {
  return signals.some((s) => s.key === key);
}
