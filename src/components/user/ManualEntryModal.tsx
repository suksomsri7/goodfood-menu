"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, Minus, Sparkles, AlertTriangle } from "lucide-react";
import { sendMessage, isInClient, closeWindow } from "@/lib/liff";

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineUserId?: string;
  onSave: (meal: {
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
  }) => void;
}

export function ManualEntryModal({ isOpen, onClose, onSave, lineUserId }: ManualEntryModalProps) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [sodium, setSodium] = useState("");
  const [sugar, setSugar] = useState("");
  const [weight, setWeight] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");

  const handleAiAnalyze = async () => {
    if (!name) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-food-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ingredients,
          weight: weight ? Number(weight) : undefined,
          quantity: multiplier,
          lineUserId,
        }),
      });

      const result = await res.json();
      
      // Check for limit reached
      if (result.limitReached) {
        setLimitMessage(result.error || "ถึงขีดจำกัดการใช้งาน AI วันนี้แล้ว");
        setShowLimitModal(true);
        return;
      }

      if (res.ok && result.data) {
        if (result.data) {
          setCalories(String(result.data.calories || ""));
          setProtein(String(result.data.protein || ""));
          setCarbs(String(result.data.carbs || ""));
          setFat(String(result.data.fat || ""));
          setSodium(String(result.data.sodium || ""));
          setSugar(String(result.data.sugar || ""));
        }
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    if (!name || !calories) return;

    onSave({
      name,
      calories: Number(calories) * multiplier,
      protein: Number(protein || 0) * multiplier,
      carbs: Number(carbs || 0) * multiplier,
      fat: Number(fat || 0) * multiplier,
      sodium: Number(sodium || 0) * multiplier,
      sugar: Number(sugar || 0) * multiplier,
      weight: weight ? Number(weight) : undefined,
      multiplier,
      ingredients: ingredients || undefined,
    });

    // Reset form
    setName("");
    setIngredients("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSodium("");
    setSugar("");
    setWeight("");
    setMultiplier(1);
    onClose();
  };

  const adjustMultiplier = (delta: number) => {
    setMultiplier(Math.max(0.5, Math.min(10, multiplier + delta)));
  };

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
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl overflow-hidden max-h-[90vh]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">เพิ่มอาหาร</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Search/Name Input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ชื่ออาหาร"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              {/* Ingredients Input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-1">ส่วนประกอบ</label>
                <textarea
                  placeholder="เช่น ข้าว, ไข่ดาว, หมูสับ, ผักบุ้ง..."
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                />
              </div>

              {/* Weight Input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-1">น้ำหนัก (กรัม)</label>
                <input
                  type="number"
                  placeholder="เช่น 150"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              {/* Multiplier */}
              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-2">จำนวน</label>
                <div className="flex items-center justify-center gap-6 bg-gray-50 rounded-xl py-3">
                  <button
                    onClick={() => adjustMultiplier(-0.5)}
                    className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-2xl font-semibold text-gray-900 min-w-[60px] text-center">
                    ×{multiplier}
                  </span>
                  <button
                    onClick={() => adjustMultiplier(0.5)}
                    className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* AI Analyze Button */}
              <div className="mb-6">
                <button
                  onClick={handleAiAnalyze}
                  disabled={!name || isAnalyzing}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังวิเคราะห์...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>AI วิเคราะห์สารอาหาร</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  วิเคราะห์จากชื่อ ส่วนประกอบ และน้ำหนักที่กรอก
                </p>
              </div>

              {/* Nutrition Info */}
              <div className="mb-6">
                <label className="block text-sm text-gray-500 mb-3">ข้อมูลโภชนาการ (ต่อหน่วย)</label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Calories */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-orange-600 mb-1">แคลอรี่</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={calories}
                        onChange={(e) => setCalories(e.target.value)}
                        className="w-full px-4 py-3 bg-orange-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">kcal</span>
                    </div>
                  </div>

                  {/* Protein */}
                  <div>
                    <label className="block text-xs font-medium text-red-600 mb-1">โปรตีน</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={protein}
                        onChange={(e) => setProtein(e.target.value)}
                        className="w-full px-4 py-3 bg-red-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                    </div>
                  </div>

                  {/* Carbs */}
                  <div>
                    <label className="block text-xs font-medium text-yellow-600 mb-1">คาร์โบไฮเดรต</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={carbs}
                        onChange={(e) => setCarbs(e.target.value)}
                        className="w-full px-4 py-3 bg-yellow-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                    </div>
                  </div>

                  {/* Fat */}
                  <div>
                    <label className="block text-xs font-medium text-blue-600 mb-1">ไขมัน</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={fat}
                        onChange={(e) => setFat(e.target.value)}
                        className="w-full px-4 py-3 bg-blue-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                    </div>
                  </div>

                  {/* Sodium */}
                  <div>
                    <label className="block text-xs font-medium text-purple-600 mb-1">โซเดียม</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={sodium}
                        onChange={(e) => setSodium(e.target.value)}
                        className="w-full px-4 py-3 bg-purple-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">mg</span>
                    </div>
                  </div>

                  {/* Sugar */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-pink-600 mb-1">น้ำตาล</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={sugar}
                        onChange={(e) => setSugar(e.target.value)}
                        className="w-full px-4 py-3 bg-pink-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {calories && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-xs text-gray-500 mb-2">ผลรวมที่จะบันทึก</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">{name || "อาหาร"} ×{multiplier}</span>
                    <span className="font-semibold text-gray-900">{Math.round(Number(calories) * multiplier)} kcal</span>
                  </div>
                  {ingredients && (
                    <p className="text-xs text-gray-400 mt-2 truncate">ส่วนประกอบ: {ingredients}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={!name || !calories}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                บันทึก
              </button>
            </div>
          </motion.div>

          {/* Limit Reached Modal */}
          <AnimatePresence>
            {showLimitModal && (
              <motion.div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="absolute inset-0 bg-black/60"
                  onClick={() => setShowLimitModal(false)}
                />
                <motion.div
                  className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      ถึงขีดจำกัดการใช้งานแล้ว
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">
                      {limitMessage}
                    </p>
                    <button
                      onClick={async () => {
                        const message = "วิธีเพิ่ม Limit การใช้งาน";
                        try {
                          const success = await sendMessage(message);
                          if (success) {
                            if (isInClient()) {
                              closeWindow();
                            } else {
                              setShowLimitModal(false);
                            }
                          }
                        } catch (error) {
                          console.error("Error:", error);
                        }
                      }}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg mb-3"
                    >
                      วิธีเพิ่ม Limit การใช้งาน
                    </button>
                    <button
                      onClick={() => setShowLimitModal(false)}
                      className="text-gray-500 text-sm"
                    >
                      ปิด
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
