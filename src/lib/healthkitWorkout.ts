/**
 * แปลงรหัส HKWorkoutActivityType (ตัวเลข) → ชื่อไทย
 *
 * ทำไมต้องมี: /api/health/sync เดิมเอา `type` ดิบมาเป็นชื่อเลย → ไทม์ไลน์ในแอปขึ้นว่า "52"
 * (52 = walking) แทนที่จะเป็น "เดิน"
 *
 * 🔴 ที่มาของตัวเลข: อ่านจาก enum จริงของไลบรารีที่แอปใช้ ไม่ได้เดา
 *    /root/projects/coach-app/node_modules/@kingstinct/react-native-healthkit/
 *      lib/commonjs/generated/healthkit.generated.js  →  `var WorkoutActivityType`
 *    (ตรงกับ Apple HKWorkoutActivityType)
 *    หมายเหตุค่าที่คนมักจำผิด: functionalStrengthTraining = 20 (ไม่ใช่ 59 — 59 = coreTraining)
 *                              yoga = 57 (ไม่ใช่ 63 — 63 = highIntensityIntervalTraining)
 */

export const HK_WORKOUT_FALLBACK = "ออกกำลังกาย (Watch)";

export const HK_WORKOUT_TH: Record<number, string> = {
  1: "อเมริกันฟุตบอล",
  2: "ยิงธนู",
  3: "ออสเตรเลียนฟุตบอล",
  4: "แบดมินตัน",
  5: "เบสบอล",
  6: "บาสเกตบอล",
  7: "โบว์ลิ่ง",
  8: "ชกมวย",
  9: "ปีนผา",
  10: "คริกเก็ต",
  11: "ครอสเทรนนิ่ง",
  12: "เคิร์ลลิง",
  13: "ปั่นจักรยาน",
  14: "เต้น",
  15: "เต้นออกกำลังกาย",
  16: "เครื่องเดินวงรี",
  17: "ขี่ม้า",
  18: "ฟันดาบ",
  19: "ตกปลา",
  20: "เวทแบบฟังก์ชัน",
  21: "กอล์ฟ",
  22: "ยิมนาสติก",
  23: "แฮนด์บอล",
  24: "เดินป่า",
  25: "ฮอกกี้",
  26: "ล่าสัตว์",
  27: "ลาครอส",
  28: "ศิลปะการต่อสู้",
  29: "กายและใจ",
  30: "คาร์ดิโอผสม",
  31: "พายเรือ/ซัพบอร์ด",
  32: "เล่นสนุก",
  33: "วอร์มอัพ/คูลดาวน์",
  34: "แร็กเกตบอล",
  35: "พายเรือ",
  36: "รักบี้",
  37: "วิ่ง",
  38: "แล่นเรือใบ",
  39: "สเกต",
  40: "กีฬาหิมะ",
  41: "ฟุตบอล",
  42: "ซอฟต์บอล",
  43: "สควอช",
  44: "เดินขึ้นบันได",
  45: "โต้คลื่น",
  46: "ว่ายน้ำ",
  47: "เทเบิลเทนนิส",
  48: "เทนนิส",
  49: "กรีฑา",
  50: "เวทเทรนนิ่ง",
  51: "วอลเลย์บอล",
  52: "เดิน",
  53: "แอโรบิกในน้ำ",
  54: "โปโลน้ำ",
  55: "กีฬาทางน้ำ",
  56: "มวยปล้ำ",
  57: "โยคะ",
  58: "บาร์",
  59: "เทรนแกนกลางลำตัว",
  60: "สกีทางไกล",
  61: "สกีลงเขา",
  62: "ยืดเหยียด",
  63: "HIIT",
  64: "กระโดดเชือก",
  65: "คิกบ็อกซิ่ง",
  66: "พิลาทิส",
  67: "สโนว์บอร์ด",
  68: "ขึ้นบันได",
  69: "สเต็ปเทรนนิ่ง",
  70: "เข็นวีลแชร์ (เดิน)",
  71: "เข็นวีลแชร์ (วิ่ง)",
  72: "ไทเก๊ก",
  73: "คาร์ดิโอ",
  74: "ปั่นด้วยมือ",
  75: "กีฬาจานร่อน",
  76: "เกมออกกำลังกาย",
  77: "คาร์ดิโอแดนซ์",
  78: "ลีลาศ",
  79: "พิกเคิลบอล",
  80: "คูลดาวน์",
  82: "ไตรกีฬา",
  83: "ช่วงเปลี่ยนกีฬา",
  84: "ดำน้ำ",
  3000: HK_WORKOUT_FALLBACK, // HKWorkoutActivityTypeOther
};

