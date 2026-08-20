/**
 * เทส engine progression (เฟส B) — รัน: npx tsx scripts/test-progression.ts
 *
 * ทำไมต้องมี: ตัวเลขจากไฟล์นี้คือ "น้ำหนักที่เราสั่งให้ลูกค้ายกสัปดาห์หน้า"
 * ถ้ากติกาเพี้ยน (เพิ่มน้ำหนักทั้งที่เมื่อวานบอกว่าหนักเกินไป · ข้ามขั้นบันไดทั้งที่ยังทำไม่ได้)
 * ผลไม่ใช่แค่ตัวเลขผิด แต่คือคนเจ็บ — กติกาทุกข้อใน WO-PT-B จึงต้องมีเทสถาวรคุมไว้
 *
 * ตรรกะล้วน ไม่แตะ DB (ฟังก์ชันชุดเดียวกับที่ API /api/coach/training-state และ planGenerator เรียกจริง)
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  epley,
  feelToRpe,
  feelIsOk,
  roundToIncrement,
  pickIncrementKg,
  deloadSets,
  judgeWeek,
  progressLoadable,
  progressBodyweight,
  progressReps,
  progressTimed,
  capWeeklyVolume,
  splitWeeks,
  deriveState,
  weekVolume,
  bestEffort,
  EMPTY_STATE,
  DEFAULT_INCREMENT_KG,
  WEEK_MS,
  type WeekSet,
  type WeekResult,
  type ProgressionStateLike,
  type LadderStep,
  type DatedSet,
} from "../src/lib/progression";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const week = (...sets: WeekSet[]): WeekResult => ({ sets });
const st = (o: Partial<ProgressionStateLike> = {}): ProgressionStateLike => ({ ...EMPTY_STATE, ...o });

/** บันไดวิดพื้น (ตัวอย่างเดียวกับ WO §4.3) */
const PUSHUP_LADDER: LadderStep[] = [
  { key: "pushup_wall", difficulty: 1, name: "วิดพื้นกำแพง" },
  { key: "pushup_incline", difficulty: 2, name: "วิดพื้นพื้นเอียง" },
  { key: "pushup_knee", difficulty: 3, name: "วิดพื้นเข่า" },
  { key: "pushup", difficulty: 4, name: "วิดพื้นเต็มตัว" },
  { key: "pushup_decline", difficulty: 5, name: "วิดพื้นเท้ายก" },
];

console.log("── ตัวเลขพื้นฐาน ──");

// 1. Epley
check("e1RM Epley 20 กก. × 10 ครั้ง = 26.7", epley(20, 10) === 26.7, `ได้ ${epley(20, 10)}`);
check("e1RM ค่าพัง (0 กก.) = 0 ไม่ใช่ NaN", epley(0, 10) === 0);

// 2. feel → RPE + กติกา "ไม่ตอบ ≠ ทำไม่ได้"
check(
  "feel → RPE ตรงตาราง",
  feelToRpe("easy") === 6 && feelToRpe("good") === 7 && feelToRpe("hard") === 8.5 && feelToRpe("too_hard") === 9.5
);
check("feel = null → ถือว่ายังไปต่อได้ (เงียบไม่ใช่ความผิด)", feelIsOk(null) && feelIsOk(undefined));
check("feel = too_hard → ไม่ใช่ 'ไปต่อได้'", !feelIsOk("too_hard") && !feelIsOk("hard"));

// 3. ปัดน้ำหนักตามก้าวจริงของอุปกรณ์
check("ปัดลงตามก้าว 2 กก.: 17.4 → 16", roundToIncrement(17.4, 2, "down") === 16, `ได้ ${roundToIncrement(17.4, 2, "down")}`);
check("ปัดใกล้สุดตามก้าว 2 กก.: 17.4 → 18", roundToIncrement(17.4, 2, "near") === 18);
check("ต่ำสุด = 1 ก้าวเสมอ (ไม่มีดัมเบล 0 กก.)", roundToIncrement(0.4, 2.5, "down") === 2.5);

// 4. ก้าวน้ำหนักจากคลังอุปกรณ์จริง
check("ไม่มีคลังอุปกรณ์ → 2.5 กก.", pickIncrementKg([], ["dumbbell"]) === DEFAULT_INCREMENT_KG);
check("ไม่เคยลงทะเบียนอุปกรณ์ (null) → 2.5 กก.", pickIncrementKg(null, []) === 2.5);
check(
  "ดัมเบลชุดก้าว 2 → ใช้ 2 ไม่ใช่ 2.5",
  pickIncrementKg([{ type: "dumbbell", incrementKg: 2 }], ["dumbbell"]) === 2
);
check(
  "ท่านี้ใช้บาร์เบล → เอาก้าวของบาร์เบล (1.25) ไม่ใช่ของดัมเบล",
  pickIncrementKg(
    [
      { type: "dumbbell", incrementKg: 2 },
      { type: "barbell", incrementKg: 1.25 },
    ],
    ["barbell"]
  ) === 1.25
);
check(
  "ไม่มีชิ้นที่ตรงกับท่า → ใช้ก้าวเล็กสุดที่มี (ปลอดภัยกว่ากระโดดไกล)",
  pickIncrementKg(
    [
      { type: "dumbbell", incrementKg: 2 },
      { type: "kettlebell", incrementKg: 4 },
    ],
    ["barbell"]
  ) === 2
);

