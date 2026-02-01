"use client";

import { useState } from "react";
import { DaySelector } from "@/components/user/DaySelector";
import { CalorieRing } from "@/components/user/CalorieRing";
import { MacroProgressBar } from "@/components/user/MacroProgressBar";
import { MealList } from "@/components/user/MealList";
import { RecommendationCard } from "@/components/user/RecommendationCard";
import { MealDetailModal } from "@/components/user/MealDetailModal";
import { FloatingAddButton } from "@/components/user/FloatingAddButton";

// Types
interface Meal {
  id: string;
  name: string;
  weight?: number;
  multiplier?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
  time: string;
  imageUrl?: string;
  ingredients?: string;
}

// Mock data
const mockUser = {
  targetCalories: 2500,
  targetProtein: 175,
  targetCarbs: 280,
  targetFat: 85,
  targetSodium: 2300,
  targetSugar: 50,
  targetWater: 2000, // ml
};

const initialMeals: Meal[] = [
  {
    id: "1",
    name: "Pasta Salad Bowl",
    weight: 350,
    multiplier: 1.7,
    calories: 680,
    protein: 20,
    carbs: 94,
    fat: 26,
    sodium: 580,
    sugar: 8,
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
    sodium: 120,
    sugar: 0,
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
    sodium: 320,
    sugar: 12,
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
    sodium: 85,
    sugar: 24,
    time: "16:28",
  },
];

export default function CaloriePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showMealDetail, setShowMealDetail] = useState(false);
  const [waterIntake, setWaterIntake] = useState(1200); // ml

  // Calculate totals from meals
  const dailyData = meals.reduce(
    (acc, meal) => ({
      consumed: acc.consumed + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
      sodium: acc.sodium + (meal.sodium || 0),
      sugar: acc.sugar + (meal.sugar || 0),
    }),
    { consumed: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, sugar: 0 }
  );

  const remaining = mockUser.targetCalories - dailyData.consumed;

  const handleMealClick = (meal: Meal) => {
    setSelectedMeal(meal);
    setShowMealDetail(true);
  };

  const handleDeleteMeal = (mealId: string) => {
    setMeals(meals.filter((m) => m.id !== mealId));
    setShowMealDetail(false);
    setSelectedMeal(null);
  };

  const handleAddMeal = (newMeal: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
    sugar: number;
    weight?: number;
    multiplier: number;
    ingredients?: string;
    imageUrl?: string;
  }) => {
    const meal: Meal = {
      id: Date.now().toString(),
      ...newMeal,
      time: new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMeals([meal, ...meals]);
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header - Sticky */}
      <DaySelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* Calories Card */}
      <div className="mx-6 mb-12">
        <CalorieRing
          remaining={remaining}
          consumed={dailyData.consumed}
          burnt={0}
          target={mockUser.targetCalories}
        />

        {/* Macros Row 1 - Carbs, Protein, Fat */}
        <div className="flex gap-4 px-2 mb-3">
          <MacroProgressBar
            label="Carbohydrates"
            current={dailyData.carbs}
            target={mockUser.targetCarbs}
            color="#fbbf24"
            delay={0.1}
          />
          <MacroProgressBar
            label="Protein"
            current={dailyData.protein}
            target={mockUser.targetProtein}
            color="#f87171"
            delay={0.2}
          />
          <MacroProgressBar
            label="Fat"
            current={dailyData.fat}
            target={mockUser.targetFat}
            color="#60a5fa"
            delay={0.3}
          />
        </div>

        {/* Macros Row 2 - Sodium, Sugar, Water */}
        <div className="flex gap-4 px-2">
          <MacroProgressBar
            label="Sodium"
            current={dailyData.sodium}
            target={mockUser.targetSodium}
            color="#a78bfa"
            unit="mg"
            delay={0.4}
          />
          <MacroProgressBar
            label="Sugar"
            current={dailyData.sugar}
            target={mockUser.targetSugar}
            color="#f472b6"
            delay={0.5}
          />
          <MacroProgressBar
            label="Water"
            current={waterIntake}
            target={mockUser.targetWater}
            color="#22d3ee"
            unit="ml"
            delay={0.6}
          />
        </div>
      </div>

      {/* Recommendation */}
      <div className="px-6 mb-6">
        <RecommendationCard
          message={
            remaining > 0
              ? `คุณยังเหลือแคลอรี่อีก ${remaining} Kcal วันนี้ลองเพิ่มผักและโปรตีนเพื่อให้ครบโภชนาการ`
              : `คุณทานครบเป้าหมายแล้ววันนี้! เยี่ยมมาก 🎉`
          }
        />
      </div>

      {/* Meals */}
      <div className="px-6">
        <MealList meals={meals} onMealClick={handleMealClick} />
      </div>

      {/* Meal Detail Modal */}
      <MealDetailModal
        meal={selectedMeal}
        isOpen={showMealDetail}
        onClose={() => {
          setShowMealDetail(false);
          setSelectedMeal(null);
        }}
        onDelete={handleDeleteMeal}
      />

      {/* Floating Add Button */}
      <FloatingAddButton onAddMeal={handleAddMeal} />
    </div>
  );
}
