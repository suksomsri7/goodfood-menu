/**
 * คลังอุปกรณ์รายชิ้นของสมาชิก — ตัวช่วยที่ใช้ร่วมกันระหว่าง API /api/coach/equipment กับเทสถาวร
 *
 * ทำไมต้องรายชิ้น: Member.equipment เดิมมีแค่ none/home/gym บอกได้แค่ "มีของไหม"
 * แต่ progression ต้องรู้ "ก้าวละกี่กิโล" — ดัมเบลชุด 2-24 ก้าว 2 กก. สั่ง 16→18 ได้ แต่สั่ง 17.5 ไม่ได้
 *
 * 🔴 ต้อง sync กลับไปที่ Member.equipment ทุกครั้ง — planGenerator/catalogFor เดิมยังอ่านค่า 3 ระดับนั้นอยู่
 */

/** ชนิดอุปกรณ์ที่ระบบรู้จัก (ค่านอกลิสต์ = ปฏิเสธ ไม่ใช่เดาให้) */
export const EQUIPMENT_TYPES = [
  // ── ของถ่วงน้ำหนัก ──
  "dumbbell",
  "barbell",
  "ez_bar",
  "kettlebell",
  "weight_plate",
  "sandbag",
  "ankle_weights",
  // ── แรงต้าน/ตัวช่วยแบบไม่มีน้ำหนัก ──
  "band",
  "trx",
  "battle_rope",
  "jump_rope",
  // ── โครง/ที่รองรับ ──
  "bench",
  "squat_rack",
  "pullup_bar",
  "dip_bar",
  "stability_ball",
  "yoga_mat",
  "foam_roller",
  "medicine_ball",
  // ── เครื่องในฟิตเนส ──
  "machine",
  "cable",
  "smith_machine",
  "leg_press",
  // ── คาร์ดิโอ ──
  "treadmill",
  "bike",
  "rowing_machine",
  "elliptical",
  "stair_climber",
  // ── เหมารวม ──
  "full_gym",
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

/**
 * ชื่อไทยของอุปกรณ์ — ใช้คำชุดเดียวกับหน้า "ท่าออกกำลังกาย" ในหลังบ้าน
 * (คีย์ยังเป็นอังกฤษใน DB เหมือนเดิม เปลี่ยนแค่สิ่งที่คนอ่านเห็น)
 */
export const EQUIPMENT_LABEL_TH: Record<string, string> = {
  dumbbell: "ดัมเบล",
  barbell: "บาร์เบล",
  ez_bar: "บาร์ EZ (บาร์หยัก)",
  kettlebell: "เคตเทิลเบล",
  weight_plate: "แผ่นน้ำหนัก",
  sandbag: "ถุงทราย",
  ankle_weights: "ถ่วงข้อเท้า/ข้อมือ",
  band: "ยางยืด",
  trx: "สายห้อย TRX",
  battle_rope: "เชือกแบทเทิลโรป",
  jump_rope: "เชือกกระโดด",
  bench: "ม้านั่ง",
  squat_rack: "แร็ค/ชั้นวางบาร์",
  pullup_bar: "บาร์โหน",
  dip_bar: "บาร์ดิป",
  stability_ball: "บอลโยคะ",
  yoga_mat: "เสื่อโยคะ",
  foam_roller: "โฟมโรลเลอร์",
  medicine_ball: "เมดิซินบอล",
  machine: "เครื่องฟิตเนส",
  cable: "เคเบิลครอส",
  smith_machine: "สมิธแมชชีน",
  leg_press: "เครื่องเลกเพรส",
  treadmill: "ลู่วิ่ง",
  bike: "จักรยาน",
  rowing_machine: "เครื่องพายเรือ",
  elliptical: "เครื่องเดินวงรี",
  stair_climber: "เครื่องเดินขึ้นบันได",
  full_gym: "ฟิตเนสครบ",
};

/** จัดกลุ่มไว้ให้จอเลือกอุปกรณ์อ่านง่าย — 29 ชนิดเรียงยาวเป็นพืดคือของที่ไม่มีใครกรอกจนจบ */
export const EQUIPMENT_GROUPS: Array<{ label: string; types: string[] }> = [
  { label: "น้ำหนักอิสระ", types: ["dumbbell", "barbell", "ez_bar", "kettlebell", "weight_plate", "sandbag", "ankle_weights"] },
  { label: "แรงต้าน/เชือก", types: ["band", "trx", "battle_rope", "jump_rope"] },
  { label: "ม้านั่งและโครง", types: ["bench", "squat_rack", "pullup_bar", "dip_bar"] },
  { label: "อุปกรณ์พื้น", types: ["yoga_mat", "stability_ball", "foam_roller", "medicine_ball"] },
  { label: "เครื่องในฟิตเนส", types: ["machine", "cable", "smith_machine", "leg_press"] },
  { label: "คาร์ดิโอ", types: ["treadmill", "bike", "rowing_machine", "elliptical", "stair_climber"] },
  { label: "เหมารวม", types: ["full_gym"] },
];

/** ของที่นับเป็น "ฟิตเนสครบ" — เข้าถึงเครื่องได้ = ทำท่า tier gym ได้ทั้งหมด */
const GYM_TYPES = ["full_gym", "machine", "cable", "smith_machine", "leg_press"];

/** ปรับได้/ตายตัว — มีผลกับ increment (ดัมเบลตายตัว 1 คู่ = ขึ้นน้ำหนักไม่ได้เลย) */
const VARIANTS = ["fixed", "adjustable"];

export const MAX_EQUIPMENT_ITEMS = 30;

export interface EquipmentItem {
  type: string;
  variant: string | null;
  minKg: number | null;
  maxKg: number | null;
  incrementKg: number | null;
  isPair: boolean;
}

const numOrNull = (v: unknown, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  // ปัด 2 ตำแหน่ง: ดัมเบลก้าว 1.25 กก. มีจริง แต่ 1.2345 ไม่มี
  return Math.round(Math.min(max, n) * 100) / 100;
};

/**
 * ตรวจ+ทำความสะอาดรายการอุปกรณ์ที่แอปส่งมา
 * คืน error เป็นข้อความไทยที่บอก "ค่าไหนไม่พอดี" ไม่ใช่ตำหนิคนกรอก
 */
export function normalizeEquipmentItems(raw: unknown): { items: EquipmentItem[] } | { error: string } {
  if (raw === undefined || raw === null) return { items: [] };
  if (!Array.isArray(raw)) return { error: "รูปแบบข้อมูลอุปกรณ์ไม่ตรงกับที่ระบบรออยู่" };

  const items: EquipmentItem[] = [];
  for (const r of raw.slice(0, MAX_EQUIPMENT_ITEMS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const type = String(o.type ?? "").trim();
    if (!EQUIPMENT_TYPES.includes(type as EquipmentType)) {
      return { error: `ยังไม่รองรับอุปกรณ์ชนิด "${type || "(ไม่ระบุ)"}" — เลือกจากรายการที่มีให้ก่อนนะ` };
    }

    const minKg = numOrNull(o.minKg, 500);
    const maxKg = numOrNull(o.maxKg, 500);
    if (minKg !== null && maxKg !== null && minKg > maxKg) {
      return { error: "ช่วงน้ำหนักสลับกันอยู่ (ต่ำสุดมากกว่าสูงสุด)" };
    }

    const incrementKg = numOrNull(o.incrementKg, 50);
    if (incrementKg !== null && incrementKg <= 0) {
      return { error: "ก้าวน้ำหนักต้องมากกว่า 0 กก." };
    }

    items.push({
      type,
      variant: VARIANTS.includes(String(o.variant)) ? String(o.variant) : null,
      minKg,
      maxKg,
      incrementKg,
      // ดัมเบลนับเป็นคู่โดยปริยาย · บาร์เบล/เครื่อง = ชิ้นเดียว แต่ให้แอปส่งมาได้
      isPair: o.isPair === undefined ? true : o.isPair !== false,
    });
  }
  return { items };
}

/**
 * แปลงคลังรายชิ้น → ค่า Member.equipment เดิม (none | home | gym)
 * มีเครื่อง/ฟิตเนสครบ → gym · มีของอย่างอื่นอย่างน้อย 1 ชิ้น → home · ไม่มีเลย → none
 */
export function legacyEquipmentTier(items: { type: string }[] | null | undefined): "none" | "home" | "gym" {
  if (!items || items.length === 0) return "none";
  if (items.some((i) => GYM_TYPES.includes(i.type))) return "gym";
  return "home";
}
