/**
 * เทสรวมยอดรายเซ็ต → สรุปต่อท่า — รัน: npx tsx scripts/test-set-rollup.ts
 *
 * ทำไมต้องมี: ตัวเลขจากไฟล์นี้คือ "เวลา/แคลอรี่" ที่ลูกค้าเห็นในวงแหวนหลังเล่นเสร็จ
 * ถ้ารวมยอดเพี้ยน (นับเซ็ตที่ยังไม่ได้ทำ · เอา feel ไปคูณแคลอรี่ · ค่าเพี้ยนหลุดเพดาน)
 * ระบบจะรายงานว่าเผาไป 900 kcal ทั้งที่เพิ่งวิดพื้น 3 เซ็ต — พังความเชื่อถือทั้งแอป
 *
 * เทสตรงนี้เป็นตรรกะล้วน ไม่แตะ DB (ฟังก์ชันชุดเดียวกับที่ POST /api/coach/sets เรียกจริง)
 */
import { normalizeSets, rollupSets, DEFAULT_BODY_WEIGHT_KG, REPS_SET_MINUTES } from "../src/lib/setRollup";
import { kcalForExercise } from "../src/lib/exerciseCatalog";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ── 1. ท่านับครั้ง: 3 เซ็ต = 4.5 นาที ──
{
  const sets = normalizeSets([
    { setNo: 1, actualWeightKg: 18, actualReps: 10, feel: "good" },
    { setNo: 2, actualWeightKg: 18, actualReps: 10, feel: "hard" },
    { setNo: 3, actualWeightKg: 18, actualReps: 8, feel: "too_hard" },
  ]);
  const r = rollupSets(sets, { met: 5, bodyWeightKg: 70 });
  check("นับครั้ง 3 เซ็ต → 4.5 นาที ปัดเป็น 5", r.durationMin === 5, `ได้ ${r.durationMin}`);
  check("นับครั้ง 3 เซ็ต → นับ workedSets ครบ", r.workedSets === 3, `ได้ ${r.workedSets}`);
  check(
    "แคลอรี่ตรงสูตร MET",
    r.calories === kcalForExercise(5, 70, 3 * REPS_SET_MINUTES),
    `ได้ ${r.calories}`
  );
  check("ปริมาณรวม = Σ kg×ครั้ง", r.volumeKg === 18 * 28, `ได้ ${r.volumeKg}`);
}

// ── 2. ท่าจับเวลา: แพลงก์ 3×60 วิ = 3 นาที ──
{
  const sets = normalizeSets([
    { setNo: 1, actualSec: 60 },
    { setNo: 2, actualSec: 60 },
    { setNo: 3, actualSec: 60 },
  ]);
  const r = rollupSets(sets, { met: 3.8, bodyWeightKg: 70 });
  check("จับเวลา 3×60 วิ → 3 นาที", r.durationMin === 3, `ได้ ${r.durationMin}`);
  check("ท่าจับเวลาไม่มีปริมาณ kg", r.volumeKg === 0, `ได้ ${r.volumeKg}`);
}

// ── 3. ผสมนับครั้ง+จับเวลาในท่าเดียว (เช่น เซ็ตสุดท้ายค้างไว้) ──
{
  const sets = normalizeSets([
    { setNo: 1, actualReps: 12 },
    { setNo: 2, actualSec: 90 },
  ]);
  const r = rollupSets(sets, { met: 4, bodyWeightKg: 60 });
  // 1.5 + 1.5 = 3 นาที
  check("ผสมครั้ง+วินาที รวมนาทีถูก", r.durationMin === 3, `ได้ ${r.durationMin}`);
}

// ── 4. feel/RPE ไม่มีผลกับแคลอรี่ ──
{
  const base = normalizeSets([{ setNo: 1, actualReps: 10 }]);
  const withFeel = normalizeSets([{ setNo: 1, actualReps: 10, feel: "too_hard", rpe: 9.5 }]);
  const a = rollupSets(base, { met: 5, bodyWeightKg: 70 });
  const b = rollupSets(withFeel, { met: 5, bodyWeightKg: 70 });
  check("feel/RPE ไม่กระทบแคลอรี่", a.calories === b.calories && a.durationMin === b.durationMin);
  check("feel ที่ถูกต้องถูกเก็บไว้", withFeel[0].feel === "too_hard" && withFeel[0].rpe === 9.5);
}

// ── 5. เซ็ตที่ยังไม่ได้ทำ (มีแต่เป้า) ไม่ถูกนับ ──
{
  const sets = normalizeSets([
    { setNo: 1, targetWeightKg: 20, targetReps: 10, actualReps: 10 },
    { setNo: 2, targetWeightKg: 20, targetReps: 10 },
  ]);
  const r = rollupSets(sets, { met: 5, bodyWeightKg: 70 });
  check("เซ็ตที่มีแต่เป้า ไม่นับเวลา", r.workedSets === 1 && r.durationMin === 2, `ได้ ${r.workedSets}/${r.durationMin}`);
}

