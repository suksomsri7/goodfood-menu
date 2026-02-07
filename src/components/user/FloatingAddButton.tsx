"use client";

import { useState } from "react";
import { Plus, Camera, Barcode, PenLine, Package, Dumbbell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ManualEntryModal } from "./ManualEntryModal";
import { CameraModal } from "./CameraModal";
import { StockModal } from "./StockModal";
import { BarcodeModal } from "./BarcodeModal";
import { ExerciseModal } from "./ExerciseModal";

interface DailyNutrition {
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  target: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface FloatingAddButtonProps {
  lineUserId?: string;
  dailyNutrition?: DailyNutrition;
  onAddMeal?: (meal: {
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
  }) => void;
  onAddExercise?: (exercise: {
    name: string;
    type: string;
    duration: number;
    calories: number;
    intensity: string;
    note?: string;
  }) => void;
}

export function FloatingAddButton({ lineUserId, dailyNutrition, onAddMeal, onAddExercise }: FloatingAddButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showExercise, setShowExercise] = useState(false);

  const options = [
    { icon: Dumbbell, label: "ออกกำลังกาย", action: () => setShowExercise(true), color: "text-orange-500" },
    { icon: Package, label: "คลังอาหาร", action: () => setShowStock(true) },
    { icon: Barcode, label: "สแกนบาร์โค้ด", action: () => setShowBarcode(true) },
    { icon: Camera, label: "ถ่ายรูปอาหาร", action: () => setShowCamera(true) },
    { icon: PenLine, label: "กรอกเอง", action: () => setShowManualEntry(true) },
  ];

  const handleSaveMeal = (meal: {
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
    onAddMeal?.(meal);
    setShowManualEntry(false);
    setShowCamera(false);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Options */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
            {options.map((option, index) => (
              <motion.button
                key={option.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: (options.length - 1 - index) * 0.05 }}
                onClick={() => {
                  setIsOpen(false);
                  option.action();
                }}
              >
                <div className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <option.icon className={`w-5 h-5 ${"color" in option ? option.color : "text-gray-700"}`} strokeWidth={1.5} />
                </div>
                <span className="text-sm text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm">
                  {option.label}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={1.5} />
      </motion.button>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        onSave={handleSaveMeal}
      />

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onSave={handleSaveMeal}
      />

      {/* Stock Modal */}
      <StockModal
        isOpen={showStock}
        onClose={() => setShowStock(false)}
        lineUserId={lineUserId}
        dailyNutrition={dailyNutrition}
        onSelectItem={() => {
          // StockModal already creates the meal via POST /api/meals
          // Just close the stock modal; no need to call onAddMeal again
          setShowStock(false);
        }}
      />

      {/* Barcode Modal */}
      <BarcodeModal
        isOpen={showBarcode}
        onClose={() => setShowBarcode(false)}
        onSave={handleSaveMeal}
      />

      {/* Exercise Modal */}
      <ExerciseModal
        isOpen={showExercise}
        onClose={() => setShowExercise(false)}
        onSave={(exercise) => {
          onAddExercise?.(exercise);
          setShowExercise(false);
        }}
      />
    </>
  );
}
