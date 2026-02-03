"use client";

import { useState, useEffect, useCallback } from "react";
import { DaySelector } from "@/components/user/DaySelector";
import { CalorieRing } from "@/components/user/CalorieRing";
import { MacroProgressBar } from "@/components/user/MacroProgressBar";
import { MealList } from "@/components/user/MealList";
import { RecommendationCard } from "@/components/user/RecommendationCard";
import { MealDetailModal } from "@/components/user/MealDetailModal";
import { FloatingAddButton } from "@/components/user/FloatingAddButton";
import { WaterIntakeButton } from "@/components/user/WaterIntakeButton";
import { FoodStockCard } from "@/components/user/FoodStockCard";
import { useLiff } from "@/components/providers/LiffProvider";

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

interface Member {
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  dailySodium: number | null;
  dailySugar: number | null;
  dailyWater: number | null;
}

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderedFood {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  price: number;
  date: string;
  status?: OrderStatus;
  orderNumber?: string;
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
  const [member, setMember] = useState<Member | null>(null);
  const [waterIntake, setWaterIntake] = useState(0);
  const [orderedFood, setOrderedFood] = useState<OrderedFood[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showMealDetail, setShowMealDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      const dateStr = selectedDate.toISOString().split("T")[0];
      const res = await fetch(
        `/api/meals?lineUserId=${lineUserId}&date=${dateStr}`
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
      const dateStr = selectedDate.toISOString().split("T")[0];
      const res = await fetch(
        `/api/water?lineUserId=${lineUserId}&date=${dateStr}`
      );
      if (res.ok) {
        const data = await res.json();
        setWaterIntake(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch water:", error);
    }
  }, [lineUserId, selectedDate]);

  // Fetch orders (Stock)
  const fetchOrders = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/orders?lineUserId=${lineUserId}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const items: OrderedFood[] = [];
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        data.forEach((order: any) => {
          const orderDate = new Date(order.createdAt).toDateString();
          const dateLabel =
            orderDate === today
              ? "วันนี้"
              : orderDate === yesterday
              ? "เมื่อวาน"
              : new Date(order.createdAt).toLocaleDateString("th-TH");

          order.items?.forEach((item: any) => {
            items.push({
              id: item.id,
              name: item.foodName,
              quantity: item.quantity,
              calories: item.calories || 0,
              price: item.price,
              date: dateLabel,
              status: order.status,
              orderNumber: order.orderNumber,
            });
          });
        });

        setOrderedFood(items);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, [lineUserId]);

  // Set page title
  useEffect(() => {
    document.title = "แคลอรี่";
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      Promise.all([fetchMember(), fetchMeals(), fetchWater(), fetchOrders()]).finally(() => {
        setIsLoading(false);
      });
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [isReady, lineUserId, isLoggedIn, fetchMember, fetchMeals, fetchWater, fetchOrders]);

  // Refetch meals when date changes
  useEffect(() => {
    if (lineUserId) {
      fetchMeals();
      fetchWater();
    }
  }, [selectedDate, lineUserId, fetchMeals, fetchWater]);

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
      }
    } catch (error) {
      console.error("Failed to add meal:", error);
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
          remaining={remaining}
          consumed={dailyData.consumed}
          burnt={0}
          target={goals.targetCalories}
        />

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
        {meals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-gray-400">ยังไม่มีรายการอาหารวันนี้</p>
            <p className="text-gray-400 text-sm">กดปุ่ม + เพื่อเพิ่มมื้ออาหาร</p>
          </div>
        ) : (
          <MealList meals={meals} onMealClick={handleMealClick} />
        )}
      </div>

      {/* Stock / Orders */}
      <div className="px-6 mt-6">
        <FoodStockCard items={orderedFood} />
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