// 5. สัปดาห์พักฟื้น: ตัดปริมาณ 40%
check("พักฟื้น 3 เซ็ต → 2", deloadSets(3) === 2, `ได้ ${deloadSets(3)}`);
check("พักฟื้น 5 เซ็ต → 3", deloadSets(5) === 3, `ได้ ${deloadSets(5)}`);
check("พักฟื้น 4 เซ็ต → 2 (ส่วนที่ตัดปัดขึ้น)", deloadSets(4) === 2, `ได้ ${deloadSets(4)}`);
check("พักฟื้นเหลืออย่างน้อย 1 เซ็ต", deloadSets(1) === 1 && deloadSets(2) === 1);

// 6. การตัดสินสัปดาห์
{
  const good = judgeWeek(week({ targetReps: 10, actualReps: 10, feel: "good" }, { targetReps: 10, actualReps: 10 }));
  check("ครบเป้าทุกเซ็ต + feel ≤ good → good", good.verdict === "good");
  const hard = judgeWeek(week({ targetReps: 10, actualReps: 10, feel: "hard" }));
  check("รู้สึก 'หนัก' (ยังไม่เกิน) → hold ไม่ใช่ good", hard.verdict === "hold");
  const miss1 = judgeWeek(week({ targetReps: 10, actualReps: 10 }, { targetReps: 10, actualReps: 8 }));
  check("พลาดเป้า 1 เซ็ต → hold", miss1.verdict === "hold");
  const miss2 = judgeWeek(week({ targetReps: 10, actualReps: 9 }, { targetReps: 10, actualReps: 8 }));
  check("พลาดเป้า 2 เซ็ต → poor", miss2.verdict === "poor");
  const th = judgeWeek(week({ targetReps: 10, actualReps: 10, feel: "too_hard" }));
  check("feel = too_hard แม้ทำครบ → poor", th.verdict === "poor");
  const noTarget = judgeWeek(week({ actualReps: 9 }, { actualReps: 7 }));
  check("ไม่เคยตั้งเป้า → ห้ามตัดสินว่าพลาดเป้า", noTarget.verdict === "good" && noTarget.missed === 0);
}

console.log("\n── ท่าที่ใส่น้ำหนักได้ (double progression) ──");

// 7. ครบทุกเซ็ต → เพิ่มครั้ง
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 18, feel: "good" },
      { targetReps: 10, actualReps: 10, actualWeightKg: 18, feel: "good" },
      { targetReps: 10, actualReps: 10, actualWeightKg: 18, feel: null }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 18, reps: 10, sets: 3 } }
  );
  check(
    "ครบ 10 ครั้งทุกเซ็ต → 11 ครั้ง น้ำหนักเท่าเดิม",
    r.next?.reps === 11 && r.next?.weightKg === 18 && r.next?.sets === 3,
    JSON.stringify(r.next)
  );
  check("มีเหตุผลภาษาไทยติดมาด้วยเสมอ", !!r.next?.reason && /ครั้ง/.test(r.next.reason), r.next?.reason);
  check("เก็บ e1RM ล่าสุดไว้ในสถานะ", r.state.e1rmKg === epley(18, 10), `ได้ ${r.state.e1rmKg}`);
}

// 8. แตะเพดานช่วงครั้ง → ขึ้นน้ำหนัก + ครั้งกลับพื้นช่วง
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 12, actualReps: 12, actualWeightKg: 18, feel: "good" },
      { targetReps: 12, actualReps: 12, actualWeightKg: 18, feel: "easy" },
      { targetReps: 12, actualReps: 12, actualWeightKg: 18, feel: "good" }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 18, reps: 12, sets: 3 } }
  );
  // 18 + 2.5 = 20.5 → ปัดเข้ากริดที่ยกได้จริงของก้าว 2.5 = 20 กก. (ต้องมากกว่าเดิมเสมอ)
  check(
    "ครบ 12 ครั้ง (เพดานช่วง) → ขึ้นน้ำหนัก + กลับไป 8 ครั้ง",
    r.next?.weightKg === 20 && r.next?.reps === 8,
    JSON.stringify(r.next)
  );
  check("น้ำหนักใหม่ต้องมากกว่าเดิมเสมอ", (r.next?.weightKg ?? 0) > 18);
}

// 9. ก้าวจริงของอุปกรณ์ (ดัมเบลชุด 2 กก.) — ห้ามสั่ง 17.5 ที่ยกไม่ได้
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 12, actualReps: 12, actualWeightKg: 16, feel: "good" },
      { targetReps: 12, actualReps: 12, actualWeightKg: 16, feel: "good" }
    ),
    { incrementKg: 2, currentRx: { weightKg: 16, reps: 12, sets: 2 } }
  );
  check("ดัมเบลก้าว 2 กก.: 16 → 18 (ไม่ใช่ 18.5)", r.next?.weightKg === 18, `ได้ ${r.next?.weightKg}`);
}

