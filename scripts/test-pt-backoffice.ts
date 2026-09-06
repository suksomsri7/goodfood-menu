/**
 * เทสถาวร: PT-E หลังบ้าน (ใบสั่งของโค้ชมนุษย์ + กติกาเตือนแอดมิน)
 * รัน: npx tsx scripts/test-pt-backoffice.ts
 *
 * ทำไมต้องมี: ทั้งสองเรื่องนี้ "เงียบเวลาพัง"
 *   · ใบสั่งที่รวมผิด = แอดมินกดสั่งแล้วเห็นข้อความว่าสำเร็จ แต่แผนลูกค้าไม่เปลี่ยน
 *   · กติกาเตือนที่นับผิด = เตือนคนที่แค่หายไป หรือเงียบใส่คนที่กำลังจะเลิกเล่น
 *
 * 🔴 เคสที่ห้ามหาย:
 *   - สั่งท่าเดิมซ้ำ ต้องได้เลขของครั้งหลัง
 *   - ใบเสียต้องยังถูกนับว่า "ใช้แล้ว" ไม่งั้นค้างคิวตลอดกาล
 *   - วันที่ไม่ได้เช็คอิน ต้องทำให้สตรีค "ความพร้อมต่ำ" ขาด (ไม่ตอบ ≠ ต่ำ)
 *   - dedupeKey ของ 3 กติกาต้องไม่ชนกัน และของเรื่องเดียวกันต้องซ้ำเดิมเสมอ
 */
import { mergeOverrideRows, isDeferred, type OverrideRow } from "../src/lib/ptOverride";
import { lowBandStreak, weekKey, READINESS_LOW_DAYS } from "../src/lib/ptAlerts";
import { COACH_SET_NOTE } from "../src/lib/applyProgression";
import { splitRemaining } from "../src/lib/exerciseVideoReview";

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

const row = (id: string, action: string, exerciseKey: string | null, after: unknown): OverrideRow =>
  ({ id, action, exerciseKey, after });

// ── 1. รวมใบสั่ง ────────────────────────────────────────────────────
{
  const merged = mergeOverrideRows([]);
  check("ไม่มีใบสั่ง = ไม่มีอะไรค้าง", merged.weightByKey.size === 0 && !merged.forceDeload && merged.ids.length === 0);
}
{
  const merged = mergeOverrideRows([row("a", "set_weight", "squat", { weightKg: 40 })]);
  check("ใบเดียว ตั้งน้ำหนักได้", merged.weightByKey.get("squat") === 40, `${merged.weightByKey.get("squat")}`);
  check("ใบเดียว เก็บ id ไว้ปั๊ม", merged.ids.length === 1);
}
{
  // เรียงเก่า → ใหม่ ตามที่ pendingOverrides ส่งมา
  const merged = mergeOverrideRows([
    row("a", "set_weight", "squat", { weightKg: 40 }),
    row("b", "set_weight", "squat", { weightKg: 45 }),
  ]);
  check("สั่งท่าเดิมซ้ำ ได้เลขครั้งหลัง", merged.weightByKey.get("squat") === 45, `${merged.weightByKey.get("squat")}`);
  check("ใบที่ถูกทับก็ยังถูกปั๊มว่าใช้แล้ว", merged.ids.length === 2);
}
{
  const merged = mergeOverrideRows([
    row("a", "set_weight", "squat", { weightKg: -5 }),
    row("b", "set_weight", "bench", { weightKg: "หนัก" }),
    row("c", "set_weight", null, { weightKg: 20 }),
  ]);
  check("ใบเสียไม่ถูกเอาไปใช้", merged.weightByKey.size === 0);
  check("ใบเสียยังนับว่าใช้แล้ว (ไม่ค้างคิว)", merged.ids.length === 3, merged.ids.join(","));
}
{
  const merged = mergeOverrideRows([
    row("a", "force_deload", null, null),
    row("b", "set_weight", "row", { weightKg: 22.5 }),
  ]);
  check("สั่งพักฟื้นติดธง", merged.forceDeload === true);
  check("สั่งพักฟื้นไม่กลืนใบตั้งน้ำหนัก", merged.weightByKey.get("row") === 22.5);
}
{
  check("set_weight เป็นคำสั่งรอแผนรอบหน้า", isDeferred("set_weight"));
  check("force_deload เป็นคำสั่งรอแผนรอบหน้า", isDeferred("force_deload"));
  check("reset_stall มีผลทันที", !isDeferred("reset_stall"));
  check("clear_calibration มีผลทันที", !isDeferred("clear_calibration"));
}

// ── 1b. ข้อความที่ลูกค้าจะเห็น ────────────────────────────────────────
{
  // เหตุผลเดิมของ engine พูดถึงเลขที่ไม่ได้ใช้แล้ว — ห้ามเอามาต่อท้ายจนอ่านแล้วสับสน
  const withEngine = COACH_SET_NOTE(42.5, 30);
  check("บอกทั้งเลขที่โค้ชสั่งและเลขที่ระบบเสนอ", withEngine.includes("42.5") && withEngine.includes("30"), withEngine);
  const same = COACH_SET_NOTE(30, 30);
  check("เลขตรงกัน ไม่ต้องมีวงเล็บให้รก", !same.includes("("), same);
  const none = COACH_SET_NOTE(20, null);
  check("ท่าที่ระบบไม่เคยเสนอเลข ไม่แต่งวงเล็บขึ้นมา", !none.includes("("), none);
}

