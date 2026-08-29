/**
 * ข้อสอบ: ชื่อกิจกรรมออกกำลังกายที่ซิงก์มาจากนาฬิกา/มือถือ (src/lib/healthkitWorkout.ts)
 *
 * ทำไมต้องมี: ฟังก์ชันนี้รับ input 3 ชุดที่ **หน้าตาคล้ายกันแต่คนละความหมาย**
 *   1. ตัวเลข = รหัส HKWorkoutActivityType (iOS)
 *   2. ชื่ออังกฤษแบบ camelCase = enum key ของ HealthKit
 *   3. ชื่ออังกฤษแบบ snake_case = enum key ของ Health Connect (Android)
 * เคยพังจริง: แอป Android ส่งเลขดิบ "56" (HC = วิ่ง) → ถูกตีความเป็นรหัส HealthKit → ชื่อผิด
 * ผิดแล้ว user เห็นชื่อกิจกรรมมั่ว ๆ ในไทม์ไลน์ แต่ระบบไม่ error ให้รู้
 */
import { healthkitWorkoutName, HK_WORKOUT_FALLBACK } from "../src/lib/healthkitWorkout";

let pass = 0;
const fails: string[] = [];

function eq(label: string, got: string, want: string) {
  if (got === want) { pass++; console.log(`✓ ${label} → ${got}`); }
  else { fails.push(label); console.log(`✗ ${label}\n   คาดว่า "${want}"  ได้ "${got}"`); }
}
function isThai(label: string, input: unknown) {
  const got = healthkitWorkoutName(input);
  const ok = /[฀-๿]/.test(got);
  if (ok) { pass++; console.log(`✓ ${label} → ${got}`); }
  else { fails.push(label); console.log(`✗ ${label} → "${got}" (ยังเป็นอังกฤษ/รหัสดิบ)`); }
}

console.log("── Health Connect (Android) · snake_case ──");
/* 🔴 ชุดนี้คือของที่แอป Android ส่งขึ้นมาจริงหลังแก้ 29 ส.ค. 69
   ก่อนหน้านี้ส่งเป็นเลขดิบแล้วชนกับรหัส HealthKit */
eq("running", healthkitWorkoutName("running"), "วิ่ง");
eq("walking", healthkitWorkoutName("walking"), "เดิน");
eq("strength_training", healthkitWorkoutName("strength_training"), "เวทเทรนนิ่ง");
eq("high_intensity_interval_training", healthkitWorkoutName("high_intensity_interval_training"), "HIIT");
eq("swimming_pool", healthkitWorkoutName("swimming_pool"), "ว่ายน้ำ (สระ)");
eq("stretching", healthkitWorkoutName("stretching"), "ยืดเหยียด");
eq("biking", healthkitWorkoutName("biking"), "ปั่นจักรยาน");
eq("yoga", healthkitWorkoutName("yoga"), "โยคะ");
eq("ตัวใหญ่ก็ต้องได้ (RUNNING)", healthkitWorkoutName("RUNNING"), "วิ่ง");
eq("other_workout → ค่าสำรอง", healthkitWorkoutName("other_workout"), HK_WORKOUT_FALLBACK);
eq("workout → ค่าสำรอง", healthkitWorkoutName("workout"), HK_WORKOUT_FALLBACK);

console.log("\n── HealthKit (iOS) ยังต้องทำงานเหมือนเดิม ──");
isThai("รหัสตัวเลข 52", 52);
isThai("รหัสเป็นสตริง \"52\"", "52");
isThai("enum key camelCase (walking)", "walking");
eq("null → ค่าสำรอง", healthkitWorkoutName(null), HK_WORKOUT_FALLBACK);
eq("undefined → ค่าสำรอง", healthkitWorkoutName(undefined), HK_WORKOUT_FALLBACK);
eq("สตริงว่าง → ค่าสำรอง", healthkitWorkoutName("  "), HK_WORKOUT_FALLBACK);

console.log("\n── ชื่อที่ user/แอปตั้งเองต้องไม่ถูกแปลทิ้ง ──");
eq("ชื่อไทยที่ส่งมาเอง", healthkitWorkoutName("วันขา + แกนกลาง"), "วันขา + แกนกลาง");
eq("ชื่ออังกฤษที่ไม่รู้จัก", healthkitWorkoutName("Muay Thai Session"), "Muay Thai Session");

console.log(`\n${fails.length === 0 ? "✅" : "❌"} ผ่าน ${pass}/${pass + fails.length} เคส`);
if (fails.length) {
  console.log("ตก:", fails.join(" · "));
  process.exit(1);
}