// 10. ไม่ได้ลงทะเบียนอุปกรณ์ → ใช้ก้าว 2.5
{
  const r = progressLoadable(
    st(),
    week({ targetReps: 12, actualReps: 12, actualWeightKg: 20, feel: "good" }),
    { currentRx: { weightKg: 20, reps: 12, sets: 3 } }
  );
  check("ไม่มีข้อมูลอุปกรณ์ → ก้าว 2.5: 20 → 22.5", r.next?.weightKg === 22.5, `ได้ ${r.next?.weightKg}`);
}

// 11. รู้สึกหนักเกิน → ลดน้ำหนัก
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: "good" },
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: "too_hard" }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 20, reps: 10, sets: 2 } }
  );
  // 20 × 0.925 = 18.5 → ปัดลงตามก้าว 2.5 = 17.5
  check("too_hard → ลดน้ำหนักเหลือ 17.5", r.next?.weightKg === 17.5, `ได้ ${r.next?.weightKg}`);
  check("ข้อความบอกเหตุผลว่าลดเพราะหนักเกิน", /หนักเกิน/.test(r.next?.reason ?? ""), r.next?.reason);
  check("นับเป็นสัปดาห์ที่ทำไม่ไหว (streak ติดลบ)", r.state.successStreak === -1);
}

// 12. พลาดเป้า ≥ 2 เซ็ต (ไม่ได้บอกว่าหนัก) → ลดน้ำหนักเช่นกัน
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 20 },
      { targetReps: 10, actualReps: 8, actualWeightKg: 20 },
      { targetReps: 10, actualReps: 7, actualWeightKg: 20 }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 20, reps: 10, sets: 3 } }
  );
  check("พลาดเป้า 2 เซ็ต → ลดน้ำหนัก", (r.next?.weightKg ?? 99) < 20, `ได้ ${r.next?.weightKg}`);
}

// 13. ลดน้ำหนักแล้วต้องลดจริง แม้ 7.5% จะไม่ถึง 1 ก้าว
{
  const r = progressLoadable(
    st(),
    week({ targetReps: 10, actualReps: 10, actualWeightKg: 10, feel: "too_hard" }),
    { incrementKg: 5, currentRx: { weightKg: 10, reps: 10, sets: 3 } }
  );
  check("ก้าว 5 กก. จาก 10 กก. → ต้องลดจริง (เหลือ 5)", r.next?.weightKg === 5, `ได้ ${r.next?.weightKg}`);
}

// 14. พลาด 1 เซ็ต → คงที่ (ไม่ขึ้น ไม่ลง) + เริ่มนับ stall
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 20 },
      { targetReps: 10, actualReps: 10, actualWeightKg: 20 },
      { targetReps: 10, actualReps: 8, actualWeightKg: 20 }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 20, reps: 10, sets: 3 } }
  );
  check(
    "พลาด 1 เซ็ต → คงที่ทั้งน้ำหนักและครั้ง",
    r.next?.weightKg === 20 && r.next?.reps === 10 && !r.next?.deload
  );
  check("เริ่มนับสัปดาห์ที่ไม่ขยับ", r.state.stallCount === 1, `ได้ ${r.state.stallCount}`);
}

// 15. feel = null ทุกเซ็ต + ครบเป้า → นับเป็น good (ไม่ตอบไม่ใช่โทษของ user)
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: null },
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: null }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 20, reps: 10, sets: 2 } }
  );
  check("ไม่กด feel เลย แต่ทำครบ → ยังได้ก้าวหน้า", r.next?.reps === 11, JSON.stringify(r.next));
}

// 16. รู้สึก "หนัก" (ยังไม่เกิน) → คงที่
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: "hard" },
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: "good" }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 20, reps: 10, sets: 2 } }
  );
  check("ครบเป้าแต่รู้สึกหนัก → คงที่ก่อน", r.next?.reps === 10 && r.next?.weightKg === 20, JSON.stringify(r.next));
}

// 17. นิ่ง 3 สัปดาห์ → สัปดาห์พักฟื้น
{
  const w = week(
    { targetReps: 10, actualReps: 10, actualWeightKg: 20 },
    { targetReps: 10, actualReps: 10, actualWeightKg: 20 },
    { targetReps: 10, actualReps: 8, actualWeightKg: 20 }
  );
  const r3 = progressLoadable(st({ stallCount: 3 }), w, {
    incrementKg: 2.5,
    currentRx: { weightKg: 20, reps: 10, sets: 3 },
  });
  check("นิ่งครบ 3 สัปดาห์ → deload + ตัดเหลือ 2 เซ็ต", r3.next?.deload === true && r3.next?.sets === 2, JSON.stringify(r3.next));
  check("หลังสั่งพักฟื้นแล้วเริ่มนับใหม่", r3.state.stallCount === 0);
  check("ข้อความพักฟื้นเป็นภาษาไทยและไม่โทษ user", /พักฟื้น/.test(r3.next?.reason ?? ""), r3.next?.reason);

  const r2 = progressLoadable(st({ stallCount: 2 }), w, {
    incrementKg: 2.5,
    currentRx: { weightKg: 20, reps: 10, sets: 3 },
  });
  check("นิ่ง 2 สัปดาห์ → ยังไม่ deload", !r2.next?.deload && r2.state.stallCount === 2);
}

