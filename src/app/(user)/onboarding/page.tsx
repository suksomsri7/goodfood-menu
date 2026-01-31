"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, User, Sparkles } from "lucide-react";

type Step = "welcome" | "gender" | "birthdate" | "body" | "activity" | "goal" | "result";

const steps: Step[] = ["welcome", "gender", "birthdate", "body", "activity", "goal", "result"];

const activityLevels = [
  { value: "SEDENTARY", label: "นั่งทำงานตลอด", description: "ไม่ค่อยออกกำลังกาย", emoji: "🪑" },
  { value: "LIGHT", label: "ออกกำลังกายเบาๆ", description: "1-3 วัน/สัปดาห์", emoji: "🚶" },
  { value: "MODERATE", label: "ออกกำลังกายปานกลาง", description: "3-5 วัน/สัปดาห์", emoji: "🏃" },
  { value: "ACTIVE", label: "ออกกำลังกายหนัก", description: "6-7 วัน/สัปดาห์", emoji: "💪" },
  { value: "VERY_ACTIVE", label: "นักกีฬา/ใช้แรงงานหนัก", description: "ทุกวัน", emoji: "🏋️" },
];

const goals = [
  { value: "LOSE_WEIGHT", label: "ลดน้ำหนัก", emoji: "🔥", color: "bg-orange-100 border-orange-300" },
  { value: "MAINTAIN", label: "รักษาน้ำหนัก", emoji: "⚖️", color: "bg-blue-100 border-blue-300" },
  { value: "GAIN_WEIGHT", label: "เพิ่มน้ำหนัก", emoji: "💪", color: "bg-green-100 border-green-300" },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [formData, setFormData] = useState({
    gender: "" as "MALE" | "FEMALE" | "",
    birthDate: "",
    height: "",
    weight: "",
    activityLevel: "",
    goal: "",
    targetWeight: "",
  });

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  // Calculate BMR, TDEE, Target Calories (simplified)
  const calculateResults = () => {
    const weight = parseFloat(formData.weight) || 70;
    const height = parseFloat(formData.height) || 170;
    const age = 25; // Simplified
    
    // Mifflin-St Jeor Equation
    let bmr = formData.gender === "FEMALE"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;
    
    const activityMultipliers: Record<string, number> = {
      SEDENTARY: 1.2,
      LIGHT: 1.375,
      MODERATE: 1.55,
      ACTIVE: 1.725,
      VERY_ACTIVE: 1.9,
    };
    
    const tdee = bmr * (activityMultipliers[formData.activityLevel] || 1.55);
    
    let targetCalories = tdee;
    if (formData.goal === "LOSE_WEIGHT") targetCalories -= 500;
    if (formData.goal === "GAIN_WEIGHT") targetCalories += 300;
    
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories: Math.max(1200, Math.round(targetCalories)),
    };
  };

  const results = calculateResults();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-green-50 p-6">
      {/* Progress Bar */}
      {currentStep !== "welcome" && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevStep} className="p-2 hover:bg-white rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm text-gray-500">
              {currentStepIndex} / {steps.length - 2}
            </span>
            <div className="w-10" />
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps Content */}
      <div className="max-w-md mx-auto">
        {/* Welcome */}
        {currentStep === "welcome" && (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-12 h-12 text-primary-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              ยินดีต้อนรับสู่<br />GoodFood Menu
            </h1>
            <p className="text-gray-500 mb-8">
              เริ่มต้นเส้นทางสุขภาพของคุณ<br />
              กรอกข้อมูลเพื่อคำนวณแคลอรี่ที่เหมาะสม
            </p>
            <button
              onClick={nextStep}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              เริ่มต้นใช้งาน
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Gender */}
        {currentStep === "gender" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">คุณเป็นเพศอะไร?</h2>
            <p className="text-gray-500 mb-8">ใช้สำหรับคำนวณ BMR ที่แม่นยำ</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { value: "MALE", icon: "👨", label: "ชาย" },
                { value: "FEMALE", icon: "👩", label: "หญิง" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, gender: option.value as "MALE" | "FEMALE" })}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all",
                    formData.gender === option.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="text-5xl block mb-3">{option.icon}</span>
                  <span className="font-semibold text-gray-800">{option.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={nextStep}
              disabled={!formData.gender}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* Birth Date */}
        {currentStep === "birthdate" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">วันเกิดของคุณ</h2>
            <p className="text-gray-500 mb-8">ใช้คำนวณอายุสำหรับ BMR</p>

            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-primary-500 mb-8"
            />

            <button
              onClick={nextStep}
              disabled={!formData.birthDate}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* Body */}
        {currentStep === "body" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">ข้อมูลร่างกาย</h2>
            <p className="text-gray-500 mb-8">ส่วนสูงและน้ำหนักปัจจุบัน</p>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ส่วนสูง (ซม.)
                </label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  placeholder="170"
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  น้ำหนัก (กก.)
                </label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="70"
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <button
              onClick={nextStep}
              disabled={!formData.height || !formData.weight}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* Activity */}
        {currentStep === "activity" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">กิจกรรมประจำวัน</h2>
            <p className="text-gray-500 mb-6">เลือกระดับที่ใกล้เคียงที่สุด</p>

            <div className="space-y-3 mb-8">
              {activityLevels.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setFormData({ ...formData, activityLevel: level.value })}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all text-left",
                    formData.activityLevel === level.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="text-3xl">{level.emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{level.label}</p>
                    <p className="text-sm text-gray-500">{level.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={nextStep}
              disabled={!formData.activityLevel}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* Goal */}
        {currentStep === "goal" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">เป้าหมายของคุณ</h2>
            <p className="text-gray-500 mb-6">คุณต้องการทำอะไร?</p>

            <div className="space-y-3 mb-6">
              {goals.map((goal) => (
                <button
                  key={goal.value}
                  onClick={() => setFormData({ ...formData, goal: goal.value })}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all text-left",
                    formData.goal === goal.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="text-3xl">{goal.emoji}</span>
                  <span className="font-semibold text-gray-800">{goal.label}</span>
                </button>
              ))}
            </div>

            {formData.goal && (
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  น้ำหนักเป้าหมาย (กก.)
                </label>
                <input
                  type="number"
                  value={formData.targetWeight}
                  onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                  placeholder="65"
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-primary-500"
                />
              </div>
            )}

            <button
              onClick={nextStep}
              disabled={!formData.goal}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
            >
              ดูผลลัพธ์
            </button>
          </div>
        )}

        {/* Result */}
        {currentStep === "result" && (
          <div className="animate-fade-in text-center">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">พร้อมแล้ว!</h2>
            <p className="text-gray-500 mb-8">นี่คือแคลอรี่ที่เหมาะสมสำหรับคุณ</p>

            <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">BMR</span>
                  <span className="font-bold text-gray-800">{results.bmr.toLocaleString()} kcal</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">TDEE</span>
                  <span className="font-bold text-gray-800">{results.tdee.toLocaleString()} kcal</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-primary-600 font-semibold">แคลอรี่เป้าหมาย/วัน</span>
                  <span className="font-bold text-primary-600 text-2xl">
                    {results.targetCalories.toLocaleString()} kcal
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-8">
              {formData.goal === "LOSE_WEIGHT" && "ลด 500 kcal จาก TDEE เพื่อลดน้ำหนัก 0.5 kg/สัปดาห์"}
              {formData.goal === "GAIN_WEIGHT" && "เพิ่ม 300 kcal จาก TDEE เพื่อเพิ่มน้ำหนัก"}
              {formData.goal === "MAINTAIN" && "รักษาระดับแคลอรี่ตาม TDEE"}
            </p>

            <button
              onClick={() => window.location.href = "/"}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors"
            >
              เข้าสู่หน้าหลัก
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
