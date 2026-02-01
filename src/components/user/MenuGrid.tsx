"use client";

import { MenuCard } from "./MenuCard";

interface Food {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: { id: string; name: string; color: string };
}

interface Props {
  foods: Food[];
  onAddItem: (food: Food, mealType: "breakfast" | "lunch" | "dinner" | "snack") => void;
  isLoading: boolean;
}

export function MenuGrid({ foods, onAddItem, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="px-6 grid grid-cols-2 gap-4 pb-32">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className="bg-white rounded-2xl overflow-hidden animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-36 bg-gradient-to-br from-gray-200 to-gray-100" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded-full w-3/4" />
              <div className="flex gap-1">
                <div className="h-5 bg-gray-200 rounded w-12" />
                <div className="h-5 bg-gray-200 rounded w-12" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-6 bg-gray-200 rounded w-16" />
                <div className="h-8 bg-gray-200 rounded-xl w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (foods.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="text-5xl">🍽️</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">ไม่พบเมนูอาหาร</h3>
        <p className="text-gray-400 text-sm">ลองเลือกหมวดหมู่อื่นดูนะ</p>
      </div>
    );
  }

  return (
    <div className="px-6 grid grid-cols-2 gap-4 pb-32">
      {foods.map((food, index) => (
        <div
          key={food.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <MenuCard
            food={food}
            onAdd={(mealType) => onAddItem(food, mealType)}
          />
        </div>
      ))}
    </div>
  );
}
