"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { WeightChart } from "@/components/user/WeightChart";
import { FoodStockCard } from "@/components/user/FoodStockCard";
import { GoalSummary } from "@/components/user/GoalSummary";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Mock weight data for the past 14 days
const weightData = [
  { date: "2026-01-19", weight: 78.5, label: "19" },
  { date: "2026-01-20", weight: 78.2, label: "20" },
  { date: "2026-01-21", weight: 78.4, label: "21" },
  { date: "2026-01-22", weight: 77.9, label: "22" },
  { date: "2026-01-23", weight: 77.6, label: "23" },
  { date: "2026-01-24", weight: 77.8, label: "24" },
  { date: "2026-01-25", weight: 77.3, label: "25" },
  { date: "2026-01-26", weight: 77.1, label: "26" },
  { date: "2026-01-27", weight: 76.9, label: "27" },
  { date: "2026-01-28", weight: 76.5, label: "28" },
  { date: "2026-01-29", weight: 76.7, label: "29" },
  { date: "2026-01-30", weight: 76.2, label: "30" },
  { date: "2026-01-31", weight: 76.0, label: "31" },
  { date: "2026-02-01", weight: 75.8, label: "1" },
];

// Mock ordered food from /menu
const orderedFood = [
  {
    id: "1",
    name: "สลัดอกไก่ย่าง",
    quantity: 2,
    calories: 350,
    price: 89,
    date: "วันนี้",
  },
  {
    id: "2",
    name: "ข้าวกล้องหมูอบ",
    quantity: 1,
    calories: 450,
    price: 75,
    date: "วันนี้",
  },
  {
    id: "3",
    name: "สมูทตี้ผลไม้รวม",
    quantity: 1,
    calories: 180,
    price: 55,
    date: "เมื่อวาน",
  },
  {
    id: "4",
    name: "แซนด์วิชไข่",
    quantity: 2,
    calories: 280,
    price: 65,
    date: "เมื่อวาน",
  },
];

// Mock goals - will be updated dynamically
const getGoals = (currentWeight: number) => [
  {
    id: "1",
    title: "ลดน้ำหนัก",
    current: currentWeight,
    target: 70,
    unit: "kg",
    icon: "weight" as const,
    color: "#10b981",
    streak: 14,
  },
  {
    id: "2",
    title: "แคลอรี่/วัน",
    current: 1850,
    target: 2000,
    unit: "kcal",
    icon: "calories" as const,
    color: "#f97316",
    streak: 7,
  },
  {
    id: "3",
    title: "ออกกำลังกาย",
    current: 4,
    target: 5,
    unit: "ครั้ง",
    icon: "exercise" as const,
    color: "#3b82f6",
  },
  {
    id: "4",
    title: "ดื่มน้ำ",
    current: 2.1,
    target: 2.5,
    unit: "ลิตร",
    icon: "water" as const,
    color: "#06b6d4",
    streak: 3,
  },
];

export default function GoalPage() {
  const [currentWeight, setCurrentWeight] = useState(75.8);

  const handleUpdateWeight = (weight: number) => {
    setCurrentWeight(weight);
    // TODO: Save to database
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/"
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
          data={weightData}
          targetWeight={70}
          currentWeight={currentWeight}
          startWeight={78.5}
          onUpdateWeight={handleUpdateWeight}
        />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Goal Summary */}
          <GoalSummary goals={getGoals(currentWeight)} daysToGoal={45} achievements={12} />

          {/* Ordered Food */}
          <FoodStockCard items={orderedFood} />
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
              <p className="text-2xl font-semibold text-slate-900">12,500</p>
              <p className="text-sm text-slate-500">แคลอรี่ที่บริโภค</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-semibold text-slate-900">4</p>
              <p className="text-sm text-slate-500">ครั้งออกกำลังกาย</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-semibold text-emerald-600">-0.8</p>
              <p className="text-sm text-slate-500">กก. จากสัปดาห์ก่อน</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-semibold text-slate-900">85%</p>
              <p className="text-sm text-slate-500">สำเร็จเป้าหมาย</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
