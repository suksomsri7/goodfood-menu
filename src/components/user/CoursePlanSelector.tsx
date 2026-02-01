"use client";

type CoursePlan = "7_DAYS" | "15_DAYS" | "30_DAYS" | "CUSTOM";

interface Props {
  coursePlan: CoursePlan;
  customDays: number;
  onPlanChange: (plan: CoursePlan) => void;
  onCustomDaysChange: (days: number) => void;
}

const plans = [
  { id: "7_DAYS", name: "7 วัน", days: 7, price: 2100, discount: 0, icon: "🌱", description: "เริ่มต้น" },
  { id: "15_DAYS", name: "15 วัน", days: 15, price: 4200, discount: 5, icon: "🌿", description: "ยอดนิยม" },
  { id: "30_DAYS", name: "30 วัน", days: 30, price: 7800, discount: 13, icon: "🌳", description: "คุ้มที่สุด" },
  { id: "CUSTOM", name: "เลือกเอง", days: 0, price: 0, discount: 0, icon: "✨", description: "อิสระ" },
];

export function CoursePlanSelector({ coursePlan, customDays, onPlanChange, onCustomDaysChange }: Props) {
  return (
    <div className="px-6 py-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">เลือกแพ็คเกจ</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onPlanChange(plan.id as CoursePlan)}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-300 ${
              coursePlan === plan.id
                ? "border-primary-500 bg-primary-50 shadow-lg shadow-primary-100 scale-[1.02]"
                : "border-gray-100 bg-white hover:border-primary-200 hover:shadow-md"
            }`}
          >
            {plan.discount > 0 && (
              <span className="absolute -top-2 -right-2 bg-gradient-to-r from-accent-red to-accent-orange text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
                -{plan.discount}%
              </span>
            )}
            {plan.id === "15_DAYS" && (
              <span className="absolute -top-2 left-2 bg-gradient-to-r from-accent-yellow to-accent-orange text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
                แนะนำ
              </span>
            )}
            <span className="text-3xl block mb-2">{plan.icon}</span>
            <h3 className="font-bold text-gray-800">{plan.name}</h3>
            <p className="text-xs text-gray-400 mb-1">{plan.description}</p>
            {plan.price > 0 ? (
              <p className="text-sm text-primary-600 font-bold">฿{plan.price.toLocaleString()}</p>
            ) : (
              <p className="text-sm text-gray-400">ตามเมนู</p>
            )}
          </button>
        ))}
      </div>

      {/* Custom Days Slider */}
      {coursePlan === "CUSTOM" && (
        <div className="mt-6 p-5 bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-primary-100 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-medium">จำนวนวัน</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary-600">{customDays}</span>
              <span className="text-sm text-gray-500">วัน</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={customDays}
            onChange={(e) => onCustomDaysChange(Number(e.target.value))}
            className="w-full h-2 bg-primary-100 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 
              [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-primary-500 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>1 วัน</span>
            <span>30 วัน</span>
            <span>60 วัน</span>
          </div>
        </div>
      )}
    </div>
  );
}
