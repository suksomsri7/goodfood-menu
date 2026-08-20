/**
 * รายงานร่างกาย 4 สัปดาห์ — โครงตัวเลข + ย่อหน้าสำรอง + prompt ของ LLM (WO-BP-3 §B5)
 *
 * 🔴 ตำแหน่งของ LLM ในระบบนี้: "คนเล่าเรื่อง" เท่านั้น ตัวเลขทุกตัวคิดเสร็จก่อนถึงมือมันแล้ว
 *    เหตุผลเดิมจาก WO-BODY §1: โมเดลให้ค่าไม่นิ่ง — ภาพเดิม/ข้อมูลเดิมได้เลขใหม่ทุกครั้ง
 *    ถ้าปล่อยให้มันคิดเลขเอง กราฟและรายงานจะเล่าคนละเรื่องกัน แล้ว user จะไม่เชื่อทั้งสองอย่าง
 *
 * 🔴 รายงานต้องออกเสมอ — AI ล่ม/เครดิตหมด ก็ยังมี fallbackNarrative() ที่ประกอบจาก stats ล้วน
 *    (ลูกค้าจ่ายเงินเพื่อ "รายงานทุก 4 สัปดาห์" ไม่ใช่ "รายงานทุก 4 สัปดาห์ถ้าผู้ให้บริการ AI ว่าง)
 *
 * pure ทั้งไฟล์ (ห้าม prisma / fetch / new Date())
 */

export interface ReportWeight {
  startKg: number;
  endKg: number;
  deltaKg: number;
}
export interface ReportWaist {
  startCm: number;
  endCm: number;
  deltaCm: number;
  /** tape = สายวัดจริง · estimate = กล้องประมาณ (±2-3 ซม.) — ต้องบอก user ว่าเลขนี้มาจากไหน */
  source: "tape" | "estimate";
}
export interface ReportBf {
  startLo: number;
  startHi: number;
  endLo: number;
  endHi: number;
  deltaMid: number;
}
export interface ReportLift {
  exerciseKey: string;
  name: string;
  startKg: number;
  endKg: number;
  deltaKg: number;
}