// 18. 🔴 เคสจริงจาก E2E เฟส A: 12/10/8 + good/hard/too_hard → ห้ามเพิ่มน้ำหนักเด็ดขาด
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 12, actualReps: 12, actualWeightKg: 18, feel: "good" },
      { targetReps: 12, actualReps: 10, actualWeightKg: 18, feel: "hard" },
      { targetReps: 12, actualReps: 8, actualWeightKg: 18, feel: "too_hard" }
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 18, reps: 12, sets: 3 } }
  );
  check("E2E: 12/10/8 + too_hard → ห้ามเพิ่มน้ำหนัก", (r.next?.weightKg ?? 0) <= 18, `ได้ ${r.next?.weightKg}`);
  check("E2E: ต้องลดน้ำหนักลงจริง (15 กก.)", r.next?.weightKg === 15, `ได้ ${r.next?.weightKg}`);
  check("E2E: ห้ามเพิ่มจำนวนครั้งด้วย", (r.next?.reps ?? 0) <= 12);
}

// 19. ไม่ได้กรอกน้ำหนักเลย → เดินด้วยจำนวนครั้ง ห้ามเดาน้ำหนักให้
{
  const r = progressLoadable(
    st(),
    week({ targetReps: 10, actualReps: 10 }, { targetReps: 10, actualReps: 10 }),
    { incrementKg: 2.5, currentRx: { reps: 10, sets: 2 } }
  );
  check(
    "ไม่รู้น้ำหนัก → ไม่สั่งน้ำหนัก แต่เพิ่มครั้งให้",
    r.next?.weightKg === undefined && r.next?.reps === 11,
    JSON.stringify(r.next)
  );
  check("บอกเหตุผลว่ายังไม่ได้บันทึกน้ำหนัก", /ยังไม่ได้บันทึกน้ำหนัก/.test(r.next?.reason ?? ""));
}

// 20. ไม่มีข้อมูลเลย → null (ห้ามเดา)
{
  check("ไม่มีเซ็ตเลย → next = null", progressLoadable(st(), week()).next === null);
  check(
    "มีแต่เป้า ยังไม่ได้ทำ → next = null",
    progressLoadable(st(), week({ targetReps: 10, targetWeightKg: 20 })).next === null
  );
  check("ท่าตัวเปล่าไม่มีข้อมูล → null", progressBodyweight(st(), week(), { ladder: PUSHUP_LADDER }).next === null);
  check("ท่าจับเวลาไม่มีข้อมูล → null", progressTimed(st(), week()).next === null);
}

// 21. สัปดาห์ที่บันทึกไม่ครบ (ตั้งใจทำ 3 เซ็ต บันทึกจริง 2) → ตัดสินจากที่มี
{
  const r = progressLoadable(
    st(),
    week(
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: "good" },
      { targetReps: 10, actualReps: 10, actualWeightKg: 20, feel: "good" },
      { targetReps: 10, actualWeightKg: 20 } // เซ็ตที่ 3 ไม่ได้บันทึก
    ),
    { incrementKg: 2.5, currentRx: { weightKg: 20, reps: 10, sets: 3 } }
  );
  check(
    "บันทึกไม่ครบ → ตัดสินจากเซ็ตที่มี และคงจำนวนเซ็ตตามแผน",
    r.next?.reps === 11 && r.next?.sets === 3,
    JSON.stringify(r.next)
  );
}

console.log("\n── ท่าตัวเปล่า (บันไดความยาก) ──");

// 22. ถึง 15 ครั้งครั้งแรก → ยังไม่เลื่อนขั้น (ต้อง 2 สัปดาห์ติด)
{
  const r = progressBodyweight(
    st(),
    week({ targetReps: 12, actualReps: 15 }, { targetReps: 12, actualReps: 15 }, { targetReps: 12, actualReps: 15 }),
    { ladder: PUSHUP_LADDER, currentKey: "pushup_knee", currentRx: { reps: 12, sets: 3 } }
  );
  check("ทำ 15 ครั้งสัปดาห์แรก → ยังไม่เลื่อนขั้น", !r.next?.nextKey, JSON.stringify(r.next));
  check("บอกว่าอีก 1 สัปดาห์ได้เลื่อน", /อีก 1 สัปดาห์/.test(r.next?.reason ?? ""), r.next?.reason);
  check("นับ streak ไว้ 1", r.state.successStreak === 1);
}