// ── 6. clamp ค่าหลุดโลก ──
{
  const sets = normalizeSets([
    { setNo: 99, actualWeightKg: 9999, actualReps: 5000, actualSec: 99999, rpe: 42 },
  ]);
  check("setNo ตัดที่ 20", sets[0].setNo === 20, `ได้ ${sets[0].setNo}`);
  check("น้ำหนักตัดที่ 500", sets[0].actualWeightKg === 500, `ได้ ${sets[0].actualWeightKg}`);
  check("ครั้งตัดที่ 200", sets[0].actualReps === 200, `ได้ ${sets[0].actualReps}`);
  check("วินาทีตัดที่ 7200", sets[0].actualSec === 7200, `ได้ ${sets[0].actualSec}`);
  check("RPE ตัดที่ 10", sets[0].rpe === 10, `ได้ ${sets[0].rpe}`);
}

// ── 7. ค่าติดลบ/ขยะ = ถือว่าไม่ได้กรอก ──
{
  const sets = normalizeSets([
    { setNo: 1, actualWeightKg: -5, actualReps: "abc", feel: "หนักมาก", rpe: 0 },
  ]);
  check("น้ำหนักติดลบ → null", sets[0].actualWeightKg === null);
  check("ครั้งที่ไม่ใช่ตัวเลข → null", sets[0].actualReps === null);
  check("feel นอกลิสต์ → null", sets[0].feel === null);
  check("RPE 0 (นอกสเกล) → null", sets[0].rpe === null);
}

// ── 8. จำนวนเซ็ตเกิน 20 ตัดทิ้ง + setNo ที่ขาดใช้ลำดับแทน ──
{
  const many = normalizeSets(Array.from({ length: 25 }, () => ({ actualReps: 10 })));
  check("รับสูงสุด 20 เซ็ต", many.length === 20, `ได้ ${many.length}`);
  check("setNo ที่ไม่ได้ส่งมาไล่ตามลำดับ", many[0].setNo === 1 && many[19].setNo === 20);
}

// ── 9. input ที่ไม่ใช่ array / แถวขยะ ──
{
  check("ไม่ใช่ array → ว่าง", normalizeSets("นี่ไม่ใช่เซ็ต").length === 0);
  check("null → ว่าง", normalizeSets(null).length === 0);
  check("แถวที่ไม่ใช่ object ถูกทิ้ง", normalizeSets([null, 5, { actualReps: 8 }]).length === 1);
}

// ── 10. ไม่มีเซ็ตที่ทำจริง → ศูนย์ทั้งแถว (ห้ามโผล่ 1 นาทีลอย ๆ) ──
{
  const r = rollupSets(normalizeSets([{ setNo: 1, targetReps: 10 }]), { met: 5, bodyWeightKg: 70 });
  check("ไม่มีการทำจริง → 0 นาที 0 แคล", r.durationMin === 0 && r.calories === 0);
}

// ── 11. ไม่รู้น้ำหนักตัว → ใช้ค่ากลาง ไม่ใช่ 0 kcal ──
{
  const sets = normalizeSets([{ setNo: 1, actualReps: 10 }]);
  const r = rollupSets(sets, { met: 5, bodyWeightKg: null });
  check(
    "ไม่มีน้ำหนักตัว → คิดจากค่ากลาง 60 กก.",
    r.calories === kcalForExercise(5, DEFAULT_BODY_WEIGHT_KG, REPS_SET_MINUTES) && r.calories > 0,
    `ได้ ${r.calories}`
  );
}

// ── 12. ไม่รู้ MET ของท่า → ใช้ 4 (ค่ากลางเวทเบา) ──
{
  const sets = normalizeSets([{ setNo: 1, actualSec: 600 }]);
  const r = rollupSets(sets, { met: null, bodyWeightKg: 70 });
  check("ไม่มี MET → ใช้ 4", r.calories === kcalForExercise(4, 70, 10), `ได้ ${r.calories}`);
}

// ── 13. เวลาสั้นมาก (เซ็ตละ 20 วิ) ต้องไม่ปัดเหลือ 0 นาที ──
{
  const r = rollupSets(normalizeSets([{ setNo: 1, actualSec: 20 }]), { met: 3.8, bodyWeightKg: 70 });
  check("ทำจริง 20 วิ → อย่างน้อย 1 นาที", r.durationMin === 1, `ได้ ${r.durationMin}`);
}

console.log(failed === 0 ? "\n✅ ผ่านทั้งหมด" : `\n❌ ไม่ผ่าน ${failed} เคส`);
process.exit(failed === 0 ? 0 : 1);
