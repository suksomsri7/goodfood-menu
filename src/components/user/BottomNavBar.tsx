"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, PieChart, UtensilsCrossed, Camera, Barcode, PenLine, Package, Dumbbell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiff } from "@/components/providers/LiffProvider";
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

export function BottomNavBar() {
  const { profile } = useLiff();
  const lineUserId = profile?.userId;
  
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showExercise, setShowExercise] = useState(false);
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition | null>(null);

  // Fetch daily nutrition data
  const fetchDailyNutrition = useCallback(async () => {
    if (!lineUserId) return;

    try {
      // Get member goals
      const memberRes = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
      if (!memberRes.ok) return;
      const memberData = await memberRes.json();

      // Get today's meals
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const tzOffset = today.getTimezoneOffset();
      
      const mealsRes = await fetch(`/api/meals?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`);
      if (!mealsRes.ok) return;
      const meals = await mealsRes.json();

      const consumed = meals.reduce(
        (acc: any, meal: any) => ({
          calories: acc.calories + (meal.calories || 0),
          protein: acc.protein + (meal.protein || 0),
          carbs: acc.carbs + (meal.carbs || 0),
          fat: acc.fat + (meal.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      const target = {
        calories: memberData.dailyCalories || 2000,
        protein: memberData.dailyProtein || 150,
        carbs: memberData.dailyCarbs || 250,
        fat: memberData.dailyFat || 65,
      };

      setDailyNutrition({
        consumed,
        target,
        remaining: {
          calories: target.calories - consumed.calories,
          protein: target.protein - consumed.protein,
          carbs: target.carbs - consumed.carbs,
          fat: target.fat - consumed.fat,
        },
      });
    } catch (error) {
      console.error("Failed to fetch nutrition:", error);
    }
  }, [lineUserId]);

  // Fetch nutrition when modal opens
  useEffect(() => {
    if ((showStock || showManualEntry || showCamera || showBarcode) && lineUserId) {
      fetchDailyNutrition();
    }
  }, [showStock, showManualEntry, showCamera, showBarcode, lineUserId, fetchDailyNutrition]);

  const options = [
    { icon: Dumbbell, label: "ออกกำลังกาย", action: () => setShowExercise(true), color: "text-orange-500" },
    { icon: Package, label: "Stock", action: () => setShowStock(true) },
    { icon: Barcode, label: "Scan barcode", action: () => setShowBarcode(true) },
    { icon: Camera, label: "Take photo", action: () => setShowCamera(true) },
    { icon: PenLine, label: "Manual entry", action: () => setShowManualEntry(true) },
  ];

  const handleSaveMeal = async (meal: {
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
    if (!lineUserId) return;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BottomNavBar.tsx:handleSaveMeal',message:'Creating meal inside BottomNavBar.handleSaveMeal',data:{mealName:meal.name,calories:meal.calories},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
      // #endregion
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          ...meal,
        }),
      });

      // Close modals
      setShowManualEntry(false);
      setShowCamera(false);
      setShowBarcode(false);

      // Redirect to /cal to see the added meal
      if (pathname !== "/cal") {
        router.push("/cal");
      } else {
        // Trigger page refresh if already on /cal
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to save meal:", error);
    }
  };

  const handleSaveExercise = async (exercise: {
    name: string;
    type: string;
    duration: number;
    calories: number;
    intensity: string;
    note?: string;
  }) => {
    if (!lineUserId) return;

    try {
      await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          ...exercise,
        }),
      });

      setShowExercise(false);

      // Redirect to /cal to see the added exercise
      if (pathname !== "/cal") {
        router.push("/cal");
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to save exercise:", error);
    }
  };

  const isCalActive = pathname === "/cal";
  const isMenuActive = pathname === "/menu";

  return (
    <>
      {/* Backdrop for FAB menu */}
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

      {/* FAB Options */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
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
                <div className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <option.icon className={`w-5 h-5 ${"color" in option ? option.color : "text-gray-700"}`} strokeWidth={1.5} />
                </div>
                <span className="text-sm text-gray-700 bg-white px-4 py-2 rounded-full shadow-lg">
                  {option.label}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Background bar */}
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <div className="flex items-center justify-around h-16 px-6">
            {/* Cal button */}
            <button
              onClick={() => router.push("/cal")}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors ${
                isCalActive ? "text-green-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <PieChart className="w-6 h-6" strokeWidth={isCalActive ? 2 : 1.5} />
              <span className="text-xs font-medium">Cal</span>
            </button>

            {/* Spacer for center button */}
            <div className="w-16" />

            {/* Menu button */}
            <button
              onClick={() => router.push("/menu")}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors ${
                isMenuActive ? "text-green-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UtensilsCrossed className="w-6 h-6" strokeWidth={isMenuActive ? 2 : 1.5} />
              <span className="text-xs font-medium">สั่งอาหาร</span>
            </button>
          </div>
        </div>

        {/* Center FAB button - positioned above the bar */}
        <motion.button
          className="absolute left-1/2 -translate-x-1/2 -top-7 w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center shadow-lg border-4 border-white"
          onClick={() => setIsOpen(!isOpen)}
          whileTap={{ scale: 0.95 }}
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2} />
        </motion.button>
      </div>

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
        lineUserId={lineUserId || ""}
        dailyNutrition={dailyNutrition || undefined}
        onSelectItem={async (item) => {
          await handleSaveMeal({
            name: item.name,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            sodium: 0,
            sugar: 0,
            multiplier: item.multiplier,
          });
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
        onSave={handleSaveExercise}
      />
    </>
  );
}
