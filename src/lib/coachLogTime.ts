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
