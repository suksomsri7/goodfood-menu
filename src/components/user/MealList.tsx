"use client";

import { motion } from "framer-motion";

interface Meal {
  id: string;
  name: string;
  weight?: number;
  multiplier?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  imageUrl?: string;
}

interface MealListProps {
  meals: Meal[];
  onMealClick?: (meal: Meal) => void;
}

export function MealList({ meals, onMealClick }: MealListProps) {
  if (meals.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
          <span className="text-2xl opacity-50">🍽️</span>
        </div>
        <p className="text-sm text-gray-400">No meals recorded</p>
        <p className="text-xs text-gray-300 mt-1">Tap + to add food</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-1">
      {meals.map((meal, index) => (
        <motion.div
          key={meal.id}
          className="flex gap-4 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer active:bg-gray-50 rounded-xl -mx-2 px-2 transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onMealClick?.(meal)}
        >
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0 flex items-center justify-center">
            <span className="text-xl opacity-40">🍽️</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-1">
              <h3 className="text-sm font-medium text-gray-900">
                {meal.name}
                <span className="text-gray-400 font-normal">
                  {meal.weight && ` (${meal.weight}g)`}
                </span>
                {meal.multiplier && meal.multiplier !== 1 && (
                  <span className="text-red-400 font-medium"> ×{meal.multiplier}</span>
                )}
              </h3>
              <span className="text-sm font-medium text-gray-900 tabular-nums flex-shrink-0">
                {meal.calories}
                <span className="text-gray-400 font-normal text-xs">kcal</span>
              </span>
            </div>

            {/* Time */}
            <p className="text-xs text-gray-400 mb-2">{meal.time}</p>

            {/* Macros */}
            <div className="flex gap-6 text-xs text-gray-400">
              <span className="tabular-nums">P {meal.protein}g</span>
              <span className="tabular-nums">C {meal.carbs}g</span>
              <span className="tabular-nums">F {meal.fat}g</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
