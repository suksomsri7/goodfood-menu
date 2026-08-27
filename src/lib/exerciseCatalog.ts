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

/** อุปกรณ์รายชิ้น — ต้องตรงกับ MemberEquipment.type (ว่าง = ตัวเปล่า/ไม่ต้องใช้อะไร) */
export type EquipmentItem =
  | "dumbbell" | "barbell" | "kettlebell" | "band" | "bench" | "pullup_bar" | "machine" | "treadmill" | "bike";

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
  { key: "cable_row", name: "เคเบิลโรว์", nameEn: "Cable Row", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "หลัง", cue: "หลังตรง ดึงเข้าท้องน้อย บีบสะบัก", pattern: "pull_h", primaryMuscles: ["back", "lats", "biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 4, progressionGroup: "row" },
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
  { key: "chair_dip", name: "ดิพเก้าอี้", nameEn: "Chair Dip", equipment: "none", kind: "strength", unit: "reps", impact: "low", met: 5.0, muscles: "แขนหลัง ไหล่ อก", cue: "มือจับขอบเก้าอี้ ศอกชี้ไปหลัง ลงแค่ระดับที่ไหล่ไม่เจ็บ", pattern: "push_v", primaryMuscles: ["triceps", "shoulders", "chest"], loadable: false, equipmentNeeded: [], difficulty: 3 },

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
  { key: "cable_fly", name: "เคเบิลบินอก", nameEn: "Cable Chest Fly", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.5, muscles: "อก ไหล่หน้า", cue: "ศอกงอคงที่ วาดโค้งมาชนกันหน้าอก คุมขากลับให้สุดช่วง", pattern: "push_h", primaryMuscles: ["chest", "shoulders"], loadable: false, equipmentNeeded: ["machine"], difficulty: 3 },
  { key: "tricep_pushdown", name: "เคเบิลกดแขนหลัง", nameEn: "Cable Triceps Pushdown", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "แขนหลัง", cue: "ศอกแนบลำตัวนิ่ง กดลงจนแขนเหยียดสุด ปล่อยกลับช้า", pattern: "push_h", primaryMuscles: ["triceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
  { key: "cable_curl", name: "เคเบิลเคิร์ล", nameEn: "Cable Biceps Curl", equipment: "gym", kind: "strength", unit: "reps", impact: "low", met: 4.0, muscles: "แขนหน้า", cue: "ยืนตรง ศอกแนบข้าง ปล่อยกลับช้าไม่ทิ้งน้ำหนัก", pattern: "pull_h", primaryMuscles: ["biceps"], loadable: false, equipmentNeeded: ["machine"], difficulty: 2 },
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
