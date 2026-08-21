/**
 * เทสถาวร: PT-E ปรับแผนวันนี้ — รัน: npx tsx scripts/test-workout-adjust.ts
 *
 * ทำไมต้องมี: ฟังก์ชันพวกนี้ถูกเรียกจากคำพูดของผู้ใช้ ("เหลือ 20 นาที" / "ปวดเข่า")
 * ผลลัพธ์เข้าไปแก้แผนของวันนั้นจริง — พลาดแล้วผู้ใช้เสียท่าหลักของวันไปเงียบ ๆ
 *
 * 🔴 เคสที่ห้ามหาย:
 *   - ท่าหลักของวัน (main) ต้องไม่หายจากแผน ไม่ว่าเวลาจะเหลือน้อยแค่ไหน
 *   - ตัดจนสุดแล้วยังไม่พอเวลา ต้องรายงาน shortfall ไม่ใช่แกล้งบอกว่าปรับให้แล้ว
 *   - ปวดจุดเดียว ห้ามหั่นทั้งวัน — ท่าที่ไม่เกี่ยวต้องไม่ถูกแตะแม้แต่ field เดียว
 */
import {
  MIN_CARDIO_MIN,
  OVERHEAD_MIN,
  REST_SEC,
  SEC_PER_REP,
  adjustForSoreArea,
  derivePriorities,
  estimateItemMinutes,
  estimateSessionMinutes,
  scaleToMinutes,
  substituteItem,
  type AdjustPlanItem,
  type ExerciseMeta,
  type MetaOf,
} from "../src/lib/workoutAdjust";
import { patternsForSoreAreas, soreAreaLabel } from "../src/lib/readiness";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (ok) console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * ตาราง metadata — คัดลอกจากตาราง exercises จริง (ตรวจกับ DB วันที่ 21 ส.ค. 2026)
 * ถ้าตารางจริงเปลี่ยน แล้วเทสนี้ยังผ่านอยู่ = ไม้บรรทัดโกหก ต้องอัปเดตที่นี่ด้วย
 */
const RAW = `
band_row:pull_h:2:strength:reps:home
barbell_squat:squat:4:strength:reps:gym
chest_press:push_h:2:strength:reps:gym
crunch:core:1:strength:reps:none
db_press:push_v:3:strength:reps:home
db_rdl:hinge:3:strength:reps:home
db_row:pull_h:3:strength:reps:home
db_squat:squat:3:strength:reps:home
elliptical:cardio:1:cardio:minutes:gym
glute_bridge:hinge:1:strength:reps:none
jog_light:cardio:3:cardio:minutes:none
lat_pulldown:pull_v:2:strength:reps:gym
leg_press:squat:2:strength:reps:gym
lunge:lunge:4:strength:reps:none
plank:core:2:strength:minutes:none
pushup:push_h:3:strength:reps:none
pushup_knee:push_h:2:strength:reps:none
squat_bw:squat:2:strength:reps:none
stationary_bike:cardio:1:cardio:minutes:gym
step_up:lunge:3:strength:reps:none
stretch_full:mobility:1:mobility:minutes:none
walk_fast:cardio:1:cardio:minutes:none
`.trim();

const TH: Record<string, string> = {
  band_row: "ยางยืดโรว์", barbell_squat: "บาร์เบลสควอท", chest_press: "เชสเพรส", crunch: "ครันช์",
  db_press: "ดัมเบลเพรส", db_rdl: "ดัมเบล RDL", db_row: "ดัมเบลโรว์", db_squat: "ดัมเบลสควอท",
  elliptical: "เครื่องเดินวงรี", glute_bridge: "กลูตบริดจ์", jog_light: "วิ่งเหยาะ",
  lat_pulldown: "ลัตพูลดาวน์", leg_press: "เลกเพรส", lunge: "ลันจ์", plank: "แพลงก์",
  pushup: "วิดพื้น", pushup_knee: "วิดพื้นเข่า", squat_bw: "สควอท", stationary_bike: "จักรยานฟิตเนส",
  step_up: "สเต็ปอัพ", stretch_full: "ยืดเหยียดทั้งตัว", walk_fast: "เดินเร็ว",
};

const POOL: ExerciseMeta[] = RAW.split("\n").map((line) => {
  const [key, pattern, diff, kind, unit, equipment] = line.split(":");
  return {
    key,
    name: TH[key] ?? key,
    pattern: pattern === "-" ? null : pattern,
    kind,
    unit,
    equipment,
    difficulty: diff === "-" ? null : Number(diff),
    cue: `คำแนะนำฟอร์มของ${TH[key] ?? key}`,
  };
});
const META = new Map(POOL.map((m) => [m.key, m]));
const metaOf: MetaOf = (it) => META.get(String(it?.key ?? "")) ?? null;
const homePool = POOL.filter((m) => m.equipment !== "gym");

