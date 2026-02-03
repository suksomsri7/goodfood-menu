"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Ruler,
  Scale,
  Target,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
} from "lucide-react";
import {
  calculateHealthProfile,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  DIET_LABELS,
  type Gender,
  type ActivityLevel,
  type GoalType,
  type DietType,
  type HealthProfile,
} from "@/lib/health-calculator";

interface OnboardingModalProps {
  isOpen: boolean;
  lineUserId: string;
  displayName?: string;
  onComplete: () => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  gender: Gender | "";
  birthDate: string;
  height: string;
  weight: string;
  activityLevel: ActivityLevel | "";
  goalType: GoalType | "";
  goalWeight: string;
  dietType: DietType;
  customMacros: { carbs: number; protein: number; fat: number };
  targetMonths: number;
}

const TOTAL_STEPS = 8;

export function OnboardingModal({
  isOpen,
  lineUserId,
  displayName,
  onComplete,
}: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: displayName || "",
    email: "",
    phone: "",
    gender: "",
    birthDate: "",
    height: "",
    weight: "",
    activityLevel: "",
    goalType: "",
    goalWeight: "",
    dietType: "balanced",
    customMacros: { carbs: 50, protein: 25, fat: 25 },
    targetMonths: 3,
  });

  // Calculate health profile when we have enough data
  useEffect(() => {
    if (
      formData.birthDate &&
      formData.gender &&
      formData.height &&
      formData.weight &&
      formData.goalWeight &&
      formData.goalType &&
      formData.activityLevel
    ) {
      const profile = calculateHealthProfile(
        new Date(formData.birthDate),
        formData.gender as Gender,
        parseFloat(formData.height),
        parseFloat(formData.weight),
        parseFloat(formData.goalWeight),
        formData.goalType as GoalType,
        formData.activityLevel as ActivityLevel,
        formData.dietType
      );
      setHealthProfile(profile);
      setFormData((prev) => ({
        ...prev,
        targetMonths: profile.timeline.recommendedMonths,
      }));
    }
  }, [
    formData.birthDate,
    formData.gender,
    formData.height,
    formData.weight,
    formData.goalWeight,
    formData.goalType,
    formData.activityLevel,
    formData.dietType,
  ]);

  const updateFormData = (key: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!formData.name;
      case 2:
        return !!formData.gender && !!formData.birthDate;
      case 3:
        return !!formData.height && !!formData.weight;
      case 4:
        return !!formData.activityLevel;
      case 5:
        return !!formData.goalType;
      case 6:
        return !!formData.goalWeight;
      case 7:
        return !!formData.dietType;
      case 8:
        return formData.targetMonths > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!healthProfile) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          gender: formData.gender,
          birthDate: formData.birthDate,
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          goalWeight: parseFloat(formData.goalWeight),
          goalType: formData.goalType,
          activityLevel: formData.activityLevel,
          dietType: formData.dietType,
          targetMonths: formData.targetMonths,
          bmr: healthProfile.bmr,
          tdee: healthProfile.tdee,
          dailyCalories: healthProfile.dailyCalories,
          dailyProtein: healthProfile.macros.protein,
          dailyCarbs: healthProfile.macros.carbs,
          dailyFat: healthProfile.macros.fat,
          dailyWater: healthProfile.dailyWater,
        }),
      });

      if (response.ok) {
        onComplete();
      } else {
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div className="flex-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          <span className="text-sm text-gray-500 min-w-[40px] text-right">
            {step}/{TOTAL_STEPS}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 pb-32 overflow-y-auto h-[calc(100vh-140px)]">
        <AnimatePresence mode="wait">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <StepContainer key="step1">
              <StepTitle
                icon={<User className="w-8 h-8" />}
                title="ข้อมูลส่วนตัว"
                subtitle="กรอกข้อมูลเพื่อเริ่มต้นใช้งาน"
              />
              <div className="space-y-4">
                <InputField
                  label="ชื่อ"
                  placeholder="ชื่อของคุณ"
                  value={formData.name}
                  onChange={(v) => updateFormData("name", v)}
                  icon={<User className="w-5 h-5" />}
                  required
                />
                <InputField
                  label="อีเมล"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(v) => updateFormData("email", v)}
                  icon={<Mail className="w-5 h-5" />}
                />
                <InputField
                  label="เบอร์โทร"
                  type="tel"
                  placeholder="0812345678"
                  value={formData.phone}
                  onChange={(v) => updateFormData("phone", v)}
                  icon={<Phone className="w-5 h-5" />}
                />
              </div>
            </StepContainer>
          )}

          {/* Step 2: Gender & Birthday */}
          {step === 2 && (
            <StepContainer key="step2">
              <StepTitle
                icon={<Calendar className="w-8 h-8" />}
                title="เพศและวันเกิด"
                subtitle="ใช้สำหรับคำนวณอัตราการเผาผลาญ"
              />
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    เพศ <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectButton
                      selected={formData.gender === "male"}
                      onClick={() => updateFormData("gender", "male")}
                      emoji="👨"
                      label="ชาย"
                    />
                    <SelectButton
                      selected={formData.gender === "female"}
                      onClick={() => updateFormData("gender", "female")}
                      emoji="👩"
                      label="หญิง"
                    />
                  </div>
                </div>
                <InputField
                  label="วันเกิด"
                  type="date"
                  value={formData.birthDate}
                  onChange={(v) => updateFormData("birthDate", v)}
                  icon={<Calendar className="w-5 h-5" />}
                  required
                />
              </div>
            </StepContainer>
          )}

          {/* Step 3: Height & Weight */}
          {step === 3 && (
            <StepContainer key="step3">
              <StepTitle
                icon={<Ruler className="w-8 h-8" />}
                title="ส่วนสูงและน้ำหนัก"
                subtitle="ใช้คำนวณ BMI และแคลอรี่ที่ต้องการ"
              />
              <div className="space-y-4">
                <InputField
                  label="ส่วนสูง"
                  type="number"
                  placeholder="170"
                  value={formData.height}
                  onChange={(v) => updateFormData("height", v)}
                  icon={<Ruler className="w-5 h-5" />}
                  suffix="ซม."
                  required
                />
                <InputField
                  label="น้ำหนักปัจจุบัน"
                  type="number"
                  placeholder="70"
                  value={formData.weight}
                  onChange={(v) => updateFormData("weight", v)}
                  icon={<Scale className="w-5 h-5" />}
                  suffix="กก."
                  required
                />
              </div>
            </StepContainer>
          )}

          {/* Step 4: Activity Level */}
          {step === 4 && (
            <StepContainer key="step4">
              <StepTitle
                icon={<Dumbbell className="w-8 h-8" />}
                title="ระดับกิจกรรม"
                subtitle="บอกเราว่าคุณออกกำลังกายแค่ไหน"
              />
              <div className="space-y-3">
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                  <SelectButton
                    key={level}
                    selected={formData.activityLevel === level}
                    onClick={() => updateFormData("activityLevel", level)}
                    label={ACTIVITY_LABELS[level]}
                    fullWidth
                  />
                ))}
              </div>
            </StepContainer>
          )}

          {/* Step 5: Goal Type */}
          {step === 5 && (
            <StepContainer key="step5">
              <StepTitle
                icon={<Target className="w-8 h-8" />}
                title="เป้าหมายของคุณ"
                subtitle="คุณต้องการอะไรจากโปรแกรมนี้?"
              />
              <div className="space-y-3">
                <SelectButton
                  selected={formData.goalType === "lose"}
                  onClick={() => updateFormData("goalType", "lose")}
                  emoji="📉"
                  label="ลดน้ำหนัก"
                  description="ลดไขมัน เผาผลาญแคลอรี่"
                  fullWidth
                />
                <SelectButton
                  selected={formData.goalType === "gain"}
                  onClick={() => updateFormData("goalType", "gain")}
                  emoji="📈"
                  label="เพิ่มน้ำหนัก"
                  description="เพิ่มกล้ามเนื้อ สร้างมวล"
                  fullWidth
                />
                <SelectButton
                  selected={formData.goalType === "maintain"}
                  onClick={() => updateFormData("goalType", "maintain")}
                  emoji="⚖️"
                  label="ดูแลสุขภาพ"
                  description="รักษาน้ำหนัก กินอย่างสมดุล"
                  fullWidth
                />
              </div>
            </StepContainer>
          )}

          {/* Step 6: Goal Weight */}
          {step === 6 && (
            <StepContainer key="step6">
              <StepTitle
                icon={<Scale className="w-8 h-8" />}
                title="น้ำหนักเป้าหมาย"
                subtitle={`น้ำหนักปัจจุบัน: ${formData.weight} กก.`}
              />
              <div className="space-y-6">
                <InputField
                  label="น้ำหนักที่ต้องการ"
                  type="number"
                  placeholder={formData.goalType === "lose" ? "65" : "75"}
                  value={formData.goalWeight}
                  onChange={(v) => updateFormData("goalWeight", v)}
                  icon={<Target className="w-5 h-5" />}
                  suffix="กก."
                  required
                />
                {formData.weight && formData.goalWeight && (
                  <div className="p-4 bg-primary-50 rounded-xl">
                    <p className="text-sm text-primary-700">
                      {parseFloat(formData.goalWeight) < parseFloat(formData.weight)
                        ? `ต้องลด ${(parseFloat(formData.weight) - parseFloat(formData.goalWeight)).toFixed(1)} กก.`
                        : parseFloat(formData.goalWeight) > parseFloat(formData.weight)
                        ? `ต้องเพิ่ม ${(parseFloat(formData.goalWeight) - parseFloat(formData.weight)).toFixed(1)} กก.`
                        : "รักษาน้ำหนักเดิม"}
                    </p>
                  </div>
                )}
              </div>
            </StepContainer>
          )}

          {/* Step 7: Diet Preference */}
          {step === 7 && (
            <StepContainer key="step7">
              <StepTitle
                icon={<Sparkles className="w-8 h-8" />}
                title="Almost there!"
                subtitle="เลือกรูปแบบการกินที่เหมาะกับคุณ"
              />
              <div className="space-y-4">
                {healthProfile && (
                  <div className="p-4 bg-gradient-to-r from-primary-50 to-green-50 rounded-xl mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium text-primary-700">
                        แนะนำสำหรับคุณ
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      จากเป้าหมาย{GOAL_LABELS[formData.goalType as GoalType]} เราแนะนำ{" "}
                      <strong>{DIET_LABELS[healthProfile.recommendedDiet].name}</strong>
                    </p>
                  </div>
                )}

                {(["balanced", "high_protein", "low_fat"] as DietType[]).map((diet) => (
                  <SelectButton
                    key={diet}
                    selected={formData.dietType === diet}
                    onClick={() => updateFormData("dietType", diet)}
                    label={DIET_LABELS[diet].name}
                    description={DIET_LABELS[diet].description}
                    fullWidth
                    highlighted={healthProfile?.recommendedDiet === diet}
                  />
                ))}

                {/* Macro Preview */}
                {healthProfile && (
                  <div className="mt-6">
                    <p className="text-sm text-gray-600 mb-3">
                      หรือปรับสัดส่วนเอง
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <MacroBox
                        emoji="🍞"
                        label="Carbs"
                        value={healthProfile.macros.carbs}
                        unit="g"
                        color="green"
                      />
                      <MacroBox
                        emoji="🥩"
                        label="Protein"
                        value={healthProfile.macros.protein}
                        unit="g"
                        color="blue"
                      />
                      <MacroBox
                        emoji="🧀"
                        label="Fat"
                        value={healthProfile.macros.fat}
                        unit="g"
                        color="yellow"
                      />
                    </div>
                    {/* Macro Bar */}
                    <div className="flex h-3 rounded-full overflow-hidden mt-3">
                      <div
                        className="bg-green-500"
                        style={{ width: `${(healthProfile.macros.carbs * 4) / healthProfile.dailyCalories * 100}%` }}
                      />
                      <div
                        className="bg-blue-500"
                        style={{ width: `${(healthProfile.macros.protein * 4) / healthProfile.dailyCalories * 100}%` }}
                      />
                      <div
                        className="bg-yellow-500"
                        style={{ width: `${(healthProfile.macros.fat * 9) / healthProfile.dailyCalories * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </StepContainer>
          )}

          {/* Step 8: Timeline & Summary */}
          {step === 8 && healthProfile && (
            <StepContainer key="step8">
              <StepTitle
                icon={<Check className="w-8 h-8" />}
                title="สรุปแผนของคุณ"
                subtitle="ตรวจสอบและยืนยันเป้าหมาย"
              />
              <div className="space-y-6">
                {/* Timeline */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    ระยะเวลาที่ต้องการ
                  </label>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      แนะนำ: {healthProfile.timeline.recommendedMonths} เดือน
                    </span>
                    <span className="text-lg font-bold text-primary-600">
                      {formData.targetMonths} เดือน
                    </span>
                  </div>
                  <input
                    type="range"
                    min={healthProfile.timeline.minMonths}
                    max={Math.max(healthProfile.timeline.maxMonths, 12)}
                    value={formData.targetMonths}
                    onChange={(e) =>
                      updateFormData("targetMonths", parseInt(e.target.value))
                    }
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>เร็ว ({healthProfile.timeline.minMonths} เดือน)</span>
                    <span>ค่อยๆ ทำ</span>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-primary-500 to-green-500 rounded-2xl p-5 text-white">
                  <h3 className="font-semibold text-lg mb-4">
                    🎯 เป้าหมายของ {formData.name}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <SummaryRow
                      label="BMI"
                      value={`${healthProfile.bmi} (${healthProfile.bmiCategory})`}
                    />
                    <SummaryRow
                      label="น้ำหนัก"
                      value={`${formData.weight} → ${formData.goalWeight} กก.`}
                    />
                    <SummaryRow
                      label="แคลอรี่/วัน"
                      value={`${healthProfile.dailyCalories} kcal`}
                    />
                    <SummaryRow
                      label="โปรตีน"
                      value={`${healthProfile.macros.protein}g`}
                    />
                    <SummaryRow
                      label="คาร์บ"
                      value={`${healthProfile.macros.carbs}g`}
                    />
                    <SummaryRow
                      label="ไขมัน"
                      value={`${healthProfile.macros.fat}g`}
                    />
                    <SummaryRow
                      label="น้ำ/วัน"
                      value={`${healthProfile.dailyWater} ml`}
                    />
                  </div>
                </div>
              </div>
            </StepContainer>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white border-t border-gray-100">
        <button
          onClick={step === TOTAL_STEPS ? handleSubmit : handleNext}
          disabled={!canProceed() || isSubmitting}
          className="w-full py-4 bg-primary-500 text-white rounded-2xl font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              กำลังบันทึก...
            </>
          ) : step === TOTAL_STEPS ? (
            <>
              <Check className="w-5 h-5" />
              เริ่มต้นใช้งาน
            </>
          ) : (
            <>
              ถัดไป
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Sub-components
function StepContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

function StepTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center mb-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-500">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500">{subtitle}</p>
    </div>
  );
}

function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  icon,
  suffix,
  required,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            icon ? "pl-12" : "pl-4"
          } ${suffix ? "pr-16" : "pr-4"}`}
        />
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectButton({
  selected,
  onClick,
  emoji,
  label,
  description,
  fullWidth,
  highlighted,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
  description?: string;
  fullWidth?: boolean;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${fullWidth ? "w-full" : ""} p-4 rounded-xl border-2 transition-all text-left ${
        selected
          ? "border-primary-500 bg-primary-50"
          : highlighted
          ? "border-primary-200 bg-primary-50/50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-3">
        {emoji && <span className="text-2xl">{emoji}</span>}
        <div className="flex-1">
          <p
            className={`font-medium ${
              selected ? "text-primary-700" : "text-gray-900"
            }`}
          >
            {label}
          </p>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {selected && (
          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
        {highlighted && !selected && (
          <span className="text-xs bg-primary-100 text-primary-600 px-2 py-1 rounded-full">
            แนะนำ
          </span>
        )}
      </div>
    </button>
  );
}

function MacroBox({
  emoji,
  label,
  value,
  unit,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  unit: string;
  color: "green" | "blue" | "yellow";
}) {
  const bgColors = {
    green: "bg-green-50",
    blue: "bg-blue-50",
    yellow: "bg-yellow-50",
  };
  const textColors = {
    green: "text-green-700",
    blue: "text-blue-700",
    yellow: "text-yellow-700",
  };

  return (
    <div className={`${bgColors[color]} rounded-xl p-3 text-center`}>
      <span className="text-2xl">{emoji}</span>
      <p className={`font-semibold ${textColors[color]} mt-1`}>{label}</p>
      <p className="text-lg font-bold text-gray-900">
        {value} {unit}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-80">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
