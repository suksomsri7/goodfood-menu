/** ตัวช่วยฟอร์มท่าออกกำลังกายฝั่งแอดมิน — แชร์ระหว่าง POST /api/exercises และ PUT /api/exercises/[id] */
import { uploadMultipleToBunny, isBase64Image } from "@/lib/bunny";

const KINDS = ["cardio", "strength", "mobility"];
const TIERS = ["none", "home", "gym"];
const UNITS = ["reps", "minutes"];

/** metadata สำหรับ engine เทรน — วงคำศัพท์ต้องตรงกับ scripts/seed-exercise-metadata.ts */
export const PATTERNS = [
  "squat", "hinge", "push_h", "push_v", "pull_h", "pull_v", "lunge", "core", "carry", "cardio", "mobility",
];
export const EQUIPMENT_NEEDED = [
  // 🔴 ต้องตรงกับ EQUIPMENT_TYPES ใน memberEquipment.ts และวงคำศัพท์ในสคริปต์ seed
  "dumbbell", "barbell", "ez_bar", "kettlebell", "weight_plate", "sandbag", "ankle_weights",
  "band", "trx", "battle_rope", "jump_rope",
  "bench", "squat_rack", "pullup_bar", "dip_bar",
  "stability_ball", "yoga_mat", "foam_roller", "medicine_ball",
  "machine", "cable", "smith_machine", "leg_press",
  "treadmill", "bike", "rowing_machine", "elliptical", "stair_climber",
];
export const MUSCLE_TAGS = [
  "quads", "hamstrings", "glutes", "calves", "adductors", "hip_flexors",
  "chest", "back", "lats", "traps", "shoulders", "biceps", "triceps", "forearms",
  "core", "obliques", "lower_back", "full_body",
];

/** เก็บเฉพาะค่าที่อยู่ในวงคำศัพท์ ไม่ซ้ำ — ค่านอกลิสต์ทิ้งเงียบ (แอดมินเลือกจากชิป ไม่ได้พิมพ์เอง) */
const pickTags = (v: unknown, allowed: string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];

/** แปลง+ตรวจ field ที่แอดมินกรอก — ใช้ร่วมกันทั้ง POST และ PUT */
export function exerciseFields(b: any) {
  const name = String(b.name || "").trim();
  if (!name) return { error: "ต้องมีชื่อท่า" };
  const met = Number(b.met);
  const difficulty = Number(b.difficulty);

  /* metadata engine เทรน — ค่าผิดทำให้ระบบจัด "ท่าแทน" ผิดกลุ่ม จึงรับเฉพาะค่าในวงคำศัพท์
     🔴 ส่ง field ไหนมาถึงเขียน field นั้น: ผู้เรียกที่ไม่รู้จัก field ใหม่ (ฟอร์มเก่าค้างในเบราว์เซอร์)
        ต้องไม่ล้าง metadata ที่ seed ไว้ทิ้งโดยไม่ตั้งใจ */
  const meta = {
    /* ชื่ออังกฤษไม่บังคับ (ท่าที่แอดมินเพิ่มเองอาจไม่มีชื่อสากล) — ว่างเก็บเป็น null ไม่ใช่สตริงว่าง
       seed จะได้รู้ว่า "ยังไม่มีใครกรอก" แล้วเติมให้ทีหลังได้ตอนคลังโค้ดมีชื่อ */
    ...(b.nameEn !== undefined ? { nameEn: String(b.nameEn || "").trim().slice(0, 120) || null } : {}),
    ...(b.pattern !== undefined ? { pattern: PATTERNS.includes(b.pattern) ? b.pattern : null } : {}),
    ...(b.primaryMuscles !== undefined ? { primaryMuscles: pickTags(b.primaryMuscles, MUSCLE_TAGS) } : {}),
    ...(b.loadable !== undefined ? { loadable: b.loadable === true } : {}),
    ...(b.equipmentNeeded !== undefined ? { equipmentNeeded: pickTags(b.equipmentNeeded, EQUIPMENT_NEEDED) } : {}),
    ...(b.difficulty !== undefined
      ? { difficulty: Number.isFinite(difficulty) ? Math.min(5, Math.max(1, Math.round(difficulty))) : 2 }
      : {}),
    ...(b.progressionGroup !== undefined
      ? { progressionGroup: String(b.progressionGroup || "").trim().slice(0, 40) || null }
      : {}),
    ...(b.commonMistakes !== undefined
      ? { commonMistakes: String(b.commonMistakes || "").trim().slice(0, 500) || null }
      : {}),
  };

  return {
    data: {
      ...meta,
      name,
      kind: KINDS.includes(b.kind) ? b.kind : "strength",
      equipment: TIERS.includes(b.equipment) ? b.equipment : "none",
      impact: b.impact === "high" ? "high" : "low",
      unit: UNITS.includes(b.unit) ? b.unit : "reps",
      // MET เพี้ยน = แคลอรี่ทุกครั้งที่ user ติ๊กท่านี้เพี้ยนตาม — คุมช่วงตามตาราง Compendium (เดิน 2 → วิ่งเร็ว 12)
      met: Number.isFinite(met) ? Math.min(15, Math.max(1, met)) : 4,
      muscles: String(b.muscles || "").trim() || null,
      cue: String(b.cue || "").trim() || null,
      videoUrl: String(b.videoUrl || "").trim() || null,
      isActive: b.isActive !== false,
    },
  };
}

/** รูป: รับได้ทั้ง URL เดิมและ base64 ใหม่ (อัปโหลดให้) — จำกัด 6 รูปเท่าเมนูอาหาร */
export async function resolveImages(images: unknown): Promise<string[]> {
  if (!Array.isArray(images)) return [];
  const list = images.filter((x): x is string => typeof x === "string").slice(0, 6);
  const base64 = list.filter((x) => isBase64Image(x));
  const urls = list.filter((x) => !isBase64Image(x));
  const uploaded = base64.length ? await uploadMultipleToBunny(base64, "exercises") : [];
  return [...urls, ...uploaded];
}