// 23. ถึง 15 ครั้ง 2 สัปดาห์ติด → เลื่อนขั้น + ครั้งกลับไป 8
{
  const r = progressBodyweight(
    st({ successStreak: 2 }),
    week({ targetReps: 15, actualReps: 15 }, { targetReps: 15, actualReps: 16 }, { targetReps: 15, actualReps: 15 }),
    { ladder: PUSHUP_LADDER, currentKey: "pushup_knee", currentRx: { reps: 15, sets: 3 } }
  );
  check(
    "15 ครั้ง 2 สัปดาห์ติด → เลื่อนเป็นวิดพื้นเต็มตัว เริ่ม 8 ครั้ง",
    r.next?.nextKey === "pushup" && r.next?.reps === 8,
    JSON.stringify(r.next)
  );
  check("ตำแหน่งบันไดขยับขึ้น 1 ขั้น", r.state.ladderLevel === 3, `ได้ ${r.state.ladderLevel}`);
  check("ชื่อท่าถัดไปเป็นภาษาไทยในเหตุผล", /วิดพื้นเต็มตัว/.test(r.next?.reason ?? ""), r.next?.reason);
}

// 24. ทำไม่ถึง 8 ครั้งเกินครึ่ง 2 สัปดาห์ติด → ลดบันได
{
  const w = week({ targetReps: 10, actualReps: 6 }, { targetReps: 10, actualReps: 5 }, { targetReps: 10, actualReps: 7 });
  const first = progressBodyweight(st(), w, {
    ladder: PUSHUP_LADDER,
    currentKey: "pushup",
    currentRx: { reps: 10, sets: 3 },
  });
  check("ทำไม่ไหวสัปดาห์แรก → ยังไม่ลดบันได (ลดเป้าครั้งก่อน)", !first.next?.nextKey && first.next?.reps === 7, JSON.stringify(first.next));
  check("นับ streak ติดลบ", first.state.successStreak === -1);

  const second = progressBodyweight(st({ successStreak: -2 }), w, {
    ladder: PUSHUP_LADDER,
    currentKey: "pushup",
    currentRx: { reps: 10, sets: 3 },
  });
  check(
    "ทำไม่ไหว 2 สัปดาห์ติด → ถอยลงบันไดเป็นวิดพื้นเข่า",
    second.next?.nextKey === "pushup_knee" && second.next?.reps === 8,
    JSON.stringify(second.next)
  );
  check("ตำแหน่งบันไดลดลง 1 ขั้น", second.state.ladderLevel === 2, `ได้ ${second.state.ladderLevel}`);
}

// 25. อยู่ขั้นล่างสุดแล้ว → ลดต่อไม่ได้ ต้องไม่พังและไม่โทษ user
{
  const r = progressBodyweight(
    st({ successStreak: -3 }),
    week({ targetReps: 10, actualReps: 5 }, { targetReps: 10, actualReps: 4 }),
    { ladder: PUSHUP_LADDER, currentKey: "pushup_wall", currentRx: { reps: 10, sets: 2 } }
  );
  check("ขั้นล่างสุด → ไม่ลดบันไดต่อ แต่ลดเป้าครั้งให้", !r.next?.nextKey && r.next?.reps === 5, JSON.stringify(r.next));
  check("ข้อความไม่ตำหนิผู้ใช้", !/แย่|ล้มเหลว|ไม่ได้เรื่อง/.test(r.next?.reason ?? ""), r.next?.reason);
}

// 26. สุดบันไดแล้ว → ไต่ครั้งต่อได้ถึง 20
{
  const r = progressBodyweight(
    st({ successStreak: 5 }),
    week({ targetReps: 16, actualReps: 16 }, { targetReps: 16, actualReps: 16 }, { targetReps: 16, actualReps: 16 }),
    { ladder: PUSHUP_LADDER, currentKey: "pushup_decline", currentRx: { reps: 16, sets: 3 } }
  );
  check("สุดบันได + ครบเป้า → เพิ่มเป็น 17 ครั้ง", r.next?.reps === 17 && !r.next?.nextKey, JSON.stringify(r.next));
}

// 27. สุดบันได + แตะ 20 ครั้ง → เพิ่มเซ็ต (สูงสุด 5)
{
  const r = progressBodyweight(
    st(),
    week({ targetReps: 20, actualReps: 20 }, { targetReps: 20, actualReps: 20 }, { targetReps: 20, actualReps: 20 }),
    { ladder: PUSHUP_LADDER, currentKey: "pushup_decline", currentRx: { reps: 20, sets: 3 } }
  );
  check("20 ครั้งครบ → เพิ่มเป็น 4 เซ็ต เริ่มใหม่ที่ 8 ครั้ง", r.next?.sets === 4 && r.next?.reps === 8, JSON.stringify(r.next));

  const maxed = progressBodyweight(
    st(),
    week(
      { targetReps: 20, actualReps: 20 },
      { targetReps: 20, actualReps: 20 },
      { targetReps: 20, actualReps: 20 },
      { targetReps: 20, actualReps: 20 },
      { targetReps: 20, actualReps: 20 }
    ),
    { ladder: PUSHUP_LADDER, currentKey: "pushup_decline", currentRx: { reps: 20, sets: 5 } }
  );
  check("เต็มเพดาน 5 เซ็ต × 20 ครั้ง → คงไว้ ไม่เพิ่มต่อ", maxed.next?.sets === 5 && maxed.next?.reps === 20, JSON.stringify(maxed.next));
}