/** ชื่อ enum แบบอังกฤษ → ไทย (สร้างจาก HK_WORKOUT_TH ผ่านตารางรหัส) */
const HK_ENUM_KEYS: Record<string, number> = {
  americanfootball: 1, archery: 2, australianfootball: 3, badminton: 4, baseball: 5,
  basketball: 6, bowling: 7, boxing: 8, climbing: 9, cricket: 10, crosstraining: 11,
  curling: 12, cycling: 13, dance: 14, danceinspiredtraining: 15, elliptical: 16,
  equestriansports: 17, fencing: 18, fishing: 19, functionalstrengthtraining: 20,
  golf: 21, gymnastics: 22, handball: 23, hiking: 24, hockey: 25, hunting: 26,
  lacrosse: 27, martialarts: 28, mindandbody: 29, mixedmetaboliccardiotraining: 30,
  paddlesports: 31, play: 32, preparationandrecovery: 33, racquetball: 34, rowing: 35,
  rugby: 36, running: 37, sailing: 38, skatingsports: 39, snowsports: 40, soccer: 41,
  softball: 42, squash: 43, stairclimbing: 44, surfingsports: 45, swimming: 46,
  tabletennis: 47, tennis: 48, trackandfield: 49, traditionalstrengthtraining: 50,
  volleyball: 51, walking: 52, waterfitness: 53, waterpolo: 54, watersports: 55,
  wrestling: 56, yoga: 57, barre: 58, coretraining: 59, crosscountryskiing: 60,
  downhillskiing: 61, flexibility: 62, highintensityintervaltraining: 63, jumprope: 64,
  kickboxing: 65, pilates: 66, snowboarding: 67, stairs: 68, steptraining: 69,
  wheelchairwalkpace: 70, wheelchairrunpace: 71, taichi: 72, mixedcardio: 73,
  handcycling: 74, discsports: 75, fitnessgaming: 76, cardiodance: 77, socialdance: 78,
  pickleball: 79, cooldown: 80, swimbikerun: 82, transition: 83, underwaterdiving: 84,
  other: 3000,
};

const HK_ENUM_KEY_TH: Record<string, string> = Object.fromEntries(
  Object.entries(HK_ENUM_KEYS).map(([k, code]) => [k, HK_WORKOUT_TH[code] ?? HK_WORKOUT_FALLBACK])
);

/**
 * ชื่อที่จะเก็บลง ExerciseLog.name
 * รับได้ทั้งเลข (52), สตริงตัวเลข ("52") และชื่อที่แอปส่งมาเป็นข้อความอยู่แล้ว ("เดินเร็ว")
 * ไม่รู้จัก → "ออกกำลังกาย (Watch)" (ดีกว่าโชว์รหัสดิบให้ user งง)
 */
export function healthkitWorkoutName(type: unknown): string {
  if (type === null || type === undefined) return HK_WORKOUT_FALLBACK;

  if (typeof type === "number" && Number.isFinite(type)) {
    return HK_WORKOUT_TH[type] ?? HK_WORKOUT_FALLBACK;
  }

  const s = String(type).trim();
  if (s === "") return HK_WORKOUT_FALLBACK;
  // ตัวเลขล้วน = รหัส HK
  if (/^\d+$/.test(s)) return HK_WORKOUT_TH[Number(s)] ?? HK_WORKOUT_FALLBACK;
  // ชื่ออังกฤษของ enum (เผื่อแอปเวอร์ชันหลังส่งเป็น "walking" แทนตัวเลข)
  const byKey = HK_ENUM_KEY_TH[s.toLowerCase()];
  if (byKey) return byKey;
  // ข้อความอื่น = แอปตั้งชื่อมาเองแล้ว ใช้ตามนั้น
  return s;
}
