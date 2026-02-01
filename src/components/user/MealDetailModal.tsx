"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Beef, Wheat, Droplets, Clock, Scale, Info, FlaskConical, Candy } from "lucide-react";

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
  description?: string;
}

interface MealDetailModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (mealId: string) => void;
}

export function MealDetailModal({ meal, isOpen, onClose, onDelete }: MealDetailModalProps) {
  if (!meal) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 bottom-4 z-50 bg-white rounded-3xl overflow-hidden max-h-[85vh]"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">รายละเอียดอาหาร</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
              {/* Food Image & Name */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">🍽️</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{meal.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {meal.weight && (
                      <span className="flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5" />
                        {meal.weight}g
                      </span>
                    )}
                    {meal.multiplier && meal.multiplier !== 1 && (
                      <span className="text-red-400 font-medium">×{meal.multiplier}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {meal.time}
                    </span>
                  </div>
                </div>
              </div>

              {/* Calories */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-gray-600">แคลอรี่</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{meal.calories} <span className="text-sm font-normal text-gray-500">kcal</span></span>
                </div>
              </div>

              {/* Macros - Row 1 */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {/* Protein */}
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <Beef className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">โปรตีน</p>
                  <p className="text-lg font-semibold text-gray-900">{meal.protein}g</p>
                </div>

                {/* Carbs */}
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <Wheat className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">คาร์บ</p>
                  <p className="text-lg font-semibold text-gray-900">{meal.carbs}g</p>
                </div>

                {/* Fat */}
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <Droplets className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">ไขมัน</p>
                  <p className="text-lg font-semibold text-gray-900">{meal.fat}g</p>
                </div>
              </div>

              {/* Macros - Row 2 (Sodium & Sugar) */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Sodium */}
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <FlaskConical className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">โซเดียม</p>
                  <p className="text-lg font-semibold text-gray-900">{meal.sodium || 0}mg</p>
                </div>

                {/* Sugar */}
                <div className="bg-pink-50 rounded-xl p-3 text-center">
                  <Candy className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">น้ำตาล</p>
                  <p className="text-lg font-semibold text-gray-900">{meal.sugar || 0}g</p>
                </div>
              </div>

              {/* Description/Notes Box */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">รายละเอียด</p>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {meal.description || meal.ingredients || `${meal.name} - บันทึกเมื่อเวลา ${meal.time} น. ${meal.weight ? `น้ำหนัก ${meal.weight} กรัม` : ""} ${meal.multiplier && meal.multiplier !== 1 ? `จำนวน ${meal.multiplier} หน่วย` : ""}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => onDelete?.(meal.id)}
                className="w-full py-3 px-4 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors"
              >
                ลบรายการนี้
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