const it = (key: string, extra: Partial<AdjustPlanItem> = {}): AdjustPlanItem => {
  const m = META.get(key)!;
  return {
    key,
    name: m.name,
    note: m.cue,
    ...(m.unit === "reps" ? { sets: 3, reps: 12 } : { minutes: 20 }),
    ...extra,
  };
};

// ────────────────────────────────────────────────────────────────
console.log("── 1. ประมาณเวลาที่เซสชันกินจริง ──");
{
  // ตัวเลขเขียนตรง ๆ ไม่อ้างสูตร — เทสที่อ้างสูตรเดียวกับโค้ดคือการถามโค้ดว่า "เธอเท่ากับเธอไหม"
  check("ท่านับครั้ง 3×12 = 4.4 นาที (ทำ 2.4 + พักระหว่างเซ็ต 2)", estimateItemMinutes(it("squat_bw")) === 4.4);
  check("เดิน 20 นาที (เซ็ตเดียว) = 20 นาที ไม่มีพักต่อท้าย", estimateItemMinutes(it("walk_fast")) === 20);
  check("ท่าจับเวลา 3 เซ็ต × 45 วิ = 4.3 นาที", estimateItemMinutes({ key: "plank", name: "แพลงก์", sets: 3, seconds: 45 }) === 4.3);
  check(
    "🔴 {sets:3, minutes:1} = แพลงก์ 3 เซ็ต เซ็ตละ 1 นาที = 5 นาที (ไม่ใช่ 1 นาที) — รูปแบบที่อยู่ในแผนจริงบน prod",
    estimateItemMinutes({ key: "plank", name: "แพลงก์", sets: 3, minutes: 1 }) === 5
  );
  check("ค่าคงที่ยังเป็นชุดที่เทสนี้คิดไว้", SEC_PER_REP === 4 && REST_SEC === 60);
  check("ไม่มีตัวเลขอะไรเลย = 0 (ไม่เดา)", estimateItemMinutes({ key: "x", name: "ท่าลึกลับ" }) === 0);
  check("เซ็ตหาย ให้ถือว่าอย่างน้อย 1 เซ็ต", estimateItemMinutes({ key: "squat_bw", name: "สควอท", reps: 12 }) > 0);

  const day = [it("squat_bw"), it("db_row"), it("plank", { minutes: 5 })];
  const sum = day.reduce((n, x) => n + estimateItemMinutes(x), 0);
  check("ทั้งเซสชัน = ผลรวมท่า + อุ่นเครื่อง/คูลดาวน์", estimateSessionMinutes(day) === Math.round(sum + OVERHEAD_MIN));
  check("แผนว่าง = 0 ไม่ใช่ค่าอุ่นเครื่องลอย ๆ", estimateSessionMinutes([]) === 0);
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 2. ธง priority (ท่าไหนคือแก่นของวัน) ──");
{
  const day = [it("squat_bw"), it("db_row"), it("crunch"), it("stretch_full")];
  const p = derivePriorities(day, metaOf);
  check("compound ตัวแรกของวัน = main", p[0] === "main");
  check("compound ตัวถัดไป = secondary", p[1] === "secondary");
  check("core = accessory", p[2] === "accessory");
  check("ยืดเหยียด = accessory", p[3] === "accessory");

  const cardioDay = derivePriorities([it("walk_fast"), it("stretch_full")], metaOf);
  check("วันคาร์ดิโอล้วน → คาร์ดิโอตัวแรกเป็น main (ไม่ใช่ไม่มี main เลย)", cardioDay[0] === "main");

  const mixed = derivePriorities([it("jog_light"), it("squat_bw")], metaOf);
  check("วันที่มีเวทด้วย → คาร์ดิโอเป็น secondary ท่าเวทเป็น main", mixed[0] === "secondary" && mixed[1] === "main");

  const stamped = derivePriorities([it("crunch", { priority: "main" }), it("squat_bw")], metaOf);
  check("ธงที่ generator ปั๊มมาแล้ว ชนะการเดาเสมอ", stamped[0] === "main" && stamped[1] === "secondary");

  const unknown = derivePriorities([{ key: "ไม่มีในตาราง", name: "ท่าที่ไม่รู้จัก" }], metaOf);
  check("ท่าที่ไม่รู้จัก = accessory (ไม่ใช่ main โดยบังเอิญ)", unknown[0] === "accessory");
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 3. เหลือเวลาแค่ X นาที ──");
{
  const day = [it("squat_bw"), it("db_row"), it("crunch"), it("stretch_full", { minutes: 10 })];
  const before = estimateSessionMinutes(day);

  const roomy = scaleToMinutes(day, before + 10, metaOf);
  check("เวลาพออยู่แล้ว = ไม่แตะแผนเลย", !roomy.changed && roomy.items.length === day.length && !roomy.dropped.length);
  check("ไม่แตะแล้วต้องไม่ใส่โน้ตให้ user งง", roomy.items.every((x) => !x.adjustNote));

  const tight = scaleToMinutes(day, 20, metaOf);
  check("เวลาน้อยลง → แผนสั้นลงจริง", tight.changed && tight.afterMin < before, `${before} → ${tight.afterMin} นาที`);
  check("ยกของท้าย (accessory) ออกก่อน", tight.dropped.length > 0 && !tight.items.some((x) => x.key === "stretch_full"));
  check("ท่าหลักของวันยังอยู่", tight.items.some((x) => x.key === "squat_bw"));
  check("ลงเวลาที่ขอได้จริง", tight.afterMin <= 20 && !tight.shortfall, `${tight.afterMin} ≤ 20`);
  check("ทุกท่าที่โดนแตะมีเหตุผลภาษาไทยติดไป", tight.items.filter((x) => x.adjustNote).every((x) => /[ก-๙]/.test(String(x.adjustNote))));

  const extreme = scaleToMinutes(day, 5, metaOf);
  check("🔴 บีบจนสุด: ท่าหลักยังต้องอยู่ ไม่ใช่แผนว่าง", extreme.items.length >= 1 && extreme.items.some((x) => x.key === "squat_bw"));
  check("เซ็ตห้ามเหลือศูนย์ (นั่นคือตัดท่าทิ้ง ไม่ใช่ลดปริมาณ)", extreme.items.every((x) => x.sets === undefined || Number(x.sets) >= 1));

  // ขอ 5 นาทีกับวันคาร์ดิโอ: พื้นของคาร์ดิโอคือ 5 นาที + อุ่นเครื่องอีก 3 → ยังไงก็เกิน ต้องยอมรับตามจริง
  const impossible = scaleToMinutes([it("walk_fast", { minutes: 40 })], 5, metaOf);
  check("🔴 ตัดไม่ลงจริง ต้องบอกตรง ๆ ว่า shortfall", impossible.shortfall && /สั้นที่สุดที่ทำได้/.test(impossible.summary), impossible.summary);
  check("shortfall แล้วก็ยังต้องย่อให้ใกล้ที่สุดเท่าที่ทำได้", Number(impossible.items[0].minutes) === MIN_CARDIO_MIN);

  const cardio = scaleToMinutes([it("walk_fast", { minutes: 40 })], 15, metaOf);
  check("วันคาร์ดิโอล้วน → ตัดที่นาที", cardio.changed && Number(cardio.items[0].minutes) < 40);
  check("คาร์ดิโอไม่ถูกตัดต่ำกว่าขั้นต่ำที่ยังได้ผล", Number(cardio.items[0].minutes) >= MIN_CARDIO_MIN);

  const twice = scaleToMinutes(day, 20, metaOf);
  check("รันซ้ำได้ผลเดิมเป๊ะ (ไม่มีอะไรสุ่ม/ไม่พึ่งเวลาปัจจุบัน)", JSON.stringify(twice.items) === JSON.stringify(tight.items));

  const src = [it("squat_bw"), it("crunch")];
  const snapshot = JSON.stringify(src);
  scaleToMinutes(src, 5, metaOf);
  check("ไม่แก้ของเดิมที่ผู้เรียกส่งเข้ามา (แผนจริงใน DB ต้องไม่โดนแตะ)", JSON.stringify(src) === snapshot);

  check("แผนว่าง = ไม่พัง ไม่โกหกว่าปรับให้", !scaleToMinutes([], 20, metaOf).changed);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 4. วันนี้ปวดตรงไหน → หาท่าแทน ──");
{
  const knee = patternsForSoreAreas(["เข่า"]);
  const kneeTh = soreAreaLabel("เข่า");
  check("จุดที่ปวดใช้ตารางเดียวกับ Readiness (เข่า → squat/lunge)", knee.has("squat") && knee.has("lunge"));

  const day = [it("squat_bw"), it("db_row"), it("plank", { minutes: 5 })];
  const r = adjustForSoreArea(day, kneeTh, { pool: homePool, avoidPatterns: knee }, metaOf);
  const swappedItem = r.items[0];
  check("ท่าที่ลงเข่าถูกเปลี่ยนให้", r.changed && r.swapped === 1 && swappedItem.key !== "squat_bw");
  check("ท่าแทนต้องไม่ลงเข่าซ้ำอีก", !knee.has(String(META.get(String(swappedItem.key))?.pattern)));
  check("ท่าแทนเป็นท่าประเภทเดียวกัน (ยังได้ฝึกแรงอยู่)", META.get(String(swappedItem.key))?.kind === "strength");
  check("🔴 ท่าที่ไม่เกี่ยวกับเข่า ห้ามโดนแตะแม้แต่ field เดียว", JSON.stringify(r.items[1]) === JSON.stringify(day[1]));
  check("บอกผู้ใช้ว่าเปลี่ยนจากอะไรเป็นอะไร", /เปลี่ยนจาก/.test(String(swappedItem.adjustNote)));
  check("ท่าแทนพกคำแนะนำฟอร์มของตัวเองมา ไม่ใช่ของท่าเดิม", swappedItem.note === META.get(String(swappedItem.key))?.cue);
  check(
    "🔴 น้ำหนักของท่าเดิมต้องไม่ติดไปกับท่าใหม่ (คนละท่า คนละแรง)",
    (() => {
      const withKg = adjustForSoreArea([it("squat_bw", { weightKg: 40, rxReason: "จากผลสัปดาห์ที่แล้ว" })], kneeTh, { pool: homePool, avoidPatterns: knee }, metaOf);
      return withKg.items[0].weightKg === undefined && withKg.items[0].rxReason === undefined;
    })()
  );

  const clean = adjustForSoreArea([it("db_row"), it("plank", { minutes: 5 })], kneeTh, { pool: homePool, avoidPatterns: knee }, metaOf);
  check("ไม่มีท่าที่ลงจุดนั้นเลย = ไม่แตะ + บอกว่าทำตามแผนเดิมได้", !clean.changed && /แผนเดิม/.test(clean.summary));

  // ไม่มีตัวแทนเลย: ปวดจนต้องเลี่ยงทุก pattern ที่มีในคลัง
  const allPatterns = new Set(POOL.map((m) => m.pattern).filter(Boolean) as string[]);
  const stuck = adjustForSoreArea([it("squat_bw")], "ทั้งตัว", { pool: homePool, avoidPatterns: allPatterns }, metaOf);
  check("ไม่มีท่าแทน → ลดปริมาณแทนการตัดทิ้ง", stuck.reduced === 1 && stuck.items.length === 1 && Number(stuck.items[0].sets) === 2);
  check("ลดปริมาณแล้วต้องบอกเหตุผล", /ปวด/.test(String(stuck.items[0].adjustNote)));

  // แทนด้วยท่า pattern เดียวกัน เมื่อปัญหาอยู่ที่ "ท่านั้น" ไม่ใช่ "ท่ากลุ่มนั้น"
  const one = substituteItem(
    it("pushup"),
    "ข้อมือ",
    { pool: homePool, avoidPatterns: new Set(), avoidKeys: new Set(["pushup"]) },
    metaOf
  );
  check("เลี่ยงเฉพาะท่านั้น → ได้ท่า pattern เดียวกันมาแทน", one.swapped && META.get(String(one.item.key))?.pattern === "push_h");
  check("เลือกท่าที่ง่ายกว่าก่อนเมื่อกำลังเจ็บ", one.item.key === "pushup_knee", String(one.item.key));

  const noDup = adjustForSoreArea([it("squat_bw"), it("db_squat")], kneeTh, { pool: homePool, avoidPatterns: knee }, metaOf);
  check("เปลี่ยนสองท่าในวันเดียว ต้องไม่ได้ท่าซ้ำกัน", noDup.items[0].key !== noDup.items[1].key);
}

// ────────────────────────────────────────────────────────────────
console.log("\n── 5. ความบริสุทธิ์ของเอนจิน ──");
{
  const src = require("fs").readFileSync(require("path").join(__dirname, "../src/lib/workoutAdjust.ts"), "utf8");
  check("workoutAdjust.ts: ไม่ import prisma", !/from ["'].*prisma/.test(src));
  check("workoutAdjust.ts: ไม่เรียกเวลาปัจจุบัน", !/Date\.now\(\)|new Date\(\)/.test(src));
  check("workoutAdjust.ts: ไม่สุ่ม (ผลต้องซ้ำได้เสมอ)", !/Math\.random/.test(src));
  check("workoutAdjust.ts: ไม่ยิงเน็ต/ไม่เรียก AI", !/fetch\(|openai|aiClient/i.test(src));
}

console.log(failed === 0 ? `\n✅ ผ่าน ${total}/${total} เคส` : `\n❌ ผ่าน ${total - failed}/${total} เคส`);
process.exit(failed === 0 ? 0 : 1);
