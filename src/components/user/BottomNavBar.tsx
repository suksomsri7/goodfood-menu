"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Plus, Camera, Barcode, PenLine, Dumbbell } from "lucide-react";
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
  const searchParams = useSearchParams();
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

  // Auto-open modal from URL query param (for LIFF Rich Menu)
  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;

    switch (action) {
      case "barcode":
        setShowBarcode(true);
        break;
      case "camera":
        setShowCamera(true);
        break;
      case "manual":
        setShowManualEntry(true);
        break;
      case "exercise":
        setShowExercise(true);
        break;
      case "stock":
        setShowStock(true);
        break;
    }

    // Clean up URL query param
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const options = [
    { icon: Dumbbell, label: "ออกกำลังกาย", action: () => setShowExercise(true), color: "text-orange-500" },
    { icon: Barcode, label: "สแกนบาร์โค้ด", action: () => setShowBarcode(true) },
    { icon: Camera, label: "ถ่ายรูปอาหาร", action: () => setShowCamera(true) },
    { icon: PenLine, label: "กรอกเอง", action: () => setShowManualEntry(true) },
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

      {/* FAB Options - anchored above FAB button at bottom-right */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3">
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
                <span className="text-sm text-gray-700 bg-white px-4 py-2 rounded-full shadow-lg">
                  {option.label}
                </span>
                <div className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <option.icon className={`w-5 h-5 ${"color" in option ? option.color : "text-gray-700"}`} strokeWidth={1.5} />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* FAB button - bottom right */}
      <motion.button
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
        data-guide="fab-button"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2} />
      </motion.button>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        onSave={handleSaveMeal}
        lineUserId={lineUserId}
      />

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onSave={handleSaveMeal}
        lineUserId={lineUserId}
      />

      {/* Stock Modal */}
      <StockModal
        isOpen={showStock}
        onClose={() => setShowStock(false)}
        lineUserId={lineUserId || ""}
        dailyNutrition={dailyNutrition || undefined}
        onSelectItem={() => {
          // StockModal already creates the meal via POST /api/meals
          // So we only need to close and refresh here
          setShowStock(false);
          // Redirect to /cal to see the added meal
          if (pathname !== "/cal") {
            router.push("/cal");
          } else {
            window.location.reload();
          }
        }}
      />

      {/* Barcode Modal */}
      <BarcodeModal
        isOpen={showBarcode}
        onClose={() => setShowBarcode(false)}
        onSave={handleSaveMeal}
        lineUserId={lineUserId}
      />

      {/* Exercise Modal */}
      <ExerciseModal
        isOpen={showExercise}
        onClose={() => setShowExercise(false)}
        onSave={handleSaveExercise}
        lineUserId={lineUserId}
      />
    </>
  );
}
