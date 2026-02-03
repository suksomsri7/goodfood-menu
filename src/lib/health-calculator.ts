/**
 * Health Calculator Utilities
 * คำนวณ BMR, TDEE, Macros และข้อมูลสุขภาพต่างๆ
 */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "gain" | "maintain";
export type DietType = "balanced" | "high_protein" | "low_fat" | "custom";

// Activity Level Factors
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // นั่งทำงาน ไม่ค่อยออกกำลังกาย
  light: 1.375, // ออกกำลังกายเบา 1-3 วัน/สัปดาห์
  moderate: 1.55, // ออกกำลังกายปานกลาง 3-5 วัน/สัปดาห์
  active: 1.725, // ออกกำลังกายหนัก 6-7 วัน/สัปดาห์
  very_active: 1.9, // ออกกำลังกายหนักมาก หรือทำงานใช้แรง
};

// Macro Ratios by Diet Type (Carbs, Protein, Fat)
const MACRO_RATIOS: Record<DietType, { carbs: number; protein: number; fat: number }> = {
  balanced: { carbs: 0.5, protein: 0.25, fat: 0.25 },
  high_protein: { carbs: 0.3, protein: 0.4, fat: 0.3 },
  low_fat: { carbs: 0.5, protein: 0.3, fat: 0.2 },
  custom: { carbs: 0.4, protein: 0.3, fat: 0.3 }, // default for custom
};

// Calories per gram
const CALORIES_PER_GRAM = {
  carbs: 4,
  protein: 4,
  fat: 9,
};

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Calculate BMI (Body Mass Index)
 */
export function calculateBMI(weight: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
}

/**
 * Get BMI Category
 */
export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "น้ำหนักต่ำกว่าเกณฑ์";
  if (bmi < 23) return "น้ำหนักปกติ";
  if (bmi < 25) return "น้ำหนักเกิน";
  if (bmi < 30) return "อ้วนระดับ 1";
  return "อ้วนระดับ 2";
}

/**
 * Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
 * This is the calories your body burns at rest
 */