export interface BodyReportStats {
  /** YYYY-MM-DD */
  periodStart: string;
  periodEnd: string;
  weight: ReportWeight | null;
  waist: ReportWaist | null;
  bf: ReportBf | null;
  /** e1RM ท่าหลักที่มีข้อมูลทั้งต้นและปลายช่วง (สูงสุด 3 ท่า) */
  lifts: ReportLift[];
  counts: {
    scans: number;
    workoutDays: number;
    foodLogDays: number;
    weighDays: number;
  };
  signals: Array<{ key: string; message: string }>;
  goal: {
    label: string;
    pctDone: number;
    onTrack: string | null;
    weeksLeft: number | null;
  } | null;
  score: { score: number; consistency: number; direction: number; data: number } | null;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-08-20" → "20 ส.ค." (รูปแบบผิด = คืนสตริงเดิม ไม่ throw กลางรายงาน) */
export function thaiDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  const mi = Number(m[2]) - 1;
  return `${Number(m[3])} ${TH_MONTHS[mi] ?? m[2]}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** เลขที่มีเครื่องหมายกำกับ — "ลด 1.2" อ่านง่ายกว่า "-1.2" สำหรับคนทั่วไป */
function movedTh(delta: number, unit: string): string {
  const d = r1(Math.abs(delta));
  if (d === 0) return `คงที่`;
  return `${delta < 0 ? "ลดลง" : "เพิ่มขึ้น"} ${d} ${unit}`;
}

/**
 * ย่อหน้าสำรองแบบ deterministic — ข้อมูลเดิมได้ข้อความเดิมเป๊ะทุกครั้ง
 * โทนโค้ช: บอกสิ่งที่เกิดขึ้นจริง ชมสิ่งที่ทำได้ ไม่สัญญาผลลัพธ์ ไม่โทษ user เมื่อตัวเลขไม่ขยับ
 */
export function fallbackNarrative(stats: BodyReportStats): string {
  const s: string[] = [];
  s.push(`สรุปรอบ 4 สัปดาห์ (${thaiDay(stats.periodStart)} - ${thaiDay(stats.periodEnd)}) ครับ`);

  const body: string[] = [];
  if (stats.weight) {
    body.push(`น้ำหนัก ${r1(stats.weight.startKg)} → ${r1(stats.weight.endKg)} กก. (${movedTh(stats.weight.deltaKg, "กก.")})`);
  }
  if (stats.waist) {
    const tag = stats.waist.source === "tape" ? "จากสายวัด" : "จากค่าประมาณของกล้อง";
    body.push(`เอว ${r1(stats.waist.startCm)} → ${r1(stats.waist.endCm)} ซม. ${tag} (${movedTh(stats.waist.deltaCm, "ซม.")})`);
  }
  if (stats.bf) {
    body.push(
      `% ไขมันช่วง ${r1(stats.bf.startLo)}-${r1(stats.bf.startHi)}% → ${r1(stats.bf.endLo)}-${r1(stats.bf.endHi)}%`
    );
  }
  if (body.length) s.push(`${body.join(" · ")}`);

  if (stats.lifts.length) {
    const parts = stats.lifts.map((l) => `${l.name} ${movedTh(l.deltaKg, "กก.")}`);
    s.push(`ด้านแรง: ${parts.join(" · ")} (ประเมินจากน้ำหนัก×ครั้งที่บันทึกไว้)`);
  }

  s.push(
    `เดือนนี้สแกน ${stats.counts.scans} ครั้ง ชั่งน้ำหนัก ${stats.counts.weighDays} วัน ` +
      `บันทึกอาหาร ${stats.counts.foodLogDays} วัน และมีวันที่ออกกำลังกาย ${stats.counts.workoutDays} วัน`
  );

  if (stats.goal) {
    s.push(
      `เป้า "${stats.goal.label}" เดินมาแล้ว ${stats.goal.pctDone}%` +
        (stats.goal.weeksLeft !== null ? ` เหลืออีกประมาณ ${stats.goal.weeksLeft} สัปดาห์ตามแผนที่ตั้งไว้` : "")
    );
  }

  if (stats.signals.length) {
    s.push(stats.signals[0].message);
  } else {
    s.push("ทำต่อแบบนี้ไปอีกรอบแล้วเรามาดูตัวเลขกันใหม่นะครับ สิ่งที่สำคัญที่สุดตอนนี้คือความสม่ำเสมอ");
  }

  return s.join(" ");
}

/**
 * system prompt (อังกฤษ — คำสั่งภาษาไทยกิน token ~4 เท่าโดยไม่ได้คุณภาพเพิ่ม)
 * ข้อห้ามเรียงตามความเสียหายจากมากไปน้อย: สร้างตัวเลขเอง > สัญญาผล > ศัพท์แพทย์ > ยาว
 */
export const REPORT_SYSTEM_PROMPT = [
  "You write a short monthly body-progress note for a Thai fitness app user.",
  "Write ONLY in Thai, 3-5 sentences, warm supportive coach tone, address the reader with ครับ.",
  "HARD RULES:",
  "1. Use ONLY numbers that appear in the DATA block. Never invent, round differently, extrapolate, or compute new numbers (no percentages, no rates, no projections).",
  "2. If a value is missing from DATA, do not mention that topic at all.",
  "3. Never promise future results or timelines. Never give medical, diagnostic, or supplement advice.",
  "4. Never blame the user. Numbers that did not move are normal; frame them as information, not failure.",
  "5. Mention the measurement source when DATA says a value is a camera estimate (ค่าประมาณ), so the reader knows its accuracy.",
  "6. No headings, no bullet points, no emoji spam (at most one emoji), no markdown.",
].join("\n");

/** DATA block — ตัวเลขล้วน ไม่มี path รูป ไม่มีข้อมูลระบุตัวตน */
export function buildReportUserPrompt(stats: BodyReportStats): string {
  const lines: string[] = [];
  lines.push(`period: ${stats.periodStart} to ${stats.periodEnd} (4 weeks)`);
  if (stats.weight) {
    lines.push(`weight_kg: start ${r1(stats.weight.startKg)}, end ${r1(stats.weight.endKg)}, change ${r1(stats.weight.deltaKg)}`);
  }
  if (stats.waist) {
    lines.push(
      `waist_cm (${stats.waist.source === "tape" ? "tape measure, accurate" : "camera estimate, ±2-3cm"}): start ${r1(stats.waist.startCm)}, end ${r1(stats.waist.endCm)}, change ${r1(stats.waist.deltaCm)}`
    );
  }
  if (stats.bf) {
    lines.push(
      `body_fat_percent_range (camera estimate): start ${r1(stats.bf.startLo)}-${r1(stats.bf.startHi)}, end ${r1(stats.bf.endLo)}-${r1(stats.bf.endHi)}`
    );
  }
  for (const l of stats.lifts) {
    lines.push(`estimated_1rm_kg [${l.name}]: start ${r1(l.startKg)}, end ${r1(l.endKg)}, change ${r1(l.deltaKg)}`);
  }
  lines.push(
    `counts_28d: body_scans ${stats.counts.scans}, weigh_days ${stats.counts.weighDays}, food_log_days ${stats.counts.foodLogDays}, workout_days ${stats.counts.workoutDays}`
  );
  if (stats.goal) {
    lines.push(
      `goal "${stats.goal.label}": percent_done ${stats.goal.pctDone}` +
        (stats.goal.onTrack ? `, status ${stats.goal.onTrack}` : "") +
        (stats.goal.weeksLeft !== null ? `, weeks_left ${stats.goal.weeksLeft}` : "")
    );
  }
  if (stats.score) {
    lines.push(`body_score: ${stats.score.score}/100 (consistency ${stats.score.consistency}/40, direction ${stats.score.direction}/40, data ${stats.score.data}/20)`);
  }
  for (const sig of stats.signals) {
    // ส่งข้อความไทยที่ตัดสินแล้วไปตรง ๆ ให้โมเดลเรียบเรียง ไม่ใช่ให้มันตีความสัญญาณเอง
    lines.push(`coach_note (already decided by the rule engine, reuse its meaning): ${sig.message}`);
  }
  return `DATA:\n${lines.join("\n")}`;
}

/** ตรวจย่อหน้าที่ LLM คืนมาก่อนเก็บ — ผิดกติกาข้อไหนก็ตาม = ทิ้ง ใช้ fallback แทน */
export function narrativeLooksSane(text: unknown, stats: BodyReportStats): boolean {
  const t = String(text ?? "").trim();
  if (t.length < 40 || t.length > 900) return false;
  if (!/[฀-๿]/.test(t)) return false; // ต้องเป็นภาษาไทย
  if (/[#*`]|\n\s*[-•]/.test(t)) return false; // markdown/bullet = ผิดรูปแบบที่จอรองรับ

  /* กันโมเดลแต่งตัวเลขเอง: ตัวเลขทุกตัวในย่อหน้าต้องมีใน DATA
     (ตัวเลข 1-2 หลักที่ ≤ 31 ปล่อยผ่าน — เป็นวันที่/จำนวนครั้ง/สัปดาห์ที่มาจากบริบทเดียวกัน) */
  const allowed = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return;
    allowed.add(String(r1(n)));
    allowed.add(String(Math.round(n)));
    allowed.add(String(r1(Math.abs(n))));
    allowed.add(String(Math.round(Math.abs(n))));
  };
  add(stats.weight?.startKg); add(stats.weight?.endKg); add(stats.weight?.deltaKg);
  add(stats.waist?.startCm); add(stats.waist?.endCm); add(stats.waist?.deltaCm);
  add(stats.bf?.startLo); add(stats.bf?.startHi); add(stats.bf?.endLo); add(stats.bf?.endHi); add(stats.bf?.deltaMid);
  for (const l of stats.lifts) { add(l.startKg); add(l.endKg); add(l.deltaKg); }
  add(stats.counts.scans); add(stats.counts.weighDays); add(stats.counts.foodLogDays); add(stats.counts.workoutDays);
  add(stats.goal?.pctDone); add(stats.goal?.weeksLeft ?? null);
  add(stats.score?.score); add(stats.score?.consistency); add(stats.score?.direction); add(stats.score?.data);
  for (const p of [stats.periodStart, stats.periodEnd]) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p);
    if (m) { allowed.add(String(Number(m[3]))); allowed.add(String(Number(m[2]))); allowed.add(m[1]); }
  }

  for (const raw of t.match(/\d+(?:\.\d+)?/g) ?? []) {
    const n = Number(raw);
    if (Number.isInteger(n) && n <= 31) continue;
    if (!allowed.has(String(r1(n)))) return false;
  }
  return true;
}