// 28. ท่าที่ไม่มีบันไดเลย (ไม่มี progressionGroup) → เดินด้วยครั้งในช่วง 8-15 แล้วค่อยเพิ่มเซ็ต
{
  const up = progressReps(st(), week({ targetReps: 12, actualReps: 12 }, { targetReps: 12, actualReps: 12 }), {
    currentRx: { reps: 12, sets: 2 },
  });
  check("ไม่มีบันได: ครบ 12 → 13 ครั้ง", up.next?.reps === 13 && up.next?.sets === 2, JSON.stringify(up.next));

  const addSet = progressReps(st(), week({ targetReps: 15, actualReps: 15 }, { targetReps: 15, actualReps: 15 }), {
    currentRx: { reps: 15, sets: 2 },
  });
  check("ไม่มีบันได: ครบ 15 (เพดานช่วง) → เพิ่มเซ็ตแล้วกลับไป 8 ครั้ง", addSet.next?.sets === 3 && addSet.next?.reps === 8, JSON.stringify(addSet.next));

  const capSets = progressReps(st(), week({ targetReps: 15, actualReps: 15 }), {
    currentRx: { reps: 15, sets: 5 },
  });
  check("ไม่มีบันได: เพดาน 5 เซ็ต → ไม่เพิ่มต่อ", capSets.next?.sets === 5, JSON.stringify(capSets.next));

  const down = progressReps(st(), week({ targetReps: 12, actualReps: 12, feel: "too_hard" }), {
    currentRx: { reps: 12, sets: 3 },
  });
  check("ไม่มีบันได: หนักเกิน → ลดครั้งลง", down.next?.reps === 10, JSON.stringify(down.next));
}

console.log("\n── ท่าจับเวลา ──");

// 29. ครบเป้า → +10% ปัด 5 วิ
{
  const r = progressTimed(st(), week({ targetSec: 60, actualSec: 60 }, { targetSec: 60, actualSec: 60 }), {
    currentSec: 60,
    currentRx: { sets: 2, seconds: 60 },
  });
  check("แพลงก์ 60 วิ ครบ → 70 วิ (ไม่เกินเพดาน +20%)", r.next?.seconds === 70, `ได้ ${r.next?.seconds}`);
  check("จำนวนเซ็ตเท่าเดิม", r.next?.sets === 2);
}

// 30. เพดาน +20% ต่อสัปดาห์
{
  const r = progressTimed(st(), week({ targetSec: 100, actualSec: 100 }), { currentSec: 100 });
  const pct = ((r.next?.seconds ?? 0) - 100) / 100;
  check("100 วิ → 110 วิ และไม่เกิน +20%", r.next?.seconds === 110 && pct <= 0.2, `ได้ ${r.next?.seconds}`);
  const small = progressTimed(st(), week({ targetSec: 20, actualSec: 20 }), { currentSec: 20 });
  // ก้าวเล็กสุดของนาฬิกาคือ 5 วิ — ถ้าคุม 20% เป๊ะ คนที่ทำได้ 20 วิจะขยับไม่ได้เลยตลอดไป
  check("แพลงก์ 20 วิ → 25 วิ (ก้าวเล็กสุด 5 วิ)", small.next?.seconds === 25, `ได้ ${small.next?.seconds}`);
}

// 31. หนักเกิน → ลด 10%
{
  const r = progressTimed(st(), week({ targetSec: 60, actualSec: 45, feel: "too_hard" }), { currentSec: 60 });
  check("จับเวลา too_hard → ลดเหลือ 55 วิ", r.next?.seconds === 55, `ได้ ${r.next?.seconds}`);
  check("ลดแล้วต้องน้อยกว่าเดิมจริง", (r.next?.seconds ?? 99) < 60);
}

// 32. ทำไม่ถึงเป้าหลายเซ็ต → ลด · ทำไม่ถึง 1 เซ็ต → คงที่ + นับ stall
{
  const poor = progressTimed(st(), week({ targetSec: 60, actualSec: 40 }, { targetSec: 60, actualSec: 35 }), {
    currentSec: 60,
  });
  check("จับเวลา: ไม่ถึงเป้า 2 เซ็ต → ลดเวลา", (poor.next?.seconds ?? 99) < 60, `ได้ ${poor.next?.seconds}`);

  const hold = progressTimed(st(), week({ targetSec: 60, actualSec: 60 }, { targetSec: 60, actualSec: 45 }), {
    currentSec: 60,
  });
  check("จับเวลา: ไม่ถึงเป้า 1 เซ็ต → คงที่ + นับ stall", hold.next?.seconds === 60 && hold.state.stallCount === 1);

  const deload = progressTimed(st({ stallCount: 3 }), week({ targetSec: 60, actualSec: 60 }, { targetSec: 60, actualSec: 60 }, { targetSec: 60, actualSec: 45 }), {
    currentSec: 60,
    currentRx: { sets: 3 },
  });
  check("จับเวลา: นิ่ง 3 สัปดาห์ → พักฟื้น ตัดเหลือ 2 เซ็ต", deload.next?.deload === true && deload.next?.sets === 2, JSON.stringify(deload.next));
}

