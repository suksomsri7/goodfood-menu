/**
 * คลังท่าออกกำลังกายมาตรฐาน (Coach)
 *
 * ทำไมต้องมี: เดิม AI แต่งชื่อท่าอิสระทุกครั้ง ("โปรแกรมวันจันทร์", "เดินเร็ว/วิ่งเหยาะ")
 * → จับคู่วิดีโอ/รูปสาธิตไม่ได้ · กรองท่าตามอุปกรณ์ที่ user มีไม่ได้ · ท่าไม่สม่ำเสมอ
 * ตอนนี้แผนต้องเลือกจากคลังนี้เท่านั้น แล้ว snapExercise() บังคับชื่อให้ตรง key
 *
 * equipment tier: none (ตัวเปล่า) → home (ดัมเบล/ยางยืด) → gym (ฟิตเนสครบ)
 * impact: high = มีกระโดด/แรงกระแทกเข่า (ตัดออกอัตโนมัติถ้ามีข้อห้ามเรื่องเข่า/กระโดด)
 *
 * 🔴 ไฟล์นี้เป็นแหล่งความจริงเดียวของ metadata ระบบเทรนด้วย (pattern / กล้ามเนื้อหลัก / loadable /
 *    อุปกรณ์ / ความยาก / บันได) — scripts/seed-exercise-metadata.ts อ่านจากที่นี่ ไม่มีตารางซ้ำอีกชุด
 *    ค่าที่ผิดทำให้ระบบจัด "ท่าแทน" ตอนเจ็บ/บันไดความยากผิด → แก้แล้วต้องรัน seed-exercises.js (ด่านตรวจ)
 * 🔴 ท่าใหม่ให้ "ต่อท้าย" เสมอ ห้ามแทรกกลาง — matchExercise()/defaultExercise() เลือกตัวแรกที่เจอ
 *    แทรกกลางแล้วท่าที่แผนเก่าเคยได้จะเปลี่ยนไปเงียบ ๆ
 */

import type { EquipmentType } from "@/lib/memberEquipment";

export type EquipmentTier = "none" | "home" | "gym";
export type ExerciseKind = "cardio" | "strength" | "mobility";

/** รูปแบบการเคลื่อนไหว — วงคำศัพท์เดียวกับ exerciseAdmin.ts (engine ใช้หาท่าแทน) */
export type MovementPattern =
  | "squat" | "hinge" | "push_h" | "push_v" | "pull_h" | "pull_v"
  | "lunge" | "core" | "carry" | "cardio" | "mobility";

/** กล้ามเนื้อหลัก (แท็กอังกฤษ) — ต้องตรงกับ MUSCLE_TAGS ใน exerciseAdmin.ts */
export type MuscleTag =
  | "quads" | "hamstrings" | "glutes" | "calves" | "adductors" | "hip_flexors"
  | "chest" | "back" | "lats" | "traps" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "core" | "obliques" | "lower_back" | "full_body";

/**
 * อุปกรณ์รายชิ้น — ว่าง = ตัวเปล่า/ไม่ต้องใช้อะไร
 * 🔴 ผูกกับ EQUIPMENT_TYPES ตรง ๆ ห้ามพิมพ์ลิสต์ซ้ำที่นี่อีก
 *    (ของเดิมลอกไว้ 9 ตัว แล้วลืมอัปเดตตอนขยายเป็น 28 → ท่าใหม่ที่ใช้ cable/trx/โยคะ compile ไม่ผ่าน)
 */
export type EquipmentItem = EquipmentType;

export interface CatalogExercise {
  key: string;
  name: string; // ชื่อไทยมาตรฐาน — ใช้เป็นชื่อในแผนตรง ๆ
  /** ชื่อสากลภาษาอังกฤษ — ใช้ค้นในหลังบ้าน/หาคลิปอ้างอิง/สื่อสารกับเทรนเนอร์ (ไม่โชว์ในแผนของลูกค้า) */
  nameEn: string;
  equipment: EquipmentTier;
  kind: ExerciseKind;
  unit: "minutes" | "reps";
  impact: "low" | "high";
  /**
   * MET (Compendium of Physical Activities) — ใช้คำนวณแคลอรี่ที่เผาได้จากน้ำหนักตัวจริง
   * ท่านับ reps ใช้ค่าของ strength training ช่วง 3.5–6 ตามความหนัก (ยืดเหยียด 2.3–2.5)
   */
  met: number;
  muscles: string;
  cue: string; // ทิปฟอร์มสั้น ๆ แสดงในหน้า "ดูท่า"

  /* ── metadata ระบบเทรน (เฟส A) ──
     กติกาที่ใช้ตัดสินตอนกรอก:
      1. loadable = true เมื่อ "น้ำหนักที่ใส่เพิ่ม" คือตัวเดินความก้าวหน้าจริง (ดัมเบล/บาร์เบล/เคตเทิล/เครื่อง-เคเบิล)
         ยางยืดไม่นับ (แรงต้านขึ้นกับเส้น/ระยะยืด ชั่งเป็นกิโลไม่ได้)
      2. progressionGroup ใส่เฉพาะที่มีบันไดจริงของท่าตัวเปล่า/แรงต้านคงที่ — ท่าที่ขึ้นกิโลได้เดินด้วยน้ำหนักอยู่แล้ว
      3. ห้ามปน impact สูง/ต่ำ และห้ามปนหน่วยนับ (ครั้ง/นาที) ในบันไดเดียวกัน + ความยากห้ามซ้ำในบันได
      4. ท่าเสริมกล้ามเล็กจัด pattern ตามวันที่มันอยู่จริงในโปรแกรม push/pull/legs
         — calf_raise=squat(วันขา) · db_curl=pull_h(วันดึง) · db_tricep=push_h(วันดัน) */
  pattern: MovementPattern;
  primaryMuscles: MuscleTag[];
  loadable: boolean;
  equipmentNeeded: EquipmentItem[];
  difficulty: number; // 1-5
  progressionGroup?: string;

  /** สื่อสาธิต (ถ้ามี) — เสิร์ฟจาก /uploads/coach-exercise/<key>.{webp,mp4,jpg} */
  media?: { webp: string; mp4: string; poster: string };
}

const MEDIA_BASE = "/uploads/coach-exercise";
/** ท่าที่มีคลิปสาธิตแล้ว (สร้างด้วย fal.ai Veo 3 Fast + คนตรวจฟอร์มก่อนปล่อย) */
const WITH_MEDIA = new Set<string>(["squat_bw"]);

function attachMedia(list: CatalogExercise[]): CatalogExercise[] {
  return list.map((e) =>
    WITH_MEDIA.has(e.key)
      ? { ...e, media: { webp: `${MEDIA_BASE}/${e.key}.webp`, mp4: `${MEDIA_BASE}/${e.key}.mp4`, poster: `${MEDIA_BASE}/${e.key}.jpg` } }
      : e
  );
}

