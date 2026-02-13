"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { WeightChart } from "@/components/user/WeightChart";
import { GoalSummary } from "@/components/user/GoalSummary";
import { Target, Scale } from "lucide-react";
import { OnboardingModal } from "@/components/user/OnboardingModal";
import { WelcomeBackModal } from "@/components/user/WelcomeBackModal";
import { useLiff } from "@/components/providers/LiffProvider";
import { LogoLoader } from "@/components/user/LogoLoader";
import type { Gender } from "@/lib/health-calculator";

interface WeightData {
  date: string;
  weight: number;
  label: string;
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
  const { profile, isReady } = useLiff();
  const [member, setMember] = useState<Member | null>(null);
  const [weightData, setWeightData] = useState<WeightData[]>([]);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [startWeight, setStartWeight] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayWater, setTodayWater] = useState(0);
  const [weeklyCalories, setWeeklyCalories] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetGoal, setShowResetGoal] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);

  const lineUserId = profile?.userId;

  // Fetch member data (with retry for LINE WebView network errors)
  const fetchMember = useCallback(async () => {
    if (!lineUserId) return;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
        if (res.ok) {
          const data = await res.json();
          setMember(data);
          if (data.weight) setCurrentWeight(data.weight);
          // Show Welcome Back modal if user was inactive
          if (data.showWelcomeBack) {
            setShowWelcomeBack(true);
          }
          return; // Success - exit retry loop
        }
      } catch (error) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }
        console.error("Failed to fetch member after 3 attempts:", error);
      }
    }
  }, [lineUserId]);

  // Fetch weight logs (with retry)
  const fetchWeightLogs = useCallback(async () => {
    if (!lineUserId) return;

    for (let attempt = 1; attempt <= 3; attempt++) {
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
          return; // Success
        }
      } catch (error) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }
        console.error("Failed to fetch weight logs:", error);
      }
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

  // Set page title
  useEffect(() => {
    document.title = "เป้าหมาย";
  }, []);

  // Initial data fetch - only when LIFF ready and user is identified
  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      Promise.all([
        fetchMember(),
        fetchWeightLogs(),
        fetchTodayData(),
        fetchWeeklyData(),
      ]).finally(() => {
        setIsLoading(false);
      });
    }
    // Do NOT set isLoading=false when !isLoggedIn - LIFF login redirect is about to happen
  }, [
    isReady,
    lineUserId,
    fetchMember,
    fetchWeightLogs,
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

  // Loading state - show while LIFF initializing, data loading, waiting for login redirect, or member not loaded
  if (!isReady || isLoading || !lineUserId || !member) {
    return <LogoLoader />;
  }

  // Handle Welcome Back modal actions
  const handleWelcomeSetNewGoal = () => {
    setShowWelcomeBack(false);
    setShowResetGoal(true);
  };

  const handleWelcomeSkip = () => {
    setShowWelcomeBack(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      {/* Welcome Back Modal (for returning inactive users) */}
      <WelcomeBackModal
        isOpen={showWelcomeBack}
        displayName={profile?.displayName}
        onSetNewGoal={handleWelcomeSetNewGoal}
        onSkip={handleWelcomeSkip}
      />

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
          showUpdateModal={showWeightModal}
          onCloseUpdateModal={() => setShowWeightModal(false)}
          hideInternalButton={true}
        />

        {/* Goal Summary */}
        <GoalSummary
          goals={getGoals(currentWeight || 70)}
          daysToGoal={daysToGoal > 0 ? daysToGoal : 0}
          achievements={
            getGoals(currentWeight || 70).filter(
              (g) => g.current >= g.target
            ).length
          }
        />

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
                {weightData.length}
              </p>
              <p className="text-sm text-slate-500">วันที่บันทึกน้ำหนัก</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p
                className={`text-2xl font-semibold ${
                  weeklyWeightChange <= 0
                    ? "text-rose-600"
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

      {/* Fixed Bottom Buttons - positioned above bottom nav bar */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-4">
        <div className="flex gap-3">
          <button
            onClick={() => setShowWeightModal(true)}
            className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-500/30"
          >
            <Scale className="w-4 h-4" />
            อัพเดทน้ำหนัก
          </button>
          <button
            onClick={() => setShowResetGoal(true)}
            className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-slate-900/30"
          >
            <Target className="w-4 h-4" />
            ตั้งเป้าหมายใหม่
          </button>
        </div>
      </div>
    </div>
  );
}
