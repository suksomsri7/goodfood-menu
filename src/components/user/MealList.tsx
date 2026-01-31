"use client";

import { Coffee, Sun, Moon, Cookie } from "lucide-react";
import { cn } from "@/lib/utils";

interface MealItem {
  id: string;
  name: string;
  calories: number;
  time: string;
  imageUrl?: string;
}

interface MealSection {
  type: "breakfast" | "lunch" | "dinner" | "snack";
  label: string;
  icon: React.ReactNode;
  items: MealItem[];
}

const mealIcons = {
  breakfast: <Coffee className="w-5 h-5" />,
  lunch: <Sun className="w-5 h-5" />,
  dinner: <Moon className="w-5 h-5" />,
  snack: <Cookie className="w-5 h-5" />,
};

const mealColors = {
  breakfast: "bg-orange-100 text-orange-600",
  lunch: "bg-yellow-100 text-yellow-600",
  dinner: "bg-indigo-100 text-indigo-600",
  snack: "bg-pink-100 text-pink-600",
};

// Mock data
const mockMeals: MealSection[] = [
  {
    type: "breakfast",
    label: "มื้อเช้า",
    icon: mealIcons.breakfast,
    items: [
      { id: "1", name: "ข้าวต้มหมู", calories: 250, time: "07:30" },
      { id: "2", name: "กาแฟดำ", calories: 5, time: "07:45" },
    ],
  },
  {
    type: "lunch",
    label: "มื้อกลางวัน",
    icon: mealIcons.lunch,
    items: [
      { id: "3", name: "ผัดกะเพราไก่", calories: 450, time: "12:00" },
    ],
  },
];

export function MealList() {
  const totalMeals = mockMeals.reduce(
    (total, section) => total + section.items.length,
    0
  );

  if (totalMeals === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Coffee className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          ยังไม่มีรายการอาหารวันนี้
        </h3>
        <p className="text-gray-500 text-sm">
          กดปุ่ม + เพื่อเพิ่มอาหารมื้อแรกของวัน
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mockMeals.map((section) => (
        <div key={section.type} className="bg-white rounded-2xl p-4 shadow-sm">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("p-2 rounded-lg", mealColors[section.type])}>
              {section.icon}
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">{section.label}</h4>
              <p className="text-xs text-gray-500">
                {section.items.reduce((sum, item) => sum + item.calories, 0)} kcal
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {section.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-lg">
                    🍽️
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
                <span className="font-semibold text-gray-700">
                  {item.calories} <span className="text-xs text-gray-400">kcal</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
