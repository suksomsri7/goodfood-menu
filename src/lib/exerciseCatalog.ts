/**
 * คลังท่าออกกำลังกายมาตรฐาน (Coach)
 *
 * ทำไมต้องมี: เดิม AI แต่งชื่อท่าอิสระทุกครั้ง ("โปรแกรมวันจันทร์", "เดินเร็ว/วิ่งเหยาะ")
 * → จับคู่วิดีโอ/รูปสาธิตไม่ได้ · กรองท่าตามอุปกรณ์ที่ user มีไม่ได้ · ท่าไม่สม่ำเสมอ
 * ตอนนี้แผนต้องเลือกจากคลังนี้เท่านั้น แล้ว snapExercise() บังคับชื่อให้ตรง key
 *
 * equipment tier: none (ตัวเปล่า) → home (ดัมเบล/ยางยืด) → gym (ฟิตเนสครบ)
 * impact: high = มีกระโดด/แรงกระแทกเข่า (ตัดออกอัตโนมัติถ้ามีข้อห้ามเรื่องเข่า/กระโดด)
 */

export type EquipmentTier = "none" | "home" | "gym";
export type ExerciseKind = "cardio" | "strength" | "mobility";

export interface CatalogExercise {
  key: string;
  name: string; // ชื่อไทยมาตรฐาน — ใช้เป็นชื่อในแผนตรง ๆ
  equipment: EquipmentTier;
  kind: ExerciseKind;
  unit: "minutes" | "reps";
  impact: "low" | "high";
  muscles: string;
  cue: string; // ทิปฟอร์มสั้น ๆ แสดงในหน้า "ดูท่า"
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // ── ตัวเปล่า: คาร์ดิโอ ──
  { key: "walk_fast", name: "เดินเร็ว", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", muscles: "ทั้งตัว", cue: "อกตั้ง แกว่งแขนธรรมชาติ ก้าวยาวพอสบาย" },
  { key: "jog_light", name: "วิ่งเหยาะ", equipment: "none", kind: "cardio", unit: "minutes", impact: "high", muscles: "ขา หัวใจ", cue: "ลงกลางเท้า ไหล่ผ่อน หายใจเป็นจังหวะ" },
  { key: "stair_step", name: "ขึ้นลงบันได", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", muscles: "ขา ก้น", cue: "วางเต็มฝ่าเท้า ดันส้นเท้าขึ้น ไม่โน้มตัวมาก" },
  { key: "jumping_jack", name: "กระโดดตบ", equipment: "none", kind: "cardio", unit: "reps", impact: "high", muscles: "ทั้งตัว", cue: "ลงเบา ๆ งอเข่าเล็กน้อยรับแรง" },
  { key: "mountain_climber", name: "เมาน์เทนไคลม์เบอร์", equipment: "none", kind: "cardio", unit: "reps", impact: "high", muscles: "แกนกลาง ขา", cue: "สะโพกนิ่ง ไม่ยกก้นสูง เข่าเข้าอก" },
  { key: "burpee", name: "เบอร์พี", equipment: "none", kind: "cardio", unit: "reps", impact: "high", muscles: "ทั้งตัว", cue: "หลังตรงตอนลง ค่อย ๆ เพิ่มความเร็ว" },
  { key: "shadow_box", name: "ชกลม", equipment: "none", kind: "cardio", unit: "minutes", impact: "low", muscles: "ไหล่ แกนกลาง", cue: "หมุนสะโพกตาม อย่าเหยียดศอกสุด" },

  // ── ตัวเปล่า: กำลัง ──
  { key: "squat_bw", name: "สควอทน้ำหนักตัว", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "ขา ก้น", cue: "เข่าไปทางปลายเท้า อกตั้ง ลงเท่าที่หลังยังตรง" },
  { key: "wall_sit", name: "นั่งพิงกำแพง", equipment: "none", kind: "strength", unit: "minutes", impact: "low", muscles: "ต้นขา", cue: "เข่างอ 90 องศา หลังแนบกำแพง" },
  { key: "lunge", name: "ลันจ์", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "ขา ก้น", cue: "ก้าวยาวพอ เข่าหน้าไม่เลยปลายเท้า ลำตัวตั้ง" },
  { key: "glute_bridge", name: "กลูตบริดจ์", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "ก้น หลังล่าง", cue: "บีบก้นตอนยกสุด ไม่แอ่นหลัง" },
  { key: "pushup", name: "วิดพื้น", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "อก ไหล่ แขน", cue: "ลำตัวเป็นเส้นตรง ศอกแนบลำตัว 45 องศา" },
  { key: "pushup_knee", name: "วิดพื้นเข่าติดพื้น", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "อก แขน", cue: "สะโพกไม่ตก ลงช้าขึ้นเร็ว" },
  { key: "plank", name: "แพลงก์", equipment: "none", kind: "strength", unit: "minutes", impact: "low", muscles: "แกนกลาง", cue: "ศอกใต้ไหล่ เกร็งหน้าท้อง ไม่ยกก้น" },
  { key: "side_plank", name: "ไซด์แพลงก์", equipment: "none", kind: "strength", unit: "minutes", impact: "low", muscles: "เอว แกนกลาง", cue: "สะโพกยกสูง ลำตัวเป็นเส้นตรง" },
  { key: "crunch", name: "ครันช์", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "หน้าท้อง", cue: "ยกแค่สะบัก ไม่ดึงคอ" },
  { key: "bicycle_crunch", name: "จักรยานอากาศ", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "หน้าท้อง เอว", cue: "ช้า ๆ บิดจากลำตัว ไม่ใช่ข้อศอก" },
  { key: "superman", name: "ซูเปอร์แมน", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง", cue: "ยกแขนขาพอตึง คอเป็นแนวเดียวกับหลัง" },
  { key: "bird_dog", name: "เบิร์ดด็อก", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง แกนกลาง", cue: "เหยียดแขนขาตรงข้าม สะโพกไม่บิด" },
  { key: "calf_raise", name: "เขย่งปลายเท้า", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "น่อง", cue: "ขึ้นสุด ค้าง 1 วิ ลงช้า" },
  { key: "step_up", name: "สเต็ปอัพบนขั้นบันได", equipment: "none", kind: "strength", unit: "reps", impact: "low", muscles: "ขา ก้น", cue: "ดันด้วยส้นเท้าข้างบน ไม่ถีบเท้าล่าง" },

  // ── ตัวเปล่า: ยืดเหยียด/ฟื้นฟู ──
  { key: "stretch_full", name: "ยืดเหยียดทั้งตัว", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", muscles: "ทั้งตัว", cue: "ค้างท่าละ 20-30 วิ หายใจยาว ไม่กระตุก" },
  { key: "yoga_basic", name: "โยคะพื้นฐาน", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", muscles: "ทั้งตัว", cue: "เคลื่อนตามลมหายใจ ไม่ฝืนจุดที่เจ็บ" },
  { key: "cat_cow", name: "ท่าแมว-วัว", equipment: "none", kind: "mobility", unit: "reps", impact: "low", muscles: "หลัง", cue: "แอ่น-โก่งหลังช้า ๆ ตามลมหายใจ" },
  { key: "hip_stretch", name: "ยืดสะโพก", equipment: "none", kind: "mobility", unit: "minutes", impact: "low", muscles: "สะโพก", cue: "ค้างข้างละ 30 วิ ไม่เด้ง" },

  // ── ดัมเบล / ยางยืด (home) ──
  { key: "db_squat", name: "ดัมเบลสควอท", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "ขา ก้น", cue: "ถือดัมเบลข้างลำตัว อกตั้ง ลงช้า" },
  { key: "db_row", name: "ดัมเบลโรว์", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง แขน", cue: "หลังตรง ดึงศอกไปข้างหลัง บีบสะบัก" },
  { key: "db_press", name: "ดัมเบลไหล่", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "ไหล่", cue: "ไม่แอ่นหลัง ดันขึ้นเหนือศีรษะช้า ๆ" },
  { key: "db_curl", name: "ไบเซปเคิร์ล", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "แขนหน้า", cue: "ศอกแนบลำตัว ไม่เหวี่ยง" },
  { key: "db_tricep", name: "ไทรเซปคิกแบ็ก", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "แขนหลัง", cue: "ต้นแขนนิ่ง เหยียดปลายแขนไปหลัง" },
  { key: "db_rdl", name: "ดัมเบลเดดลิฟท์", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "ก้น หลังต้นขา", cue: "ดันสะโพกไปหลัง หลังตรงตลอด" },
  { key: "band_row", name: "ยางยืดโรว์", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง", cue: "ดึงจนศอกผ่านลำตัว บีบสะบักค้าง 1 วิ" },
  { key: "band_pull_apart", name: "ยางยืดกางอก", equipment: "home", kind: "strength", unit: "reps", impact: "low", muscles: "หลังบน ไหล่", cue: "แขนตึงระดับอก กางออกช้า ๆ" },
  { key: "farmer_walk", name: "ฟาร์เมอร์วอล์ค", equipment: "home", kind: "strength", unit: "minutes", impact: "low", muscles: "ทั้งตัว", cue: "ถือหนักสองข้าง ไหล่ตั้ง เดินช้า" },

  // ── ฟิตเนส (gym) ──
  { key: "treadmill", name: "ลู่วิ่ง", equipment: "gym", kind: "cardio", unit: "minutes", impact: "high", muscles: "ขา หัวใจ", cue: "เริ่มเดินอุ่นเครื่อง 5 นาทีก่อนเพิ่มความเร็ว" },
  { key: "stationary_bike", name: "จักรยานฟิตเนส", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", muscles: "ขา หัวใจ", cue: "ปรับอานให้เข่างอเล็กน้อยตอนปั่นสุด" },
  { key: "elliptical", name: "เครื่องเดินวงรี", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", muscles: "ทั้งตัว", cue: "ยืนตรง ไม่ทิ้งน้ำหนักบนมือจับ" },
  { key: "rowing_machine", name: "เครื่องกรรเชียงบก", equipment: "gym", kind: "cardio", unit: "minutes", impact: "low", muscles: "หลัง ขา", cue: "ดันขา → เอนลำตัว → ดึงแขน ตามลำดับ" },
  { key: "lat_pulldown", name: "ลัตพูลดาวน์", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง", cue: "ดึงลงหน้าอก อกตั้ง ไม่เหวี่ยงตัว" },
  { key: "chest_press", name: "เชสเพรส", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "อก ไหล่", cue: "ศอกไม่กางเกิน 45 องศา ดันจนเกือบสุดแขน" },
  { key: "leg_press", name: "เลกเพรส", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "ขา ก้น", cue: "ไม่ล็อกเข่าตอนดันสุด หลังแนบเบาะ" },
  { key: "leg_curl", name: "เลกเคิร์ล", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "หลังต้นขา", cue: "งอเข่าช้า ๆ ปล่อยกลับแบบควบคุม" },
  { key: "cable_row", name: "เคเบิลโรว์", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง", cue: "หลังตรง ดึงเข้าท้องน้อย บีบสะบัก" },
  { key: "barbell_bench", name: "บาร์เบลเบนช์เพรส", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "อก แขน", cue: "มีคนช่วยดูเสมอเมื่อขึ้นน้ำหนักหนัก" },
  { key: "barbell_squat", name: "บาร์เบลสควอท", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "ขา ก้น", cue: "แกนกลางเกร็ง ลงจนต้นขาขนานพื้น" },
  { key: "pullup_assist", name: "พูลอัพแบบมีตัวช่วย", equipment: "gym", kind: "strength", unit: "reps", impact: "low", muscles: "หลัง แขน", cue: "เริ่มจากแรงช่วยเยอะแล้วค่อยลด" },
];

const TIER_ORDER: Record<EquipmentTier, number> = { none: 0, home: 1, gym: 2 };

/** ท่าที่ user ทำได้จริงตามอุปกรณ์ที่มี (gym = ได้ทุกท่า) */
export function catalogFor(tier: EquipmentTier | null | undefined): CatalogExercise[] {
  const max = TIER_ORDER[tier || "none"];
  return EXERCISE_CATALOG.filter((e) => TIER_ORDER[e.equipment] <= max);
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
    [/ว่ายน้ำ|swim/, "elliptical"],
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
