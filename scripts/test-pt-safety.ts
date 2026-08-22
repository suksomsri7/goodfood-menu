/**
 * ด่านความปลอดภัย/วินัยของ PT engine — เกิดจาก QC ลูกค้าจำลอง 22 ส.ค. 69 (คณิตล้วน ไม่แตะ DB/AI)
 *   1. เข่า avoid → ท่า impact สูง (วิ่งเหยาะ) ต้องถูกสลับเป็นตัวแทน impact ต่ำ ไม่ใช่หลุดมา
 *   2. isRestDay ห้ามเชื่อป้าย "พัก" — วันที่มีท่าจริงต้องไม่นับเป็นวันพัก
 *   3. applyTrainDays เขียนชื่อวันในหัวข้อใหม่ให้ตรงวันจริงหลังย้าย
 *   4. สัปดาห์ที่มีเวทแต่ไม่มีท่าดึงเลย → ensureWeeklyPull เติมให้ 1 ท่า
 *   5. snapExercises: ท่า strength จับเวลาแบบไม่มีเซ็ต >3 นาที → 3 เซ็ต เซ็ตละ 1 นาที
 */
import { EXERCISE_CATALOG } from "../src/lib/exerciseCatalog";
import {
  applyInjuryFilter, applyTrainDays, injuryFilters, isRestDay, type InjuryFilters,
} from "../src/lib/trainingProfile";
import { ensureWeeklyPull, snapExercises } from "../src/lib/planGenerator";
import { patternsForInjuryArea, injuryAreaAlias } from "../src/lib/trainingProfileStore";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${detail}`); }
};

const pool = EXERCISE_CATALOG;
const byKey = new Map(pool.map((e) => [e.key, e]));
// pattern จำลองเท่าที่เทสต้องใช้ (ของจริงมาจาก DB)
const PATTERNS: Record<string, string> = {
  squat_bw: "squat", db_squat: "squat", lunge: "lunge", walk_fast: "cardio", jog_light: "cardio",
  jumping_jack: "cardio", pushup: "push_h", db_row: "pull_h", plank: "core",
};
const patternOf = (it: { key?: string; name?: string }) => PATTERNS[it.key ?? ""] ?? null;

const day = (title: string, items: any[]) => ({
  dayNumber: 1, date: new Date("2026-08-24T00:00:00Z"), aiNote: "",
  exercisePlan: { title, durationMin: 30, caloriesTarget: 200, items },
  mealPlan: { meals: [] },
}) as any;

// ── 1) เข่า avoid: สควอทโดนตัด (pattern) · วิ่งเหยาะโดนสลับเป็นคาร์ดิโอ impact ต่ำ ──
const kneeFilters = injuryFilters(
  [{ area: "knee", severity: "avoid", active: true }] as any,
  new Date(), patternsForInjuryArea, (a) => a
);
ok("เข่า avoid → ตั้งธง avoidHighImpact", kneeFilters.avoidHighImpact === true);
{
  const d = [day("วันจันทร์ - คาร์ดิโอ", [
    { key: "jog_light", name: "วิ่งเหยาะ", minutes: 20 },
    { key: "squat_bw", name: "สควอทน้ำหนักตัว", sets: 3, reps: 10 },
    { key: "plank", name: "แพลงก์", sets: 3, minutes: 1 },
  ])];
  const r = applyInjuryFilter(d, kneeFilters, patternOf, pool);
  const names = (r.days[0].exercisePlan.items ?? []).map((i: any) => i.key);
  ok("สควอทถูกตัด (pattern squat)", !names.includes("squat_bw"), String(names));
  ok("วิ่งเหยาะไม่หลุดมา", !names.includes("jog_light"), String(names));
  const sub = (r.days[0].exercisePlan.items ?? []).find((i: any) => byKey.get(i.key)?.kind === "cardio");
  ok("มีคาร์ดิโอตัวแทน impact ต่ำ", !!sub && byKey.get(String(sub.key))?.impact === "low", String(sub?.key ?? "-"));
  ok("ตัวแทนสืบทอดนาทีเดิม", sub?.minutes === 20, String(sub?.minutes));
  ok("แพลงก์ (ไม่เกี่ยว) ไม่โดนแตะ", names.includes("plank"));
}

// ── 2) isRestDay ดูของจริง ──
ok("ป้าย 'พัก' แต่มีเดินเร็ว 20 นาที = ไม่ใช่วันพัก",
  isRestDay(day("วันเสาร์ - พัก", [{ key: "walk_fast", name: "เดินเร็ว", minutes: 20 }]), pool) === false);
ok("ยืดเหยียดล้วน = วันพักจริง",
  isRestDay(day("วันพัก", [{ key: "stretch_full", name: "ยืดเหยียดทั้งตัว", minutes: 15 }]), pool) === true);

// ── 3) ชื่อวันในหัวข้อตรงวันจริงหลังย้าย ──
{
  // start วันเสาร์ (dow 6) · เทรนเฉพาะจันทร์ → วันที่ i=2 คือจันทร์
  const week = [
    day("วันเสาร์ - เวท", [{ key: "pushup", name: "วิดพื้น", sets: 3, reps: 10 }]),
    day("วันพัก", []),
    day("วันพัก", []),
    day("วันพัก", []), day("วันพัก", []), day("วันพัก", []), day("วันพัก", []),
  ];
  const r = applyTrainDays(week, 6, ["mon"], pool);
  const monTitle = r.days[2].exercisePlan.title;
  ok("เวิร์คเอาต์ย้ายไปวันจันทร์ + หัวข้อเปลี่ยนเป็น 'วันจันทร์ - …'",
    monTitle.startsWith("วันจันทร์"), monTitle);
  ok("วันเสาร์เดิมกลายเป็นวันพัก", isRestDay(r.days[0], pool) === true, r.days[0].exercisePlan.title);
}

// ── 4) สัปดาห์ไม่มี pull → เติม 1 ท่า ──
{
  const week = [
    day("เวท", [{ key: "pushup", name: "วิดพื้น", sets: 3, reps: 10 }]),
    day("วันพัก", []),
  ];
  const r = ensureWeeklyPull(week, pool, patternOf);
  const keys = r.days.flatMap((d: any) => (d.exercisePlan.items ?? []).map((i: any) => i.key));
  ok("เติมท่าดึงให้ 1 ท่า", r.added === true && keys.some((k: string) => patternOf({ key: k }) === "pull_h"), String(keys));
  const again = ensureWeeklyPull(r.days, pool, patternOf);
  ok("มี pull แล้วไม่เติมซ้ำ", again.added === false);
}

// ── 5) แพลงก์ 10 นาทีไม่มีเซ็ต → 3 เซ็ต เซ็ตละ 1 นาที ──
{
  const r = snapExercises([day("เวท", [{ name: "แพลงก์", minutes: 10 }])], pool);
  const it: any = r.days[0].exercisePlan.items[0];
  ok("ท่า strength จับเวลาถูกจัดรูปเป็น 3x1 นาที", it.sets === 3 && it.minutes === 1, JSON.stringify(it));
}

// ── กัน alias พัง ──
ok("คำไทย 'เข่า' → area knee", injuryAreaAlias("เข่า") === "knee");

console.log(`\nผ่าน ${pass} · ตก ${fail}`);
if (fail > 0) process.exit(1);