// ── 2. สตรีคความพร้อมต่ำ ────────────────────────────────────────────
const day = (offset: number): Date => {
  const d = new Date(Date.UTC(2026, 8, 1));
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const today = day(0);

{
  const rows = Array.from({ length: 5 }, (_, i) => ({ date: day(-i), band: "reduced" }));
  check(`ต่ำ ${READINESS_LOW_DAYS} วันติด = นับได้ครบ`, lowBandStreak(rows, today) === 5, `${lowBandStreak(rows, today)}`);
}
{
  const rows = [
    { date: day(0), band: "reduced" },
    { date: day(-1), band: "recovery" },
    { date: day(-2), band: "normal" }, // ตรงกลางกลับมาปกติ = สตรีคจบแค่ 2
    { date: day(-3), band: "reduced" },
    { date: day(-4), band: "reduced" },
  ];
  check("วันที่กลับมาปกติทำให้สตรีคขาด", lowBandStreak(rows, today) === 2, `${lowBandStreak(rows, today)}`);
}
{
  const rows = [
    { date: day(0), band: "reduced" },
    // ขาดวันที่ -1 (ไม่ได้เช็คอิน)
    { date: day(-2), band: "reduced" },
    { date: day(-3), band: "reduced" },
    { date: day(-4), band: "reduced" },
    { date: day(-5), band: "reduced" },
  ];
  check("วันที่ไม่ได้ตอบ = สตรีคขาด ไม่ใช่ต่ำ", lowBandStreak(rows, today) === 1, `${lowBandStreak(rows, today)}`);
}
{
  const rows = [{ date: day(0), band: null }];
  check("ไม่มีคะแนน (band ว่าง) ไม่นับเป็นต่ำ", lowBandStreak(rows, today) === 0);
}
{
  const rows = Array.from({ length: 5 }, (_, i) => ({ date: day(-i), band: "full" }));
  check("ช่วงเต็มที่ไม่เข้าเงื่อนไข", lowBandStreak(rows, today) === 0);
}

// ── 3. dedupeKey ────────────────────────────────────────────────────
{
  const wk = weekKey(new Date(Date.UTC(2026, 8, 1)));
  const same = weekKey(new Date(Date.UTC(2026, 8, 3)));
  const next = weekKey(new Date(Date.UTC(2026, 8, 8)));
  check("วันในสัปดาห์เดียวกันได้กุญแจเดียวกัน", wk === same, `${wk} vs ${same}`);
  check("ข้ามสัปดาห์แล้วกุญแจเปลี่ยน", wk !== next, `${wk} vs ${next}`);
  check("กุญแจสัปดาห์อยู่ในรูป YYYYWnn", /^\d{4}W\d{2}$/.test(wk), wk);
}
{
  // กติกาคนละข้อของคนเดียวกันต้องไม่ชนกุญแจกัน (ไม่งั้นเตือนได้แค่เรื่องเดียวต่อสัปดาห์)
  const wk = weekKey(today);
  const keys = [`stall:squat:${wk}`, `stall:bench:${wk}`, `readiness_low:${wk}`, `new_injury:inj_1`];
  check("กุญแจ 3 กติกาไม่ชนกัน", new Set(keys).size === keys.length);
}

// ── 4. คิวตรวจคลิป: "ครบ" ต้องแปลว่าครบจริง ───────────────────────────
{
  const noVideo = [{ key: "towel_row" }, { key: "split_jump" }, { key: "self_resist_curl" }];
  // ข้ามไว้ก่อน = ยังไม่มีข้อสรุป → ต้องอยู่กองที่ต้องตามต่อ (บั๊ก 6 ก.ย. 69 นับเป็น "จบแล้ว")
  const noneConcluded = splitRemaining(noVideo, new Set<string>());
  check("ท่าที่ข้ามไว้ก่อนยังต้องตามต่อ", noneConcluded.stuck.length === 3 && noneConcluded.dismissed.length === 0);

  const oneKilled = splitRemaining(noVideo, new Set(["self_resist_curl"]));
  check("ท่าที่สั่งปิดถาวรออกจากกองที่ต้องตาม", oneKilled.stuck.length === 2, `${oneKilled.stuck.length}`);
  check("แต่ยังถูกนับว่า 'ยังไม่มีคลิป' อยู่ ไม่หายเงียบ", oneKilled.dismissed.length === 1);

  const allKilled = splitRemaining(noVideo, new Set(noVideo.map((n) => n.key)));
  check("ปิดถาวรหมด = ไม่มีอะไรต้องตาม แต่ห้ามพูดว่าครบทุกท่า",
    allKilled.stuck.length === 0 && allKilled.dismissed.length === 3);

  const nothingLeft = splitRemaining([] as { key: string }[], new Set<string>());
  check("ทุกท่ามีคลิปจริง = ครบทั้งสองกอง", nothingLeft.stuck.length === 0 && nothingLeft.dismissed.length === 0);
}

console.log(`\nรวม ${total} ข้อ · ผ่าน ${total - failed} · ตก ${failed}`);
process.exit(failed ? 1 : 0);
