/**
 * เทสสมองของ Body BP-3 (WO-BP-3 §B7) — รัน: npx tsx scripts/test-body-goal.ts
 *
 * ครอบ 5 เอนจิน pure: bodyGoal · bodyScore · bodySignals · bodyPlanHints · bodyReport (ย่อหน้าสำรอง + ด่านตรวจ LLM)
 *
 * ทำไมเทสชุดนี้สำคัญกว่าที่เห็น:
 *   ตัวเลขจากไฟล์พวกนี้ไปโผล่เป็น "อีก 12 สัปดาห์ถึงเป้า" · "คุณตามแผนอยู่" · "Body Score 82"
 *   ซึ่ง user จะเชื่อและใช้ตัดสินใจกับร่างกายตัวเองจริง ๆ ทุกสัปดาห์
 *   คำตอบที่ผิดแบบดูสมเหตุผลจับได้ยากกว่าพังโต้ง ๆ มาก → ทุกเคสในไฟล์นี้คำนวณมือไว้ในคอมเมนต์
 *
 * 🔴 เคสที่ห้ามหาย: "ยังไม่มีข้อมูล" ต้องตอบ null/ข้าม ไม่ใช่เดาแทนลูกค้า
 *    และ "ขยับน้อยกว่าพื้นสัญญาณรบกวน" ต้องได้ flat ไม่ใช่ behind
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  GOAL_FLOOR_WEIGHT_KG,
  MAX_TARGET_WEEKS,
  RATE_BF_PCT,
  RATE_WAIST_CM,
  RATE_WEIGHT_KG_FAST,
  RATE_WEIGHT_KG_SLOW,
  goalProgress,
  milestones,
  suggestWeeks,
  validateGoal,
  type GoalForProgress,
} from "../src/lib/bodyGoal";
import { computeBodyScore, DIRECTION_NO_GOAL } from "../src/lib/bodyScore";
import { computeBodySignals, hasSignal, type BodySignal, type BodySignalInput } from "../src/lib/bodySignals";
import { applyBodyHints, bodyHintsFromSignals, isUnilateral, MOBILITY_MINUTES } from "../src/lib/bodyPlanHints";
import {
  buildReportUserPrompt,
  fallbackNarrative,
  narrativeLooksSane,
  thaiDay,
  type BodyReportStats,
} from "../src/lib/bodyReport";
import { EXERCISE_CATALOG, catalogFor } from "../src/lib/exerciseCatalog";
import type { Estimate } from "../src/lib/bodyMeasure";
import type { DayPlan } from "../src/lib/planGenerator";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const est = (mid: number, half = 2, conf: Estimate["conf"] = "high"): Estimate => ({
  lo: mid - half,
  mid,
  hi: mid + half,
  conf,
  method: "2view",
});

// ────────────────────────────────────────────────────────────────
console.log("\n── 1. suggestWeeks: อัตราปลอดภัยและตัวที่ไกลสุด ──");
{
  // ลด 6 กก. ÷ 0.75 = 8 สัปดาห์พอดี
  const a = suggestWeeks({ weightKg: 80 }, { weightKg: 74 });
  check("น้ำหนัก 80→74 = 8 สัปดาห์", a?.weeks === 8, `ได้ ${a?.weeks}`);
  check("limitedBy = weight", a?.limitedBy === "weight");
  check("อัตราที่ใช้หาร = 0.75 กก./สัปดาห์", a?.perGoal[0].ratePerWeek === RATE_WEIGHT_KG_FAST);
  check("weeksSlow (0.5 กก./สัปดาห์) = 12", a?.weeksSlow === 12, `ได้ ${a?.weeksSlow}`);
  check("direction = down", a?.perGoal[0].direction === "down");

  // 5 กก. ÷ 0.75 = 6.67 → ปัดขึ้น 7
  check("ปัดขึ้นเสมอ (5 กก. = 7 สัปดาห์)", suggestWeeks({ weightKg: 80 }, { weightKg: 75 })?.weeks === 7);

  // เอว 10 ซม. ÷ 0.5 = 20 สัปดาห์ · น้ำหนัก 3 กก. ÷ 0.75 = 4 → เอวเป็นตัวคุม
  const b = suggestWeeks({ weightKg: 80, waistCm: 95 }, { weightKg: 77, waistCm: 85 });
  check("เป้าที่ไกลสุดเป็นตัวกำหนด (เอว 20 สัปดาห์)", b?.weeks === 20, `ได้ ${b?.weeks}`);
  check("limitedBy = waist", b?.limitedBy === "waist");
  check("perGoal มีครบ 2 เป้า", b?.perGoal.length === 2);
  check("อัตราเอว = 0.5 ซม./สัปดาห์", b?.perGoal.find((g) => g.key === "waist")?.ratePerWeek === RATE_WAIST_CM);

  // BF 25 → 20 = 5 จุด ÷ 0.5 = 10 สัปดาห์
  const c = suggestWeeks({ bfMid: 25 }, { bfMid: 20 });
  check("ไขมัน 5 จุด = 10 สัปดาห์", c?.weeks === 10, `ได้ ${c?.weeks}`);
  check("อัตราไขมัน = 0.5 จุด/สัปดาห์", c?.perGoal[0].ratePerWeek === RATE_BF_PCT);

  check("ไม่ได้ตั้งเป้าอะไรเลย = null", suggestWeeks({ weightKg: 80 }, {}) === null);
  check("ตั้งเป้าแต่ไม่มีค่าปัจจุบัน = null (ห้ามเดา)", suggestWeeks({}, { weightKg: 74 }) === null);
  check(
    "มีเป้า 2 อย่างแต่ขาดค่าปัจจุบัน 1 อย่าง = null",
    suggestWeeks({ weightKg: 80 }, { weightKg: 74, waistCm: 85 }) === null
  );

  const zero = suggestWeeks({ weightKg: 74 }, { weightKg: 74 });
  check("เป้าเท่าปัจจุบัน = 0 สัปดาห์", zero?.weeks === 0);
  check("เป้าเท่าปัจจุบัน direction = none", zero?.perGoal[0].direction === "none");

  const up = suggestWeeks({ weightKg: 60 }, { weightKg: 63 });
  check("เป้าเพิ่มน้ำหนักคิดเวลาได้เหมือนกัน (3÷0.75=4)", up?.weeks === 4, `ได้ ${up?.weeks}`);
  check("direction = up", up?.perGoal[0].direction === "up");

  // เสมอกัน: น้ำหนัก 3 กก. (4 สัปดาห์) vs เอว 2 ซม. (4 สัปดาห์) → น้ำหนักชนะตามลำดับความสำคัญ
  const tie = suggestWeeks({ weightKg: 80, waistCm: 90 }, { weightKg: 77, waistCm: 88 });
  check("เสมอกัน → limitedBy = weight", tie?.limitedBy === "weight", `ได้ ${tie?.limitedBy}`);
  check("อัตราช้าสุดของน้ำหนักคงที่ 0.5", RATE_WEIGHT_KG_SLOW === 0.5);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 2. validateGoal ──");
{
  const none = validateGoal({}, { weightKg: 80 });
  check("ไม่ตั้งเป้าอะไรเลย = ok:false", none.ok === false);
  check("เหตุผลเป็นไทยและชวนให้เลือกเป้า", /อย่างน้อย 1 อย่าง/.test(none.reasons[0]));

  check("เป้าน้ำหนักเพี้ยน (5 กก.) = ok:false", validateGoal({ targetWeightKg: 5 }, { weightKg: 80 }).ok === false);
  check("เป้าเอว 20 ซม. = ok:false", validateGoal({ targetWaistCm: 20 }, { waistCm: 90 }).ok === false);
  check("เป้าเอว 300 ซม. = ok:false", validateGoal({ targetWaistCm: 300 }, { waistCm: 90 }).ok === false);
  check("เป้าไขมัน 70% = ok:false", validateGoal({ targetBfLo: 70, targetBfHi: 75 }, { bfMid: 25 }).ok === false);
  check(
    "ช่วงไขมันสลับกัน = ok:false",
    validateGoal({ targetBfLo: 22, targetBfHi: 18 }, { bfMid: 25 }).ok === false
  );
  check(
    `สัปดาห์เกิน ${MAX_TARGET_WEEKS} = ok:false`,
    validateGoal({ targetWeightKg: 74, targetWeeks: MAX_TARGET_WEEKS + 1 }, { weightKg: 80 }).ok === false
  );
  check(
    "สัปดาห์ 0 = ok:false",
    validateGoal({ targetWeightKg: 74, targetWeeks: 0 }, { weightKg: 80 }).ok === false
  );

  // 80→74 ขั้นต่ำ 8 สัปดาห์ · ขอ 4 → ต้องถูกดันขึ้น
  const fast = validateGoal({ targetWeightKg: 74, targetWeeks: 4 }, { weightKg: 80 });
  check("ขอเร็วเกินไป = ok:true (ไม่ปฏิเสธ)", fast.ok === true);
  check("fixed.targetWeeks ถูกดันเป็นขั้นต่ำ 8", fast.fixed?.targetWeeks === 8, `ได้ ${fast.fixed?.targetWeeks}`);
  check("minWeeks = 8", fast.minWeeks === 8);
  check("เหตุผลบอกเหตุผลความปลอดภัยเป็นไทย", fast.reasons.some((r) => /ไม่ปลอดภัย/.test(r)));
  check("เหตุผลบอกเลขสัปดาห์ที่ขยับให้", fast.reasons.some((r) => /8 สัปดาห์/.test(r)));

  const okWeeks = validateGoal({ targetWeightKg: 74, targetWeeks: 12 }, { weightKg: 80 });
  check("ขอ 12 สัปดาห์ (ช้ากว่าขั้นต่ำ) = ไม่แก้", okWeeks.fixed === undefined);
  check("ยังคืน minWeeks ให้จอใช้อธิบาย", okWeeks.minWeeks === 8);

  const noWeeks = validateGoal({ targetWaistCm: 85 }, { waistCm: 90 });
  check("ไม่กรอกสัปดาห์ = ระบบตั้งให้ (10 สัปดาห์)", noWeeks.fixed?.targetWeeks === 10, `ได้ ${noWeeks.fixed?.targetWeeks}`);

  const gain = validateGoal({ targetWeightKg: 85 }, { weightKg: 80 });
  check("เป้าหนักกว่าปัจจุบัน = ยอมรับได้", gain.ok === true);
  check("ติดธง gain", gain.flags.includes("gain"));
  check("ข้อความ gain ไม่ตำหนิ user", gain.reasons.some((r) => /ตั้งใจเพิ่ม/.test(r)));

  const noCurrent = validateGoal({ targetWeightKg: 74, targetWeeks: 2 }, {});
  check("ไม่มีค่าปัจจุบัน = ok:true แต่ minWeeks null", noCurrent.ok === true && noCurrent.minWeeks === null);
  check("ไม่มีค่าปัจจุบัน = ไม่ดันสัปดาห์มั่ว", noCurrent.fixed === undefined);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 3. goalProgress: ahead / on / behind / flat ──");
{
  // start 80 → target 74 (รวม 6 กก.) ใน 8 สัปดาห์ · ผ่านไป 4 สัปดาห์ = ควรเดินมาแล้ว 3 กก.
  const goal: GoalForProgress = { targetWeightKg: 74, targetWeeks: 8, start: { weightKg: 80 } };
  const at = (nowKg: number, weeks = 4) => goalProgress(goal, { weightKg: nowKg }, weeks).perGoal[0];

  check("now 77 (ตรงเส้น) = on", at(77).onTrack === "on", at(77).onTrack);
  check("now 76 (เกินเส้น 1 กก. > floor 0.5) = ahead", at(76).onTrack === "ahead", at(76).onTrack);
  check("now 79 (ช้ากว่าเส้น 2 กก.) = behind", at(79).onTrack === "behind", at(79).onTrack);
  check("now 79.8 (ขยับ 0.2 < floor 0.5) = flat ไม่ใช่ behind", at(79.8).onTrack === "flat", at(79.8).onTrack);
  check("สัปดาห์ที่ 1 ขยับ 0.3 กก. = flat (สองสัปดาห์แรกเป็นแบบนี้ปกติ)", at(79.7, 1).onTrack === "flat");
  check("floor น้ำหนัก = 0.5 กก.", GOAL_FLOOR_WEIGHT_KG === 0.5);

  check("pctDone 77 = 50%", at(77).pctDone === 50, `ได้ ${at(77).pctDone}`);
  check("expectedByNow ที่ 4 สัปดาห์ = 77", at(77).expectedByNow === 77, `ได้ ${at(77).expectedByNow}`);
  check("moved = 3", at(77).moved === 3);
  check("remaining = 3", at(77).remaining === 3);
  check("source = scale (น้ำหนักมาจากเครื่องชั่ง)", at(77).source === "scale");
  check("ถอยหลัง (81 กก.) pctDone ไม่ติดลบ", at(81).pctDone === 0, `ได้ ${at(81).pctDone}`);
  check("เกินเป้า (73 กก.) pctDone ตัดที่ 100", at(73).pctDone === 100);

  const overall = goalProgress(goal, { weightKg: 77 }, 4).overall;
  check("overall.weeksElapsed = 4", overall.weeksElapsed === 4);
  check("overall.weeksLeft = 4", overall.weeksLeft === 4);
  check("overall.onTrack = on", overall.onTrack === "on");
  const past = goalProgress(goal, { weightKg: 77 }, 20).overall;
  check("เลยกำหนดแล้ว weeksLeft = 0 (ไม่ติดลบ)", past.weeksLeft === 0);
}

console.log("\n── 4. goalProgress: เอวใช้สายวัดก่อนค่าประมาณ + เป้าที่ข้อมูลไม่ครบ ──");
{
  const goal: GoalForProgress = {
    targetWaistCm: 80,
    targetWeeks: 20,
    start: { waistCm: 90 },
  };
  const withTape = goalProgress(goal, { waist: est(86), tapeWaistCm: 88 }, 10).perGoal[0];
  check("มีสายวัด → ใช้ 88 ไม่ใช่ 86", withTape.now === 88, `ได้ ${withTape.now}`);
  check("source = tape", withTape.source === "tape");
  const noTape = goalProgress(goal, { waist: est(86) }, 10).perGoal[0];
  check("ไม่มีสายวัด → ใช้ค่าประมาณ 86", noTape.now === 86);
  check("source = estimate", noTape.source === "estimate");
  check("floor เอว 1 ซม.: ขยับ 0.5 ซม. = flat", goalProgress(goal, { waist: est(89.5) }, 10).perGoal[0].onTrack === "flat");

  const partial = goalProgress(
    { targetWeightKg: 74, targetWaistCm: 80, targetWeeks: 10, start: { weightKg: 80 } },
    { weightKg: 78, waist: est(86) },
    5
  );
  check("เป้าเอวไม่มีค่าตั้งต้น = ถูกข้าม (เหลือ 1 เป้า)", partial.perGoal.length === 1, `ได้ ${partial.perGoal.length}`);
  check("เป้าที่เหลือคือน้ำหนัก", partial.perGoal[0].key === "weight");

  const noNow = goalProgress({ targetWeightKg: 74, targetWeeks: 8, start: { weightKg: 80 } }, {}, 4);
  check("ไม่มีค่าปัจจุบัน = ไม่มี perGoal เลย", noNow.perGoal.length === 0);
  check("ไม่มี perGoal → overall.onTrack = null", noNow.overall.onTrack === null);

  // ไขมัน: start 28 → เป้า 18-22 (mid 20) · ตอนนี้ 25
  const bf = goalProgress(
    { targetBfLo: 18, targetBfHi: 22, targetWeeks: 16, start: { bfMid: 28 } },
    { bfPct: est(25) },
    8
  ).perGoal[0];
  check("เป้าไขมันใช้กึ่งกลางช่วง (20)", bf.target === 20, `ได้ ${bf.target}`);
  check("ไขมัน moved = 3", bf.moved === 3);
  check("floor ไขมัน 1.5: ขยับ 3 จุด ผ่าน floor", bf.onTrack !== "flat");

  // ไม่กำหนดเวลา → ตัดสินแค่ทิศทาง
  const noWeeks: GoalForProgress = { targetWeightKg: 74, targetWeeks: null, start: { weightKg: 80 } };
  check("ไม่มี targetWeeks: เดินเข้าหาเป้า = on", goalProgress(noWeeks, { weightKg: 79 }, 3).perGoal[0].onTrack === "on");
  check("ไม่มี targetWeeks: เดินถอยหลัง = behind", goalProgress(noWeeks, { weightKg: 81 }, 3).perGoal[0].onTrack === "behind");
  check("ไม่มี targetWeeks: ขยับต่ำกว่า floor = flat", goalProgress(noWeeks, { weightKg: 79.8 }, 3).perGoal[0].onTrack === "flat");
  check("ไม่มี targetWeeks: expectedByNow = null", goalProgress(noWeeks, { weightKg: 79 }, 3).perGoal[0].expectedByNow === null);
  check("ไม่มี targetWeeks: weeksLeft = null", goalProgress(noWeeks, { weightKg: 79 }, 3).overall.weeksLeft === null);

  // overall = ตัวที่ตามหลังที่สุด
  const mixed = goalProgress(
    { targetWeightKg: 74, targetWaistCm: 80, targetWeeks: 8, start: { weightKg: 80, waistCm: 90 } },
    { weightKg: 76, waist: est(89.9) },
    4
  );
  check("overall เอาตัวที่แย่ที่สุด (weight ahead + waist flat = flat)", mixed.overall.onTrack === "flat", String(mixed.overall.onTrack));
  // น้ำหนัก 80→76 จาก 6 กก. = 67% · เอว 90→89.9 จาก 10 ซม. = 1% → เฉลี่ย 34%
  check("overall.pctDone = เฉลี่ยของทุกเป้า (34)", mixed.overall.pctDone === 34, `ได้ ${mixed.overall.pctDone}`);
}

console.log("\n── 5. milestones ──");
{
  const mk = (pct: number) => milestones([{ key: "waist", start: 90, now: 85, target: 80, source: "tape", pctDone: pct, expectedByNow: null, onTrack: "on", moved: 5, remaining: 5 }]);
  check("50% = ผ่านครึ่งทาง", mk(50)[0] === "ผ่านครึ่งทางเป้าเอวแล้ว", mk(50)[0]);
  check("100% = ถึงเป้า", /ถึงเป้าเอวแล้ว/.test(mk(100)[0]));
  check("80% = 3 ใน 4", /3 ใน 4/.test(mk(80)[0]));
  check("30% = 1 ใน 4", /1 ใน 4/.test(mk(30)[0]));
  check("10% = ยังไม่มีหมุด", mk(10).length === 0);
  check("เป้าละ 1 ข้อความเท่านั้น", mk(100).length === 1);
  check("ไม่มีเป้า = ไม่มีหมุด", milestones([]).length === 0);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 6. computeBodyScore ──");
{
  const weekly = ["2026-08-20", "2026-08-13", "2026-08-06", "2026-07-30"];
  const full = computeBodyScore({
    scanDates: weekly,
    last28d: { weighDays: 16, scanCount: 4 },
    hasHeight: true,
    hasTapeCalib: true,
    hasDeviceLink: true,
    goalOnTrack: ["on", "ahead"],
    asOf: "2026-08-20",
  });
  check("ครบทุกอย่าง = 100", full?.score === 100, `ได้ ${full?.score}`);
  check("consistency เต็ม 40", full?.parts.consistency === 40);
  check("direction เต็ม 40", full?.parts.direction === 40);
  check("data เต็ม 20", full?.parts.data === 20);
  check("explain มีครบทุกส่วน + บรรทัดรวม", (full?.explain.length ?? 0) >= 4);
  check("explain บอกวิธีคิดของ consistency", /สแกน 4\/4 สัปดาห์/.test(full?.explain[0] ?? ""));
  check("explain บรรทัดสุดท้ายบวกเลขให้ดู", /รวม 100\/100 = 40 \+ 40 \+ 20/.test(full?.explain[3] ?? ""));

  const halfWeigh = computeBodyScore({
    scanDates: weekly,
    last28d: { weighDays: 8, scanCount: 4 },
    hasHeight: true, hasTapeCalib: true, hasDeviceLink: true,
    goalOnTrack: ["on"], asOf: "2026-08-20",
  });
  check("ชั่ง 8/16 วัน = consistency 34", halfWeigh?.parts.consistency === 34, `ได้ ${halfWeigh?.parts.consistency}`);

  const twoWeeks = computeBodyScore({
    scanDates: ["2026-08-20", "2026-08-13"],
    last28d: { weighDays: 16, scanCount: 2 },
    hasHeight: true, hasTapeCalib: true, hasDeviceLink: true,
    goalOnTrack: ["on"], asOf: "2026-08-20",
  });
  check("สแกน 2/4 สัปดาห์ = 14+12 = 26", twoWeeks?.parts.consistency === 26, `ได้ ${twoWeeks?.parts.consistency}`);

  const sameWeek = computeBodyScore({
    scanDates: ["2026-08-20", "2026-08-19", "2026-08-18"],
    last28d: { weighDays: 0, scanCount: 3 },
    hasHeight: false, hasTapeCalib: false, hasDeviceLink: false,
    goalOnTrack: null, asOf: "2026-08-20",
  });
  check("สแกน 3 ครั้งในสัปดาห์เดียว = นับ 1 สัปดาห์ (7 แต้ม)", sameWeek?.parts.consistency === 7, `ได้ ${sameWeek?.parts.consistency}`);

  const stale = computeBodyScore({
    scanDates: ["2026-06-01"],
    last28d: { weighDays: 0, scanCount: 0 },
    hasHeight: true, hasTapeCalib: false, hasDeviceLink: false,
    goalOnTrack: null, asOf: "2026-08-20",
  });
  check("สแกนเก่ากว่า 28 วัน = ไม่นับ", stale?.parts.consistency === 0);

  const noGoal = computeBodyScore({
    scanDates: weekly,
    last28d: { weighDays: 16, scanCount: 4 },
    hasHeight: true, hasTapeCalib: true, hasDeviceLink: true,
    goalOnTrack: null, asOf: "2026-08-20",
  });
  check(`ไม่มีเป้า = direction ${DIRECTION_NO_GOAL} คงที่`, noGoal?.parts.direction === DIRECTION_NO_GOAL);
  check("ไม่มีเป้า = explain ชวนให้ตั้งเป้า", /ตั้งเป้าเพื่อให้คะแนนส่วนนี้ทำงาน/.test(noGoal?.explain[1] ?? ""));
  check("ไม่มีเป้า = คะแนนรวม 80", noGoal?.score === 80, `ได้ ${noGoal?.score}`);
  check(
    "เป้าว่าง (array ว่าง) = เหมือนไม่มีเป้า",
    computeBodyScore({
      scanDates: weekly, last28d: { weighDays: 16, scanCount: 4 },
      hasHeight: true, hasTapeCalib: true, hasDeviceLink: true,
      goalOnTrack: [], asOf: "2026-08-20",
    })?.parts.direction === DIRECTION_NO_GOAL
  );

  const flatGoals = computeBodyScore({
    scanDates: weekly, last28d: { weighDays: 16, scanCount: 4 },
    hasHeight: true, hasTapeCalib: true, hasDeviceLink: true,
    goalOnTrack: ["flat", "flat"], asOf: "2026-08-20",
  });
  check("flat ทั้งหมด = ครึ่งแต้ม (20)", flatGoals?.parts.direction === 20, `ได้ ${flatGoals?.parts.direction}`);
  check("explain อธิบายว่าทำไม flat ถึงได้ครึ่งแต้ม", /เล็กกว่าที่เครื่องมือวัดแยกออก/.test(flatGoals?.explain[1] ?? ""));

  const behind = computeBodyScore({
    scanDates: weekly, last28d: { weighDays: 16, scanCount: 4 },
    hasHeight: true, hasTapeCalib: true, hasDeviceLink: true,
    goalOnTrack: ["behind", "behind"], asOf: "2026-08-20",
  });
  check("behind ทั้งหมด = 0 แต้มในส่วนทิศทาง", behind?.parts.direction === 0);
  check("behind ยังได้คะแนนส่วนอื่นเต็ม (พฤติกรรมดี)", behind?.score === 60, `ได้ ${behind?.score}`);

  const dataOnly = computeBodyScore({
    scanDates: [], last28d: { weighDays: 0, scanCount: 0 },
    hasHeight: true, hasTapeCalib: false, hasDeviceLink: false,
    goalOnTrack: null, asOf: "2026-08-20",
  });
  check("มีแค่ส่วนสูง = 0 + 20 + 5 = 25", dataOnly?.score === 25, `ได้ ${dataOnly?.score}`);
  check("สายวัด = 10 แต้ม", (computeBodyScore({
    scanDates: [], last28d: { weighDays: 0, scanCount: 0 },
    hasHeight: false, hasTapeCalib: true, hasDeviceLink: false, goalOnTrack: null,
  })?.parts.data) === 10);

  check(
    "ไม่มีข้อมูลอะไรเลย = null (ไม่ใช่ 0)",
    computeBodyScore({
      scanDates: [], last28d: { weighDays: 0, scanCount: 0 },
      hasHeight: false, hasTapeCalib: false, hasDeviceLink: false, goalOnTrack: null,
    }) === null
  );
  check("ไม่ส่ง asOf = อ้างวันสแกนล่าสุดเอง", (computeBodyScore({
    scanDates: weekly, last28d: { weighDays: 16, scanCount: 4 },
    hasHeight: true, hasTapeCalib: true, hasDeviceLink: true, goalOnTrack: ["on"],
  })?.parts.consistency) === 40);
  check("คะแนนไม่เกิน 100 ในทุกกรณี", (full?.score ?? 0) <= 100);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 7. computeBodySignals: ตาราง §7 ทีละแถว ──");
{
  const base: BodySignalInput = {
    waistTrend4w: null,
    e1rmTrend4w: null,
    weightRatePctPerWk: null,
    inDeficit: null,
    thighDiffCm: null,
    calfDiffCm: null,
    diffConfHigh2x: false,
    postureFlag2x: { headForward: false, shoulderTilt: false },
  };
  const keys = (s: BodySignal[]) => s.map((x) => x.key).join(",");

  check("ไม่มีข้อมูลเลย = ไม่มีสัญญาณ", computeBodySignals(base).length === 0);

  // แถว 1
  const recompUp = computeBodySignals({ ...base, waistTrend4w: "down", e1rmTrend4w: "up" });
  check("เอว↓ + แรง↑ = recomp_working", keys(recompUp) === "recomp_working");
  check("action = keep_program", recompUp[0].action === "keep_program");
  check("ข้อความตรงตามตาราง WO", recompUp[0].message === "ที่ทำอยู่ได้ผล — เอวลดโดยแรงไม่ตก อย่าเพิ่งเปลี่ยนอะไร");
  check("เอว↓ + แรงคงที่ = recomp_working เหมือนกัน", hasSignal(computeBodySignals({ ...base, waistTrend4w: "down", e1rmTrend4w: "flat" }), "recomp_working"));
  check("เอว↓ + แรง↓ = ไม่เข้าแถว 1", !hasSignal(computeBodySignals({ ...base, waistTrend4w: "down", e1rmTrend4w: "down" }), "recomp_working"));
  check("เอว↓ + ไม่รู้แรง = ข้ามเงียบ ๆ", computeBodySignals({ ...base, waistTrend4w: "down" }).length === 0);

  // แถว 2
  const tooFast = computeBodySignals({ ...base, weightRatePctPerWk: -1.4, e1rmTrend4w: "down" });
  check("ลง 1.4%/สัปดาห์ + แรงตก = losing_too_fast", keys(tooFast) === "losing_too_fast");
  check("action = energy_up_volume_down", tooFast[0].action === "energy_up_volume_down");
  check("ข้อความสั่งเพิ่มแคลอรี่", /เพิ่มแคลอรี่/.test(tooFast[0].message));
  check("ข้อความสั่งลดปริมาณ 1 ระดับ", /ลดปริมาณเวทลง 1 ระดับ/.test(tooFast[0].message));
  check("ข้อความเตือนโปรตีน", /โปรตีน/.test(tooFast[0].message));
  check("เลขในข้อความอ้างกลับได้ที่ detail", tooFast[0].detail?.weightRatePctPerWk === -1.4);
  check("ข้อความไม่โทษ user", !/คุณผิด|เพราะคุณ/.test(tooFast[0].message));
  check("ลงพอดี -1.0% = เข้าเกณฑ์ (ขอบเขต ≤ -1)", hasSignal(computeBodySignals({ ...base, weightRatePctPerWk: -1, e1rmTrend4w: "down" }), "losing_too_fast"));
  check("ลง 0.9% = ยังไม่เข้าเกณฑ์", !hasSignal(computeBodySignals({ ...base, weightRatePctPerWk: -0.9, e1rmTrend4w: "down" }), "losing_too_fast"));
  check("ลงเร็วแต่แรงไม่ตก = ไม่เข้าแถว 2", !hasSignal(computeBodySignals({ ...base, weightRatePctPerWk: -2, e1rmTrend4w: "up" }), "losing_too_fast"));
  check("ลงเร็วแต่ไม่รู้แรง = ข้าม", !hasSignal(computeBodySignals({ ...base, weightRatePctPerWk: -2 }), "losing_too_fast"));

  // แถว 3
  const adherence = computeBodySignals({ ...base, waistTrend4w: "flat", inDeficit: true });
  check("เอวคงที่ + deficit = check_adherence", keys(adherence) === "check_adherence");
  check("action = ask_adherence", adherence[0].action === "ask_adherence");
  check("ข้อความชวนดูบันทึกอาหารก่อนปรับแผน", /บันทึกอาหาร/.test(adherence[0].message) && /ยังไม่ต้องเปลี่ยนแผน/.test(adherence[0].message));
  check("เอวคงที่ + ไม่รู้ว่า deficit = ข้าม", computeBodySignals({ ...base, waistTrend4w: "flat" }).length === 0);
  check("เอวคงที่ + ไม่ deficit = ข้าม", computeBodySignals({ ...base, waistTrend4w: "flat", inDeficit: false }).length === 0);

  // แถว 4
  const imb = computeBodySignals({ ...base, thighDiffCm: 2.1, diffConfHigh2x: true });
  check("ต้นขาต่าง 2.1 ซม. + conf สูง 2 ครั้ง = imbalance", keys(imb) === "imbalance");
  check("action = unilateral_hint", imb[0].action === "unilateral_hint");
  check("ข้อความบอกว่าจะใส่ท่าทีละข้าง", /ทีละข้าง/.test(imb[0].message));
  check("detail เก็บตัวเลขที่ใช้ตัดสิน", imb[0].detail?.thighDiffCm === 2.1);
  check("ต่าง 1.5 พอดี = ยังไม่เข้าเกณฑ์ (ต้อง > 1.5)", !hasSignal(computeBodySignals({ ...base, thighDiffCm: 1.5, diffConfHigh2x: true }), "imbalance"));
  check("ต่างมากแต่ conf ไม่สูง 2 ครั้ง = ข้าม", !hasSignal(computeBodySignals({ ...base, thighDiffCm: 3, diffConfHigh2x: false }), "imbalance"));
  check("น่องต่าง 2 ซม. ก็เข้าเกณฑ์", hasSignal(computeBodySignals({ ...base, calfDiffCm: 2, diffConfHigh2x: true }), "imbalance"));
  check("ค่าติดลบ (ขวาใหญ่กว่าซ้าย) ก็นับ", hasSignal(computeBodySignals({ ...base, thighDiffCm: -2.4, diffConfHigh2x: true }), "imbalance"));
  check("ไม่มีค่าความต่าง = ข้าม", !hasSignal(computeBodySignals({ ...base, diffConfHigh2x: true }), "imbalance"));

  // แถว 5
  const posture = computeBodySignals({ ...base, postureFlag2x: { headForward: true, shoulderTilt: false } });
  check("head forward 2 สแกน = posture_note", keys(posture) === "posture_note");
  check("action = mobility_hint", posture[0].action === "mobility_hint");
  check("มีป้ายกำกับว่าไม่ใช่การวินิจฉัย", /ไม่ใช่การวินิจฉัย/.test(posture[0].note ?? ""));
  check("ข้อความบอกว่าไม่บังคับ", /ไม่ทำก็ไม่ผิด/.test(posture[0].message));
  check("ไหล่เอียงอย่างเดียวก็ติด", hasSignal(computeBodySignals({ ...base, postureFlag2x: { headForward: false, shoulderTilt: true } }), "posture_note"));
  check("ทั้งสองอย่าง = ข้อความรวมทั้งสอง", /ศีรษะยื่นไปหน้าและไหล่/.test(computeBodySignals({ ...base, postureFlag2x: { headForward: true, shoulderTilt: true } })[0].message));
  check("ไม่มี flag = ไม่มีสัญญาณ", !hasSignal(computeBodySignals(base), "posture_note"));

  // หลายแถวพร้อมกัน + ลำดับคงที่
  const many = computeBodySignals({
    waistTrend4w: "flat",
    e1rmTrend4w: "down",
    weightRatePctPerWk: -1.6,
    inDeficit: true,
    thighDiffCm: 2,
    calfDiffCm: 0.2,
    diffConfHigh2x: true,
    postureFlag2x: { headForward: true, shoulderTilt: false },
  });
  check("ติดพร้อมกัน 4 แถว", many.length === 4, keys(many));
  check("ลำดับตามตาราง §7 เสมอ", keys(many) === "losing_too_fast,check_adherence,imbalance,posture_note");
  check("ทุกข้อความเป็นภาษาไทย", many.every((s) => /[฀-๿]/.test(s.message)));
  check("ทุกสัญญาณมี key+action ครบ", many.every((s) => !!s.key && !!s.action));
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 8. bodyPlanHints: สัญญาณ → ท่าในแผนจริง ──");
{
  const pool = catalogFor("home");
  const strengthDay = (): DayPlan => ({
    exercisePlan: {
      title: "วันกำลัง",
      durationMin: 30,
      caloriesTarget: 200,
      items: [
        { key: "squat_bw", name: "สควอทน้ำหนักตัว", sets: 3, reps: 12 },
        { key: "pushup", name: "วิดพื้น", sets: 3, reps: 10 },
      ],
    },
    mealPlan: { meals: [], totalKcal: 0 },
  });
  const restDay = (): DayPlan => ({
    exercisePlan: { title: "พัก", durationMin: 0, caloriesTarget: 0, items: [] },
    mealPlan: { meals: [], totalKcal: 0 },
  });
  const week = () => [strengthDay(), restDay(), strengthDay()];

  const hints = bodyHintsFromSignals(computeBodySignals({
    waistTrend4w: null, e1rmTrend4w: null, weightRatePctPerWk: null, inDeficit: null,
    thighDiffCm: 2, calfDiffCm: null, diffConfHigh2x: true,
    postureFlag2x: { headForward: false, shoulderTilt: false },
  }));
  check("imbalance → hint unilateral", hints.unilateral === true);
  check("ไม่มีสัญญาณอื่น → hint อื่นปิดหมด", !hints.mobility && !hints.keepProgram && !hints.volumeDown);
  check("ไม่มีสัญญาณเลย → ทุก hint ปิด", Object.values(bodyHintsFromSignals([])).every((v) => v === false));
  check("null ก็ต้องไม่พัง", Object.values(bodyHintsFromSignals(null)).every((v) => v === false));

  const uni = applyBodyHints(week(), { unilateral: true, mobility: false, keepProgram: false, volumeDown: false }, pool);
  const allItems = uni.days.flatMap((d) => d.exercisePlan.items);
  check("เพิ่มท่าฝึกทีละข้าง 1 ท่า", allItems.filter((i) => isUnilateral(i)).length === 1);
  check("ท่าที่เลือกมาจากคลังจริง", allItems.some((i) => EXERCISE_CATALOG.some((e) => e.key === i.key && isUnilateral(e))));
  check("ท่าใหม่มีคำอธิบายให้ทำข้างละเท่ากัน", allItems.find((i) => isUnilateral(i))?.note?.includes("ทีละข้าง") === true);
  check("ไม่ไปโผล่ในวันพัก", uni.days[1].exercisePlan.items.length === 0);
  check("applied บันทึกสิ่งที่ทำจริง", uni.applied.some((a) => a.startsWith("unilateral:")));

  const already = applyBodyHints(
    [{ ...strengthDay(), exercisePlan: { ...strengthDay().exercisePlan, items: [{ key: "lunge", name: "ลันจ์", sets: 3, reps: 10 }] } }],
    { unilateral: true, mobility: false, keepProgram: false, volumeDown: false },
    pool
  );
  check("มีท่าทีละข้างอยู่แล้ว = ไม่เพิ่มซ้ำ", already.days[0].exercisePlan.items.length === 1);
  check("applied บอกว่ามีอยู่แล้ว", already.applied.includes("unilateral:already"));

  const mob = applyBodyHints(week(), { unilateral: false, mobility: true, keepProgram: false, volumeDown: false }, pool);
  check("ต่อยืดเหยียดท้ายวันเทรนทุกวัน (2 วัน)", mob.applied.filter((a) => a.startsWith("mobility@")).length === 2);
  check("ยืดเหยียด 5 นาที", mob.days[0].exercisePlan.items.at(-1)?.minutes === MOBILITY_MINUTES);
  check("ติดป้ายว่าไม่บังคับ", /ไม่บังคับ/.test(mob.days[0].exercisePlan.items.at(-1)?.note ?? ""));
  check("เวลารวมของวันเพิ่มตามจริง", mob.days[0].exercisePlan.durationMin === 35);
  check("วันพักไม่ถูกแตะ", mob.days[1].exercisePlan.items.length === 0);
  const mobTwice = applyBodyHints(mob.days, { unilateral: false, mobility: true, keepProgram: false, volumeDown: false }, pool);
  check("รันซ้ำไม่เพิ่มยืดเหยียดซ้อน", mobTwice.days[0].exercisePlan.items.length === mob.days[0].exercisePlan.items.length);

  const vol = applyBodyHints(week(), { unilateral: false, mobility: false, keepProgram: false, volumeDown: true }, pool);
  check("ลด 1 เซ็ตในท่าที่มีเซ็ต", vol.days[0].exercisePlan.items[0].sets === 2);
  check("บอกเหตุผลในโน้ตของท่า", /ฟื้นตัว/.test(vol.days[0].exercisePlan.items[0].note ?? ""));
  const vol2 = applyBodyHints(vol.days, { unilateral: false, mobility: false, keepProgram: false, volumeDown: true }, pool);
  check("ไม่ลดต่ำกว่า 2 เซ็ต (รันซ้ำก็ไม่ลด)", vol2.days[0].exercisePlan.items[0].sets === 2);

  const keep = applyBodyHints(week(), { unilateral: false, mobility: false, keepProgram: true, volumeDown: false }, pool);
  check("keepProgram = ไม่แตะแผน (no-op)", JSON.stringify(keep.days) === JSON.stringify(week()));

  const src = week();
  applyBodyHints(src, { unilateral: true, mobility: true, keepProgram: false, volumeDown: true }, pool);
  check("ไม่แก้ของเดิมในที่ (คืนก้อนใหม่เสมอ)", JSON.stringify(src) === JSON.stringify(week()));
  check("แผนว่างทั้งสัปดาห์ = ไม่พัง", applyBodyHints([restDay()], { unilateral: true, mobility: true, keepProgram: false, volumeDown: true }, pool).days.length === 1);
  check("isUnilateral รู้จักลันจ์", isUnilateral({ key: "lunge", name: "ลันจ์" }));
  check("isUnilateral ไม่เหมาเอาสควอทธรรมดา", !isUnilateral({ key: "squat_bw", name: "สควอทน้ำหนักตัว" }));
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 9. รายงาน: ย่อหน้าสำรอง (ทางที่ต้องใช้เมื่อ AI ล่ม) ──");
{
  const stats: BodyReportStats = {
    periodStart: "2026-07-24",
    periodEnd: "2026-08-20",
    weight: { startKg: 82.4, endKg: 80.9, deltaKg: -1.5 },
    waist: { startCm: 92.5, endCm: 90.2, deltaCm: -2.3, source: "tape" },
    bf: { startLo: 24.5, startHi: 28.5, endLo: 23, endHi: 27, deltaMid: -1.5 },
    lifts: [{ exerciseKey: "db_squat", name: "ดัมเบลสควอท", startKg: 45.5, endKg: 48.2, deltaKg: 2.7 }],
    counts: { scans: 4, workoutDays: 12, foodLogDays: 22, weighDays: 18 },
    signals: [],
    goal: { label: "ซัมเมอร์ 2026", pctDone: 45, onTrack: "on", weeksLeft: 6 },
    score: { score: 78, consistency: 34, direction: 30, data: 14 },
  };

  const text = fallbackNarrative(stats);
  check("ย่อหน้าสำรองเป็นภาษาไทย", /[฀-๿]/.test(text));
  check("บอกช่วงเวลาแบบไทย", text.includes("24 ก.ค.") && text.includes("20 ส.ค."));
  check("มีน้ำหนักต้น-ปลาย", text.includes("82.4") && text.includes("80.9"));
  check("บอกทิศทางเป็นคำ ไม่ใช่เครื่องหมายลบ", /ลดลง 1.5 กก./.test(text));
  check("บอกที่มาของค่าเอว (สายวัด)", /จากสายวัด/.test(text));
  check("ไขมันขึ้นเป็นช่วง ไม่ใช่จุดเดียว", /24.5-28.5%/.test(text));
  check("มีสรุปความสม่ำเสมอ", /สแกน 4 ครั้ง/.test(text) && /บันทึกอาหาร 22 วัน/.test(text));
  check("มีความคืบหน้าของเป้า", /45%/.test(text) && /ซัมเมอร์ 2026/.test(text));
  check("ไม่มี undefined/NaN หลุด", !/undefined|NaN|null/.test(text));
  check("ผลนิ่ง: ข้อมูลเดิม = ข้อความเดิมเป๊ะ", fallbackNarrative(stats) === text);
  check("ไม่สัญญาผลลัพธ์ล่วงหน้า", !/รับรอง|การันตี|จะลดได้อีก/.test(text));

  const bare: BodyReportStats = {
    periodStart: "2026-07-24", periodEnd: "2026-08-20",
    weight: null, waist: null, bf: null, lifts: [],
    counts: { scans: 2, workoutDays: 0, foodLogDays: 0, weighDays: 0 },
    signals: [], goal: null, score: null,
  };
  const bareText = fallbackNarrative(bare);
  check("ข้อมูลน้อยมากก็ยังออกรายงานได้", bareText.length > 40);
  check("ไม่พูดถึงค่าที่ไม่มี", !/น้ำหนัก \d+(\.\d+)? →/.test(bareText) && !/เอว \d/.test(bareText) && !/ไขมัน/.test(bareText));
  check("ปิดท้ายด้วยกำลังใจเมื่อไม่มีสัญญาณ", /ความสม่ำเสมอ/.test(bareText));

  const withSignal = fallbackNarrative({ ...bare, signals: [{ key: "recomp_working", message: "ที่ทำอยู่ได้ผล — เอวลดโดยแรงไม่ตก อย่าเพิ่งเปลี่ยนอะไร" }] });
  check("มีสัญญาณ = เอาข้อความของ engine มาใช้ตรง ๆ", /ที่ทำอยู่ได้ผล/.test(withSignal));
  check("thaiDay รูปแบบผิด = ไม่ throw", thaiDay("ไม่ใช่วันที่") === "ไม่ใช่วันที่");

  const prompt = buildReportUserPrompt(stats);
  check("DATA block มีแต่ตัวเลข ไม่มี path รูป", !/uploads|\.jpg|private\//.test(prompt));
  check("DATA block ติดป้ายว่าเอวมาจากสายวัด", /tape measure/.test(prompt));
  check("DATA block ส่ง body score ไปด้วย", /body_score: 78\/100/.test(prompt));
}

console.log("\n── 10. ด่านตรวจย่อหน้าที่ LLM เขียน ──");
{
  const stats: BodyReportStats = {
    periodStart: "2026-07-24", periodEnd: "2026-08-20",
    weight: { startKg: 82.4, endKg: 80.9, deltaKg: -1.5 },
    waist: null, bf: null, lifts: [],
    counts: { scans: 4, workoutDays: 12, foodLogDays: 22, weighDays: 18 },
    signals: [], goal: null, score: null,
  };
  const good = "เดือนนี้น้ำหนักขยับจาก 82.4 กก. มาที่ 80.9 กก. ครับ ถือว่าเป็นจังหวะที่กำลังดี สแกนครบ 4 ครั้งและบันทึกอาหารได้ 22 วัน ทำแบบนี้ต่ออีกรอบแล้วเรามาดูตัวเลขกันใหม่นะครับ";
  check("ย่อหน้าที่ใช้เฉพาะเลขในตาราง = ผ่าน", narrativeLooksSane(good, stats));
  check("แต่งตัวเลขใหม่ (89.7 กก.) = ไม่ผ่าน", !narrativeLooksSane(good.replace("80.9", "89.7"), stats));
  check("แต่งเปอร์เซ็นต์ที่ไม่ได้ให้ = ไม่ผ่าน", !narrativeLooksSane(`${good} คิดเป็น 1.8% ของน้ำหนักตัว`, stats));
  check("สั้นเกินไป = ไม่ผ่าน", !narrativeLooksSane("ดีมากครับ", stats));
  check("ยาวเกินไป = ไม่ผ่าน", !narrativeLooksSane(good.repeat(10), stats));
  check("ตอบเป็นอังกฤษ = ไม่ผ่าน", !narrativeLooksSane("Great job this month, your weight went from 82.4 to 80.9 kg and you stayed consistent.", stats));
  check("มี markdown = ไม่ผ่าน", !narrativeLooksSane(`**สรุป** ${good}`, stats));
  check("มี bullet = ไม่ผ่าน", !narrativeLooksSane(`${good}\n- น้ำหนัก 82.4`, stats));
  check("ค่าว่าง/undefined = ไม่ผ่าน", !narrativeLooksSane(undefined, stats));
  check("เลขจำนวนวัน (≤31) ที่ไม่ได้อยู่ในตารางยังยอมได้", narrativeLooksSane(`${good} อีก 7 วันเจอกันครับ`, stats));
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 11. ความบริสุทธิ์ของเอนจิน (ต้องเทสได้โดยไม่มี DB/เวลา/AI) ──");
{
  const pure = ["bodyGoal.ts", "bodyScore.ts", "bodySignals.ts", "bodyReport.ts", "bodyPlanHints.ts"];
  for (const f of pure) {
    // ตัดคอมเมนต์ออกก่อน — หัวไฟล์เขียนกติกาไว้ว่า "ห้าม new Date()" ซึ่งจะไปตรงกับ regex ของตัวเอง
    const code = readFileSync(join(process.cwd(), "src/lib", f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    check(`${f}: ไม่ import prisma`, !/@\/lib\/prisma/.test(code));
    check(`${f}: ไม่เรียกเวลาปัจจุบัน`, !/new Date\(\)|Date\.now\(/.test(code));
    check(`${f}: ไม่ยิงเน็ต`, !/\bfetch\(|openai/i.test(code));
  }
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ผ่าน ${total - failed}/${total} เคส`);
process.exit(failed === 0 ? 0 : 1);
