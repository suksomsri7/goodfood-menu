/**
 * เทสคลังอุปกรณ์รายชิ้น + การ sync กลับไปค่าเดิม 3 ระดับ — รัน: npx tsx scripts/test-equipment-sync.ts
 *
 * ทำไมต้องมี: ตัวจัดแผนเดิม (planGenerator/catalogFor) ยังอ่าน Member.equipment (none|home|gym)
 * ถ้า sync ผิด ลูกค้าที่เพิ่งกรอกว่า "มีดัมเบล" จะยังได้แผนตัวเปล่าไปทั้งสัปดาห์ — เงียบ ๆ ไม่มี error
 *
 * ตรรกะล้วน ไม่แตะ DB (ฟังก์ชันชุดเดียวกับที่ PUT /api/coach/equipment เรียกจริง)
 */
import { normalizeEquipmentItems, legacyEquipmentTier, MAX_EQUIPMENT_ITEMS } from "../src/lib/memberEquipment";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const ok = (r: ReturnType<typeof normalizeEquipmentItems>) => ("items" in r ? r.items : null);

// ── 1. ไม่มีอุปกรณ์เลย → none ──
check("ว่าง → none", legacyEquipmentTier([]) === "none");
check("null → none", legacyEquipmentTier(null) === "none");

// ── 2. ดัมเบล/ยางยืด → home ──
check("ดัมเบล → home", legacyEquipmentTier([{ type: "dumbbell" }]) === "home");
check("ยางยืด → home", legacyEquipmentTier([{ type: "band" }]) === "home");
check("บาร์เบล+ม้านั่ง (ยิมบ้าน) → home", legacyEquipmentTier([{ type: "barbell" }, { type: "bench" }]) === "home");

// ── 3. เครื่อง/ฟิตเนสครบ → gym (ชนะ home เสมอ) ──
check("ฟิตเนสครบ → gym", legacyEquipmentTier([{ type: "full_gym" }]) === "gym");
check("เครื่องฟิตเนส → gym", legacyEquipmentTier([{ type: "machine" }]) === "gym");
check("ดัมเบล+เครื่อง → gym", legacyEquipmentTier([{ type: "dumbbell" }, { type: "machine" }]) === "gym");

// ── 4. ตรวจชนิดอุปกรณ์ที่ไม่รู้จัก ──
{
  const r = normalizeEquipmentItems([{ type: "เชือกกระโดดยักษ์" }]);
  check("ชนิดที่ไม่รู้จัก → error", "error" in r);
  check("ข้อความ error ไม่โทษผู้ใช้", "error" in r && !/ผิด|พลาด|ห้าม/.test(r.error), "error" in r ? r.error : "");
}

// ── 5. ช่วงน้ำหนักสลับกัน → error ──
{
  const r = normalizeEquipmentItems([{ type: "dumbbell", minKg: 24, maxKg: 2 }]);
  check("min > max → error", "error" in r);
}

// ── 6. ก้าวน้ำหนักต้องมากกว่า 0 ──
{
  check("increment = 0 → error", "error" in normalizeEquipmentItems([{ type: "dumbbell", incrementKg: 0 }]));
  const good = ok(normalizeEquipmentItems([{ type: "dumbbell", minKg: 2, maxKg: 24, incrementKg: 2 }]));
  check("ดัมเบลปรับได้ 2-24 ก้าว 2 ผ่าน", !!good && good[0].incrementKg === 2);
  // ก้าว 1.25 กก. (แผ่นเล็ก) มีจริงในโลก ต้องไม่ถูกปัดทิ้ง
  const fine = ok(normalizeEquipmentItems([{ type: "barbell", incrementKg: 1.25 }]));
  check("ก้าว 1.25 กก. ยังอยู่ครบ", !!fine && fine[0].incrementKg === 1.25);
}

// ── 7. ค่าที่ไม่ได้กรอก/ขยะ → null ไม่ใช่ 0 (0 กก. แปลว่า "ยกบาร์เปล่า" คนละความหมายกับ "ไม่รู้") ──
{
  const items = ok(normalizeEquipmentItems([{ type: "kettlebell", minKg: "", maxKg: "หนักมาก" }]));
  check("ค่าว่าง/ขยะ → null", !!items && items[0].minKg === null && items[0].maxKg === null);
  check("isPair ไม่ส่งมา → true", !!items && items[0].isPair === true);
  check("variant นอกลิสต์ → null", !!items && items[0].variant === null);
}

// ── 8. variant/isPair ที่ส่งมาถูกต้อง ──
{
  const items = ok(normalizeEquipmentItems([{ type: "dumbbell", variant: "adjustable", isPair: false }]));
  check("variant adjustable เก็บไว้", !!items && items[0].variant === "adjustable");
  check("isPair=false เก็บไว้", !!items && items[0].isPair === false);
}

// ── 9. ตัดจำนวนรายการ + input ที่ไม่ใช่ array ──
{
  const many = ok(normalizeEquipmentItems(Array.from({ length: 30 }, () => ({ type: "dumbbell" }))));
  check(`รับสูงสุด ${MAX_EQUIPMENT_ITEMS} ชิ้น`, !!many && many.length === MAX_EQUIPMENT_ITEMS, `ได้ ${many?.length}`);
  check("ไม่ใช่ array → error", "error" in normalizeEquipmentItems("dumbbell"));
  check("ไม่ส่ง items มาเลย → ว่าง (ลบคลังทั้งหมด)", ok(normalizeEquipmentItems(undefined))?.length === 0);
}

// ── 10. ครบวงจร: ของที่ normalize แล้ว sync เป็น tier ได้ถูก ──
{
  const items = ok(normalizeEquipmentItems([
    { type: "dumbbell", variant: "adjustable", minKg: 2, maxKg: 24, incrementKg: 2 },
    { type: "band" },
  ]));
  check("คลังบ้าน 2 ชิ้น → home", !!items && legacyEquipmentTier(items) === "home");
  const gym = ok(normalizeEquipmentItems([{ type: "treadmill" }, { type: "full_gym" }]));
  check("ลู่วิ่ง+ฟิตเนสครบ → gym", !!gym && legacyEquipmentTier(gym) === "gym");
  const home = ok(normalizeEquipmentItems([{ type: "treadmill" }]));
  check("ลู่วิ่งที่บ้านอย่างเดียว → home (ไม่ใช่ gym)", !!home && legacyEquipmentTier(home) === "home");
}

console.log(failed === 0 ? "\n✅ ผ่านทั้งหมด" : `\n❌ ไม่ผ่าน ${failed} เคส`);
process.exit(failed === 0 ? 0 : 1);