const CATALOG_RAW: CatalogExercise[] = [
  // ── ตัวเปล่า: คาร์ดิโอ ──
  { key: "walk_fast", name: "เดินเร็ว", nameEn: "Brisk Walk", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 4.3, muscles: "ทั้งตัว", cue: "อกตั้ง แกว่งแขนธรรมชาติ ก้าวยาวพอสบาย", pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "jog_light", name: "วิ่งเหยาะ", nameEn: "Light Jog", equipment: "none", kind: "cardio", unit: "minutes", impact: "high", met: 7.0, muscles: "ขา หัวใจ", cue: "ลงกลางเท้า ไหล่ผ่อน หายใจเป็นจังหวะ", pattern: "cardio", primaryMuscles: ["quads", "hamstrings", "calves"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "stair_step", name: "ขึ้นลงบันได", nameEn: "Stair Climbing", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 8.0, muscles: "ขา ก้น", cue: "วางเต็มฝ่าเท้า ดันส้นเท้าขึ้น ไม่โน้มตัวมาก", pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "jumping_jack", name: "กระโดดตบ", nameEn: "Jumping Jack", equipment: "none", kind: "cardio", unit: "reps", impact: "high", met: 8.0, muscles: "ทั้งตัว", cue: "ลงเบา ๆ งอเข่าเล็กน้อยรับแรง", pattern: "cardio", primaryMuscles: ["full_body", "calves", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "mountain_climber", name: "เมาน์เทนไคลม์เบอร์", nameEn: "Mountain Climber", equipment: "none", kind: "cardio", unit: "reps", impact: "high", met: 8.0, muscles: "แกนกลาง ขา", cue: "สะโพกนิ่ง ไม่ยกก้นสูง เข่าเข้าอก", pattern: "cardio", primaryMuscles: ["core", "hip_flexors", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "burpee", name: "เบอร์พี", nameEn: "Burpee", equipment: "none", kind: "cardio", unit: "reps", impact: "high", met: 8.0, muscles: "ทั้งตัว", cue: "หลังตรงตอนลง ค่อย ๆ เพิ่มความเร็ว", pattern: "cardio", primaryMuscles: ["full_body", "quads", "chest"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "shadow_box", name: "ชกลม", nameEn: "Shadow Boxing", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 5.5, muscles: "ไหล่ แกนกลาง", cue: "หมุนสะโพกตาม อย่าเหยียดศอกสุด", pattern: "cardio", primaryMuscles: ["shoulders", "core", "back"], loadable: false, equipmentNeeded: [], difficulty: 2 },

  // ── ตัวเปล่า: กำลัง ──
  { key: "squat_bw", name: "สควอทน้ำหนักตัว", nameEn: "Bodyweight Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "เข่าไปทางปลายเท้า อกตั้ง ลงเท่าที่หลังยังตรง", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "squat_bw" },
  { key: "wall_sit", name: "นั่งพิงกำแพง", nameEn: "Wall Sit", equipment: "none", kind: "strength", unit: "minutes", impact: "low", met: 4.0, muscles: "ต้นขา", cue: "เข่างอ 90 องศา หลังแนบกำแพง", pattern: "squat", primaryMuscles: ["quads"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "lunge", name: "ลันจ์", nameEn: "Forward Lunge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ขา ก้น", cue: "ก้าวยาวพอ เข่าหน้าไม่เลยปลายเท้า ลำตัวตั้ง", pattern: "lunge", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "squat_bw" },
  { key: "glute_bridge", name: "กลูตบริดจ์", nameEn: "Glute Bridge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ก้น หลังล่าง", cue: "บีบก้นตอนยกสุด ไม่แอ่นหลัง", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings", "lower_back"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "pushup", name: "วิดพื้น", nameEn: "Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "อก ไหล่ แขน", cue: "ลำตัวเป็นเส้นตรง ศอกแนบลำตัว 45 องศา", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "pushup" },
  { key: "pushup_knee", name: "วิดพื้นเข่าติดพื้น", nameEn: "Knee Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "อก แขน", cue: "สะโพกไม่ตก ลงช้าขึ้นเร็ว", pattern: "push_h", primaryMuscles: ["chest", "triceps", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "pushup" },
  { key: "plank", name: "แพลงก์", nameEn: "Plank", equipment: "none", kind: "strength", unit: "minutes", impact: "low", met: 3.8, muscles: "แกนกลาง", cue: "ศอกใต้ไหล่ เกร็งหน้าท้อง ไม่ยกก้น", pattern: "core", primaryMuscles: ["core", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "plank" },
  { key: "side_plank", name: "ไซด์แพลงก์", nameEn: "Side Plank", equipment: "none", kind: "strength", unit: "minutes", impact: "low", met: 3.5, muscles: "เอว แกนกลาง", cue: "สะโพกยกสูง ลำตัวเป็นเส้นตรง", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "plank" },
  { key: "crunch", name: "ครันช์", nameEn: "Crunch", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "หน้าท้อง", cue: "ยกแค่สะบัก ไม่ดึงคอ", pattern: "core", primaryMuscles: ["core"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "bicycle_crunch", name: "จักรยานอากาศ", nameEn: "Bicycle Crunch", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "หน้าท้อง เอว", cue: "ช้า ๆ บิดจากลำตัว ไม่ใช่ข้อศอก", pattern: "core", primaryMuscles: ["core", "obliques"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "superman", name: "ซูเปอร์แมน", nameEn: "Superman", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "หลัง", cue: "ยกแขนขาพอตึง คอเป็นแนวเดียวกับหลัง", pattern: "core", primaryMuscles: ["lower_back", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "bird_dog", name: "เบิร์ดด็อก", nameEn: "Bird Dog", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "หลัง แกนกลาง", cue: "เหยียดแขนขาตรงข้าม สะโพกไม่บิด", pattern: "core", primaryMuscles: ["core", "lower_back", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "calf_raise", name: "เขย่งปลายเท้า", nameEn: "Standing Calf Raise", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "น่อง", cue: "ขึ้นสุด ค้าง 1 วิ ลงช้า", pattern: "squat", primaryMuscles: ["calves"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "step_up", name: "สเต็ปอัพบนขั้นบันได", nameEn: "Step-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ดันด้วยส้นเท้าข้างบน ไม่ถีบเท้าล่าง", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "squat_bw" },

  // ── ตัวเปล่า: ยืดเหยียด/ฟื้นฟู ──
  { key: "stretch_full", name: "ยืดเหยียดทั้งตัว", nameEn: "Full-Body Stretch", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "ทั้งตัว", cue: "ค้างท่าละ 20-30 วิ หายใจยาว ไม่กระตุก", pattern: "mobility", primaryMuscles: ["full_body"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "yoga_basic", name: "โยคะพื้นฐาน", nameEn: "Basic Yoga Flow", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.5, muscles: "ทั้งตัว", cue: "เคลื่อนตามลมหายใจ ไม่ฝืนจุดที่เจ็บ", pattern: "mobility", primaryMuscles: ["full_body", "core"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "cat_cow", name: "ท่าแมว-วัว", nameEn: "Cat-Cow", equipment: "none", kind: "mobility", unit: "reps", impact: "low", met: 2.3, muscles: "หลัง", cue: "แอ่น-โก่งหลังช้า ๆ ตามลมหายใจ", pattern: "mobility", primaryMuscles: ["lower_back", "core"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "hip_stretch", name: "ยืดสะโพก", nameEn: "Hip Flexor Stretch", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "สะโพก", cue: "ค้างข้างละ 30 วิ ไม่เด้ง", pattern: "mobility", primaryMuscles: ["hip_flexors", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },

  // ── ดัมเบล / ยางยืด (home) ──
  { key: "db_squat", name: "ดัมเบลสควอท", nameEn: "Dumbbell Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ถือดัมเบลข้างลำตัว อกตั้ง ลงช้า", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_row", name: "ดัมเบลโรว์", nameEn: "Dumbbell Row", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หลัง แขน", cue: "หลังตรง ดึงศอกไปข้างหลัง บีบสะบัก", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3, progressionGroup: "row" },
  { key: "db_press", name: "ดัมเบลไหล่", nameEn: "Dumbbell Shoulder Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ไหล่", cue: "ไม่แอ่นหลัง ดันขึ้นเหนือศีรษะช้า ๆ", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_curl", name: "ไบเซปเคิร์ล", nameEn: "Dumbbell Biceps Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แขนหน้า", cue: "ศอกแนบลำตัว ไม่เหวี่ยง", pattern: "pull_h", primaryMuscles: ["biceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_tricep", name: "ไทรเซปคิกแบ็ก", nameEn: "Dumbbell Triceps Kickback", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แขนหลัง", cue: "ต้นแขนนิ่ง เหยียดปลายแขนไปหลัง", pattern: "push_h", primaryMuscles: ["triceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_rdl", name: "ดัมเบลเดดลิฟท์", nameEn: "Dumbbell Romanian Deadlift", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ก้น หลังต้นขา", cue: "ดันสะโพกไปหลัง หลังตรงตลอด", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes", "lower_back"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "band_row", name: "ยางยืดโรว์", nameEn: "Band Row", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "หลัง", cue: "ดึงจนศอกผ่านลำตัว บีบสะบักค้าง 1 วิ", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2, progressionGroup: "row" },
  { key: "band_pull_apart", name: "ยางยืดกางอก", nameEn: "Band Pull-Apart", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "หลังบน ไหล่", cue: "แขนตึงระดับอก กางออกช้า ๆ", pattern: "pull_h", primaryMuscles: ["shoulders", "traps", "back"], loadable: false, equipmentNeeded: ["band"], difficulty: 1 },
  { key: "farmer_walk", name: "ฟาร์เมอร์วอล์ค", nameEn: "Farmer's Walk", equipment: "home", kind: "strength", unit: "minutes", impact: "low", met: 5.0, muscles: "ทั้งตัว", cue: "ถือหนักสองข้าง ไหล่ตั้ง เดินช้า", pattern: "carry", primaryMuscles: ["forearms", "traps", "core"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },

  // ── ฟิตเนส (gym) ──
  { key: "treadmill", name: "ลู่วิ่ง", nameEn: "Treadmill Run", equipment: "gym", kind: "cardio", unit: "minutes", impact: "high", met: 7.0, muscles: "ขา หัวใจ", cue: "เริ่มเดินอุ่นเครื่อง 5 นาทีก่อนเพิ่มความเร็ว", pattern: "cardio", primaryMuscles: ["quads", "hamstrings", "calves"], loadable: false, equipmentNeeded: ["treadmill"], difficulty: 2 },
  { key: "stationary_bike", name: "จักรยานฟิตเนส", nameEn: "Stationary Bike", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 6.8, muscles: "ขา หัวใจ", cue: "ปรับอานให้เข่างอเล็กน้อยตอนปั่นสุด", pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: ["bike"], difficulty: 1 },
  { key: "elliptical", name: "เครื่องเดินวงรี", nameEn: "Elliptical Trainer", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 5.0, muscles: "ทั้งตัว", cue: "ยืนตรง ไม่ทิ้งน้ำหนักบนมือจับ", pattern: "cardio", primaryMuscles: ["full_body", "quads"], loadable: false, equipmentNeeded: ["machine"], difficulty: 1 },
  { key: "rowing_machine", name: "เครื่องกรรเชียงบก", nameEn: "Rowing Machine", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 7.0, muscles: "หลัง ขา", cue: "ดันขา → เอนลำตัว → ดึงแขน ตามลำดับ", pattern: "cardio", primaryMuscles: ["back", "quads", "lats"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
  { key: "lat_pulldown", name: "ลัตพูลดาวน์", nameEn: "Lat Pulldown", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หลัง", cue: "ดึงลงหน้าอก อกตั้ง ไม่เหวี่ยงตัว", pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "chest_press", name: "เชสเพรส", nameEn: "Machine Chest Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "อก ไหล่", cue: "ศอกไม่กางเกิน 45 องศา ดันจนเกือบสุดแขน", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "leg_press", name: "เลกเพรส", nameEn: "Leg Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ไม่ล็อกเข่าตอนดันสุด หลังแนบเบาะ", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "leg_curl", name: "เลกเคิร์ล", nameEn: "Leg Curl", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หลังต้นขา", cue: "งอเข่าช้า ๆ ปล่อยกลับแบบควบคุม", pattern: "hinge", primaryMuscles: ["hamstrings"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "cable_row", name: "เคเบิลโรว์", nameEn: "Cable Row", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หลัง", cue: "หลังตรง ดึงเข้าท้องน้อย บีบสะบัก", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["cable"], difficulty: 4, progressionGroup: "row" },
  { key: "barbell_bench", name: "บาร์เบลเบนช์เพรส", nameEn: "Barbell Bench Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "อก แขน", cue: "มีคนช่วยดูเสมอเมื่อขึ้นน้ำหนักหนัก", pattern: "push_h", primaryMuscles: ["chest", "triceps", "shoulders"], loadable: true, equipmentNeeded: ["barbell", "bench"], difficulty: 4 },
  { key: "barbell_squat", name: "บาร์เบลสควอท", nameEn: "Barbell Back Squat", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ขา ก้น", cue: "แกนกลางเกร็ง ลงจนต้นขาขนานพื้น", pattern: "squat", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 4 },
  { key: "pullup_assist", name: "พูลอัพแบบมีตัวช่วย", nameEn: "Assisted Pull-Up", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หลัง แขน", cue: "เริ่มจากแรงช่วยเยอะแล้วค่อยลด", pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },

  /* ══════════ ต่อขยาย (ส.ค. 69) — ตั้งแต่บรรทัดนี้ลงไปคือท่าที่เพิ่มทีหลัง ห้ามแทรกกลางของเดิม ══════════ */

  // ── ตัวเปล่า: บันไดวิดพื้น (pushup: มือสูง 1 → เข่า 2 → เต็ม 3 → มือเพชร 4 → เท้าสูง 5) ──
  { key: "pushup_incline", name: "วิดพื้นมือสูง", nameEn: "Incline Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "อก ไหล่ แขน", cue: "วางมือบนโต๊ะ/ขอบเตียงที่มั่นคง ยิ่งสูงยิ่งเบา ลำตัวเป็นเส้นตรง", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 1, progressionGroup: "pushup" },
  { key: "pushup_diamond", name: "วิดพื้นมือเพชร", nameEn: "Diamond Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "แขนหลัง อก", cue: "นิ้วโป้งกับนิ้วชี้ชนกันเป็นสามเหลี่ยมใต้อก ศอกแนบลำตัว", pattern: "push_h", primaryMuscles: ["triceps", "chest", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "pushup" },
  { key: "pushup_decline", name: "วิดพื้นเท้าสูง", nameEn: "Decline Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "อกบน ไหล่", cue: "วางเท้าบนเก้าอี้ สะโพกไม่ตก ลงช้าคุมจังหวะ", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 5, progressionGroup: "pushup" },
  // ก้นโด่ง = ดันแนวดิ่ง (push_v) คนละบันไดกับวิดพื้น — ถ้ายัดรวมบันได pushup ระบบจะเอาไปแทนท่าอกผิดมัด
  { key: "pushup_pike", name: "วิดพื้นก้นโด่ง", nameEn: "Pike Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ไหล่ แขนหลัง", cue: "ยกก้นสูงเป็นตัว V หย่อนหัวลงระหว่างมือ ไม่งอหลัง", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 4 },

  // ── ตัวเปล่า: บันไดสควอท (squat_bw: นั่งเก้าอี้ 1 → สควอท 2 → สเต็ปอัพ 3 → ลันจ์ 4 → ขาเดียว 5) ──
  { key: "squat_box", name: "สควอทนั่งเก้าอี้", nameEn: "Box Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ขา ก้น", cue: "นั่งแตะเก้าอี้เบา ๆ แล้วลุกขึ้น ไม่ทิ้งตัวลงกระแทก", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 1, progressionGroup: "squat_bw" },
  { key: "pistol_squat", name: "สควอทขาเดียว", nameEn: "Pistol Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ขา ก้น แกนกลาง", cue: "จับที่ยึดช่วยทรงตัวก่อน ลงช้าจนก้นเกือบแตะส้น เข่าไม่บิดเข้า", pattern: "squat", primaryMuscles: ["quads", "glutes", "core"], loadable: false, equipmentNeeded: [], difficulty: 5, progressionGroup: "squat_bw" },

  // ── ตัวเปล่า: บันไดขาเดียว (split_squat: ก้าวค้าง 2 → ถอยหลัง 3 → เดิน 4 → บัลแกเรียน 5) ──
  { key: "split_squat", name: "สปลิตสควอท", nameEn: "Split Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ขา ก้น", cue: "ยืนก้าวขาค้างไว้ ย่อลงตรง ๆ เข่าหลังเกือบแตะพื้น", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "split_squat" },
  { key: "lunge_reverse", name: "ลันจ์ถอยหลัง", nameEn: "Reverse Lunge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ขา ก้น", cue: "ก้าวถอยหลังแล้วย่อลง ลำตัวตั้งตรง (แรงกดเข่าน้อยกว่าก้าวไปหน้า)", pattern: "lunge", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "split_squat" },
  { key: "lunge_walking", name: "ลันจ์ก้าวสลับ", nameEn: "Walking Lunge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ก้าวยาวสม่ำเสมอ ดันด้วยส้นเท้าหน้า ไม่ทิ้งตัวลงเร็ว", pattern: "lunge", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "split_squat" },
  { key: "bulgarian_split_squat", name: "บัลแกเรียนสปลิตสควอท", nameEn: "Bulgarian Split Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "ขา ก้น", cue: "วางหลังเท้าบนเก้าอี้ ย่อลงตรง ๆ น้ำหนักอยู่ที่ขาหน้า", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 5, progressionGroup: "split_squat" },

  // ── ตัวเปล่า: บันไดดึง (row: ขอบประตู 1 → ยางยืด 2 → ดัมเบล 3 → เคเบิล 4 → ใต้โต๊ะ 5) ──
  { key: "doorway_row", name: "โรว์ดึงขอบประตู", nameEn: "Doorway Row", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "หลัง แขนหน้า", cue: "จับวงกบที่แข็งแรง เอนตัวไปหลังแล้วดึงตัวเข้า บีบสะบัก", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: [], difficulty: 1, progressionGroup: "row" },
  { key: "inverted_row", name: "โรว์ใต้โต๊ะ", nameEn: "Inverted Row", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หลัง ปีก แขนหน้า", cue: "นอนใต้โต๊ะที่รับน้ำหนักได้ ลำตัวตรงเป็นแผ่นเดียว ดึงอกชนขอบโต๊ะ", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: [], difficulty: 5, progressionGroup: "row" },

  // ── ตัวเปล่า: บันไดสะโพก (hip_bridge) + ดิพ ──
  { key: "hip_thrust_bw", name: "ฮิปทรัสต์น้ำหนักตัว", nameEn: "Bodyweight Hip Thrust", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ก้น หลังต้นขา", cue: "พาดสะบักบนม้านั่ง/โซฟา ดันสะโพกขึ้นจนลำตัวขนานพื้น บีบก้นค้าง 1 วิ", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: false, equipmentNeeded: ["bench"], difficulty: 2, progressionGroup: "hip_bridge" },
  { key: "glute_bridge_single", name: "กลูตบริดจ์ขาเดียว", nameEn: "Single-Leg Glute Bridge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ก้น หลังต้นขา", cue: "ยกขาข้างหนึ่งลอย สะโพกสองข้างต้องขึ้นเท่ากัน ห้ามบิด", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings", "core"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "hip_bridge" },
  // ดิพจัดเป็น push_v เพราะแรงกดลงไหล่แนวดิ่งเหมือนดันเหนือหัว — คนไหล่เจ็บต้องโดนตัดพร้อมกลุ่มนี้
  { key: "chair_dip", name: "ดิพเก้าอี้", nameEn: "Chair Dip", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "แขนหลัง ไหล่ อก", cue: "มือจับขอบเก้าอี้ ศอกชี้ไปหลัง ลงแค่ระดับที่ไหล่ไม่เจ็บ", pattern: "push_v", primaryMuscles: ["triceps", "shoulders", "chest"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "dip_bw" },

  // ── ตัวเปล่า: แกนกลาง (plank = บันไดท่าค้างจับเวลา · ท่านับครั้งอยู่นอกบันได) ──
  { key: "plank_knee", name: "แพลงก์เข่าติดพื้น", nameEn: "Knee Plank", equipment: "none", kind: "strength", unit: "minutes", impact: "low", met: 3.0, muscles: "แกนกลาง", cue: "ศอกใต้ไหล่ เข่าติดพื้น เกร็งท้องไม่ให้หลังแอ่น", pattern: "core", primaryMuscles: ["core"], loadable: false, equipmentNeeded: [], difficulty: 1, progressionGroup: "plank" },
  { key: "hollow_hold", name: "ฮอลโลว์โฮลด์", nameEn: "Hollow Body Hold", equipment: "none", kind: "strength", unit: "minutes", impact: "low", met: 4.0, muscles: "หน้าท้อง แกนกลาง", cue: "หลังล่างแนบพื้นตลอด ยกไหล่กับขาลอยต่ำ ๆ ถ้าหลังแอ่นให้งอเข่า", pattern: "core", primaryMuscles: ["core", "hip_flexors"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "plank" },
  { key: "plank_shoulder_tap", name: "แพลงก์แตะไหล่", nameEn: "Plank Shoulder Tap", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "แกนกลาง ไหล่", cue: "ถ่างเท้ากว้างขึ้นเพื่อกันส่าย แตะสลับช้า ๆ สะโพกนิ่ง", pattern: "core", primaryMuscles: ["core", "shoulders", "obliques"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "dead_bug", name: "เดดบั๊ก", nameEn: "Dead Bug", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แกนกลาง", cue: "หลังล่างแนบพื้น เหยียดแขนกับขาตรงข้ามช้า ๆ หายใจออกตอนเหยียด", pattern: "core", primaryMuscles: ["core", "hip_flexors"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "russian_twist", name: "รัสเซียนทวิสต์", nameEn: "Russian Twist", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "เอว หน้าท้อง", cue: "หลังตรงเอนราว 45 องศา บิดจากลำตัว ไม่ใช่เหวี่ยงแขน", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: false, equipmentNeeded: [], difficulty: 2 },

  // ── ดัมเบล (home) ──
  { key: "db_bench_press", name: "ดัมเบลเบนช์เพรส", nameEn: "Dumbbell Bench Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "อก ไหล่ แขนหลัง", cue: "นอนม้านั่ง ศอกทำมุม 45 องศากับลำตัว ดันขึ้นจนดัมเบลเกือบชนกัน", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: true, equipmentNeeded: ["dumbbell", "bench"], difficulty: 3 },
  { key: "db_floor_press", name: "ดัมเบลเพรสนอนพื้น", nameEn: "Dumbbell Floor Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "อก แขนหลัง", cue: "นอนพื้น ลงจนต้นแขนแตะพื้นแล้วดันขึ้น (พื้นจำกัดช่วง = ปลอดภัยกับไหล่)", pattern: "push_h", primaryMuscles: ["chest", "triceps", "shoulders"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_lateral_raise", name: "ดัมเบลกางข้าง", nameEn: "Dumbbell Lateral Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ไหล่ด้านข้าง", cue: "ยกแค่ระดับไหล่ ศอกงอเล็กน้อย ห้ามเหวี่ยงตัวช่วย", pattern: "push_v", primaryMuscles: ["shoulders"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_rear_delt_fly", name: "ดัมเบลกางหลังไหล่", nameEn: "Dumbbell Rear Delt Fly", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ไหล่หลัง หลังบน", cue: "ก้มลำตัวหลังตรง กางแขนออกข้าง บีบสะบักตอนสุด", pattern: "pull_h", primaryMuscles: ["shoulders", "traps", "back"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_hammer_curl", name: "ดัมเบลแฮมเมอร์เคิร์ล", nameEn: "Dumbbell Hammer Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แขนหน้า ปลายแขน", cue: "หันฝ่ามือเข้าหาลำตัวตลอด ศอกแนบข้าง ปล่อยกลับช้า", pattern: "pull_h", primaryMuscles: ["biceps", "forearms"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_overhead_tricep", name: "ดัมเบลเหยียดแขนเหนือหัว", nameEn: "Dumbbell Overhead Triceps Extension", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แขนหลัง", cue: "ต้นแขนตั้งนิ่งข้างหู หย่อนดัมเบลหลังศีรษะช้า ๆ แล้วเหยียดขึ้น", pattern: "push_v", primaryMuscles: ["triceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_goblet_squat", name: "ดัมเบลก็อบเล็ตสควอท", nameEn: "Goblet Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น แกนกลาง", cue: "อุ้มดัมเบลชิดอก ศอกลอดระหว่างเข่าตอนย่อสุด อกตั้งตลอด", pattern: "squat", primaryMuscles: ["quads", "glutes", "core"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_split_squat", name: "ดัมเบลสปลิตสควอท", nameEn: "Dumbbell Split Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ถือดัมเบลสองข้าง ย่อลงตรง ๆ น้ำหนักอยู่ขาหน้า", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_bent_over_row", name: "ดัมเบลโรว์ก้มตัวสองข้าง", nameEn: "Dumbbell Bent-Over Row", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หลัง ปีก แขนหน้า", cue: "พับสะโพกหลังตรง ดึงศอกชิดลำตัวไปหลัง บีบสะบัก", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_renegade_row", name: "ดัมเบลเรเนเกดโรว์", nameEn: "Renegade Row", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "หลัง แกนกลาง", cue: "อยู่ท่าแพลงก์บนดัมเบล ดึงทีละข้าง สะโพกห้ามส่าย ถ่างเท้ากว้าง", pattern: "pull_h", primaryMuscles: ["back", "lats", "core"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 4 },
  { key: "db_pullover", name: "ดัมเบลพูลโอเวอร์", nameEn: "Dumbbell Pullover", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ปีก อก", cue: "นอนม้านั่ง หย่อนดัมเบลไปหลังศีรษะแค่ระดับที่ไหล่ไม่ตึงเกิน", pattern: "pull_v", primaryMuscles: ["lats", "chest", "triceps"], loadable: true, equipmentNeeded: ["dumbbell", "bench"], difficulty: 3 },
  { key: "db_shrug", name: "ดัมเบลยักไหล่", nameEn: "Dumbbell Shrug", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "บ่า", cue: "ยักไหล่ขึ้นตรง ๆ ค้าง 1 วิ ไม่หมุนไหล่เป็นวง", pattern: "pull_h", primaryMuscles: ["traps"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_calf_raise", name: "ดัมเบลเขย่งปลายเท้า", nameEn: "Dumbbell Calf Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "น่อง", cue: "ถือดัมเบลข้างลำตัว เขย่งขึ้นสุด ค้าง 1 วิ ลงช้า", pattern: "squat", primaryMuscles: ["calves"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_thruster", name: "ดัมเบลทรัสเตอร์", nameEn: "Dumbbell Thruster", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ทั้งตัว ขา ไหล่", cue: "ย่อสควอทลง แล้วดันดัมเบลขึ้นเหนือหัวต่อเนื่องเป็นจังหวะเดียว", pattern: "squat", primaryMuscles: ["quads", "shoulders", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 4 },

  // ── บาร์เบล (gym) ──
  { key: "barbell_front_squat", name: "บาร์เบลฟรอนต์สควอท", nameEn: "Barbell Front Squat", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ต้นขาหน้า แกนกลาง", cue: "พาดบาร์บนไหล่หน้า ศอกยกสูงตลอด อกตั้ง ลงช้า", pattern: "squat", primaryMuscles: ["quads", "glutes", "core"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 5 },
  { key: "barbell_deadlift", name: "บาร์เบลเดดลิฟท์", nameEn: "Barbell Deadlift", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "หลัง ก้น ต้นขาหลัง", cue: "บาร์ชิดหน้าแข้ง หลังตรงล็อกไว้ ดันพื้นด้วยขา ไม่กระตุกหลัง", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings", "lower_back"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 5 },
  { key: "barbell_rdl", name: "บาร์เบลโรมาเนียนเดดลิฟท์", nameEn: "Barbell Romanian Deadlift", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "ต้นขาหลัง ก้น", cue: "ดันสะโพกไปหลัง เข่างอนิดเดียว บาร์เลียดขา หยุดตอนหลังเริ่มงอ", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes", "lower_back"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 4 },
  { key: "barbell_incline_bench", name: "บาร์เบลอินไคลน์เบนช์เพรส", nameEn: "Barbell Incline Bench Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "อกบน ไหล่", cue: "ตั้งเบาะราว 30 องศา ลงบาร์ที่อกบน มีคนช่วยดูเมื่อหนัก", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: true, equipmentNeeded: ["barbell", "bench"], difficulty: 4 },
  { key: "barbell_ohp", name: "บาร์เบลดันเหนือหัว", nameEn: "Barbell Overhead Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ไหล่ แขนหลัง", cue: "เกร็งก้นกับท้องกันแอ่นหลัง ดันบาร์ขึ้นตรงผ่านหน้าผาก", pattern: "push_v", primaryMuscles: ["shoulders", "triceps", "core"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 4 },
  { key: "barbell_row", name: "บาร์เบลโรว์", nameEn: "Barbell Bent-Over Row", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "หลัง ปีก", cue: "พับสะโพกหลังตรง ดึงบาร์เข้าท้องน้อย ไม่ใช้แรงเหวี่ยงลำตัว", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: true, equipmentNeeded: ["barbell"], difficulty: 4 },
  { key: "barbell_hip_thrust", name: "บาร์เบลฮิปทรัสต์", nameEn: "Barbell Hip Thrust", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "ก้น หลังต้นขา", cue: "พาดสะบักบนม้านั่ง รองบาร์ด้วยแผ่นนุ่ม ดันสะโพกจนลำตัวขนานพื้น", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: true, equipmentNeeded: ["barbell", "bench"], difficulty: 4 },

  // ── เคตเทิลเบล (home) ── สวิงเป็นท่ากระชาก impact สูง (ตัดอัตโนมัติถ้าห้ามกระแทก)
  { key: "kb_swing", name: "เคตเทิลเบลสวิง", nameEn: "Kettlebell Swing", equipment: "home", kind: "strength", unit: "reps", impact: "high", met: 8.0, muscles: "ก้น ต้นขาหลัง หลัง", cue: "แรงมาจากสะโพกไม่ใช่แขน หลังตรงตลอด เหวี่ยงแค่ระดับอก", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings", "lower_back"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 4 },
  { key: "kb_goblet_squat", name: "เคตเทิลเบลก็อบเล็ตสควอท", nameEn: "Kettlebell Goblet Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "อุ้มเคตเทิลชิดอก ลงช้าจนต้นขาขนานพื้น ส้นเท้าติดพื้น", pattern: "squat", primaryMuscles: ["quads", "glutes", "core"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 3 },
  { key: "kb_clean", name: "เคตเทิลเบลคลีน", nameEn: "Kettlebell Clean", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ทั้งตัว ก้น ไหล่", cue: "ดึงลูกชิดลำตัว พลิกข้อมือรับบนปลายแขน อย่าให้ลูกฟาดแขน", pattern: "hinge", primaryMuscles: ["glutes", "shoulders", "back"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 4 },
  { key: "kb_press", name: "เคตเทิลเบลดันเหนือหัว", nameEn: "Kettlebell Overhead Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ไหล่ แขนหลัง", cue: "ข้อมือตรง เกร็งท้อง ดันขึ้นจนแขนเหยียดข้างหู", pattern: "push_v", primaryMuscles: ["shoulders", "triceps", "core"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 3 },
  { key: "kb_carry", name: "เคตเทิลเบลแคร์รี่ข้างเดียว", nameEn: "Suitcase Carry", equipment: "home", kind: "strength", unit: "minutes", impact: "low", met: 5.0, muscles: "แกนกลาง บ่า ปลายแขน", cue: "ถือข้างเดียว ลำตัวห้ามเอียงตาม ก้าวช้าคุมจังหวะ สลับข้าง", pattern: "carry", primaryMuscles: ["core", "obliques", "forearms"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 3 },

  // ── ยางยืด (home) ── แรงต้านขึ้นกับเส้น/ระยะยืด ชั่งเป็นกิโลไม่ได้ → loadable=false ทั้งกลุ่ม
  { key: "band_chest_press", name: "ยางยืดดันอก", nameEn: "Band Chest Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "อก ไหล่ แขนหลัง", cue: "คล้องยางไว้หลังลำตัว ดันไปข้างหน้าจนแขนเกือบเหยียด คุมขากลับ", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_face_pull", name: "ยางยืดดึงเข้าหน้า", nameEn: "Band Face Pull", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ไหล่หลัง หลังบน", cue: "ดึงเข้าหาหน้าผาก กางศอกออก บีบสะบัก (ท่าแก้ไหล่ห่อ)", pattern: "pull_h", primaryMuscles: ["shoulders", "traps", "back"], loadable: false, equipmentNeeded: ["band"], difficulty: 1 },
  { key: "band_side_step", name: "ยางยืดก้าวข้าง", nameEn: "Banded Lateral Walk", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ก้น สะโพกด้านข้าง", cue: "คล้องยางเหนือเข่า ย่อครึ่งสควอท ก้าวออกข้างช้า ๆ เข่าไม่บีบเข้าใน", pattern: "squat", primaryMuscles: ["glutes"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_overhead_press", name: "ยางยืดดันเหนือหัว", nameEn: "Band Overhead Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ไหล่ แขนหลัง", cue: "เหยียบยางสองเท้า ดันขึ้นเหนือหัว ไม่แอ่นหลัง", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_curl", name: "ยางยืดเคิร์ล", nameEn: "Band Biceps Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แขนหน้า", cue: "เหยียบยาง ศอกแนบลำตัว ปล่อยกลับช้า ๆ ไม่ให้ยางดีดมือ", pattern: "pull_h", primaryMuscles: ["biceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 1 },

  // ── เครื่องฟิตเนส/เคเบิล (gym) ── น้ำหนักบนเครื่องคือตัวเดินความก้าวหน้า → loadable=true
  { key: "seated_row", name: "เครื่องโรว์นั่ง", nameEn: "Seated Row Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หลัง ปีก แขนหน้า", cue: "อกชนแผ่นรอง ดึงศอกไปหลัง ไม่โยกลำตัวช่วย", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "leg_extension", name: "เลกเอ็กซ์เทนชัน", nameEn: "Leg Extension", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหน้า", cue: "เหยียดเข่าจนสุด ค้าง 1 วิ ลงช้า ไม่ปล่อยน้ำหนักกระแทก", pattern: "squat", primaryMuscles: ["quads"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "calf_raise_machine", name: "เครื่องเขย่งน่อง", nameEn: "Machine Calf Raise", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "น่อง", cue: "หย่อนส้นลงสุดให้น่องยืด แล้วเขย่งขึ้นสุด ช้า ๆ ทั้งขาขึ้นและลง", pattern: "squat", primaryMuscles: ["calves"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "pec_deck", name: "เพคเด็ค (บินอก)", nameEn: "Pec Deck Fly", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "อก", cue: "ศอกอยู่ระดับอก บีบอกเข้าหากันช้า ๆ ไม่กระชากกลับ", pattern: "push_h", primaryMuscles: ["chest", "shoulders"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "cable_fly", name: "เคเบิลบินอก", nameEn: "Cable Chest Fly", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "อก ไหล่หน้า", cue: "ศอกงอคงที่ วาดโค้งมาชนกันหน้าอก คุมขากลับให้สุดช่วง", pattern: "push_h", primaryMuscles: ["chest", "shoulders"], loadable: false, equipmentNeeded: ["cable"], difficulty: 3 },
  { key: "tricep_pushdown", name: "เคเบิลกดแขนหลัง", nameEn: "Cable Triceps Pushdown", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "แขนหลัง", cue: "ศอกแนบลำตัวนิ่ง กดลงจนแขนเหยียดสุด ปล่อยกลับช้า", pattern: "push_h", primaryMuscles: ["triceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "cable_curl", name: "เคเบิลเคิร์ล", nameEn: "Cable Biceps Curl", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "แขนหน้า", cue: "ยืนตรง ศอกแนบข้าง ปล่อยกลับช้าไม่ทิ้งน้ำหนัก", pattern: "pull_h", primaryMuscles: ["biceps"], loadable: false, equipmentNeeded: ["cable"], difficulty: 2 },
  { key: "hip_abduction", name: "เครื่องกางสะโพก", nameEn: "Hip Abduction Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ก้น สะโพกด้านข้าง", cue: "นั่งหลังชิดพนัก กางเข่าออกช้า ๆ บีบก้นตอนสุด", pattern: "squat", primaryMuscles: ["glutes"], loadable: false, equipmentNeeded: ["machine"], difficulty: 1 },

  // ── บาร์โหน (gym) ── บันได pullup: หงายมือ 4 → คว่ำมือ 5 (ตัวช่วยอยู่ที่ pullup_assist)
  { key: "chin_up", name: "ชินอัพ (หงายมือ)", nameEn: "Chin-Up", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "ปีก แขนหน้า", cue: "จับหงายมือกว้างเท่าไหล่ ดึงจนคางพ้นบาร์ ลงช้าจนแขนเกือบเหยียด", pattern: "pull_v", primaryMuscles: ["lats", "biceps", "back"], loadable: false, equipmentNeeded: ["pullup_bar"], difficulty: 4, progressionGroup: "pullup" },
  { key: "pullup", name: "พูลอัพ (คว่ำมือ)", nameEn: "Pull-Up", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "ปีก หลัง", cue: "จับคว่ำมือกว้างกว่าไหล่ ห้ามเหวี่ยงขา ลงจนแขนเกือบเหยียด", pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: ["pullup_bar"], difficulty: 5, progressionGroup: "pullup" },

  // ── คาร์ดิโอเพิ่มเติม ──
  { key: "treadmill_walk", name: "ลู่เดินชัน", nameEn: "Treadmill Incline Walk", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 6.0, muscles: "ขา ก้น หัวใจ", cue: "ตั้งความชัน 5-10% เดินไม่จับราว ลงเต็มฝ่าเท้า", pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: ["treadmill"], difficulty: 2 },
  { key: "stair_climber", name: "เครื่องปีนบันได", nameEn: "Stair Climber", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 9.0, muscles: "ขา ก้น หัวใจ", cue: "ยืนตรงไม่ทิ้งน้ำหนักบนราวจับ เหยียบเต็มเท้าทุกก้าว", pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
  { key: "swimming", name: "ว่ายน้ำ", nameEn: "Swimming", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 6.0, muscles: "ทั้งตัว หัวใจ", cue: "หายใจเป็นจังหวะ วอร์ม 200 ม. ก่อน แล้วค่อยเพิ่มความเร็ว", pattern: "cardio", primaryMuscles: ["full_body", "back", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "jump_rope", name: "กระโดดเชือก", nameEn: "Jump Rope", equipment: "none", kind: "cardio", unit: "minutes", impact: "high", met: 10.0, muscles: "น่อง ขา หัวใจ", cue: "กระโดดเตี้ย ๆ ลงปลายเท้า ใช้ข้อมือหมุนเชือกไม่ใช่ทั้งแขน", pattern: "cardio", primaryMuscles: ["calves", "quads", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "high_knees", name: "ยกเข่าสูงอยู่กับที่", nameEn: "High Knees", equipment: "none", kind: "cardio", unit: "reps", impact: "high", met: 8.0, muscles: "ขา แกนกลาง หัวใจ", cue: "ยกเข่าถึงระดับสะโพก ลงปลายเท้าเบา ๆ ลำตัวตั้งตรง", pattern: "cardio", primaryMuscles: ["hip_flexors", "quads", "calves"], loadable: false, equipmentNeeded: [], difficulty: 3 },

  // ── ยืดเหยียด/ฟื้นฟูเพิ่มเติม ──
  { key: "hamstring_stretch", name: "ยืดต้นขาหลัง", nameEn: "Hamstring Stretch", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "ต้นขาหลัง", cue: "เหยียดเข่าตรง ก้มจากสะโพกจนรู้สึกตึง ค้าง 30 วิ ไม่เด้ง", pattern: "mobility", primaryMuscles: ["hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "shoulder_mobility", name: "คลายข้อไหล่", nameEn: "Shoulder Mobility Drill", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "ไหล่ หลังบน", cue: "หมุนไหล่เป็นวงกว้างช้า ๆ ทั้งไปหน้าและไปหลัง ไม่ยกไหล่ชนหู", pattern: "mobility", primaryMuscles: ["shoulders", "traps"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "thoracic_rotation", name: "บิดหลังส่วนบน", nameEn: "Thoracic Rotation", equipment: "none", kind: "mobility", unit: "reps", impact: "low", met: 2.3, muscles: "หลังบน แกนกลาง", cue: "คุกเข่า มือข้างหนึ่งแตะท้ายทอย บิดอกเปิดขึ้นเพดานช้า ๆ", pattern: "mobility", primaryMuscles: ["back", "obliques"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "foam_roll", name: "โฟมโรลคลายกล้ามเนื้อ", nameEn: "Foam Rolling", equipment: "home", kind: "mobility", unit: "minutes", impact: "low", met: 2.5, muscles: "ทั้งตัว", cue: "กลิ้งช้า ๆ จุดละ 30 วิ เจอจุดตึงให้ค้างไว้แล้วหายใจยาว", pattern: "mobility", primaryMuscles: ["full_body"], loadable: false, equipmentNeeded: [], difficulty: 1 },

  /* ══════════════════════════════════════════════════════════════════
     ขยายคลัง 116 → 250 ท่า (เจ้าของสั่ง 28 ส.ค. 69)
     เหตุผล: วัดแล้วพบว่าคนไม่มีอุปกรณ์มีท่าดึงแค่ 2 · หน้าแขน 2 · ปีก 2 · บานพับ 2
             = ขอเน้นหลัง/แขนแล้วแผนวนซ้ำท่าเดิมทั้งสัปดาห์
     กติกา: ทุกท่าต้องผ่านด่านตรวจของ scripts/seed-exercises.js
            (ชื่อไทยห้ามซ้ำ · กล้ามเนื้อ/อุปกรณ์ต้องอยู่ในวงคำศัพท์ · บันไดต้องหน่วยเดียวกัน แรงกระแทกเดียวกัน)
     ══════════════════════════════════════════════════════════════════ */

  // ── ตัวเปล่า · ดึง/หลัง/ปีก (ช่องโหว่ใหญ่สุด: เดิมมีแค่ 2 ท่า) ──
  { key: "towel_row", name: "แถวผ้าเช็ดตัว", nameEn: "Towel Row", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "หลัง ปีก หน้าแขน", cue: "คล้องผ้ารอบเสา ดึงศอกชิดลำตัว บีบสะบักค้าง 1 วิ", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "row_bw" },
  { key: "table_row", name: "แถวใต้โต๊ะ", nameEn: "Under-Table Row", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "หลัง ปีก หน้าแขน", cue: "นอนใต้โต๊ะมั่นคง จับขอบ ดึงอกเข้าหาโต๊ะ ลำตัวตรงเป็นแผ่นเดียว", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "row_bw" },
  { key: "table_row_feet_up", name: "แถวใต้โต๊ะเท้าสูง", nameEn: "Feet-Elevated Table Row", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.6, muscles: "หลัง ปีก หน้าแขน", cue: "วางเท้าบนเก้าอี้ให้ลำตัวขนานพื้น ดึงช้า ๆ ไม่เหวี่ยง", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "row_bw" },
  { key: "prone_ytw", name: "ท่า Y-T-W นอนคว่ำ", nameEn: "Prone Y-T-W Raise", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.2, muscles: "หลังส่วนบน สะบัก ไหล่หลัง", cue: "นอนคว่ำ ยกแขนเป็นตัว Y แล้ว T แล้ว W นับเป็น 1 ครั้ง คอผ่อน", pattern: "pull_h", primaryMuscles: ["back", "shoulders", "traps"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "reverse_snow_angel", name: "รีเวิร์สสโนว์แองเจิล", nameEn: "Reverse Snow Angel", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.0, muscles: "หลังส่วนบน สะบัก", cue: "นอนคว่ำ ยกอกเล็กน้อย กวาดแขนจากข้างลำตัวขึ้นเหนือหัวช้า ๆ", pattern: "pull_h", primaryMuscles: ["back", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "scapular_pull", name: "ดึงสะบักค้างบาร์", nameEn: "Scapular Pull-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ปีก สะบัก", cue: "ห้อยตัว แขนตรง ดึงตัวขึ้นด้วยสะบักอย่างเดียว ศอกไม่งอ", pattern: "pull_v", primaryMuscles: ["lats", "traps"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "pullup_bw" },
  { key: "negative_pullup", name: "พูลอัพลงช้า", nameEn: "Negative Pull-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ปีก หน้าแขน หลัง", cue: "กระโดดขึ้นถึงคางแล้วลงช้า 5 วินาที", pattern: "pull_v", primaryMuscles: ["lats", "biceps", "back"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "pullup_bw" },
  { key: "doorway_curl", name: "ไอโซเมตริกหน้าแขนขอบประตู", nameEn: "Doorway Isometric Curl", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.0, muscles: "หน้าแขน", cue: "งอศอก 90 องศา ดันฝ่ามือขึ้นใต้ขอบประตู เกร็งค้าง 10 วินาที", pattern: "pull_h", primaryMuscles: ["biceps"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "self_resist_curl", name: "หน้าแขนต้านมือตัวเอง", nameEn: "Self-Resisted Curl", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.2, muscles: "หน้าแขน", cue: "ใช้มืออีกข้างกดต้านขณะงอศอกขึ้น ช้าและควบคุมทั้งขาขึ้นขาลง", pattern: "pull_h", primaryMuscles: ["biceps", "forearms"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "prone_swimmer", name: "ท่าว่ายน้ำนอนคว่ำ", nameEn: "Prone Swimmer", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.4, muscles: "หลังส่วนล่าง ก้น ไหล่", cue: "นอนคว่ำ สลับยกแขนขาตรงข้ามเหมือนว่ายน้ำ ช้า ๆ", pattern: "pull_h", primaryMuscles: ["lower_back", "glutes", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2 },

  // ── ตัวเปล่า · บานพับสะโพก / หลังล่าง / ต้นขาหลัง ──
  { key: "good_morning_bw", name: "กู๊ดมอร์นิ่งตัวเปล่า", nameEn: "Bodyweight Good Morning", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ต้นขาหลัง ก้น หลังล่าง", cue: "มือประสานท้ายทอย ดันสะโพกไปหลัง หลังตรงตลอด เข่างอเล็กน้อย", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes", "lower_back"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "hinge_bw" },
  { key: "single_leg_rdl_bw", name: "อาร์ดีแอลขาเดียวตัวเปล่า", nameEn: "Single-Leg RDL (Bodyweight)", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "ต้นขาหลัง ก้น การทรงตัว", cue: "ยืนขาเดียว ก้มพร้อมยกขาหลังขึ้นให้เป็นเส้นตรง สะโพกไม่บิด", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "hinge_bw" },
  { key: "nordic_assisted", name: "นอร์ดิกเคิร์ลแบบมีตัวช่วย", nameEn: "Assisted Nordic Curl", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหลัง", cue: "คุกเข่าให้คนหรือของหนักกดข้อเท้า ลงช้าที่สุดเท่าที่คุมได้ ใช้มือดันกลับ", pattern: "hinge", primaryMuscles: ["hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "hinge_bw" },
  { key: "reverse_hyper_floor", name: "ยกขาหลังนอนคว่ำ", nameEn: "Floor Reverse Hyperextension", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.3, muscles: "หลังล่าง ก้น", cue: "นอนคว่ำบนเตียง/ม้านั่ง ยกขาทั้งสองขึ้นด้วยก้น ไม่แอ่นหลัง", pattern: "hinge", primaryMuscles: ["lower_back", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "hip_hinge_wall", name: "ฝึกพับสะโพกกับผนัง", nameEn: "Wall Hip Hinge Drill", equipment: "none", kind: "mobility", unit: "reps", impact: "low", met: 2.6, muscles: "สะโพก หลังล่าง", cue: "ยืนหลังห่างผนัง 1 ฝ่ามือ ดันก้นไปแตะผนังโดยหลังไม่งอ", pattern: "hinge", primaryMuscles: ["hamstrings", "lower_back"], loadable: false, equipmentNeeded: [], difficulty: 1 },

  // ── ตัวเปล่า · ดันแนวดิ่ง / ไหล่ ──
  { key: "pike_pushup", name: "ไพก์พุชอัพ", nameEn: "Pike Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ไหล่ หลังแขน", cue: "ตั้งสะโพกสูงเป็นตัว A ลงศีรษะระหว่างมือ ศอกไม่บาน", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "pushv_bw" },
  { key: "pike_pushup_elev", name: "ไพก์พุชอัพเท้าสูง", nameEn: "Elevated Pike Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ไหล่ หลังแขน", cue: "วางเท้าบนเก้าอี้ให้ลำตัวตั้งขึ้น น้ำหนักลงไหล่มากขึ้น", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "pushv_bw" },
  { key: "wall_handstand_hold", name: "ตั้งมือพิงผนังค้าง", nameEn: "Wall Handstand Hold", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ไหล่ แกนกลาง", cue: "เดินเท้าขึ้นผนังทีละก้าว เกร็งท้อง ค้างเท่าที่คุมได้", pattern: "push_v", primaryMuscles: ["shoulders", "core"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "wall_slide", name: "สไลด์แขนกับผนัง", nameEn: "Wall Slide", equipment: "none", kind: "mobility", unit: "reps", impact: "low", met: 2.5, muscles: "ไหล่ สะบัก", cue: "หลังแนบผนัง เลื่อนแขนขึ้นลงโดยข้อมือไม่หลุดผนัง", pattern: "push_v", primaryMuscles: ["shoulders", "traps"], loadable: false, equipmentNeeded: [], difficulty: 1 },

  // ── ตัวเปล่า · ดัน/อก/หลังแขน ──
  { key: "bench_dip_legs_out", name: "ดิปขอบเก้าอี้ขาเหยียด", nameEn: "Bench Dip (Legs Extended)", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.8, muscles: "หลังแขน อกล่าง", cue: "เหยียดขาออกไกลขึ้นเพื่อเพิ่มน้ำหนัก ไหล่ไม่ยกขึ้นหู", pattern: "push_h", primaryMuscles: ["triceps", "chest"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "dip_bw" },
  { key: "archer_pushup", name: "อาร์เชอร์พุชอัพ", nameEn: "Archer Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "อก หลังแขน", cue: "กางมือกว้าง ลงเอียงไปข้างหนึ่ง อีกแขนเหยียดตรง สลับข้าง", pattern: "push_h", primaryMuscles: ["chest", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "decline_pushup", name: "วิดพื้นเท้าสูงบนเก้าอี้", nameEn: "Decline Push-Up (Chair)", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "อกบน ไหล่ หลังแขน", cue: "วางเท้าบนเก้าอี้ สะโพกไม่ตก ลงช้าคุมจังหวะ", pattern: "push_h", primaryMuscles: ["chest", "shoulders", "triceps"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "close_pushup", name: "วิดพื้นมือแคบ", nameEn: "Close-Grip Push-Up", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หลังแขน อก", cue: "มือกว้างเท่าไหล่ ศอกแนบลำตัว ไม่บานออกข้าง", pattern: "push_h", primaryMuscles: ["triceps", "chest"], loadable: false, equipmentNeeded: [], difficulty: 3 },

  // ── ตัวเปล่า · แกนกลางแบบต้านการบิด (เดิมมีแต่ท่างอตัว) ──
  { key: "pallof_iso_bw", name: "ต้านการบิดลำตัวค้าง", nameEn: "Anti-Rotation Hold", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.2, muscles: "แกนกลาง ปีกข้าง", cue: "ยื่นมือประสานไปหน้า ให้คนดันข้าง ๆ แล้วต้านไม่ให้ลำตัวบิด", pattern: "core", primaryMuscles: ["core", "obliques"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "side_plank_reach", name: "ไซด์แพลงก์สอดแขน", nameEn: "Side Plank Thread-Through", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "ปีกข้าง แกนกลาง", cue: "ตั้งไซด์แพลงก์ สอดแขนบนลอดใต้ลำตัวแล้วกางกลับ สะโพกไม่ตก", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "hollow_rock", name: "ฮอลโลว์โยกตัว", nameEn: "Hollow Rock", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "แกนกลาง", cue: "จากท่าฮอลโลว์ โยกตัวไปหน้า-หลังโดยรูปทรงไม่เปลี่ยน", pattern: "core", primaryMuscles: ["core"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "russian_twist_bw", name: "รัสเซียนทวิสต์ตัวเปล่า", nameEn: "Bodyweight Russian Twist", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "ปีกข้าง แกนกลาง", cue: "นั่งเอนหลัง 45 องศา บิดลำตัวแตะพื้นสลับข้าง คอผ่อน", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "side_bend_bw", name: "ไซด์เบนด์ตัวเปล่า", nameEn: "Standing Side Bend", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 2.8, muscles: "ปีกข้าง", cue: "ยืนตรง เอียงลำตัวข้างเดียวโดยไม่โน้มไปหน้า-หลัง", pattern: "core", primaryMuscles: ["obliques"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "bear_hold", name: "หมีคลานค้าง", nameEn: "Bear Hold", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "แกนกลาง ไหล่", cue: "คุกเข่าสี่ขา ยกเข่าลอยจากพื้น 2 นิ้ว หลังแบนเหมือนโต๊ะ", pattern: "core", primaryMuscles: ["core", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "bear_crawl", name: "คลานหมี", nameEn: "Bear Crawl", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 6.0, muscles: "ทั้งตัว", cue: "คลานไปหน้าโดยเข่าไม่แตะพื้น สะโพกไม่ส่าย", pattern: "core", primaryMuscles: ["full_body", "core", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 3 },

  // ── ตัวเปล่า · ท่ากระโดด/พลัยโอ (เดิมมีแค่ 2 ท่า) ──
  { key: "squat_jump", name: "สควอทกระโดด", nameEn: "Squat Jump", equipment: "none", kind: "strength", unit: "reps", impact: "high", met: 8.0, muscles: "ขา ก้น", cue: "ย่อสควอทแล้วระเบิดขึ้น ลงเบา ๆ ด้วยปลายเท้าก่อน", pattern: "squat", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "jump_lower" },
  { key: "tuck_jump", name: "กระโดดเก็บเข่า", nameEn: "Tuck Jump", equipment: "none", kind: "strength", unit: "reps", impact: "high", met: 9.0, muscles: "ขา แกนกลาง", cue: "กระโดดขึ้นแล้วดึงเข่าเข้าหาอก ลงเบา", pattern: "squat", primaryMuscles: ["quads", "core", "calves"], loadable: false, equipmentNeeded: [], difficulty: 4, progressionGroup: "jump_lower" },
  { key: "split_jump", name: "ลันจ์กระโดดสลับขา", nameEn: "Split Jump", equipment: "none", kind: "strength", unit: "reps", impact: "high", met: 8.5, muscles: "ขา ก้น", cue: "จากท่าลันจ์ กระโดดสลับขาในอากาศ เข่าหลังไม่กระแทกพื้น", pattern: "lunge", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "box_jump_step", name: "กระโดดขึ้นกล่อง", nameEn: "Box Jump", equipment: "none", kind: "strength", unit: "reps", impact: "high", met: 8.5, muscles: "ขา ก้น", cue: "เลือกกล่องมั่นคงสูงพอสบาย กระโดดขึ้นให้เต็มเท้า ลงเดินกลับ", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "broad_jump", name: "กระโดดไกล", nameEn: "Broad Jump", equipment: "none", kind: "strength", unit: "reps", impact: "high", met: 8.0, muscles: "ขา ก้น", cue: "แกว่งแขนช่วย กระโดดไปหน้าให้ไกล ลงย่อรับแรง", pattern: "hinge", primaryMuscles: ["glutes", "quads", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "skater_jump", name: "กระโดดสเก็ตข้าง", nameEn: "Skater Jump", equipment: "none", kind: "cardio", unit: "minutes", impact: "high", met: 7.5, muscles: "ขา ก้นข้าง หัวใจ", cue: "กระโดดออกข้างสลับซ้ายขวา ลงขาเดียวแล้วทรงตัวให้นิ่ง", pattern: "cardio", primaryMuscles: ["glutes", "quads", "calves"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "butt_kick", name: "วิ่งเตะส้นอยู่กับที่", nameEn: "Butt Kicks", equipment: "none", kind: "cardio", unit: "minutes", impact: "high", met: 7.5, muscles: "ต้นขาหลัง หัวใจ", cue: "เตะส้นแตะก้นสลับเร็ว ๆ ลำตัวตั้งตรง", pattern: "cardio", primaryMuscles: ["hamstrings", "calves"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "shadow_run", name: "วิ่งอยู่กับที่", nameEn: "Running in Place", equipment: "none", kind: "cardio", unit: "minutes", impact: "high", met: 6.5, muscles: "ขา หัวใจ", cue: "วิ่งย่ำอยู่กับที่ ลงกลางเท้า หายใจเป็นจังหวะ", pattern: "cardio", primaryMuscles: ["quads", "calves"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "inchworm", name: "หนอนคืบ", nameEn: "Inchworm", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 5.0, muscles: "ทั้งตัว ต้นขาหลัง", cue: "ก้มแตะพื้น เดินมือออกไปถึงท่าแพลงก์ แล้วเดินกลับ", pattern: "cardio", primaryMuscles: ["full_body", "hamstrings", "core"], loadable: false, equipmentNeeded: [], difficulty: 2 },

  // ── ตัวเปล่า · ขา/ก้น เพิ่มความหลากหลาย ──
  { key: "cossack_squat", name: "คอสแซคสควอท", nameEn: "Cossack Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ขาใน ก้น ต้นขาหน้า", cue: "กางขากว้าง ย่อลงข้างหนึ่งจนสุด อีกขาเหยียดตรง ส้นไม่ลอย", pattern: "squat", primaryMuscles: ["adductors", "quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "pistol_assisted", name: "พิสทอลสควอทมีตัวช่วย", nameEn: "Assisted Pistol Squat", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ต้นขาหน้า ก้น การทรงตัว", cue: "จับที่ยึดไว้ ย่อขาเดียวลงช้า อีกขาเหยียดไปหน้า", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 4 },
  { key: "curtsy_lunge", name: "ลันจ์ไขว้หลัง", nameEn: "Curtsy Lunge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "ก้นข้าง ต้นขาหน้า", cue: "ก้าวขาหลังไขว้ไปด้านหลังเฉียง เข่าหน้าไม่บิดเข้าใน", pattern: "lunge", primaryMuscles: ["glutes", "quads"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "lateral_lunge", name: "ลันจ์ก้าวข้าง", nameEn: "Lateral Lunge", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ขาใน ก้น ต้นขาหน้า", cue: "ก้าวออกข้าง ย่อขาที่ก้าว อีกขาเหยียดตรง หลังตรง", pattern: "lunge", primaryMuscles: ["adductors", "glutes", "quads"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "single_leg_calf_bw", name: "เขย่งขาเดียว", nameEn: "Single-Leg Calf Raise", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "น่อง", cue: "ยืนขาเดียวบนขอบขั้น ลงส้นให้สุดแล้วเขย่งขึ้นสูงสุด", pattern: "hinge", primaryMuscles: ["calves"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "step_down", name: "ก้าวลงจากขั้นช้า ๆ", nameEn: "Step-Down", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ต้นขาหน้า ก้น", cue: "ยืนบนขั้น ค่อย ๆ ลดอีกขาลงแตะพื้นแล้วดันกลับ เข่าไม่บิด", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: [], difficulty: 3 },
  { key: "frog_pump", name: "ฟร็อกปั๊ม", nameEn: "Frog Pump", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "ก้น", cue: "นอนหงาย ฝ่าเท้าประกบกัน เข่ากางออก ดันสะโพกขึ้นบีบก้น", pattern: "hinge", primaryMuscles: ["glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "fire_hydrant", name: "ยกเข่าออกข้าง", nameEn: "Fire Hydrant", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.2, muscles: "ก้นข้าง สะโพก", cue: "คุกเข่าสี่ขา ยกเข่าออกข้างโดยลำตัวไม่เอียงตาม", pattern: "hinge", primaryMuscles: ["glutes"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "donkey_kick", name: "เตะขาขึ้นหลัง", nameEn: "Donkey Kick", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.2, muscles: "ก้น", cue: "คุกเข่าสี่ขา ดันส้นเท้าขึ้นเพดาน หลังไม่แอ่น", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: false, equipmentNeeded: [], difficulty: 1 },

  // ── ตัวเปล่า · ยืดเหยียด/ฟื้นฟู ──
  { key: "worlds_greatest_stretch", name: "เวิลด์เกรทเทสต์สเตรตช์", nameEn: "World's Greatest Stretch", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.8, muscles: "สะโพก อก หลังบน", cue: "ก้าวลันจ์ วางศอกด้านในเท้า แล้วบิดเปิดอกขึ้นฟ้า", pattern: "mobility", primaryMuscles: ["hip_flexors", "chest", "back"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "couch_stretch", name: "ยืดสะโพกหน้าพิงผนัง", nameEn: "Couch Stretch", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "สะโพกหน้า ต้นขาหน้า", cue: "เข่าหลังชิดผนัง เก็บก้น ดันสะโพกไปหน้าจนตึงพอทน", pattern: "mobility", primaryMuscles: ["hip_flexors", "quads"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "downward_dog", name: "ท่าสุนัขก้มหน้า", nameEn: "Downward Dog", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.8, muscles: "ต้นขาหลัง น่อง ไหล่", cue: "ตั้งสะโพกสูง ส้นกดลงพื้นเท่าที่ได้ คอผ่อน", pattern: "mobility", primaryMuscles: ["hamstrings", "calves", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "childs_pose", name: "ท่าเด็ก", nameEn: "Child's Pose", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.0, muscles: "หลังล่าง สะโพก", cue: "นั่งส้นเท้า ก้มตัวไปหน้า ยืดแขนไปไกล หายใจลึก", pattern: "mobility", primaryMuscles: ["lower_back", "lats"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "neck_release", name: "ยืดคอบ่า", nameEn: "Neck & Trap Release", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.0, muscles: "คอ บ่า", cue: "เอียงหูเข้าหาไหล่ ใช้มือช่วยเบา ๆ ไม่กระตุก", pattern: "mobility", primaryMuscles: ["traps", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "ankle_mobility", name: "ยืดข้อเท้าเข่าชนผนัง", nameEn: "Ankle Mobility Drill", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.2, muscles: "ข้อเท้า น่อง", cue: "ดันเข่าไปหาผนังโดยส้นไม่ลอย ค้างแล้วสลับข้าง", pattern: "mobility", primaryMuscles: ["calves"], loadable: false, equipmentNeeded: [], difficulty: 1 },


  // ══ ที่บ้าน · ยางยืด (ครบทุกทิศทางแรงดึง) ══
  { key: "band_hammer_curl", name: "ยางยืดหน้าแขนหงายมือกลาง", nameEn: "Band Hammer Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "หน้าแขน แขนท่อนล่าง", cue: "หันฝ่ามือเข้าหากันตลอดช่วง ศอกไม่ขยับ", pattern: "pull_h", primaryMuscles: ["biceps", "forearms"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_tricep_push", name: "ยางยืดเหยียดหลังแขน", nameEn: "Band Triceps Pushdown", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.4, muscles: "หลังแขน", cue: "คล้องยางสูง ศอกแนบลำตัว เหยียดลงจนสุดแล้วค้าง 1 วิ", pattern: "push_v", primaryMuscles: ["triceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_overhead_tricep", name: "ยางยืดเหยียดแขนเหนือหัว", nameEn: "Band Overhead Triceps Extension", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.4, muscles: "หลังแขน", cue: "ศอกชี้ฟ้า ไม่บานออก เหยียดขึ้นสุดแล้วลงช้า", pattern: "push_v", primaryMuscles: ["triceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_lat_pulldown", name: "ยางยืดดึงลงเหนือหัว", nameEn: "Band Lat Pulldown", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ปีก หลัง", cue: "คล้องยางสูง คุกเข่า ดึงลงมาระดับอก บีบสะบัก", pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_face_pull_high", name: "ยางยืดดึงหน้าเหนือหัว", nameEn: "High Band Face Pull", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "ไหล่หลัง สะบัก", cue: "ดึงเข้าหาหน้าผาก กางศอกออก บีบสะบักท้ายช่วง", pattern: "pull_h", primaryMuscles: ["shoulders", "traps", "back"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_shoulder_press", name: "ยางยืดดันไหล่", nameEn: "Band Shoulder Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ไหล่ หลังแขน", cue: "เหยียบยาง ดันขึ้นเหนือหัว ซี่โครงไม่บาน", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_deadlift", name: "ยางยืดเดดลิฟท์", nameEn: "Band Deadlift", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหลัง ก้น หลังล่าง", cue: "เหยียบกลางยาง ดันสะโพกไปหลัง ยืดขึ้นด้วยก้น หลังตรง", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes", "lower_back"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_good_morning", name: "ยางยืดกู๊ดมอร์นิ่ง", nameEn: "Band Good Morning", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ต้นขาหลัง หลังล่าง", cue: "คล้องยางที่ต้นคอ พับสะโพกไปหลัง หลังตรงตลอด", pattern: "hinge", primaryMuscles: ["hamstrings", "lower_back", "glutes"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_squat", name: "ยางยืดสควอท", nameEn: "Band Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหน้า ก้น", cue: "เหยียบยาง คล้องบ่า ย่อลงให้ต้นขาขนานพื้น เข่าไปทางปลายเท้า", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_monster_walk", name: "ยางยืดเดินปูข้าง", nameEn: "Band Monster Walk", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "ก้นข้าง สะโพก", cue: "คล้องยางเหนือเข่า ย่อครึ่ง เดินออกข้างโดยเข่าไม่หุบเข้า", pattern: "lunge", primaryMuscles: ["glutes"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_pallof", name: "ยางยืดต้านการบิด", nameEn: "Band Pallof Press", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "แกนกลาง ปีกข้าง", cue: "ยืนข้างจุดคล้อง ดันมือออกหน้าอกโดยลำตัวไม่บิดตาม", pattern: "core", primaryMuscles: ["core", "obliques"], loadable: false, equipmentNeeded: ["band"], difficulty: 2 },
  { key: "band_woodchop", name: "ยางยืดฟันขวาน", nameEn: "Band Woodchop", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "ปีกข้าง แกนกลาง", cue: "ดึงจากสูงลงต่ำเฉียงข้าง หมุนจากลำตัว ไม่ใช่แค่แขน", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: false, equipmentNeeded: ["band"], difficulty: 3 },

  // ══ ที่บ้าน · ดัมเบล ══
  { key: "db_lunge_walk", name: "ดัมเบลลันจ์เดิน", nameEn: "Dumbbell Walking Lunge", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ถือดัมเบลข้างลำตัว ก้าวยาว เข่าหลังเกือบแตะพื้น", pattern: "lunge", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_reverse_lunge", name: "ดัมเบลลันจ์ถอยหลัง", nameEn: "Dumbbell Reverse Lunge", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.8, muscles: "ขา ก้น", cue: "ก้าวถอยหลัง ลงตรง ๆ ไม่โยกตัว เข่าหน้าอยู่เหนือส้น", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_step_up", name: "ดัมเบลสเต็ปอัพ", nameEn: "Dumbbell Step-Up", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ต้นขาหน้า ก้น", cue: "ก้าวขึ้นเต็มเท้า ดันด้วยขาบน ไม่ถีบขาล่างช่วย", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_bulgarian", name: "ดัมเบลบัลแกเรียนสควอท", nameEn: "Dumbbell Bulgarian Split Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.2, muscles: "ต้นขาหน้า ก้น", cue: "วางหลังเท้าบนเก้าอี้ ลงตรง ๆ ลำตัวเอนหน้าเล็กน้อย", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["dumbbell", "bench"], difficulty: 4 },
  { key: "db_hip_thrust", name: "ดัมเบลฮิปทรัสต์", nameEn: "Dumbbell Hip Thrust", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.6, muscles: "ก้น ต้นขาหลัง", cue: "พิงหลังกับเก้าอี้ วางดัมเบลบนสะโพก ดันขึ้นบีบก้นค้าง 1 วิ", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_single_rdl", name: "ดัมเบลอาร์ดีแอลขาเดียว", nameEn: "Dumbbell Single-Leg RDL", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหลัง ก้น", cue: "ยืนขาเดียว ก้มพร้อมยกขาหลัง สะโพกไม่เปิดออกข้าง", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 4 },
  { key: "db_front_raise", name: "ดัมเบลยกหน้า", nameEn: "Dumbbell Front Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.4, muscles: "ไหล่หน้า", cue: "ยกขึ้นระดับไหล่ ไม่แกว่งตัวช่วย ลงช้ากว่าขึ้น", pattern: "push_v", primaryMuscles: ["shoulders"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_upright_row", name: "ดัมเบลดึงตั้ง", nameEn: "Dumbbell Upright Row", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "บ่า ไหล่", cue: "ดึงขึ้นตามลำตัวถึงระดับอก ศอกนำ ไม่ยกสูงเกินไหล่", pattern: "pull_v", primaryMuscles: ["traps", "shoulders"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_chest_fly", name: "ดัมเบลบินอก", nameEn: "Dumbbell Chest Fly", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "อก", cue: "นอนบนม้านั่ง กางแขนเป็นวงกว้าง ศอกงอคงที่ บีบอกตอนขึ้น", pattern: "push_h", primaryMuscles: ["chest", "shoulders"], loadable: true, equipmentNeeded: ["dumbbell", "bench"], difficulty: 3 },
  { key: "db_farmer_carry", name: "ดัมเบลแบกเดิน", nameEn: "Dumbbell Farmer Carry", equipment: "home", kind: "strength", unit: "minutes", impact: "low", met: 5.0, muscles: "แขนท่อนล่าง บ่า แกนกลาง", cue: "ถือหนักสองข้าง เดินตัวตรง ไหล่ไม่ห่อ", pattern: "carry", primaryMuscles: ["forearms", "traps", "core"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },
  { key: "db_suitcase_carry", name: "ดัมเบลแบกข้างเดียว", nameEn: "Suitcase Carry", equipment: "home", kind: "strength", unit: "minutes", impact: "low", met: 5.0, muscles: "ปีกข้าง แกนกลาง", cue: "ถือข้างเดียว เดินโดยลำตัวไม่เอียงตาม", pattern: "carry", primaryMuscles: ["obliques", "core", "forearms"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_russian_twist", name: "ดัมเบลรัสเซียนทวิสต์", nameEn: "Dumbbell Russian Twist", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "ปีกข้าง แกนกลาง", cue: "นั่งเอนหลัง ถือดัมเบลบิดแตะข้างลำตัวสลับ", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 3 },
  { key: "db_side_bend", name: "ดัมเบลไซด์เบนด์", nameEn: "Dumbbell Side Bend", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.4, muscles: "ปีกข้าง", cue: "ถือข้างเดียว เอียงลงข้างแล้วดึงกลับด้วยเอว ไม่โน้มหน้า-หลัง", pattern: "core", primaryMuscles: ["obliques"], loadable: true, equipmentNeeded: ["dumbbell"], difficulty: 2 },

  // ══ ที่บ้าน · เคตเทิลเบล ══
  { key: "kb_goblet_lunge", name: "เคตเทิลเบลลันจ์", nameEn: "Kettlebell Goblet Lunge", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ขา ก้น", cue: "ถือชิดอก ก้าวลงตรง ลำตัวตั้ง", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 3 },
  { key: "kb_halo", name: "เคตเทิลเบลวนรอบหัว", nameEn: "Kettlebell Halo", equipment: "home", kind: "mobility", unit: "reps", impact: "low", met: 3.5, muscles: "ไหล่ หลังบน", cue: "วนลูกรอบศีรษะช้า ๆ ลำตัวนิ่ง สลับทิศ", pattern: "mobility", primaryMuscles: ["shoulders", "traps"], loadable: true, equipmentNeeded: ["kettlebell"], difficulty: 2 },

  // ══ ที่บ้าน · บาร์โหน / ม้านั่ง / อื่น ๆ ══
  { key: "hanging_knee_raise", name: "ห้อยตัวยกเข่า", nameEn: "Hanging Knee Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หน้าท้องล่าง", cue: "ห้อยบาร์ ยกเข่าขึ้นระดับสะโพก ไม่แกว่งตัว", pattern: "core", primaryMuscles: ["core", "hip_flexors"], loadable: false, equipmentNeeded: ["pullup_bar"], difficulty: 3, progressionGroup: "hang_core" },
  { key: "hanging_leg_raise", name: "ห้อยตัวยกขาตรง", nameEn: "Hanging Leg Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หน้าท้องล่าง", cue: "ยกขาตรงขึ้นระดับสะโพกขึ้นไป คุมจังหวะลง", pattern: "core", primaryMuscles: ["core", "hip_flexors"], loadable: false, equipmentNeeded: ["pullup_bar"], difficulty: 4, progressionGroup: "hang_core" },
  { key: "dead_hang", name: "ห้อยบาร์ค้าง", nameEn: "Dead Hang", equipment: "home", kind: "mobility", unit: "minutes", impact: "low", met: 3.0, muscles: "ปีก ไหล่ แขนท่อนล่าง", cue: "ห้อยตัวปล่อยไหล่ผ่อน หายใจปกติ", pattern: "mobility", primaryMuscles: ["lats", "shoulders", "forearms"], loadable: false, equipmentNeeded: ["pullup_bar"], difficulty: 1 },
  { key: "bench_hip_thrust_bw", name: "ฮิปทรัสต์พิงม้านั่ง", nameEn: "Bench Hip Thrust", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "ก้น", cue: "พิงสะบักกับม้านั่ง ดันสะโพกขึ้นจนลำตัวขนานพื้น", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: false, equipmentNeeded: ["bench"], difficulty: 2 },
  { key: "bench_bulgarian_bw", name: "บัลแกเรียนสควอทตัวเปล่า", nameEn: "Bodyweight Bulgarian Split Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหน้า ก้น", cue: "วางหลังเท้าบนม้านั่ง ลงตรง เข่าหน้าไม่เลยปลายเท้ามาก", pattern: "lunge", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["bench"], difficulty: 3 },
  { key: "jump_rope_interval", name: "กระโดดเชือกสลับจังหวะ", nameEn: "Jump Rope Intervals", equipment: "home", kind: "cardio", unit: "minutes", impact: "high", met: 11.0, muscles: "น่อง หัวใจ", cue: "สลับเร็ว 30 วิ / ช้า 30 วิ ลงปลายเท้าเบา ๆ", pattern: "cardio", primaryMuscles: ["calves", "full_body"], loadable: false, equipmentNeeded: [], difficulty: 3 },

  // ══ ยิม · แกนกลาง (เดิมมีแค่ 2 ท่า) ══
  { key: "cable_crunch", name: "เคเบิลครันช์", nameEn: "Cable Crunch", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "หน้าท้อง", cue: "คุกเข่าใต้เคเบิล ม้วนตัวลงด้วยหน้าท้อง ไม่ใช่ดึงด้วยแขน", pattern: "core", primaryMuscles: ["core"], loadable: true, equipmentNeeded: ["cable"], difficulty: 3 },
  { key: "cable_pallof", name: "เคเบิลต้านการบิด", nameEn: "Cable Pallof Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "แกนกลาง ปีกข้าง", cue: "ยืนข้างเครื่อง ดันมือออกหน้าอกโดยลำตัวไม่หมุนตาม", pattern: "core", primaryMuscles: ["core", "obliques"], loadable: true, equipmentNeeded: ["cable"], difficulty: 3 },
  { key: "cable_woodchop", name: "เคเบิลฟันขวาน", nameEn: "Cable Woodchop", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ปีกข้าง แกนกลาง", cue: "ดึงจากสูงลงต่ำเฉียงข้าง หมุนสะโพกตามธรรมชาติ", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: true, equipmentNeeded: ["cable"], difficulty: 3 },
  { key: "ab_wheel", name: "ล้อบริหารหน้าท้อง", nameEn: "Ab Wheel Rollout", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หน้าท้อง หลังล่าง", cue: "คุกเข่า กลิ้งออกไปเท่าที่หลังไม่แอ่น แล้วดึงกลับด้วยท้อง", pattern: "core", primaryMuscles: ["core", "lower_back"], loadable: false, equipmentNeeded: ["machine"], difficulty: 4 },
  { key: "captains_chair", name: "ยกเข่าเก้าอี้กัปตัน", nameEn: "Captain's Chair Knee Raise", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "หน้าท้องล่าง", cue: "พิงหลังกับเบาะ ยกเข่าขึ้นด้วยท้อง ไม่เหวี่ยง", pattern: "core", primaryMuscles: ["core", "hip_flexors"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
  { key: "back_extension_machine", name: "เครื่องเหยียดหลัง", nameEn: "Back Extension Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "หลังล่าง ก้น", cue: "ก้มลงจากสะโพก ยืดขึ้นแค่ระดับลำตัวตรง ไม่แอ่นเกิน", pattern: "hinge", primaryMuscles: ["lower_back", "glutes", "hamstrings"], loadable: true, equipmentNeeded: ["machine"], difficulty: 2 },

  // ══ ยิม · เคเบิล/เครื่อง เพิ่มความหลากหลาย ══
  { key: "cable_lateral_raise", name: "เคเบิลกางไหล่ข้าง", nameEn: "Cable Lateral Raise", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "ไหล่ข้าง", cue: "ยกออกข้างถึงระดับไหล่ ศอกนำ ไม่ยักไหล่", pattern: "push_v", primaryMuscles: ["shoulders"], loadable: true, equipmentNeeded: ["cable"], difficulty: 2 },
  { key: "cable_row_single", name: "เคเบิลโรว์แขนเดียว", nameEn: "Single-Arm Cable Row", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "หลัง ปีก", cue: "ดึงศอกไปหลังชิดลำตัว ปล่อยให้สะบักยืดสุดตอนคืน", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: true, equipmentNeeded: ["cable"], difficulty: 2 },
  { key: "cable_kickback", name: "เคเบิลเตะก้น", nameEn: "Cable Glute Kickback", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "ก้น", cue: "คล้องข้อเท้า ดันขาไปหลังด้วยก้น ไม่แอ่นหลัง", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: true, equipmentNeeded: ["cable"], difficulty: 2 },
  { key: "assisted_pullup_machine", name: "เครื่องช่วยพูลอัพ", nameEn: "Assisted Pull-Up Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ปีก หลัง หน้าแขน", cue: "ตั้งน้ำหนักช่วยให้ทำได้ 8-10 ครั้ง แล้วค่อยลดตัวช่วยลง", pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: true, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "chest_press_machine", name: "เครื่องดันอก", nameEn: "Chest Press Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "อก หลังแขน ไหล่", cue: "ปรับเบาะให้มือจับอยู่ระดับกลางอก ดันจนเกือบสุดศอก", pattern: "push_h", primaryMuscles: ["chest", "triceps", "shoulders"], loadable: true, equipmentNeeded: ["machine"], difficulty: 1 },
  { key: "shoulder_press_machine", name: "เครื่องดันไหล่", nameEn: "Shoulder Press Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ไหล่ หลังแขน", cue: "หลังแนบเบาะ ดันขึ้นตรง ไม่ล็อกศอกกระแทก", pattern: "push_v", primaryMuscles: ["shoulders", "triceps"], loadable: true, equipmentNeeded: ["machine"], difficulty: 1 },
  { key: "smith_squat", name: "สมิธแมชชีนสควอท", nameEn: "Smith Machine Squat", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ต้นขาหน้า ก้น", cue: "รางบังคับทางเดินบาร์ เหมาะกับคนเริ่มต้น ย่อให้ต้นขาขนานพื้น", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: true, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "seated_calf_machine", name: "เครื่องน่องท่านั่ง", nameEn: "Seated Calf Raise", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "น่องส่วนลึก", cue: "นั่งวางเข่าใต้แผ่นกด ลงส้นสุดแล้วเขย่งสุด", pattern: "hinge", primaryMuscles: ["calves"], loadable: true, equipmentNeeded: ["machine"], difficulty: 1 },
  { key: "hip_adduction_machine", name: "เครื่องหุบสะโพก", nameEn: "Hip Adduction Machine", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "ขาใน", cue: "หุบเข่าเข้าหากันช้า ๆ คุมจังหวะกางออก", pattern: "hinge", primaryMuscles: ["adductors"], loadable: true, equipmentNeeded: ["machine"], difficulty: 1 },
  { key: "rowing_erg_interval", name: "เครื่องกรรเชียงสลับจังหวะ", nameEn: "Rowing Machine Intervals", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 8.5, muscles: "ทั้งตัว หัวใจ", cue: "ดันขา → เอนตัว → ดึงแขน สลับหนัก 1 นาที เบา 1 นาที", pattern: "cardio", primaryMuscles: ["full_body", "back", "quads"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
  { key: "stair_machine", name: "เครื่องเดินขึ้นบันได", nameEn: "Stair Climber", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 8.0, muscles: "ขา ก้น หัวใจ", cue: "ยืนตรง ไม่ทิ้งน้ำหนักบนราวจับ ก้าวเต็มขั้น", pattern: "cardio", primaryMuscles: ["glutes", "quads", "calves"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "treadmill_walk_incline", name: "ลู่วิ่งเดินชันสลับ", nameEn: "Incline Treadmill Intervals", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 7.0, muscles: "ขา ก้น หัวใจ", cue: "สลับชัน 8% 2 นาที กับชัน 2% 2 นาที ไม่จับราว", pattern: "cardio", primaryMuscles: ["glutes", "quads", "calves"], loadable: false, equipmentNeeded: ["treadmill"], difficulty: 3 },
  { key: "foam_roll_full", name: "โฟมโรลทั้งตัว", nameEn: "Full-Body Foam Rolling", equipment: "gym", kind: "mobility", unit: "minutes", impact: "low", met: 2.5, muscles: "ทั้งตัว", cue: "กลิ้งช้า ๆ จุดละ 30 วินาที เจอจุดตึงให้ค้างหายใจลึก", pattern: "mobility", primaryMuscles: ["full_body"], loadable: false, equipmentNeeded: [], difficulty: 1 },
  { key: "hip_flexor_stretch_gym", name: "ยืดสะโพกหน้าคุกเข่า", nameEn: "Kneeling Hip Flexor Stretch", equipment: "gym", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "สะโพกหน้า", cue: "คุกเข่าข้างหนึ่ง เก็บก้น ดันสะโพกไปหน้าจนตึงหน้าขา", pattern: "mobility", primaryMuscles: ["hip_flexors", "quads"], loadable: false, equipmentNeeded: [], difficulty: 1 },


  /* ══ โยคะ (เดิมมีท่าเดียว) + อุปกรณ์ที่ยังไม่มีท่ารองรับเลย 19 ชนิด ══
     เจ้าของทัก 28 ส.ค. 69: ขยายรายการอุปกรณ์เป็น 29 ชนิดแล้ว แต่ลืมสร้างท่าให้ใช้
     → คนกรอกว่ามี TRX/บอลโยคะ/เมดิซินบอล แล้วแผนไม่เคยเรียกใช้เลย */

  // ── โยคะ / เสื่อโยคะ ──
  { key: "yoga_sun_salutation", name: "ไหว้พระอาทิตย์", nameEn: "Sun Salutation", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 3.3, muscles: "ทั้งตัว", cue: "ไหลต่อเนื่องตามลมหายใจ ไม่ค้างนาน ทำวนรอบละ 1 นาที", pattern: "mobility", primaryMuscles: ["full_body", "shoulders", "hamstrings"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 2 },
  { key: "yoga_warrior2", name: "ท่านักรบสอง", nameEn: "Warrior II", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.8, muscles: "ขา สะโพก ไหล่", cue: "เข่าหน้า 90 องศาอยู่เหนือข้อเท้า กางแขนขนานพื้น มองปลายนิ้วหน้า", pattern: "mobility", primaryMuscles: ["quads", "glutes", "shoulders"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 2 },
  { key: "yoga_triangle", name: "ท่าสามเหลี่ยม", nameEn: "Triangle Pose", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.6, muscles: "ปีกข้าง ต้นขาหลัง สะโพก", cue: "ขาตรงทั้งสอง เอียงลำตัวข้างโดยไม่ก้มไปหน้า เปิดอกขึ้น", pattern: "mobility", primaryMuscles: ["obliques", "hamstrings", "adductors"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 2 },
  { key: "yoga_pigeon", name: "ท่านกพิราบ", nameEn: "Pigeon Pose", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.4, muscles: "สะโพก ก้น", cue: "งอขาหน้าวางขวางลำตัว ขาหลังเหยียดตรง ก้มลงเท่าที่สบาย", pattern: "mobility", primaryMuscles: ["glutes", "hip_flexors"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 2 },
  { key: "yoga_cobra", name: "ท่างู", nameEn: "Cobra Pose", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.5, muscles: "หลังล่าง อก", cue: "นอนคว่ำ ดันอกขึ้นด้วยหลัง ศอกงอ ไหล่ไม่ยกขึ้นหู", pattern: "mobility", primaryMuscles: ["lower_back", "chest"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 1 },
  { key: "yoga_bridge_pose", name: "ท่าสะพานโยคะ", nameEn: "Yoga Bridge Pose", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.8, muscles: "ก้น หลัง สะโพกหน้า", cue: "นอนหงาย ดันสะโพกขึ้น ประสานมือใต้ลำตัว หายใจลึก", pattern: "mobility", primaryMuscles: ["glutes", "lower_back"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 1 },
  { key: "yoga_tree", name: "ท่าต้นไม้", nameEn: "Tree Pose", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.3, muscles: "การทรงตัว ขา", cue: "ยืนขาเดียว วางฝ่าเท้าที่ต้นขาใน (ไม่วางที่เข่า) มองจุดนิ่ง", pattern: "mobility", primaryMuscles: ["quads", "core"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 2 },
  { key: "yoga_seated_twist", name: "ท่าบิดตัวนั่ง", nameEn: "Seated Spinal Twist", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 2.2, muscles: "หลัง ปีกข้าง", cue: "นั่งขัดสมาธิ บิดลำตัวไปข้างหนึ่ง มือช่วยดันเบา ๆ หายใจออกตอนบิด", pattern: "mobility", primaryMuscles: ["back", "obliques"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 1 },
  { key: "yoga_savasana", name: "ท่าศพผ่อนคลาย", nameEn: "Savasana", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", met: 1.3, muscles: "ผ่อนคลายทั้งตัว", cue: "นอนหงายปล่อยแขนขา หายใจเข้า 4 ออก 6 นับ ปิดท้ายทุกเซสชัน", pattern: "mobility", primaryMuscles: ["full_body"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 1 },
  { key: "yoga_chair_pose", name: "ท่าเก้าอี้โยคะ", nameEn: "Chair Pose", equipment: "none", kind: "strength", unit: "minutes", impact: "low", met: 3.5, muscles: "ต้นขาหน้า ก้น ไหล่", cue: "ย่อเหมือนนั่งเก้าอี้ล่องหน ยกแขนขึ้น หลังยาว ค้างไว้", pattern: "squat", primaryMuscles: ["quads", "glutes", "shoulders"], loadable: false, equipmentNeeded: ["yoga_mat"], difficulty: 2 },

  // ── TRX / สายห้อย ──
  { key: "trx_row", name: "ทีอาร์เอ็กซ์โรว์", nameEn: "TRX Row", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หลัง ปีก หน้าแขน", cue: "เอนตัวถอยหลัง ลำตัวตรงเป็นแผ่นเดียว ดึงศอกชิดลำตัว", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["trx"], difficulty: 3 },
  { key: "trx_pushup", name: "ทีอาร์เอ็กซ์วิดพื้น", nameEn: "TRX Push-Up", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "อก หลังแขน แกนกลาง", cue: "จับสายห้อย ลงช้าโดยลำตัวไม่แอ่น แกนกลางเกร็งตลอด", pattern: "push_h", primaryMuscles: ["chest", "triceps", "core"], loadable: false, equipmentNeeded: ["trx"], difficulty: 4 },
  { key: "trx_squat", name: "ทีอาร์เอ็กซ์สควอท", nameEn: "TRX Assisted Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ต้นขาหน้า ก้น", cue: "จับสายช่วยพยุง ย่อลึกกว่าปกติได้โดยหลังไม่งอ", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["trx"], difficulty: 2 },
  { key: "trx_hamstring_curl", name: "ทีอาร์เอ็กซ์งอขา", nameEn: "TRX Hamstring Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหลัง ก้น", cue: "นอนหงาย ส้นเท้าคล้องสาย ยกสะโพกแล้วงอเข่าเข้าหาตัว", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], loadable: false, equipmentNeeded: ["trx"], difficulty: 4 },
  { key: "trx_fallout", name: "ทีอาร์เอ็กซ์ยืดแขนหน้า", nameEn: "TRX Fallout", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "แกนกลาง ไหล่", cue: "ยื่นแขนไปหน้าจนสุด ลำตัวเป็นเส้นตรง หลังห้ามแอ่น", pattern: "core", primaryMuscles: ["core", "shoulders"], loadable: false, equipmentNeeded: ["trx"], difficulty: 4 },

  // ── เมดิซินบอล ──
  { key: "med_ball_slam", name: "เมดิซินบอลฟาดพื้น", nameEn: "Medicine Ball Slam", equipment: "home", kind: "cardio", unit: "minutes", impact: "high", met: 8.0, muscles: "ทั้งตัว แกนกลาง", cue: "ยกเหนือหัวแล้วฟาดลงพื้นสุดแรง ย่อเก็บลูกทุกครั้ง", pattern: "core", primaryMuscles: ["full_body", "core", "lats"], loadable: true, equipmentNeeded: ["medicine_ball"], difficulty: 3 },
  { key: "med_ball_twist", name: "เมดิซินบอลบิดลำตัว", nameEn: "Medicine Ball Russian Twist", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "ปีกข้าง แกนกลาง", cue: "นั่งเอนหลัง ถือลูกบิดแตะข้างลำตัวสลับ เท้าลอยได้ถ้าไหว", pattern: "core", primaryMuscles: ["obliques", "core"], loadable: true, equipmentNeeded: ["medicine_ball"], difficulty: 3 },
  { key: "med_ball_wall_throw", name: "เมดิซินบอลโยนกำแพง", nameEn: "Medicine Ball Wall Throw", equipment: "home", kind: "cardio", unit: "minutes", impact: "low", met: 7.0, muscles: "ทั้งตัว ไหล่", cue: "ย่อแล้วโยนขึ้นกำแพง รับแล้วย่อต่อเนื่องเป็นจังหวะ", pattern: "core", primaryMuscles: ["full_body", "shoulders", "quads"], loadable: true, equipmentNeeded: ["medicine_ball"], difficulty: 3 },
  { key: "med_ball_situp", name: "เมดิซินบอลซิทอัพ", nameEn: "Medicine Ball Sit-Up", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หน้าท้อง", cue: "ถือลูกไว้หน้าอก ลุกขึ้นด้วยท้อง ไม่ดึงคอ", pattern: "core", primaryMuscles: ["core"], loadable: true, equipmentNeeded: ["medicine_ball"], difficulty: 3 },

  // ── บอลโยคะ (stability ball) ──
  { key: "ball_crunch", name: "ครันช์บนบอลโยคะ", nameEn: "Stability Ball Crunch", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "หน้าท้อง", cue: "หลังล่างวางบนบอล ม้วนตัวขึ้นสั้น ๆ ไม่ดึงคอ", pattern: "core", primaryMuscles: ["core"], loadable: false, equipmentNeeded: ["stability_ball"], difficulty: 2 },
  { key: "ball_hamstring_curl", name: "งอขาบนบอลโยคะ", nameEn: "Stability Ball Hamstring Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "ต้นขาหลัง ก้น", cue: "นอนหงาย ส้นวางบนบอล ยกสะโพกแล้วดึงบอลเข้าหาตัว", pattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], loadable: false, equipmentNeeded: ["stability_ball"], difficulty: 3 },
  { key: "ball_plank", name: "แพลงก์บนบอลโยคะ", nameEn: "Stability Ball Plank", equipment: "home", kind: "strength", unit: "minutes", impact: "low", met: 4.0, muscles: "แกนกลาง ไหล่", cue: "วางศอกบนบอล เกร็งท้องกันบอลกลิ้ง ค้างไว้", pattern: "core", primaryMuscles: ["core", "shoulders"], loadable: false, equipmentNeeded: ["stability_ball"], difficulty: 3 },
  { key: "ball_wall_squat", name: "สควอทบอลติดผนัง", nameEn: "Stability Ball Wall Squat", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "ต้นขาหน้า ก้น", cue: "วางบอลระหว่างหลังกับผนัง ย่อลงให้บอลกลิ้งตาม เข่าไม่เลยปลายเท้า", pattern: "squat", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["stability_ball"], difficulty: 1 },

  // ── เชือกแบทเทิลโรป / เชือกกระโดด ──
  { key: "battle_rope_wave", name: "แบทเทิลโรปสะบัดคลื่น", nameEn: "Battle Rope Waves", equipment: "home", kind: "cardio", unit: "minutes", impact: "low", met: 9.0, muscles: "ไหล่ แขน หัวใจ", cue: "ย่อครึ่ง สะบัดสลับซ้ายขวาเร็ว ๆ ลำตัวนิ่ง", pattern: "cardio", primaryMuscles: ["shoulders", "core", "full_body"], loadable: false, equipmentNeeded: ["battle_rope"], difficulty: 3 },
  { key: "battle_rope_slam", name: "แบทเทิลโรปฟาดสองมือ", nameEn: "Battle Rope Slams", equipment: "home", kind: "cardio", unit: "minutes", impact: "low", met: 9.5, muscles: "ทั้งตัว", cue: "ยกเชือกสองมือขึ้นสุดแล้วฟาดลงพร้อมย่อ", pattern: "cardio", primaryMuscles: ["full_body", "shoulders", "core"], loadable: false, equipmentNeeded: ["battle_rope"], difficulty: 4 },
  { key: "jump_rope_double", name: "กระโดดเชือกสองรอบ", nameEn: "Double Unders", equipment: "home", kind: "cardio", unit: "minutes", impact: "high", met: 12.0, muscles: "น่อง หัวใจ", cue: "กระโดดสูงขึ้นเล็กน้อยแล้วสะบัดข้อมือให้เชือกลอด 2 รอบ", pattern: "cardio", primaryMuscles: ["calves", "full_body"], loadable: false, equipmentNeeded: ["jump_rope"], difficulty: 4 },

  // ── โฟมโรลเลอร์ ──
  { key: "foam_roll_quad", name: "โฟมโรลต้นขาหน้า", nameEn: "Foam Roll Quads", equipment: "home", kind: "mobility", unit: "minutes", impact: "low", met: 2.5, muscles: "ต้นขาหน้า", cue: "นอนคว่ำวางโฟมใต้ต้นขา กลิ้งช้า เจอจุดตึงค้าง 20 วินาที", pattern: "mobility", primaryMuscles: ["quads"], loadable: false, equipmentNeeded: ["foam_roller"], difficulty: 1 },
  { key: "foam_roll_itband", name: "โฟมโรลข้างต้นขา", nameEn: "Foam Roll IT Band", equipment: "home", kind: "mobility", unit: "minutes", impact: "low", met: 2.5, muscles: "ข้างต้นขา", cue: "นอนตะแคง กลิ้งจากสะโพกถึงเหนือเข่า อย่ากลิ้งทับข้อ", pattern: "mobility", primaryMuscles: ["quads", "glutes"], loadable: false, equipmentNeeded: ["foam_roller"], difficulty: 2 },
  { key: "foam_roll_upper_back", name: "โฟมโรลหลังบน", nameEn: "Foam Roll Upper Back", equipment: "home", kind: "mobility", unit: "minutes", impact: "low", met: 2.4, muscles: "หลังบน", cue: "วางโฟมใต้สะบัก ประสานมือท้ายทอย กลิ้งขึ้นลงช้า ๆ", pattern: "mobility", primaryMuscles: ["back", "traps"], loadable: false, equipmentNeeded: ["foam_roller"], difficulty: 1 },

  // ── แผ่นน้ำหนัก / ถุงทราย / ถ่วงข้อเท้า / บาร์ EZ ──
  { key: "plate_front_raise", name: "แผ่นน้ำหนักยกหน้า", nameEn: "Plate Front Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "ไหล่หน้า", cue: "จับแผ่นสองข้าง ยกขึ้นระดับตา แขนเกือบตรง ไม่แกว่งตัว", pattern: "push_v", primaryMuscles: ["shoulders"], loadable: true, equipmentNeeded: ["weight_plate"], difficulty: 2 },
  { key: "plate_halo", name: "แผ่นน้ำหนักวนรอบหัว", nameEn: "Plate Halo", equipment: "home", kind: "mobility", unit: "reps", impact: "low", met: 3.4, muscles: "ไหล่ หลังบน", cue: "วนแผ่นรอบศีรษะช้า ๆ สลับทิศ ลำตัวไม่โยก", pattern: "mobility", primaryMuscles: ["shoulders", "traps"], loadable: true, equipmentNeeded: ["weight_plate"], difficulty: 2 },
  { key: "plate_squat_hold", name: "แผ่นน้ำหนักสควอทถือหน้า", nameEn: "Plate Front Squat Hold", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "ต้นขาหน้า แกนกลาง", cue: "ถือแผ่นไว้หน้าอก ย่อลึก ลำตัวตั้งตรง", pattern: "squat", primaryMuscles: ["quads", "core", "glutes"], loadable: true, equipmentNeeded: ["weight_plate"], difficulty: 2 },
  { key: "sandbag_carry", name: "ถุงทรายแบกเดิน", nameEn: "Sandbag Carry", equipment: "home", kind: "strength", unit: "minutes", impact: "low", met: 6.0, muscles: "ทั้งตัว แกนกลาง", cue: "แบกบนไหล่หรือกอดหน้าอก เดินตัวตรง สลับข้างครึ่งทาง", pattern: "carry", primaryMuscles: ["full_body", "core", "traps"], loadable: true, equipmentNeeded: ["sandbag"], difficulty: 3 },
  { key: "sandbag_clean", name: "ถุงทรายยกขึ้นไหล่", nameEn: "Sandbag Clean to Shoulder", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 7.0, muscles: "ทั้งตัว ก้น หลัง", cue: "พับสะโพกยกขึ้นด้วยขา ไม่งอหลัง สลับไหล่ทุกครั้ง", pattern: "hinge", primaryMuscles: ["full_body", "glutes", "back"], loadable: true, equipmentNeeded: ["sandbag"], difficulty: 4 },
  { key: "ankle_weight_leg_raise", name: "ถ่วงข้อเท้ายกขาข้าง", nameEn: "Weighted Side Leg Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.4, muscles: "ก้นข้าง สะโพก", cue: "นอนตะแคง ใส่ถ่วงข้อเท้า ยกขาขึ้นข้างช้า ๆ ไม่แกว่ง", pattern: "hinge", primaryMuscles: ["glutes"], loadable: true, equipmentNeeded: ["ankle_weights"], difficulty: 2 },
  { key: "ankle_weight_kickback", name: "ถ่วงข้อเท้าเตะหลัง", nameEn: "Weighted Glute Kickback", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 3.6, muscles: "ก้น", cue: "คุกเข่าสี่ขา ดันส้นขึ้นเพดาน หลังไม่แอ่น", pattern: "hinge", primaryMuscles: ["glutes", "hamstrings"], loadable: true, equipmentNeeded: ["ankle_weights"], difficulty: 2 },
  { key: "ez_bar_curl", name: "บาร์อีแซดหน้าแขน", nameEn: "EZ-Bar Curl", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "หน้าแขน", cue: "จับตรงส่วนหยัก ศอกแนบลำตัว ข้อมือเป็นกลางลดแรงกดข้อ", pattern: "pull_h", primaryMuscles: ["biceps", "forearms"], loadable: true, equipmentNeeded: ["ez_bar"], difficulty: 2 },
  { key: "ez_bar_skullcrusher", name: "บาร์อีแซดเหยียดหลังแขน", nameEn: "EZ-Bar Skullcrusher", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.2, muscles: "หลังแขน", cue: "นอนราบ ลดบาร์มาหลังหน้าผาก ศอกชี้ฟ้าไม่บาน", pattern: "push_v", primaryMuscles: ["triceps"], loadable: true, equipmentNeeded: ["ez_bar", "bench"], difficulty: 3 },

  // ── บาร์ดิป / แร็ค / สมิธ / เลกเพรส ──
  { key: "dip_bar_dips", name: "ดิปบาร์คู่", nameEn: "Parallel Bar Dips", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 6.0, muscles: "หลังแขน อกล่าง ไหล่", cue: "ลงจนศอก 90 องศา ลำตัวเอนหน้าเล็กน้อย ไหล่ไม่ยกขึ้นหู", pattern: "push_h", primaryMuscles: ["triceps", "chest", "shoulders"], loadable: false, equipmentNeeded: ["dip_bar"], difficulty: 4 },
  { key: "dip_bar_leg_raise", name: "ดิปบาร์ยกขา", nameEn: "Parallel Bar Leg Raise", equipment: "home", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หน้าท้องล่าง", cue: "ยันตัวบนบาร์คู่ ยกเข่าหรือขาตรงขึ้น ไม่แกว่ง", pattern: "core", primaryMuscles: ["core", "hip_flexors"], loadable: false, equipmentNeeded: ["dip_bar"], difficulty: 3 },
  { key: "rack_pull", name: "แร็คพูล", nameEn: "Rack Pull", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.5, muscles: "หลัง ก้น ต้นขาหลัง", cue: "ตั้งบาร์ระดับใต้เข่า ดึงขึ้นด้วยสะโพก หลังตรงตลอด", pattern: "hinge", primaryMuscles: ["back", "glutes", "hamstrings"], loadable: true, equipmentNeeded: ["squat_rack", "barbell"], difficulty: 3 },
  { key: "smith_row", name: "สมิธแมชชีนโรว์", nameEn: "Smith Machine Row", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "หลัง ปีก", cue: "ก้มลำตัว ดึงบาร์เข้าท้อง รางช่วยคุมทางเดินให้นิ่ง", pattern: "pull_h", primaryMuscles: ["back", "lats"], loadable: true, equipmentNeeded: ["smith_machine"], difficulty: 2 },
  { key: "leg_press_machine", name: "เครื่องเลกเพรส", nameEn: "Leg Press", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "ต้นขาหน้า ก้น", cue: "วางเท้ากลางแผ่น ลงจนเข่า 90 องศา ไม่ล็อกเข่ากระแทกตอนดัน", pattern: "squat", primaryMuscles: ["quads", "glutes", "hamstrings"], loadable: true, equipmentNeeded: ["leg_press"], difficulty: 2 },
  { key: "leg_press_calf", name: "เลกเพรสดันน่อง", nameEn: "Leg Press Calf Raise", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 3.8, muscles: "น่อง", cue: "วางปลายเท้าที่ขอบแผ่น ดันด้วยน่องอย่างเดียว เข่าเกือบตรง", pattern: "hinge", primaryMuscles: ["calves"], loadable: true, equipmentNeeded: ["leg_press"], difficulty: 1 },

  // ── เครื่องคาร์ดิโอที่ยังไม่มีท่า ──
  { key: "elliptical_steady", name: "เครื่องเดินวงรีจังหวะคงที่", nameEn: "Elliptical Steady State", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 5.5, muscles: "ทั้งตัว หัวใจ", cue: "ยืนตรง ดันและดึงแขนไปด้วย แรงกระแทกต่ำเหมาะกับคนเข่าไม่ดี", pattern: "cardio", primaryMuscles: ["full_body", "quads", "glutes"], loadable: false, equipmentNeeded: ["elliptical"], difficulty: 1 },
  { key: "elliptical_interval", name: "เครื่องเดินวงรีสลับหนักเบา", nameEn: "Elliptical Intervals", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 7.5, muscles: "ทั้งตัว หัวใจ", cue: "สลับหนัก 1 นาที เบา 2 นาที ตามลมหายใจที่ยังพูดได้", pattern: "cardio", primaryMuscles: ["full_body", "quads"], loadable: false, equipmentNeeded: ["elliptical"], difficulty: 3 },
  { key: "rowing_steady", name: "เครื่องพายเรือจังหวะคงที่", nameEn: "Rowing Steady State", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 7.0, muscles: "ทั้งตัว หัวใจ", cue: "ลำดับ ดันขา-เอนตัว-ดึงแขน แล้วคืนย้อนกลับ", pattern: "cardio", primaryMuscles: ["full_body", "back", "quads"], loadable: false, equipmentNeeded: ["rowing_machine"], difficulty: 2 },
  { key: "stair_interval", name: "เครื่องบันไดสลับจังหวะ", nameEn: "Stair Climber Intervals", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 9.0, muscles: "ขา ก้น หัวใจ", cue: "สลับเร็ว 1 นาที ช้า 2 นาที ไม่พิงราวจับ", pattern: "cardio", primaryMuscles: ["glutes", "quads", "calves"], loadable: false, equipmentNeeded: ["stair_climber"], difficulty: 3 },
  { key: "bike_sprint", name: "จักรยานสปรินต์สลับ", nameEn: "Bike Sprint Intervals", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", met: 10.0, muscles: "ขา หัวใจ", cue: "ปั่นสุดแรง 20 วินาที พัก 40 วินาที วนรอบ", pattern: "cardio", primaryMuscles: ["quads", "glutes", "calves"], loadable: false, equipmentNeeded: ["bike"], difficulty: 4 },

  /* ── ตัวเปล่าล้วน: อุดช่องที่ยังบางจริง (28 ส.ค. 69) ──
     คนไม่มีอุปกรณ์เลยเคยได้ "ดึงแนวดิ่ง" แค่ 2 ท่า และ "หิ้ว/แบก" 0 ท่า
     ดึงแนวดิ่งจริง ๆ ต้องมีบาร์โหน → ใช้แรงต้านตัวเอง/ผ้าขนหนู/พื้นแทนได้
     หิ้ว/แบกต้องมีน้ำหนักถ่วง → ใช้การเคลื่อนที่แบบรับน้ำหนักตัว (คลาน/เดินปู) ซึ่งเป็น anti-rotation แบบเดียวกัน */
  { key: "self_resisted_pulldown", name: "ดึงลงต้านมือตัวเอง", nameEn: "Self-Resisted Lat Pulldown", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ปีก หลังส่วนบน หน้าแขน", cue: "ยกแขนขึ้นเหนือหัว กำมือดึงลงข้างลำตัวพร้อมเกร็งต้านสุดทาง 3 วิ", pattern: "pull_v", primaryMuscles: ["lats", "back", "biceps"], loadable: false, equipmentNeeded: [], difficulty: 1, progressionGroup: "pullv_bw" },
  { key: "towel_pulldown", name: "ดึงผ้าขนหนูลงเหนือหัว", nameEn: "Towel Overhead Pulldown", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ปีก หลังส่วนบน ไหล่หลัง", cue: "จับผ้าตึงเหนือหัว ดึงแยกออกพร้อมลากศอกลงชิดซี่โครง", pattern: "pull_v", primaryMuscles: ["lats", "back", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 2, progressionGroup: "pullv_bw" },
  { key: "prone_lat_pullin", name: "นอนคว่ำลากแขนเข้าลำตัว", nameEn: "Prone Lat Pull-In", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 3.5, muscles: "ปีก หลังส่วนบน สะบัก", cue: "นอนคว่ำเหยียดแขนหน้า กดฝ่ามือลากตัวไปหน้าโดยใช้ปีก ไม่ยกคอ", pattern: "pull_v", primaryMuscles: ["lats", "back"], loadable: false, equipmentNeeded: [], difficulty: 3, progressionGroup: "pullv_bw" },
  { key: "crab_walk", name: "เดินปู", nameEn: "Crab Walk", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 5.0, muscles: "ไหล่หลัง หลังแขน ก้น แกนกลาง", cue: "นั่งยกสะโพกลอย เดินถอย/หน้าโดยสะโพกไม่ตก", pattern: "carry", primaryMuscles: ["shoulders", "triceps", "glutes", "core"], loadable: false, equipmentNeeded: [], difficulty: 2 },
  { key: "bear_crawl_lateral", name: "คลานหมีออกข้าง", nameEn: "Lateral Bear Crawl", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", met: 6.0, muscles: "ทั้งตัว แกนกลาง ไหล่", cue: "คลานออกข้างโดยเข่าลอยเหนือพื้นหนึ่งฝ่ามือ สะโพกนิ่ง", pattern: "carry", primaryMuscles: ["full_body", "core", "shoulders"], loadable: false, equipmentNeeded: [], difficulty: 3 },
];

export const EXERCISE_CATALOG: CatalogExercise[] = attachMedia(CATALOG_RAW);

/**
 * แคลอรี่ที่เผาได้จากท่าออกกำลังกาย (สูตรมาตรฐาน MET)
 *   kcal = MET × 3.5 × น้ำหนัก(กก.) / 200 × นาที
 * คืนจำนวนเต็ม · ค่าที่ไม่สมเหตุสมผล (น้ำหนัก/เวลา ≤ 0) → 0
 */
export function kcalForExercise(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return Math.round((met * 3.5 * weightKg) / 200 * minutes);
}

const TIER_ORDER: Record<EquipmentTier, number> = { none: 0, home: 1, gym: 2 };

/**
 * ท่าที่ user ทำได้จริงตามอุปกรณ์ที่มี
 *
 * `owned` = คลังอุปกรณ์รายชิ้นของเขา (MemberEquipment) — ส่งมาเมื่อไหร่จะกรองละเอียดขึ้นอีกชั้น
 * 🔴 27 ส.ค. 69 เจ้าของทัก: กรอกอุปกรณ์ไว้ตั้งเยอะแต่แผนไม่เคยรู้จักเลย
 *    ของเดิมดูแค่ tier 3 ระดับ → คนมีแค่ยางยืดได้ท่าดัมเบล, คนมีลู่วิ่งอย่างเดียวได้ท่าเครื่องทั้งฟิตเนส
 *    ตอนนี้ถ้ามีคลังอุปกรณ์จริง จะตัดท่าที่ต้องใช้ของที่เขาไม่มีออก
 * 🔴 คลังว่าง = ไม่ได้แปลว่า "ไม่มีอะไรเลย" แต่แปลว่า "ยังไม่ได้กรอก" → ใช้ tier ตามเดิม ห้ามตัดจนแผนว่าง
 */
export function catalogFor(
  tier: EquipmentTier | null | undefined,
  owned?: readonly string[] | null
): CatalogExercise[] {
  const max = TIER_ORDER[tier || "none"];
  const byTier = EXERCISE_CATALOG.filter((e) => TIER_ORDER[e.equipment] <= max);
  if (!owned || owned.length === 0) return byTier;

  const have = new Set(owned);
  // "ฟิตเนสครบ" = เข้าถึงของทุกอย่างในยิม ไม่ต้องมากรอกทีละชิ้น
  if (have.has("full_gym")) return byTier;
  return byTier.filter((e) => (e.equipmentNeeded ?? []).every((need) => have.has(need)));
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.·/()]/g, "");

/**
 * บังคับชื่อท่าจาก AI ให้ตรงกับคลัง — คืน null ถ้าจับคู่ไม่ได้เลย
 * (ชื่อตรง → ชื่อที่มีคำเดียวกัน → คำสำคัญร่วม)
 */
export function matchExercise(rawName: string, pool: CatalogExercise[]): CatalogExercise | null {
  const n = norm(rawName || "");
  if (!n) return null;

  const exact = pool.find((e) => norm(e.name) === n);
  if (exact) return exact;

  const contains = pool.find((e) => n.includes(norm(e.name)) || norm(e.name).includes(n));
  if (contains) return contains;

  const KEYWORDS: Array<[RegExp, string]> = [
    [/วิ่งเหยาะ|จ๊อก|jog/, "jog_light"],
    [/เดิน(เร็ว)?|walk/, "walk_fast"],
    [/วิ่ง|run|ลู่/, "treadmill"],
    [/ปั่น|จักรยาน|bike|cycl/, "stationary_bike"],
    [/ว่ายน้ำ|swim/, "swimming"],
    [/สควอท|squat/, "squat_bw"],
    [/แพลงก์|plank/, "plank"],
    [/วิดพื้น|pushup|push-up|ดันพื้น/, "pushup"],
    [/ลันจ์|lunge/, "lunge"],
    [/ท้อง|crunch|ซิทอัพ|situp/, "crunch"],
    [/ยืด|stretch|คูลดาวน์|วอร์ม/, "stretch_full"],
    [/โยคะ|yoga/, "yoga_basic"],
    [/บันได|stair/, "stair_step"],
    [/ดัมเบล|dumbbell/, "db_row"],
    [/ยางยืด|band/, "band_row"],
    [/เวท|weight|บาร์เบล|barbell/, "barbell_squat"],
  ];
  for (const [re, key] of KEYWORDS) {
    if (re.test(rawName)) {
      const hit = pool.find((e) => e.key === key);
      if (hit) return hit;
    }
  }
  return null;
}

/** ท่าสำรองที่ปลอดภัยที่สุดของแต่ละประเภท (ใช้เมื่อจับคู่ไม่ได้) */
export function defaultExercise(pool: CatalogExercise[], kind: ExerciseKind): CatalogExercise {
  return (
    pool.find((e) => e.kind === kind && e.impact === "low") ||
    pool.find((e) => e.impact === "low") ||
    EXERCISE_CATALOG[0]
  );
}

/** รายชื่อท่าสำหรับใส่ใน prompt (จัดกลุ่มให้ AI เลือกง่าย) */
export function catalogPromptList(pool: CatalogExercise[]): string {
  const group = (k: ExerciseKind, label: string) => {
    const items = pool.filter((e) => e.kind === k);
    return items.length ? `${label}: ${items.map((e) => e.name).join(" · ")}` : "";
  };
  return [group("cardio", "คาร์ดิโอ"), group("strength", "กำลัง"), group("mobility", "ยืดเหยียด/ฟื้นฟู")]
    .filter(Boolean)
    .join("\n");
}