export function calculateBMR(
  weight: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  // Mifflin-St Jeor Equation
  const base = 10 * weight + 6.25 * heightCm - 5 * age;
  
  if (gender === "male") {
    return Math.round(base + 5);
  } else {
    return Math.round(base - 161);
  }
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 * This is the total calories you burn per day including activity
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

/**
 * Calculate daily calorie target based on goal
 * Safe weight change: 0.5-1 kg per week = 500-1000 calorie deficit/surplus per day
 */
export function calculateDailyCalories(
  tdee: number,
  goalType: GoalType,
  aggressive: boolean = false
): number {
  const adjustment = aggressive ? 750 : 500;
  
  switch (goalType) {
    case "lose":
      return Math.max(1200, tdee - adjustment); // Minimum 1200 for health
    case "gain":
      return tdee + adjustment;
    case "maintain":
    default:
      return tdee;
  }
}

/**
 * Calculate macros in grams based on daily calories and diet type
 */
export function calculateMacros(
  dailyCalories: number,
  dietType: DietType,
  customRatios?: { carbs: number; protein: number; fat: number }
): { carbs: number; protein: number; fat: number } {
  const ratios = dietType === "custom" && customRatios 
    ? customRatios 
    : MACRO_RATIOS[dietType];
  
  return {
    carbs: Math.round((dailyCalories * ratios.carbs) / CALORIES_PER_GRAM.carbs),
    protein: Math.round((dailyCalories * ratios.protein) / CALORIES_PER_GRAM.protein),
    fat: Math.round((dailyCalories * ratios.fat) / CALORIES_PER_GRAM.fat),
  };
}

/**
 * Calculate recommended timeline to reach weight goal
 * Safe rate: 0.5 kg per week for lose, 0.25-0.5 kg per week for gain
 */
export function calculateRecommendedMonths(
  currentWeight: number,
  goalWeight: number,
  goalType: GoalType
): { minMonths: number; maxMonths: number; recommendedMonths: number } {
  const weightDiff = Math.abs(currentWeight - goalWeight);
  
  // Rate per week
  const fastRate = goalType === "gain" ? 0.25 : 1.0; // kg per week
  const slowRate = goalType === "gain" ? 0.5 : 0.5;
  
  const minWeeks = Math.ceil(weightDiff / fastRate);
  const maxWeeks = Math.ceil(weightDiff / slowRate);
  
  const minMonths = Math.ceil(minWeeks / 4);
  const maxMonths = Math.ceil(maxWeeks / 4);
  const recommendedMonths = Math.ceil((minMonths + maxMonths) / 2);
  
  return {
    minMonths: Math.max(1, minMonths),
    maxMonths: Math.max(1, maxMonths),
    recommendedMonths: Math.max(1, recommendedMonths),
  };
}

/**
 * Recommend best diet type based on goal
 */
export function recommendDietType(goalType: GoalType): DietType {
  switch (goalType) {
    case "lose":
      return "low_fat";
    case "gain":
      return "high_protein";
    case "maintain":
    default:
      return "balanced";
  }
}

/**
 * Calculate daily water intake recommendation (ml)
 * General rule: 30-35 ml per kg of body weight
 */
export function calculateDailyWater(weight: number, activityLevel: ActivityLevel): number {
  const baseWater = weight * 30;
  const activityBonus = ACTIVITY_FACTORS[activityLevel] > 1.5 ? 500 : 0;
  return Math.round((baseWater + activityBonus) / 100) * 100; // Round to nearest 100
}

/**
 * Calculate all health metrics at once
 */
export interface HealthProfile {
  age: number;
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  dailyCalories: number;
  macros: { carbs: number; protein: number; fat: number };
  dailyWater: number;
  recommendedDiet: DietType;
  timeline: { minMonths: number; maxMonths: number; recommendedMonths: number };
}

export function calculateHealthProfile(
  birthDate: Date,
  gender: Gender,
  heightCm: number,
  currentWeight: number,
  goalWeight: number,
  goalType: GoalType,
  activityLevel: ActivityLevel,
  dietType?: DietType
): HealthProfile {
  const age = calculateAge(birthDate);
  const bmi = calculateBMI(currentWeight, heightCm);
  const bmiCategory = getBMICategory(bmi);
  const bmr = calculateBMR(currentWeight, heightCm, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  const dailyCalories = calculateDailyCalories(tdee, goalType);
  const recommendedDiet = dietType || recommendDietType(goalType);
  const macros = calculateMacros(dailyCalories, recommendedDiet);
  const dailyWater = calculateDailyWater(currentWeight, activityLevel);
  const timeline = calculateRecommendedMonths(currentWeight, goalWeight, goalType);
  
  return {
    age,
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory,
    bmr,
    tdee,
    dailyCalories,
    macros,
    dailyWater,
    recommendedDiet,
    timeline,
  };
}

/**
 * Activity level labels in Thai
 */
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "นั่งทำงาน / ไม่ค่อยออกกำลังกาย",
  light: "ออกกำลังกายเบาๆ 1-3 วัน/สัปดาห์",
  moderate: "ออกกำลังกายปานกลาง 3-5 วัน/สัปดาห์",
  active: "ออกกำลังกายหนัก 6-7 วัน/สัปดาห์",
  very_active: "ออกกำลังกายหนักมาก / ใช้แรงงาน",
};

/**
 * Goal type labels in Thai
 */
export const GOAL_LABELS: Record<GoalType, string> = {
  lose: "ลดน้ำหนัก",
  gain: "เพิ่มน้ำหนัก",
  maintain: "ดูแลสุขภาพ",
};

/**
 * Diet type labels in Thai
 */
export const DIET_LABELS: Record<DietType, { name: string; description: string }> = {
  balanced: {
    name: "Balanced",
    description: "สมดุล เหมาะกับการดูแลสุขภาพทั่วไป",
  },
  high_protein: {
    name: "High Protein",
    description: "โปรตีนสูง เหมาะกับการสร้างกล้ามเนื้อ",
  },
  low_fat: {
    name: "Low Fat",
    description: "ไขมันต่ำ เหมาะกับการลดน้ำหนัก",
  },
  custom: {
    name: "Custom",
    description: "กำหนดสัดส่วนเอง",
  },
};
