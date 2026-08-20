/**
 * เทส engine readiness (เฟส C) — รัน: npx tsx scripts/test-readiness.ts
 *
 * ทำไมต้องมี: คะแนนจากไฟล์นี้ไป "ตัดเซ็ตของแผนวันนี้" จริง ๆ
 * ถ้าสูตรเพี้ยน ผลไม่ใช่แค่ตัวเลขผิด แต่คือคนที่ตั้งใจมาเล่นถูกสั่งให้พัก (หรือแย่กว่า: คนที่ควรพักถูกสั่งให้ลุยเต็ม)
 * ข้อที่พลาดง่ายที่สุดคือ "ไม่มี Watch" — ถ้า re-normalize พัง คนไม่มีอุปกรณ์จะได้คะแนนต่ำตลอดชีวิต
 *
 * ตรรกะล้วน ไม่แตะ DB (ฟังก์ชันชุดเดียวกับที่ /api/coach/readiness[/apply|/undo] เรียกจริง)
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  computeReadiness,
  bandOf,
  zToPart,
  hrvPart,
  rhrPart,
  sleepPart,
  energyPart,
  sorenessPart,
  suggestionFor,
  adjustPlanForReadiness,
  cutSetsFor,
  normalizeSoreArea,
  patternsForSoreAreas,
  soreAreaLabel,
  recoveryDayItems,
  SORE_AREA_PATTERNS,
  RECOVERY_DAY_NOTE,
  type ReadinessPlanItem,
  type PatternOf,
} from "../src/lib/readiness";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("── ส่วนประกอบของสูตร (§4.1) ──");

// 1. z → 0-1 และการ clamp ที่ ±2
check("z = 0 → 0.5 (เท่าค่าปกติของตัวเอง)", zToPart(0) === 0.5);
check("z = +1 → 0.75 · z = −1 → 0.25", zToPart(1) === 0.75 && zToPart(-1) === 0.25);
check("z = +2 → 1 (ขอบบน)", zToPart(2) === 1);
check("z = −2 → 0 (ขอบล่าง)", zToPart(-2) === 0);
check("z ทะลุขอบ (+8 / −8) ถูก clamp ไม่หลุด 0-1", zToPart(8) === 1 && zToPart(-8) === 0);

// 2. HRV — สูงกว่าค่าปกติ = ฟื้นตัวดี
check("HRV สูงกว่า baseline 1 sd → 0.75", hrvPart({ today7dAvg: 60, base28dAvg: 55, sd28d: 5 }) === 0.75);
check(
  "HRV ต่ำกว่า baseline มาก ๆ → 0 (clamp ที่ −2 sd)",
  hrvPart({ today7dAvg: 10, base28dAvg: 55, sd28d: 5 }) === 0
);
check("ไม่มี Watch (undefined) → ไม่มีส่วนนี้ (null ไม่ใช่ 0)", hrvPart(undefined) === null && hrvPart(null) === null);
check(
  "sd = 0 (ค่านิ่งผิดธรรมชาติ/อุปกรณ์ค้าง) → ตัดส่วนนี้ทิ้ง",
  hrvPart({ today7dAvg: 60, base28dAvg: 55, sd28d: 0 }) === null
);
check("sd ติดลบ/ค่าพัง → ตัดส่วนนี้ทิ้ง", hrvPart({ today7dAvg: 60, base28dAvg: 55, sd28d: -3 }) === null);

// 3. RHR — กลับด้าน (ต่ำกว่าปกติ = ดี)
check("RHR ต่ำกว่า baseline 1 sd → 0.75 (ดีกว่า)", rhrPart({ today: 50, base28dAvg: 55, sd28d: 5 }) === 0.75);
check("RHR สูงกว่า baseline 1 sd → 0.25 (แย่กว่า)", rhrPart({ today: 60, base28dAvg: 55, sd28d: 5 }) === 0.25);
check(
  "RHR: ต่ำกว่าต้องได้คะแนนมากกว่าสูงกว่าเสมอ (กันสูตรกลับด้านผิด)",
  (rhrPart({ today: 48, base28dAvg: 55, sd28d: 5 }) ?? 0) > (rhrPart({ today: 62, base28dAvg: 55, sd28d: 5 }) ?? 1)
);

// 4. การนอน — เพดาน 1.15 เท่าของเป้า
check("นอนครบเป้า 480 นาที → 1/1.15 = 0.8696", sleepPart({ minutes: 480, goalMinutes: 480 }) === 0.8696);
check("นอนเกินเป้า 600 นาที → เพดาน 1.15 → 1", sleepPart({ minutes: 600, goalMinutes: 480 }) === 1);
check("นอนเกินเป้าพอดี 1.15 เท่า (552 นาที) → 1", sleepPart({ minutes: 552, goalMinutes: 480 }) === 1);
check("นอน 6 ชม. จากเป้า 8 → 0.6522", sleepPart({ minutes: 360, goalMinutes: 480 }) === 0.6522);
check("ไม่ได้นอนเลย → 0 (ไม่ใช่ null)", sleepPart({ minutes: 0 }) === 0);
check("ไม่มีข้อมูลการนอน → ตัดส่วนนี้ทิ้ง", sleepPart(null) === null && sleepPart(undefined) === null);
check("ไม่ได้ตั้งเป้านอน → ใช้ 480 นาทีเป็นปริยาย", sleepPart({ minutes: 480 }) === 0.8696);

// 5. คำถาม 2 ข้อ
check("พลังงาน 1 → 0 · 3 → 0.5 · 5 → 1", energyPart(1) === 0 && energyPart(3) === 0.5 && energyPart(5) === 1);
check("ปวดกล้ามเนื้อ 1 (ไม่ปวด) → 1 · 5 (ปวดมาก) → 0", sorenessPart(1) === 1 && sorenessPart(5) === 0);
check("ไม่ตอบ = ตัดส่วนนั้นทิ้ง ไม่ใช่ให้ 0", energyPart(null) === null && sorenessPart(undefined) === null);

// 6. เกณฑ์แบ่งช่วง (ขอบต้องเป๊ะ — ต่างกัน 1 คะแนน = แผนคนละแบบ)
check("75 = full · 74 = normal", bandOf(75) === "full" && bandOf(74) === "normal");
check("55 = normal · 54 = reduced", bandOf(55) === "normal" && bandOf(54) === "reduced");
check("40 = reduced · 39 = recovery", bandOf(40) === "reduced" && bandOf(39) === "recovery");

console.log("\n── คะแนนรวม (re-normalize เมื่อข้อมูลไม่ครบ) ──");

// 7. ข้อมูลครบทุกส่วน → full
{
  const r = computeReadiness({
    hrv: { today7dAvg: 60, base28dAvg: 55, sd28d: 5 },
    rhr: { today: 52, base28dAvg: 55, sd28d: 3 },
    sleep: { minutes: 480, goalMinutes: 480 },
    energy: 5,
    soreness: 1,
  });
  check("ครบทุกส่วน + สภาพดี → 87 (full)", r.score === 87 && r.band === "full", JSON.stringify(r));
  check("น้ำหนักที่ใช้ = 100 เมื่อข้อมูลครบ", r.usedWeight === 100 && r.missing.length === 0);
  check("คืนค่าที่ใช้จริงต่อส่วนครบ 5 ตัว", Object.keys(r.parts).length === 5, JSON.stringify(r.parts));
}

// 8. 🔴 ไม่มี Watch เลย (ตอบครบ + นอนครบ) → ต้องได้ full ห้ามโดนกดคะแนน
{
  const r = computeReadiness({ sleep: { minutes: 480 }, energy: 5, soreness: 1 });
  check("ไม่มี Watch แต่ตอบครบ + นอนเต็ม → 95 (full)", r.score === 95 && r.band === "full", JSON.stringify(r));
  check("น้ำหนักที่ใช้เหลือ 60 (ตัด HRV 25 + RHR 15 ออก)", r.usedWeight === 60);
  check("บอกได้ว่าส่วนไหนหายไป", r.missing.join(",") === "hrv,rhr", r.missing.join(","));
  check("ส่วนที่ไม่มีข้อมูลต้องไม่โผล่ใน parts (ไม่ใช่ 0)", r.parts.hrv === undefined && r.parts.rhr === undefined);
}

// 9. ไม่มีการนอน (ถอดนาฬิกานอน) → คิดจากคำถาม 2 ข้อ
{
  const r = computeReadiness({ energy: 5, soreness: 1 });
  check("ตอบ 2 ข้อดีทั้งคู่ ไม่มีนอน/Watch → 100", r.score === 100 && r.band === "full", JSON.stringify(r));
  check("น้ำหนักที่ใช้ = 35 (energy 15 + soreness 20)", r.usedWeight === 35);
}

// 10. ตอบแค่ข้อเดียว
{
  const r = computeReadiness({ energy: 4 });
  check("ตอบแค่พลังงาน 4 → 75 พอดี = full", r.score === 75 && r.band === "full", JSON.stringify(r));
  const low = computeReadiness({ energy: 1 });
  check("ตอบแค่พลังงาน 1 → 0 = recovery", low.score === 0 && low.band === "recovery");
}

// 11. re-normalize คิดถูกจริง (เลขมือ: (15×1 + 20×0)/35 = 42.86 → 43)
{
  const r = computeReadiness({ energy: 5, soreness: 5 });
  check("พลังใจเต็มแต่ปวดมาก → 43 (reduced)", r.score === 43 && r.band === "reduced", JSON.stringify(r));
}

// 12. ทุก band ครบ
{
  const normal = computeReadiness({ sleep: { minutes: 360 }, energy: 3, soreness: 3 });
  check("นอน 6 ชม. + ปานกลางทุกอย่าง → 56 (normal)", normal.score === 56 && normal.band === "normal", JSON.stringify(normal));

  const reduced = computeReadiness({ sleep: { minutes: 360 }, energy: 3, soreness: 4 });
  check("เริ่มปวด + นอน 6 ชม. → 48 (reduced)", reduced.score === 48 && reduced.band === "reduced", JSON.stringify(reduced));

  const recovery = computeReadiness({ sleep: { minutes: 240 }, energy: 1, soreness: 5 });
  check("นอน 4 ชม. + หมดแรง + ปวดมาก → 18 (recovery)", recovery.score === 18 && recovery.band === "recovery", JSON.stringify(recovery));
}

// 13. ไม่มีข้อมูลเลย → ห้ามแต่งคะแนน
{
  const r = computeReadiness({});
  check("ไม่มีข้อมูลสักส่วน → score = null (ไม่เดาเลขให้)", r.score === null, JSON.stringify(r));
  check("ไม่มีข้อมูล → ถือว่า normal (เดินตามแผนเดิม ไม่ตัดอะไร)", r.band === "normal" && r.usedWeight === 0);
}

// 14. HRV ที่แกว่งสุดขอบต้องไม่ทำให้คะแนนหลุดกรอบ 0-100
{
  const hi = computeReadiness({ hrv: { today7dAvg: 999, base28dAvg: 55, sd28d: 5 }, energy: 5, soreness: 1 });
  const lo = computeReadiness({ hrv: { today7dAvg: 1, base28dAvg: 55, sd28d: 5 }, energy: 1, soreness: 5 });
  check("ค่าสุดขอบบน → ไม่เกิน 100", (hi.score ?? 0) === 100);
  check("ค่าสุดขอบล่าง → ไม่ต่ำกว่า 0", (lo.score ?? -1) === 0);
}

// 15. คำแนะนำไทย 1 ประโยค — ห้ามตำหนิ user
{
  const texts = [
    suggestionFor(90, "full"),
    suggestionFor(60, "normal"),
    suggestionFor(45, "reduced"),
    suggestionFor(20, "recovery"),
    suggestionFor(null, "normal"),
  ];
  check("มีคำแนะนำไทยครบทุก band", texts.every((t) => /[ก-๙]/.test(t) && t.length > 10));
  check("ไม่มีคำตำหนิผู้ใช้", !texts.some((t) => /ขี้เกียจ|แย่|ล้มเหลว|ไม่ได้เรื่อง|ผิด/.test(t)), texts.join(" | "));
  check("ไม่มีข้อมูล → บอกตรง ๆ ว่ายังประเมินไม่ได้", /ยังไม่มีข้อมูล/.test(texts[4]), texts[4]);
  check("มีคะแนนติดไปในประโยคให้ user เห็น", /45/.test(texts[2]), texts[2]);
}

console.log("\n── จุดที่ปวด → pattern ที่ต้องลดก่อน ──");

// 16. ตารางตาม §4.1
check(
  "เข่า → squat, lunge",
  SORE_AREA_PATTERNS.knee.join(",") === "squat,lunge",
  SORE_AREA_PATTERNS.knee.join(",")
);
check("หลัง → hinge, squat", SORE_AREA_PATTERNS.back.join(",") === "hinge,squat");
check("ไหล่ → push_v, push_h, pull_v", SORE_AREA_PATTERNS.shoulder.join(",") === "push_v,push_h,pull_v");
check("รับคำไทยด้วย (เข่า/ไหล่)", normalizeSoreArea("เข่า") === "knee" && normalizeSoreArea("ไหล่") === "shoulder");
check("รับตัวพิมพ์ใหญ่/ช่องว่าง", normalizeSoreArea(" Knee ") === "knee");
check("จุดที่ไม่รู้จัก → null (ไม่เดาว่าเป็นอะไร)", normalizeSoreArea("จมูก") === null && normalizeSoreArea("") === null);
check(
  "หลายจุดรวม pattern ไม่ซ้ำ",
  [...patternsForSoreAreas(["knee", "shoulder"])].sort().join(",") === "lunge,pull_v,push_h,push_v,squat",
  [...patternsForSoreAreas(["knee", "shoulder"])].sort().join(",")
);
check("ชื่อไทยของจุดที่ปวดไว้เขียนเหตุผล", soreAreaLabel("knee") === "เข่า" && soreAreaLabel("shoulder") === "ไหล่");

console.log("\n── ปรับแผนวันนี้ตาม band ──");

const PATTERNS: Record<string, string> = {
  squat_bw: "squat",
  lunge: "lunge",
  bench: "push_h",
  row: "pull_h",
  plank: "core",
  walk_fast: "cardio",
  stretch_full: "mobility",
};
const patternOf: PatternOf = (it) => PATTERNS[String(it.key ?? "")] ?? null;
const item = (key: string, name: string, sets?: number, extra: Partial<ReadinessPlanItem> = {}): ReadinessPlanItem => ({
  key,
  name,
  ...(sets != null ? { sets, reps: 10 } : {}),
  ...extra,
});

// 17. ตัดกี่เซ็ต (30% ปัดขึ้น แต่เหลืออย่างน้อย 1)
check("3 เซ็ต → ตัด 1 (เหลือ 2)", cutSetsFor(3) === 1);
check("4 เซ็ต → ตัด 2 (ปัดขึ้น)", cutSetsFor(4) === 2);
check("5 เซ็ต → ตัด 2", cutSetsFor(5) === 2);
check("2 เซ็ต → ตัด 1 (เหลือ 1)", cutSetsFor(2) === 1);
check("1 เซ็ต → ไม่ตัด (ลดปริมาณ ≠ ยกเลิกท่า)", cutSetsFor(1) === 0);

// 18. full / normal → ไม่แตะแผนเลย
{
  const items = [item("squat_bw", "สควอท", 3), item("bench", "เบนช์เพรส", 3)];
  const full = adjustPlanForReadiness(items, "full", [], patternOf);
  const normal = adjustPlanForReadiness(items, "normal", ["knee"], patternOf);
  check("full → คืนของเดิมทั้งดุ้น ไม่แตะ", full.items === items && !full.changed && full.cutSets === 0);
  check("normal → ไม่แตะ แม้จะบอกว่าปวดเข่า", normal.items === items && !normal.changed);
  check("ไม่แตะ = ไม่มี readinessNote ติดไปให้ user งง", !items.some((it) => it.readinessNote));
}

// 19. reduced ธรรมดา — ตัดจากท่าท้ายขึ้นมาจนถึง 30% แล้วหยุด
{
  const items = [item("squat_bw", "สควอท", 4), item("bench", "เบนช์เพรส", 4), item("row", "โรว์", 4)];
  const r = adjustPlanForReadiness(items, "reduced", [], patternOf);
  check("รวม 12 เซ็ต → เป้าตัด 4 เซ็ต", r.cutSets === 4 && r.changed, JSON.stringify(r.items));
  check("ท่าท้ายโดนก่อน (โรว์ 4→2, เบนช์ 4→2)", r.items[2].sets === 2 && r.items[1].sets === 2);
  check("ถึงเป้าแล้ว → ท่าหลักต้นวันไม่โดนแตะ", r.items[0].sets === 4 && !r.items[0].readinessNote);
  check("ท่าที่โดนตัดมีเหตุผลไทยติดไป", /ลด 2 เซ็ต — คะแนนความพร้อมต่ำ/.test(r.items[2].readinessNote ?? ""), r.items[2].readinessNote);
  check("ไม่แก้ของเดิม (ต้นฉบับยังครบ 4 เซ็ตทุกท่า)", items.every((it) => it.sets === 4 && !it.readinessNote));
}

// 20. เหลืออย่างน้อย 1 เซ็ตเสมอ
{
  const items = [item("squat_bw", "สควอท", 1), item("bench", "เบนช์เพรส", 2), item("row", "โรว์", 2)];
  const r = adjustPlanForReadiness(items, "reduced", [], patternOf);
  check("2 เซ็ต → เหลือ 1 · 1 เซ็ต → คงไว้ 1", r.items[2].sets === 1 && r.items[1].sets === 1 && r.items[0].sets === 1);
  check("ท่าที่เหลือ 1 เซ็ตอยู่แล้ว ไม่ถูกใส่ note ว่าลดให้", !r.items[0].readinessNote);
}

// 21. 🔴 soreArea → ตัด pattern ที่ตรงจุดก่อน และถ้าพอแล้วท่าอื่นไม่ต้องโดน
{
  const items = [item("squat_bw", "สควอท", 4), item("lunge", "ลันจ์", 4), item("plank", "แพลงก์", 3)];
  const r = adjustPlanForReadiness(items, "reduced", ["knee"], patternOf);
  check("ปวดเข่า → สควอท/ลันจ์ โดนตัด (4→2)", r.items[0].sets === 2 && r.items[1].sets === 2, JSON.stringify(r.items));
  check("ตัดท่าที่กวนเข่าแล้วถึง 30% → แพลงก์ไม่โดนแตะ", r.items[2].sets === 3 && !r.items[2].readinessNote);
  check("เหตุผลบอกว่าเพราะปวดเข่า ไม่ใช่เหตุผลกลาง ๆ", /ปวดเข่า/.test(r.items[0].readinessNote ?? ""), r.items[0].readinessNote);
  check("ตัดรวม 4 เซ็ตจาก 11 (≥30%)", r.cutSets === 4 && r.cutSets >= Math.ceil(11 * 0.3));
}

// 22. soreArea อย่างเดียวยังไม่ถึง 30% → ท่าอื่นโดนต่อจากท้ายขึ้นมา
{
  const items = [
    item("squat_bw", "สควอท", 3),
    item("bench", "เบนช์เพรส", 3),
    item("row", "โรว์", 3),
    item("plank", "แพลงก์", 3),
  ];
  const r = adjustPlanForReadiness(items, "reduced", ["knee"], patternOf);
  check("ตัดสควอทแล้วยังไม่ถึงเป้า → ไล่ตัดท่าอื่นต่อ", r.cutSets === 4, JSON.stringify(r.items));
  check("ท่าที่กวนเข่ายังได้เหตุผลเรื่องเข่า", /ปวดเข่า/.test(r.items[0].readinessNote ?? ""));
  check("ท่าอื่นได้เหตุผลกลาง (คะแนนความพร้อมต่ำ)", /คะแนนความพร้อมต่ำ/.test(r.items[3].readinessNote ?? ""));
}

// 23. ไม่รู้ pattern ของท่า (ท่าที่แอดมินยังไม่ใส่ metadata) → ไม่เดา ไม่พัง
{
  const items = [item("unknown_x", "ท่าที่ยังไม่มี metadata", 3), item("plank", "แพลงก์", 3)];
  const r = adjustPlanForReadiness(items, "reduced", ["knee"], patternOf);
  check("ไม่รู้ pattern → ยังตัดตามกติกาปกติได้ ไม่ throw", r.changed && r.cutSets === 2, JSON.stringify(r.items));
  const noResolver = adjustPlanForReadiness(items, "reduced", ["knee"], null);
  check("ไม่มีตัวแปล pattern เลย → ตัดจากท่าท้ายตามปกติ", noResolver.cutSets === 2);
}

// 24. วันที่ไม่มีเซ็ตเลย (เดิน/ยืดล้วน) → ตัดที่นาทีแทน
{
  const items = [item("walk_fast", "เดินเร็ว", undefined, { minutes: 30 }), item("stretch_full", "ยืดเหยียด", undefined, { minutes: 10 })];
  const r = adjustPlanForReadiness(items, "reduced", [], patternOf);
  check("เดิน 30 นาที → 20 นาที", r.items[0].minutes === 20 && r.changed, JSON.stringify(r.items));
  check("ยืดเหยียด 10 นาทีอยู่แล้ว → ไม่ตัดต่อ (สั้นกว่านี้ไม่ได้ผล)", r.items[1].minutes === 10 && !r.items[1].readinessNote);
}

// 25. recovery → เปลี่ยนทั้งวันเป็นเดิน Zone 2 + ยืดเหยียด
{
  const items = [item("squat_bw", "สควอท", 4), item("bench", "เบนช์เพรส", 4)];
  const r = adjustPlanForReadiness(items, "recovery", [], patternOf);
  check("วันพักฟื้น = 2 ท่า", r.items.length === 2 && r.replacedDay, JSON.stringify(r.items));
  check(
    "ท่าคือ เดินเร็ว Zone 2 25 นาที + ยืดเหยียด 10 นาที",
    r.items[0].key === "walk_fast" && r.items[0].minutes === 25 && r.items[1].key === "stretch_full" && r.items[1].minutes === 10
  );
  check("มีข้อความระดับวัน 'วันพักฟื้น — ร่างกายขอ'", r.dayNote === RECOVERY_DAY_NOTE, r.dayNote);
  check("ทุกท่ามีเหตุผลไทยติดไป", r.items.every((it) => !!it.readinessNote));
  check("ไม่ใช่ 'หยุดเฉย ๆ' — ยังมีอะไรให้ทำ (รักษานิสัย)", recoveryDayItems().every((it) => (it.minutes ?? 0) > 0));
  check("ของเดิมไม่ถูกแก้", items[0].sets === 4 && !items[0].readinessNote);
}

// 26. undo — planBackup ต้องคืนของเดิมได้เป๊ะ (เทสแบบ pure บนแผนจำลอง)
{
  const exercisePlan = {
    title: "ขาและแกนกลาง",
    durationMin: 45,
    caloriesTarget: 250,
    items: [item("squat_bw", "สควอท", 4), item("lunge", "ลันจ์", 4), item("plank", "แพลงก์", 3)],
  };
  // apply: เก็บสำเนาก่อนแตะ แล้วเขียนทับ items
  const planBackup = JSON.parse(JSON.stringify(exercisePlan));
  const adjusted = adjustPlanForReadiness(exercisePlan.items, "reduced", ["knee"], patternOf);
  const after = { ...exercisePlan, items: adjusted.items };
  check("หลัง apply แผนเปลี่ยนจริง", JSON.stringify(after) !== JSON.stringify(planBackup));
  // undo: คืน planBackup ทั้งก้อน
  const restored = JSON.parse(JSON.stringify(planBackup));
  check("undo → เหมือนต้นฉบับทุกตัวอักษร", JSON.stringify(restored) === JSON.stringify(exercisePlan), JSON.stringify(restored));
  check("สำเนาที่เก็บไว้ไม่โดน engine แก้ตาม (ไม่ใช่ตัวเดียวกันในหน่วยความจำ)", planBackup.items[0].sets === 4);
  check("ท่าที่คืนมาไม่มี readinessNote ค้าง", !restored.items.some((it: ReadinessPlanItem) => it.readinessNote));
}

// 27. แผนว่าง / ค่าเพี้ยน → ต้องไม่พัง
{
  check("แผนว่าง + reduced → ไม่มีอะไรเปลี่ยน", !adjustPlanForReadiness([], "reduced", ["knee"], patternOf).changed);
  const r = adjustPlanForReadiness([], "recovery", [], patternOf);
  check("แผนว่าง + recovery → ยังสร้างวันพักฟื้นให้ได้", r.items.length === 2 && r.replacedDay);
}

// 28. กติกาบ้าน: ไฟล์ engine ต้องไม่แตะ DB/เวลาปัจจุบัน
{
  try {
    const src = readFileSync(join(process.cwd(), "src/lib/readiness.ts"), "utf8");
    // ตัดคอมเมนต์ออกก่อน — ในคอมเมนต์เขียนถึงชื่อฟังก์ชันต้องห้ามได้ (นี่คือกฎของไฟล์ ไม่ใช่โค้ดที่รัน)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    check("engine ไม่ import prisma (คณิตล้วน เทสได้ทุกกติกา)", !/@\/lib\/prisma|from "prisma/.test(code));
    check("engine ไม่เรียกเวลาปัจจุบัน (ผลลัพธ์ต้องซ้ำได้เสมอ)", !/new Date\(/.test(code) && !/Date\.now\(/.test(code));
  } catch {
    console.log("… ข้ามการตรวจไฟล์ (รันจากนอกโฟลเดอร์โปรเจกต์)");
  }
}

console.log(failed === 0 ? `\n✅ ผ่านทั้งหมด ${total} เคส` : `\n❌ ไม่ผ่าน ${failed}/${total} เคส`);
process.exit(failed === 0 ? 0 : 1);
