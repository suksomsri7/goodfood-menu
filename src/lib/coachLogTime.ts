/**
 * เวลาไทยที่ผู้ใช้ระบุเอง ("ตอน 10 โมงครึ่งดื่มน้ำ 1 ลิตร" / ช่องเลือกเวลาในแอป) → Date จริง
 *
 * รับ time="HH:MM" (+ date="YYYY-MM-DD" ถ้าไม่ใช่วันนี้) ตามเวลาไทย
 * ไม่ระบุ/รูปแบบผิด/เกิน 14 วัน/อนาคตเกิน 1 ชม. → คืน undefined = ผู้เรียกใช้เวลาเดิม/เวลาปัจจุบัน
 *
 * ใช้ร่วมกันระหว่าง /api/coach/execute (สร้างบันทึกใหม่) และ /api/coach/update-entry (แก้บันทึกเดิม)
 * เพื่อให้กติกาเวลาเหมือนกันเป๊ะ
 */
const BKK_OFFSET_MS = 7 * 3600 * 1000;

export function resolveLogTime(g: any): Date | undefined {
  const time = typeof g?.time === "string" ? g.time.trim() : "";
  if (!/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [hh, mm] = time.split(":").map(Number);
  if (hh > 23 || mm > 59) return undefined;

  const nowBkk = new Date(Date.now() + BKK_OFFSET_MS);
  const dateStr =
    typeof g?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.date)
      ? g.date
      : nowBkk.toISOString().slice(0, 10);

  // เวลาไทยที่ระบุ → UTC (ลบ 7 ชม.)
  const utc = new Date(`${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`);
  if (isNaN(utc.getTime())) return undefined;
  const when = new Date(utc.getTime() - BKK_OFFSET_MS);

  const ageMs = Date.now() - when.getTime();
  if (ageMs < -3600_000 || ageMs > 14 * 24 * 3600_000) return undefined; // อนาคต/เก่าเกินไป = ไม่เชื่อ
  return when;
}

/** ยอมให้เวลาอยู่ในอนาคตได้ไม่เกินเท่านี้ (นาฬิกาเครื่อง user คลาดเคลื่อนได้นิดหน่อย) */
export const FUTURE_TOLERANCE_MS = 3600_000;

/**
 * เวลาที่ผู้เรียกส่งมาเป็น "instant" (ISO string / Date) เช่น logAt ตอนติ๊กแผน,
 * startedAt ของ workout จากนาฬิกา, date ของ /api/exercises (LIFF)
 *
 * ต่างจาก resolveLogTime ตรงที่ตัวนี้ไม่ได้แปลง timezone (ค่าที่รับมามี offset ในตัวอยู่แล้ว)
 * แต่ใช้ "กติกาความน่าเชื่อถือ" ชุดเดียวกัน: อนาคตเกิน 1 ชม. = ไม่เชื่อ → ใช้เวลาปัจจุบันแทน
 *
 * ทำไมต้องมี: เดิมหลาย path รับ new Date(อะไรก็ได้) ตรง ๆ ไม่ตรวจเลย
 * เวลาที่ล้ำอนาคตทำให้บันทึกตกไปอยู่หน้าต่างวันไทยของวันถัดไป → วงแหวน/งบเพี้ยนข้ามวัน
 */
export function sanitizeLogInstant(raw: unknown, now = new Date()): Date {
  if (raw === null || raw === undefined || raw === "") return now;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (isNaN(d.getTime())) return now;
  if (d.getTime() - now.getTime() > FUTURE_TOLERANCE_MS) return now; // อนาคต = ไม่เชื่อ
  return d;
}

/**
 * บังคับให้เวลาอยู่ใน "วันของแผน" (BKK) — ใช้ตอนติ๊กแผน
 *
 * แอปส่ง logAt = เวลาปัจจุบันของเครื่องเสมอ แม้ user กำลังเปิดดูแผนของวันย้อนหลัง
 * ผลคือติ๊กแผนเมื่อวาน → บันทึกไปโผล่วันนี้ (วงแหวนวันนี้บวม วันเมื่อวานยังว่าง)
 * นอกช่วงวันนั้น → ใช้เที่ยงวันไทยของวันนั้น (คอนเวนชันเดียวกับที่แอปใช้กับวันย้อนหลัง)
 */
export function clampToDayWindow(when: Date, dayStart: Date, dayEnd: Date): Date {
  if (when >= dayStart && when < dayEnd) return when;
  return new Date(dayStart.getTime() + 12 * 3600_000);
}