console.log("\n── เพดานปริมาณต่อสัปดาห์ (+10%) ──");

// 33. ไม่มีฐานเทียบ → ไม่คุม
{
  const r = capWeeklyVolume(0, [{ sets: 3, reps: 12, weightKg: 20, reason: "x" }]);
  check("สัปดาห์แรก (ไม่มีฐานเทียบ) → ไม่คุม", !r.capped && r.rx[0].sets === 3);
}

// 34. อยู่ในเพดาน → ไม่แตะ
{
  const r = capWeeklyVolume(1000, [{ sets: 3, reps: 12, weightKg: 20, reason: "x" }]); // 720 ≤ 1100
  check("ปริมาณยังไม่ถึงเพดาน → ไม่แตะใบสั่ง", !r.capped && r.rx[0].sets === 3 && r.rx[0].reps === 12);
}

// 35. เกินเพดาน → ตัดเซ็ตจนอยู่ในเพดาน
{
  const r = capWeeklyVolume(500, [{ sets: 3, reps: 12, weightKg: 20, reason: "เพิ่มน้ำหนัก" }]); // 720 > 550
  check("เกิน +10% → ตัดเซ็ตลงจนอยู่ในเพดาน", r.capped && r.rx[0].sets === 2, JSON.stringify(r.rx[0]));
  check("ปริมาณหลังคุมต้องไม่เกินเพดาน", r.volume <= r.limit, `${r.volume} / ${r.limit}`);
  check("บอกใน reason ว่าถูกคุมปริมาณ", /คุมปริมาณ/.test(r.rx[0].reason));
}

// 36. ท่าตัวเปล่า (ไม่มีน้ำหนัก) ไม่เข้าเพดาน
{
  const r = capWeeklyVolume(100, [{ sets: 4, reps: 20, reason: "วิดพื้น" }]);
  check("ท่าตัวเปล่าไม่มีน้ำหนัก → ไม่ถูกคุมปริมาณ", !r.capped && r.rx[0].sets === 4);
}

// 37. หลายท่ารวมกัน → ตัดท่าที่กินปริมาณมากสุดก่อน
{
  const r = capWeeklyVolume(600, [
    { sets: 3, reps: 12, weightKg: 20, reason: "a" }, // 720
    { sets: 3, reps: 10, weightKg: 8, reason: "b" }, // 240
  ]);
  check("ตัดท่าที่ปริมาณมากสุดก่อน", r.capped && r.rx[0].sets < 3 && r.rx[1].sets === 3, JSON.stringify(r.rx));
}

console.log("\n── สรุปสถานะจากประวัติจริง (ที่ POST /api/coach/sets เรียก) ──");

const T0 = Date.UTC(2026, 7, 20, 12, 0, 0);
const dated = (at: number, o: Partial<WeekSet>): DatedSet => ({ ...o, at });

// 38. แบ่งสัปดาห์จากเซ็ตล่าสุด
{
  const weeks = splitWeeks([
    dated(T0, { actualReps: 10, actualWeightKg: 20 }),
    dated(T0 - WEEK_MS, { actualReps: 10, actualWeightKg: 20 }),
    dated(T0 - 2 * WEEK_MS, { actualReps: 10, actualWeightKg: 20 }),
  ]);
  check("แบ่งได้ 3 สัปดาห์ เรียงใหม่→เก่า", weeks.length === 3 && weeks[0].index === 0 && weeks[2].index === 2);
  check("ไม่มีข้อมูล → ไม่มีสัปดาห์", splitWeeks([]).length === 0);
}

// 39. นิ่ง 3 สัปดาห์ติด → stallCount = 3
{
  const holdWeek = (base: number): DatedSet[] => [
    dated(base, { targetReps: 10, actualReps: 10, actualWeightKg: 20 }),
    dated(base, { targetReps: 10, actualReps: 10, actualWeightKg: 20 }),
    dated(base, { targetReps: 10, actualReps: 8, actualWeightKg: 20 }),
  ];
  const weeks = splitWeeks([...holdWeek(T0), ...holdWeek(T0 - WEEK_MS), ...holdWeek(T0 - 2 * WEEK_MS)]);
  const s = deriveState(null, weeks, { mode: "loadable" });
  check("3 สัปดาห์ไม่ขยับ → stallCount = 3", s.stallCount === 3, `ได้ ${s.stallCount}`);
  check("streak = 0 เมื่อไม่ได้ทำครบ", s.successStreak === 0);
  check("เก็บน้ำหนัก/ครั้ง/เซ็ตล่าสุดไว้", s.lastWeightKg === 20 && s.lastReps === 10 && s.lastSets === 3, JSON.stringify(s));
}

