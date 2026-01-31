"use client";

import { WeekCalendar } from "@/components/user/WeekCalendar";
import { CalorieGauge } from "@/components/user/CalorieGauge";
import { MacroCard } from "@/components/user/MacroCard";
import { MealList } from "@/components/user/MealList";
import { Bell, User } from "lucide-react";

// Mock user data
const userData = {
  name: "John",
  targetCalories: 1840,
  consumed: 705,
  burnt: 0,
  macros: {
    protein: { current: 25, target: 138 },
    carbs: { current: 85, target: 184 },
    fat: { current: 15, target: 51 },
  },
};

export default function UserDashboard() {
  return (
    <div className="pb-24">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">สวัสดี 👋</p>
            <h1 className="text-lg font-bold text-gray-800">{userData.name}</h1>
          </div>
        </div>
        <button className="relative p-3 rounded-full bg-white shadow-sm hover:shadow-md transition-shadow">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-4 space-y-4">
        {/* Week Calendar */}
        <WeekCalendar />

        {/* Calorie Gauge */}
        <CalorieGauge
          consumed={userData.consumed}
          burnt={userData.burnt}
          target={userData.targetCalories}
        />

        {/* Macros */}
        <div className="grid grid-cols-3 gap-3">
          <MacroCard
            label="Protein"
            current={userData.macros.protein.current}
            target={userData.macros.protein.target}
            unit="g"
            color="protein"
            icon="🥩"
          />
          <MacroCard
            label="Carbs"
            current={userData.macros.carbs.current}
            target={userData.macros.carbs.target}
            unit="g"
            color="carbs"
            icon="🍞"
          />
          <MacroCard
            label="Fat"
            current={userData.macros.fat.current}
            target={userData.macros.fat.target}
            unit="g"
            color="fat"
            icon="🧈"
          />
        </div>

        {/* Meals Today */}
        <div className="pt-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            มื้ออาหารวันนี้
          </h2>
          <MealList />
        </div>
      </main>
    </div>
  );
}
