"use client";

import { useState } from "react";

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
  category: { name: string; color: string };
}

interface Props {
  food: Food;
  onAdd: (mealType: "breakfast" | "lunch" | "dinner" | "snack") => void;
}

const mealButtons = [
  { type: "breakfast" as const, icon: "🌅", label: "เช้า" },
  { type: "lunch" as const, icon: "☀️", label: "กลางวัน" },
  { type: "dinner" as const, icon: "🌙", label: "เย็น" },
];

export function MenuCard({ food, onAdd }: Props) {
  const [showMeals, setShowMeals] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleAdd = (mealType: "breakfast" | "lunch" | "dinner" | "snack") => {
    onAdd(mealType);
    setJustAdded(mealType);
    setTimeout(() => setJustAdded(null), 500);
  };

  return (
    <div 
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
      onMouseLeave={() => setShowMeals(false)}
    >
      {/* Image */}
      <div className="relative h-36 bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
        {food.imageUrl ? (
          <img
            src={food.imageUrl}
            alt={food.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-primary-50 to-primary-100">
            🍽️
          </div>
        )}
        
        {/* Category Badge */}
        <span
          className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm"
          style={{ backgroundColor: food.category.color }}
        >
          {food.category.name}
        </span>

        {/* Calories Badge */}
        <span className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-accent-orange shadow-sm">
          {food.calories} kcal
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 line-clamp-1 group-hover:text-primary-600 transition-colors">
          {food.name}
        </h3>
        
        {/* Nutrition Pills */}
        <div className="flex gap-1.5 mt-2">
          <span className="px-2 py-0.5 bg-red-50 text-red-500 rounded-md text-xs font-medium">
            P {food.protein}g
          </span>
          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-xs font-medium">
            C {food.carbs}g
          </span>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded-md text-xs font-medium">
            F {food.fat}g
          </span>
        </div>

        {/* Price & Add */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-primary-600">
            ฿{food.price}
          </span>
          
          {/* Add Button */}
          {!showMeals ? (
            <button
              onClick={() => setShowMeals(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 active:scale-95 transition-all shadow-sm shadow-primary-200"
            >
              + เพิ่ม
            </button>
          ) : (
            <div className="flex gap-1 animate-fade-in">
              {mealButtons.map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => handleAdd(type)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${
                    justAdded === type
                      ? "bg-primary-500 text-white scale-110"
                      : "bg-primary-50 hover:bg-primary-500 hover:text-white"
                  }`}
                  title={`เพิ่มเป็นมื้อ${label}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