// 40. ทำครบ 2 สัปดาห์ติดในโหมดบันได → successStreak = 2 (เกณฑ์ 15 ครั้ง ไม่ใช่ "ครบเป้า")
{
  const goodWeek = (base: number, reps: number): DatedSet[] => [
    dated(base, { targetReps: 12, actualReps: reps }),
    dated(base, { targetReps: 12, actualReps: reps }),
  ];
  const weeks = splitWeeks([...goodWeek(T0, 15), ...goodWeek(T0 - WEEK_MS, 16), ...goodWeek(T0 - 2 * WEEK_MS, 12)]);
  const s = deriveState(null, weeks, { mode: "ladder", ladderLevel: 2 });
  check("บันได: ถึง 15 ครั้ง 2 สัปดาห์ติด → streak = 2", s.successStreak === 2, `ได้ ${s.successStreak}`);
  check("จำตำแหน่งบันไดที่ส่งเข้ามา", s.ladderLevel === 2);

  // สัปดาห์ที่ 3 ทำ 12 ครั้ง (ครบเป้าแต่ไม่ถึงเกณฑ์บันได) ต้องไม่ถูกนับเป็น good
  const only12 = deriveState(null, splitWeeks(goodWeek(T0, 12)), { mode: "ladder" });
  check("บันได: ครบเป้า 12 แต่ไม่ถึง 15 → ไม่นับ streak", only12.successStreak === 0);
}

// 41. ทำไม่ไหวติดกัน → streak ติดลบ
{
  const badWeek = (base: number): DatedSet[] => [
    dated(base, { targetReps: 10, actualReps: 5 }),
    dated(base, { targetReps: 10, actualReps: 4 }),
  ];
  const s = deriveState(null, splitWeeks([...badWeek(T0), ...badWeek(T0 - WEEK_MS)]), { mode: "ladder" });
  check("บันได: ทำไม่ถึง 8 ครั้ง 2 สัปดาห์ติด → streak = -2", s.successStreak === -2, `ได้ ${s.successStreak}`);
}

// 42. e1RM เก่าต้องไม่ถูกล้างทิ้งเพราะสัปดาห์นี้ไม่ได้กรอกน้ำหนัก
{
  const prev = st({ e1rmKg: 30, lastWeightKg: 20 });
  const s = deriveState(prev, splitWeeks([dated(T0, { actualReps: 12 })]), { mode: "reps" });
  check("ไม่กรอกน้ำหนักสัปดาห์นี้ → e1RM เดิมยังอยู่", s.e1rmKg === 30, `ได้ ${s.e1rmKg}`);
  check("ไม่มีข้อมูลใหม่เลย → คืนค่าเดิม", deriveState(prev, [], { mode: "reps" }).e1rmKg === 30);
}

// 43. เครื่องมือคิดปริมาณ/เซ็ตที่ดีที่สุด
{
  const sets: WeekSet[] = [
    { actualReps: 10, actualWeightKg: 20 },
    { actualReps: 8, actualWeightKg: 22.5 },
    { actualReps: 12 }, // ไม่มีน้ำหนัก
  ];
  check("ปริมาณรวม = Σ kg×ครั้ง (เซ็ตไม่มีน้ำหนักไม่นับ)", weekVolume(sets) === 380, `ได้ ${weekVolume(sets)}`);
  check("เซ็ตที่ดีที่สุด = e1RM สูงสุด", bestEffort(sets).weightKg === 22.5, JSON.stringify(bestEffort(sets)));
}

// 44. กติกาบ้าน: ไฟล์ engine ต้องไม่แตะ DB
{
  try {
    const src = readFileSync(join(process.cwd(), "src/lib/progression.ts"), "utf8");
    // ตัดคอมเมนต์ออกก่อน — ในคอมเมนต์เขียนถึงชื่อฟังก์ชันต้องห้ามได้ (นี่คือกฎของไฟล์ ไม่ใช่โค้ดที่รัน)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    check("engine ไม่ import prisma (คณิตล้วน เทสได้ทุกกติกา)", !/@\/lib\/prisma|from "prisma/.test(code));
    check("engine ไม่เรียกเวลาปัจจุบัน (ผลลัพธ์ต้องซ้ำได้เสมอ)", !/new Date\(/.test(code) && !/Date\.now\(/.test(code));
  } catch {
    console.log("… ข้ามการตรวจไฟล์ (รันจากนอกโฟลเดอร์โปรเจกต์)");
  }
}

console.log(
  failed === 0 ? `\n✅ ผ่านทั้งหมด ${total} เคส` : `\n❌ ไม่ผ่าน ${failed}/${total} เคส`
);
process.exit(failed === 0 ? 0 : 1);
