"use client";

import { useState, useEffect, useCallback } from "react";
import { DaySelector } from "@/components/user/DaySelector";
import { CalorieRing } from "@/components/user/CalorieRing";
import { MacroProgressBar } from "@/components/user/MacroProgressBar";
import { MealList } from "@/components/user/MealList";
import { ExerciseList } from "@/components/user/ExerciseList";
import { RecommendationCard } from "@/components/user/RecommendationCard";
import { MealDetailModal } from "@/components/user/MealDetailModal";
import { FloatingAddButton } from "@/components/user/FloatingAddButton";
import { WaterIntakeButton } from "@/components/user/WaterIntakeButton";
import { AnalysisModal } from "@/components/user/AnalysisModal";
import { useLiff } from "@/components/providers/LiffProvider";
import { Brain } from "lucide-react";

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseBurned, setExerciseBurned] = useState(0);
  const [member, setMember] = useState<Member | null>(null);
  const [waterIntake, setWaterIntake] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showMealDetail, setShowMealDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<string>("");
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  
  // AI Analysis state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    summary?: string | string[] | null;
    goalAnalysis?: string | string[] | null;
    recommendations?: string | string[] | null;
  } | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const lineUserId = profile?.userId;

  // Fetch member data
  const fetchMember = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMember(data);
      }
    } catch (error) {
      console.error("Failed to fetch member:", error);
    }
  }, [lineUserId]);

  // Fetch meals for selected date
  const fetchMeals = useCallback(async () => {
    if (!lineUserId) return;

    try {
      // Use local date string to avoid timezone issues
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      // Also send timezone offset so backend can filter correctly
      const tzOffset = selectedDate.getTimezoneOffset();
      const res = await fetch(
        `/api/meals?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        // Transform data to match Meal interface
        const transformedMeals: Meal[] = data.map((meal: any) => ({
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
        }));
        setMeals(transformedMeals);
      }
    } catch (error) {
      console.error("Failed to fetch meals:", error);
    }
  }, [lineUserId, selectedDate]);

  // Fetch water intake for selected date
  const fetchWater = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
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
  }, [lineUserId, selectedDate]);

  // Fetch exercises for selected date
  const fetchExercises = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const tzOffset = selectedDate.getTimezoneOffset();
      const res = await fetch(
        `/api/exercises?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        // Transform data to match Exercise interface
        const transformedExercises: Exercise[] = (data.exercises || []).map((ex: any) => ({
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
        }));
        setExercises(transformedExercises);
        setExerciseBurned(data.totalBurned || 0);
      }
    } catch (error) {
      console.error("Failed to fetch exercises:", error);
    }
  }, [lineUserId, selectedDate]);

  // Fetch AI recommendation
  const fetchRecommendation = useCallback(async (forceRefresh = false) => {
    if (!lineUserId) return;

    setIsLoadingRecommendation(true);
    try {
      const url = forceRefresh 
        ? `/api/recommendation?lineUserId=${lineUserId}&refresh=true`
        : `/api/recommendation?lineUserId=${lineUserId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data.message || "");
      }
    } catch (error) {
      console.error("Failed to fetch recommendation:", error);
    } finally {
      setIsLoadingRecommendation(false);
    }
  }, [lineUserId]);

  // Fetch AI analysis
  const fetchAnalysis = useCallback(async () => {
    if (!lineUserId) return;

    setIsLoadingAnalysis(true);
    setShowAnalysis(true);
    
    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          dateStr,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Ensure analysis has required fields with fallbacks
        const safeAnalysis = data.analysis ? {
          summary: data.analysis.summary || "ไม่สามารถวิเคราะห์ได้",
          goalAnalysis: data.analysis.goalAnalysis || [],
          recommendations: data.analysis.recommendations || []
        } : null;
        
        setAnalysisResult(safeAnalysis);
      } else {
        setAnalysisResult(null);
      }
    } catch (error) {
      console.error("Failed to fetch analysis:", error);
      setAnalysisResult(null);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [lineUserId, selectedDate]);

  // Set page title
  useEffect(() => {
    document.title = "แคลอรี่";
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      Promise.all([fetchMember(), fetchMeals(), fetchWater(), fetchExercises()]).finally(() => {
        setIsLoading(false);
        // AI Recommendation disabled temporarily
        // fetchRecommendation();
      });
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [isReady, lineUserId, isLoggedIn, fetchMember, fetchMeals, fetchWater, fetchExercises]);

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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-white pb-28">
      {/* Header - Sticky */}
      <DaySelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* Calories Card */}
      <div className="mx-6 mb-12">
        <CalorieRing
          remaining={remaining + exerciseBurned}
          consumed={dailyData.consumed}
          burnt={exerciseBurned}
          target={goals.targetCalories}
        />

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

        {/* AI Analysis Button */}
        <div className="flex justify-center mb-8 mt-8">
          <button
            onClick={fetchAnalysis}
            disabled={isLoadingAnalysis}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all active:scale-95"
          >
            <Brain className={`w-4 h-4 ${isLoadingAnalysis ? 'animate-pulse' : ''}`} />
            <span>{isLoadingAnalysis ? 'กำลังวิเคราะห์...' : 'AI วิเคราะห์'}</span>
          </button>
        </div>

        {/* Macros Row 1 - Carbs, Protein, Fat */}
        <div className="flex gap-4 px-2 mb-3">
          <MacroProgressBar
            label="Carbohydrates"
            current={dailyData.carbs}
            target={goals.targetCarbs}
            color="#fbbf24"
            delay={0.1}
          />
          <MacroProgressBar
            label="Protein"
            current={dailyData.protein}
            target={goals.targetProtein}
            color="#f87171"
            delay={0.2}
          />
          <MacroProgressBar
            label="Fat"
            current={dailyData.fat}
            target={goals.targetFat}
            color="#60a5fa"
            delay={0.3}
          />
        </div>

        {/* Macros Row 2 - Sodium, Sugar, Water */}
        <div className="flex gap-4 px-2">
          <MacroProgressBar
            label="Sodium"
            current={dailyData.sodium}
            target={goals.targetSodium}
            color="#a78bfa"
            unit="mg"
            delay={0.4}
          />
          <MacroProgressBar
            label="Sugar"
            current={dailyData.sugar}
            target={goals.targetSugar}
            color="#f472b6"
            delay={0.5}
          />
          <WaterIntakeButton
            current={waterIntake}
            target={goals.targetWater}
            onAddWater={handleAddWater}
          />
        </div>
      </div>

      {/* AI Recommendation - Disabled temporarily */}
      {/* <div className="px-6 mb-6">
        <RecommendationCard
          message={recommendation}
          isLoading={isLoadingRecommendation}
          onRefresh={() => fetchRecommendation(true)}
        />
      </div> */}

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

      {/* AI Analysis Modal */}
      <AnalysisModal
        isOpen={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        analysis={analysisResult}
        isLoading={isLoadingAnalysis}
        onRefresh={fetchAnalysis}
      />

      {/* Floating Add Button */}
      <FloatingAddButton lineUserId={lineUserId} onAddMeal={handleAddMeal} onAddExercise={handleAddExercise} />
    </div>
  );
}
