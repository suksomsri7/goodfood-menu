"use client";

import { useState, useEffect, useCallback } from "react";
import { DaySelector } from "@/components/user/DaySelector";
import { MacroProgressBar } from "@/components/user/MacroProgressBar";
import { MealList } from "@/components/user/MealList";
import { ExerciseList } from "@/components/user/ExerciseList";
import { MealDetailModal } from "@/components/user/MealDetailModal";
import { FitnessRings } from "@/components/user/FitnessRings";
import { useLiff } from "@/components/providers/LiffProvider";
import { LogoLoader } from "@/components/user/LogoLoader";
import { useCalHelp } from "./help-context";

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

interface Exercise {
  id: string;
  name: string;
  type?: string;
  duration: number;
  calories: number;
  intensity?: string;
  note?: string;
  time: string;
}

interface Member {
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  dailySodium: number | null;
  dailySugar: number | null;
  dailyWater: number | null;
  bmr: number | null;
  tdee: number | null;
}


// Default goals
const defaultGoals = {
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 250,
  targetFat: 65,
  targetSodium: 2300,
  targetSugar: 50,
  targetWater: 2000,
};

export default function CaloriePage() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const { onHelpClick } = useCalHelp();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseBurned, setExerciseBurned] = useState(0);
  const [member, setMember] = useState<Member | null>(null);
  const [waterIntake, setWaterIntake] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showMealDetail, setShowMealDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const lineUserId = profile?.userId;

  // Helper to get date string
  const getDateStr = useCallback((date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);

  // Helper to transform meal data
  const transformMeal = useCallback((meal: any): Meal => ({
    id: meal.id,
    name: meal.name,
    weight: meal.weight,
    multiplier: meal.multiplier,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    sodium: meal.sodium,
    sugar: meal.sugar,
    imageUrl: meal.imageUrl,
    ingredients: meal.ingredients,
    time: new Date(meal.date).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }), []);

  // Helper to transform exercise data  
  const transformExercise = useCallback((ex: any): Exercise => ({
    id: ex.id,
    name: ex.name,
    type: ex.type,
    duration: ex.duration,
    calories: ex.calories,
    intensity: ex.intensity,
    note: ex.note,
    time: new Date(ex.date).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }), []);

  // OPTIMIZED: Fetch ALL initial data in ONE request
  const fetchInitialData = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const dateStr = getDateStr(selectedDate);
      const tzOffset = selectedDate.getTimezoneOffset();
      const res = await fetch(
        `/api/cal/initial-data?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`
      );
      
      if (res.ok) {
        const data = await res.json();
        
        // Set all data at once
        setMember(data.member);
        setMeals(data.meals.map(transformMeal));
        setWaterIntake(data.water.total);
        setExercises(data.exercises.items.map(transformExercise));
        setExerciseBurned(data.exercises.totalBurned);
        
        console.log(`[Cal] Initial data loaded in ${data.meta.responseTime}ms`);
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
  }, [lineUserId, selectedDate, getDateStr, transformMeal, transformExercise]);

  // Individual fetch functions for date changes and mutations
  const fetchMeals = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const dateStr = getDateStr(selectedDate);
      const tzOffset = selectedDate.getTimezoneOffset();
      const res = await fetch(
        `/api/meals?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        setMeals(data.map(transformMeal));
      }
    } catch (error) {
      console.error("Failed to fetch meals:", error);
    }
  }, [lineUserId, selectedDate, getDateStr, transformMeal]);

  const fetchWater = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const dateStr = getDateStr(selectedDate);
      const tzOffset = selectedDate.getTimezoneOffset();
      const res = await fetch(
        `/api/water?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        setWaterIntake(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch water:", error);
    }
  }, [lineUserId, selectedDate, getDateStr]);

  const fetchExercises = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const dateStr = getDateStr(selectedDate);
      const tzOffset = selectedDate.getTimezoneOffset();
      const res = await fetch(
        `/api/exercises?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        setExercises((data.exercises || []).map(transformExercise));
        setExerciseBurned(data.totalBurned || 0);
      }
    } catch (error) {
      console.error("Failed to fetch exercises:", error);
    }
  }, [lineUserId, selectedDate, getDateStr, transformExercise]);

  // Set page title
  useEffect(() => {
    document.title = "แคลอรี่";
  }, []);

  // Initial data fetch - OPTIMIZED: Single API call instead of 4
  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      fetchInitialData().finally(() => {
        setIsLoading(false);
      });
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [isReady, lineUserId, isLoggedIn, fetchInitialData]);

  // Refetch data when date changes
  useEffect(() => {
    if (lineUserId) {
      fetchMeals();
      fetchWater();
      fetchExercises();
    }
  }, [selectedDate, lineUserId, fetchMeals, fetchWater, fetchExercises]);

  // Get user goals (from member or defaults)
  const goals = {
    targetCalories: member?.dailyCalories || defaultGoals.targetCalories,
    targetProtein: member?.dailyProtein || defaultGoals.targetProtein,
    targetCarbs: member?.dailyCarbs || defaultGoals.targetCarbs,
    targetFat: member?.dailyFat || defaultGoals.targetFat,
    targetSodium: member?.dailySodium || defaultGoals.targetSodium,
    targetSugar: member?.dailySugar || defaultGoals.targetSugar,
    targetWater: member?.dailyWater || defaultGoals.targetWater,
  };

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

  const remaining = goals.targetCalories - dailyData.consumed;

  const handleMealClick = (meal: Meal) => {
    setSelectedMeal(meal);
    setShowMealDetail(true);
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      const res = await fetch(`/api/meals/${mealId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMeals(meals.filter((m) => m.id !== mealId));
        setShowMealDetail(false);
        setSelectedMeal(null);
      }
    } catch (error) {
      console.error("Failed to delete meal:", error);
    }
  };

  const handleAddMeal = async (newMeal: {
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
    if (!lineUserId) return;

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          ...newMeal,
          date: selectedDate.toISOString(),
        }),
      });

      if (res.ok) {
        const savedMeal = await res.json();
        const meal: Meal = {
          id: savedMeal.id,
          ...newMeal,
          time: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMeals([meal, ...meals]);
        // AI Recommendation disabled temporarily
        // fetchRecommendation(true);
      }
    } catch (error) {
      console.error("Failed to add meal:", error);
    }
  };

  const handleAddExercise = async (newExercise: {
    name: string;
    type: string;
    duration: number;
    calories: number;
    intensity: string;
    note?: string;
  }) => {
    if (!lineUserId) return;

    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          ...newExercise,
          date: selectedDate.toISOString(),
        }),
      });

      if (res.ok) {
        const savedExercise = await res.json();
        const exercise: Exercise = {
          id: savedExercise.id,
          ...newExercise,
          time: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setExercises([exercise, ...exercises]);
        setExerciseBurned(exerciseBurned + newExercise.calories);
      }
    } catch (error) {
      console.error("Failed to add exercise:", error);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const deletedExercise = exercises.find(e => e.id === exerciseId);
        setExercises(exercises.filter((e) => e.id !== exerciseId));
        if (deletedExercise) {
          setExerciseBurned(Math.max(0, exerciseBurned - deletedExercise.calories));
        }
      }
    } catch (error) {
      console.error("Failed to delete exercise:", error);
    }
  };

  const handleAddWater = async (amount: number) => {
    if (!lineUserId) return;

    try {
      const res = await fetch("/api/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          amount,
          date: selectedDate.toISOString(),
        }),
      });

      if (res.ok) {
        setWaterIntake((prev) => prev + amount);
      }
    } catch (error) {
      console.error("Failed to add water:", error);
    }
  };

  // Loading state
  if (!isReady || isLoading) {
    return <LogoLoader />;
  }

  // Not logged in state
  if (!isLoggedIn || !lineUserId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            กรุณาเข้าสู่ระบบ
          </h2>
          <p className="text-gray-500 text-sm">
            เปิดผ่าน LINE เพื่อใช้งานระบบนับแคลอรี่
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-16">
      {/* Header - Sticky */}
      <DaySelector selectedDate={selectedDate} onDateChange={setSelectedDate} showGoalIcon onHelpClick={onHelpClick} />

      {/* Fitness Rings - Calories, Water */}
      <div data-guide="fitness-rings">
        <FitnessRings
          calories={{ current: dailyData.consumed, target: goals.targetCalories }}
          water={{ current: waterIntake, target: goals.targetWater }}
          onAddWater={handleAddWater}
        />
      </div>

      {/* Macros & Details */}
      <div className="mx-6 mb-12">
        {/* BMR/TDEE Info */}
        {(member?.bmr || member?.tdee) && (
          <div className="flex justify-center gap-6 mb-4 text-xs text-gray-400">
            {member?.bmr && (
              <div className="flex items-center gap-1">
                <span>BMR:</span>
                <span className="font-medium text-gray-500">{Math.round(member.bmr)} kcal</span>
              </div>
            )}
            {member?.tdee && (
              <div className="flex items-center gap-1">
                <span>TDEE:</span>
                <span className="font-medium text-gray-500">{Math.round(member.tdee)} kcal</span>
              </div>
            )}
          </div>
        )}

        {/* Macros - both rows */}
        <div data-guide="macros">
          {/* Row 1 - Carbs, Protein, Fat */}
          <div className="flex gap-4 px-2 mb-3">
            <MacroProgressBar
              label="คาร์โบไฮเดรต"
              current={dailyData.carbs}
              target={goals.targetCarbs}
              color="#fbbf24"
              delay={0.1}
            />
            <MacroProgressBar
              label="โปรตีน"
              current={dailyData.protein}
              target={goals.targetProtein}
              color="#f87171"
              delay={0.2}
            />
            <MacroProgressBar
              label="ไขมัน"
              current={dailyData.fat}
              target={goals.targetFat}
              color="#60a5fa"
              delay={0.3}
            />
          </div>

          {/* Row 2 - Sodium, Sugar, Burned */}
          <div className="flex gap-4 px-2">
          <MacroProgressBar
            label="โซเดียม"
            current={dailyData.sodium}
            target={goals.targetSodium}
            color={
              dailyData.sodium > goals.targetSodium
                ? "#ef4444"
                : dailyData.sodium >= goals.targetSodium * 0.8
                ? "#f97316"
                : "#a78bfa"
            }
            unit="mg"
            delay={0.4}
          />
          <MacroProgressBar
            label="น้ำตาล"
            current={dailyData.sugar}
            target={goals.targetSugar}
            color={
              dailyData.sugar > goals.targetSugar
                ? "#ef4444"
                : dailyData.sugar >= goals.targetSugar * 0.8
                ? "#f97316"
                : "#f472b6"
            }
            delay={0.5}
          />
          <MacroProgressBar
            label="เผาผลาญ"
            current={exerciseBurned}
            target={goals.targetCalories}
            color="#34d399"
            unit="kcal"
            delay={0.6}
            hideTarget
          />
          </div>

          {/* เตือนโซเดียม/น้ำตาล */}
          {(() => {
            const warns: string[] = [];
            if (goals.targetSodium > 0 && dailyData.sodium > goals.targetSodium)
              warns.push(`โซเดียมเกินเป้าแล้ว (${Math.round(dailyData.sodium)}/${Math.round(goals.targetSodium)} mg) ลดของเค็ม/น้ำจิ้มลงหน่อยนะ`);
            else if (goals.targetSodium > 0 && dailyData.sodium >= goals.targetSodium * 0.8)
              warns.push(`โซเดียมใกล้ถึงเป้า (${Math.round(dailyData.sodium)}/${Math.round(goals.targetSodium)} mg) ระวังของเค็ม`);
            if (goals.targetSugar > 0 && dailyData.sugar > goals.targetSugar)
              warns.push(`น้ำตาลเกินเป้าแล้ว (${Math.round(dailyData.sugar)}/${Math.round(goals.targetSugar)} g) เลี่ยงของหวาน/เครื่องดื่มหวาน`);
            else if (goals.targetSugar > 0 && dailyData.sugar >= goals.targetSugar * 0.8)
              warns.push(`น้ำตาลใกล้ถึงเป้า (${Math.round(dailyData.sugar)}/${Math.round(goals.targetSugar)} g)`);
            if (warns.length === 0) return null;
            const over =
              dailyData.sodium > goals.targetSodium || dailyData.sugar > goals.targetSugar;
            return (
              <div
                className={`mx-2 mt-3 rounded-xl px-3 py-2 text-xs ${
                  over ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                }`}
              >
                {warns.map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Exercises */}
      {exercises.length > 0 && (
        <div className="px-6 mb-6">
          <ExerciseList exercises={exercises} onDelete={handleDeleteExercise} />
        </div>
      )}

      {/* Meals */}
      <div className="px-6">
        {meals.length === 0 && exercises.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-gray-400">ยังไม่มีรายการอาหารวันนี้</p>
            <p className="text-gray-400 text-sm">กดปุ่ม + เพื่อเพิ่มมื้ออาหาร</p>
          </div>
        ) : meals.length > 0 ? (
          <>
            {/* Meals Header - add mt-10 if exercises exist above */}
            <div className={`flex items-center gap-2 mb-3 ${exercises.length > 0 ? 'mt-10' : ''}`}>
              <span className="text-lg">🍽️</span>
              <h3 className="font-semibold text-gray-800">รายการอาหาร</h3>
            </div>
            <MealList meals={meals} onMealClick={handleMealClick} />
          </>
        ) : null}
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

    </div>
  );
}
