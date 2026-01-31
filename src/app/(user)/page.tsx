"use client";

import { useState } from "react";
import { DaySelector } from "@/components/user/DaySelector";
import { CalorieRing } from "@/components/user/CalorieRing";
import { MacroProgressBar } from "@/components/user/MacroProgressBar";
import { MealList } from "@/components/user/MealList";
import { RecommendationCard } from "@/components/user/RecommendationCard";

// Mock data
const mockUser = {
  targetCalories: 2500,
  targetProtein: 175,
  targetCarbs: 280,
  targetFat: 85,
};

const mockDailyData = {
  consumed: 2243,
  burnt: 0,
  protein: 164,
  carbs: 182,
  fat: 93,
};

const mockMeals = [
  {
    id: "1",
    name: "Pasta Salad Bowl",
    weight: 350,
    multiplier: 1.7,
    calories: 680,
    protein: 20,
    carbs: 94,
    fat: 26,
    time: "16:30",
  },
  {
    id: "2",
    name: "Grilled Salmon",
    weight: 150,
    multiplier: 2.0,
    calories: 500,
    protein: 46,
    carbs: 0,
    fat: 30,
    time: "16:30",
  },
  {
    id: "3",
    name: "Colorful Salad Bowl",
    weight: 400,
    calories: 350,
    protein: 10,
    carbs: 40,
    fat: 20,
    time: "16:29",
  },
  {
    id: "4",
    name: "Yogurt Parfait",
    weight: 150,
    multiplier: 2.0,
    calories: 300,
    protein: 10,
    carbs: 48,
    fat: 8,
    time: "16:28",
  },
];

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const remaining = mockUser.targetCalories - mockDailyData.consumed + mockDailyData.burnt;

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header - Sticky */}
      <DaySelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* Calories Card */}
      <div className="mx-6 mb-12">
        <CalorieRing
          remaining={remaining}
          consumed={mockDailyData.consumed}
          burnt={mockDailyData.burnt}
          target={mockUser.targetCalories}
        />

        {/* Macros - ชิดกับวงกลม */}
        <div className="flex gap-6 px-2">
          <MacroProgressBar
            label="Carbohydrates"
            current={mockDailyData.carbs}
            target={mockUser.targetCarbs}
            color="#fbbf24"
            delay={0.1}
          />
          <MacroProgressBar
            label="Protein"
            current={mockDailyData.protein}
            target={mockUser.targetProtein}
            color="#f87171"
            delay={0.2}
          />
          <MacroProgressBar
            label="Fat"
            current={mockDailyData.fat}
            target={mockUser.targetFat}
            color="#60a5fa"
            delay={0.3}
          />
        </div>
      </div>

      {/* Recommendation */}
      <div className="px-6 mb-6">
        <RecommendationCard 
          message={`คุณยังเหลือแคลอรี่อีก ${remaining} Kcal วันนี้ลองเพิ่มผักและโปรตีนเพื่อให้ครบโภชนาการ`}
        />
      </div>

      {/* Meals */}
      <div className="px-6">
        <MealList meals={mockMeals} />
      </div>
    </div>
  );
}
