"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { WeightChart } from "@/components/user/WeightChart";
import { FoodStockCard } from "@/components/user/FoodStockCard";
import { GoalSummary } from "@/components/user/GoalSummary";
import { OnboardingModal } from "@/components/user/OnboardingModal";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLiff } from "@/components/providers/LiffProvider";
import type { Gender } from "@/lib/health-calculator";

interface WeightData {
  date: string;
  weight: number;
  label: string;
}

interface OrderedFood {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  price: number;
  date: string;
}

interface Member {
  name?: string;
  gender?: Gender;
  birthDate?: string;
  height?: number | null;
  weight: number | null;
  goalWeight: number | null;
  dailyCalories: number | null;
  dailyWater: number | null;
}

export default function GoalPage() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [member, setMember] = useState<Member | null>(null);
  const [weightData, setWeightData] = useState<WeightData[]>([]);
  const [orderedFood, setOrderedFood] = useState<OrderedFood[]>([]);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [startWeight, setStartWeight] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayWater, setTodayWater] = useState(0);
  const [weeklyCalories, setWeeklyCalories] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetGoal, setShowResetGoal] = useState(false);

  const lineUserId = profile?.userId;

  // Fetch member data
  const fetchMember = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMember(data);
        if (data.weight) setCurrentWeight(data.weight);
      }
    } catch (error) {
      console.error("Failed to fetch member:", error);
    }
  }, [lineUserId]);

  // Fetch weight logs
  const fetchWeightLogs = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/weight?lineUserId=${lineUserId}&days=14`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const transformed: WeightData[] = data.map((log: any) => ({
            date: log.date,
            weight: log.weight,
            label: new Date(log.date).getDate().toString(),
          }));
          setWeightData(transformed);
          setStartWeight(transformed[0]?.weight || 0);
          setCurrentWeight(transformed[transformed.length - 1]?.weight || 0);
        }
      }
    } catch (error) {
      console.error("Failed to fetch weight logs:", error);
    }
  }, [lineUserId]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/orders?lineUserId=${lineUserId}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        // Transform orders to ordered food items
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
            });
          });
        });

        setOrderedFood(items);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, [lineUserId]);

  // Fetch today's calories
  const fetchTodayData = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch meals
      const mealsRes = await fetch(
        `/api/meals?lineUserId=${lineUserId}&date=${today}`
      );
      if (mealsRes.ok) {
        const meals = await mealsRes.json();
        const totalCal = meals.reduce(
          (sum: number, meal: any) => sum + meal.calories,
          0
        );
        setTodayCalories(totalCal);
      }

      // Fetch water
      const waterRes = await fetch(
        `/api/water?lineUserId=${lineUserId}&date=${today}`
      );
      if (waterRes.ok) {
        const water = await waterRes.json();
        setTodayWater(water.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch today data:", error);
    }
  }, [lineUserId]);

  // Fetch weekly calories
  const fetchWeeklyData = useCallback(async () => {
    if (!lineUserId) return;

    try {
      // Get meals for the past 7 days
      let totalCalories = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const res = await fetch(
          `/api/meals?lineUserId=${lineUserId}&date=${dateStr}`
        );
        if (res.ok) {
          const meals = await res.json();
          totalCalories += meals.reduce(
            (sum: number, meal: any) => sum + meal.calories,
            0
          );
        }
      }
      setWeeklyCalories(totalCalories);
    } catch (error) {
      console.error("Failed to fetch weekly data:", error);
    }
  }, [lineUserId]);

  // Initial data fetch
  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      Promise.all([
        fetchMember(),
        fetchWeightLogs(),
        fetchOrders(),
        fetchTodayData(),
        fetchWeeklyData(),
      ]).finally(() => {
        setIsLoading(false);
      });
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [
    isReady,
    lineUserId,
    isLoggedIn,
    fetchMember,
    fetchWeightLogs,
    fetchOrders,
    fetchTodayData,
    fetchWeeklyData,
  ]);

  const handleUpdateWeight = async (weight: number) => {
    if (!lineUserId) return;

    try {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          weight,
        }),
      });

      if (res.ok) {
        setCurrentWeight(weight);
        // Refetch weight logs to update chart
        fetchWeightLogs();
      }
    } catch (error) {
      console.error("Failed to update weight:", error);
    }
  };

  const handleResetGoalComplete = () => {
    setShowResetGoal(false);
    // Refresh the page to load new data
    window.location.reload();
  };

  // Calculate goals
  const targetWeight = member?.goalWeight || 70;
  const targetCalories = member?.dailyCalories || 2000;
  const targetWater = (member?.dailyWater || 2000) / 1000; // Convert to liters

  const getGoals = (currentWt: number) => [
    {
      id: "1",
      title: "ลดน้ำหนัก",
      current: currentWt,
      target: targetWeight,
      unit: "kg",
      icon: "weight" as const,
      color: "#10b981",
      streak: weightData.length,
    },
    {
      id: "2",
      title: "แคลอรี่/วัน",
      current: todayCalories,
      target: targetCalories,
      unit: "kcal",
      icon: "calories" as const,
      color: "#f97316",
    },
    {
      id: "3",
      title: "ออกกำลังกาย",
      current: 0,
      target: 5,
      unit: "ครั้ง",
      icon: "exercise" as const,
      color: "#3b82f6",
    },
    {
      id: "4",
      title: "ดื่มน้ำ",
      current: todayWater / 1000, // Convert to liters
      target: targetWater,
      unit: "ลิตร",
      icon: "water" as const,
      color: "#06b6d4",
    },
  ];

  // Calculate days to goal
  const weightToLose = currentWeight - targetWeight;
  const avgWeightLossPerDay =
    weightData.length > 1
      ? (weightData[0]?.weight - weightData[weightData.length - 1]?.weight) /
        weightData.length
      : 0.1;
  const daysToGoal =
    avgWeightLossPerDay > 0
      ? Math.ceil(weightToLose / avgWeightLossPerDay)
      : 90;

  // Calculate weight change from last week
  const weekAgoWeight = weightData.find((d) => {
    const date = new Date(d.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date.toDateString() === weekAgo.toDateString();
  })?.weight;
  const weeklyWeightChange = weekAgoWeight
    ? currentWeight - weekAgoWeight
    : 0;

  // Loading state
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            กรุณาเข้าสู่ระบบ
          </h2>
          <p className="text-gray-500 text-sm">
            เปิดผ่าน LINE เพื่อดูเป้าหมายของคุณ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Reset Goal Modal */}
      {showResetGoal && lineUserId && (
        <OnboardingModal
          isOpen={showResetGoal}
          lineUserId={lineUserId}
          displayName={profile?.displayName}
          onComplete={handleResetGoalComplete}
          skipPersonalInfo={true}
          existingData={{
            name: member?.name,
            gender: member?.gender as Gender,
            birthDate: member?.birthDate,
            height: member?.height || undefined,
            weight: member?.weight || undefined,
          }}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/cal"
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="font-semibold text-slate-900">เป้าหมาย</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <div className="px-4 pt-4 space-y-4">
        {/* Weight Chart */}
        <WeightChart
          data={
            weightData.length > 0
              ? weightData
              : [
                  {
                    date: new Date().toISOString(),
                    weight: currentWeight || 70,
                    label: new Date().getDate().toString(),
                  },
                ]
          }
          targetWeight={targetWeight}
          currentWeight={currentWeight || 70}
          startWeight={startWeight || currentWeight || 70}
          onUpdateWeight={handleUpdateWeight}
        />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Goal Summary */}
          <GoalSummary
            goals={getGoals(currentWeight || 70)}
            daysToGoal={daysToGoal > 0 ? daysToGoal : 0}
            achievements={
              getGoals(currentWeight || 70).filter(
                (g) => g.current >= g.target
              ).length
            }
            onResetGoal={() => setShowResetGoal(true)}
          />

          {/* Ordered Food */}
          <FoodStockCard
            items={
              orderedFood.length > 0
                ? orderedFood
                : [
                    {
                      id: "empty",
                      name: "ยังไม่มีรายการสั่งซื้อ",
                      quantity: 0,
                      calories: 0,
                      price: 0,
                      date: "-",
                    },
                  ]
            }
          />
        </div>

        {/* Weekly Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h3 className="font-semibold text-slate-900 mb-4">สรุปสัปดาห์นี้</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-semibold text-slate-900">
                {weeklyCalories.toLocaleString()}
              </p>
              <p className="text-sm text-slate-500">แคลอรี่ที่บริโภค</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-semibold text-slate-900">
                {orderedFood.length}
              </p>
              <p className="text-sm text-slate-500">รายการที่สั่ง</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p
                className={`text-2xl font-semibold ${
                  weeklyWeightChange <= 0
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {weeklyWeightChange > 0 ? "+" : ""}
                {weeklyWeightChange.toFixed(1)}
              </p>
              <p className="text-sm text-slate-500">กก. จากสัปดาห์ก่อน</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-semibold text-slate-900">
                {Math.round(
                  (getGoals(currentWeight || 70).filter(
                    (g) => g.current >= g.target * 0.8
                  ).length /
                    getGoals(currentWeight || 70).length) *
                    100
                )}
                %
              </p>
              <p className="text-sm text-slate-500">สำเร็จเป้าหมาย</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
