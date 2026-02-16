"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, Minus, Brain, Loader2, CheckCircle, ThumbsUp, AlertCircle, ShieldAlert, PenLine } from "lucide-react";
import { LimitReachedModal } from "./LimitReachedModal";

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

type TabMode = "ai" | "manual";

export function ManualEntryModal({ isOpen, onClose, onSave, lineUserId }: ManualEntryModalProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("ai");

  // Shared fields
  const [name, setName] = useState("");
  const [multiplier, setMultiplier] = useState(1);

  // AI tab fields
  const [aiIngredients, setAiIngredients] = useState("");
  const [aiWeight, setAiWeight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    sodium: string;
    sugar: string;
  } | null>(null);
  const [coaching, setCoaching] = useState<{
    verdict: string;
    verdictText: string;
    reason: string;
    impact: string;
    suggestion: string;
  } | null>(null);

  // Manual tab fields
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [sodium, setSodium] = useState("");
  const [sugar, setSugar] = useState("");
  const [manualWeight, setManualWeight] = useState("");
  const [manualIngredients, setManualIngredients] = useState("");

  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ limit?: number; used?: number }>({});

  const handleAiAnalyze = async () => {
    if (!name) return;
    
    setIsAnalyzing(true);
    setCoaching(null);
    setAiResult(null);
    try {
      const res = await fetch("/api/analyze-food-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ingredients: aiIngredients,
          weight: aiWeight ? Number(aiWeight) : undefined,
          quantity: multiplier,
          lineUserId,
        }),
      });

      const result = await res.json();
      
      if (result.limitReached) {
        setLimitInfo({ limit: result.limit, used: result.used });
        setShowLimitModal(true);
        return;
      }

      if (res.ok && result.data) {
        setAiResult({
          calories: String(result.data.calories || ""),
          protein: String(result.data.protein || ""),
          carbs: String(result.data.carbs || ""),
          fat: String(result.data.fat || ""),
          sodium: String(result.data.sodium || ""),
          sugar: String(result.data.sugar || ""),
        });

        if (result.data.coaching) {
          setCoaching(result.data.coaching);
        }
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    const isAi = activeTab === "ai";
    const cal = isAi ? (aiResult?.calories || "") : calories;
    const pro = isAi ? (aiResult?.protein || "") : protein;
    const carb = isAi ? (aiResult?.carbs || "") : carbs;
    const f = isAi ? (aiResult?.fat || "") : fat;
    const sod = isAi ? (aiResult?.sodium || "") : sodium;
    const sug = isAi ? (aiResult?.sugar || "") : sugar;
    const w = isAi ? aiWeight : manualWeight;
    const ing = isAi ? aiIngredients : manualIngredients;

    if (!name || !cal) return;

    onSave({
      name,
      calories: Number(cal) * multiplier,
      protein: Number(pro || 0) * multiplier,
      carbs: Number(carb || 0) * multiplier,
      fat: Number(f || 0) * multiplier,
      sodium: Number(sod || 0) * multiplier,
      sugar: Number(sug || 0) * multiplier,
      weight: w ? Number(w) : undefined,
      multiplier,
      ingredients: ing || undefined,
    });

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName("");
    setMultiplier(1);
    setAiIngredients("");
    setAiWeight("");
    setAiResult(null);
    setCoaching(null);
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSodium("");
    setSugar("");
    setManualWeight("");
    setManualIngredients("");
  };

  const adjustMultiplier = (delta: number) => {
    setMultiplier(Math.max(0.5, Math.min(10, multiplier + delta)));
  };

  const canSubmit = activeTab === "ai"
    ? !!(name && aiResult?.calories)
    : !!(name && calories);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[90vh] flex flex-col"
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

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab("ai")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === "ai"
                    ? "text-amber-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Brain className="w-4 h-4" />
                AI Coach วิเคราะห์
                {activeTab === "ai" && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === "manual"
                    ? "text-gray-800"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <PenLine className="w-4 h-4" />
                กรอกเอง
                {activeTab === "manual" && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800"
                  />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 min-h-0">
              {/* Shared: Food Name */}
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

              {/* =================== AI Coach Tab =================== */}
              {activeTab === "ai" && (
                <>
                  {/* Ingredients */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">ส่วนประกอบ</label>
                    <textarea
                      placeholder="เช่น ข้าว, ไข่ดาว, หมูสับ, ผักบุ้ง..."
                      value={aiIngredients}
                      onChange={(e) => setAiIngredients(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                    />
                  </div>

                  {/* Weight */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">น้ำหนัก (กรัม)</label>
                    <input
                      type="number"
                      placeholder="เช่น 150"
                      value={aiWeight}
                      onChange={(e) => setAiWeight(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>

                  {/* Multiplier */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-2">จำนวน</label>
                    <div className="flex items-center justify-center gap-6 bg-gray-50 rounded-xl py-3">
                      <button onClick={() => adjustMultiplier(-0.5)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Minus className="w-5 h-5 text-gray-600" />
                      </button>
                      <span className="text-2xl font-semibold text-gray-900 min-w-[60px] text-center">×{multiplier}</span>
                      <button onClick={() => adjustMultiplier(0.5)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Plus className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* AI Coach Button */}
                  <button
                    onClick={handleAiAnalyze}
                    disabled={!name || isAnalyzing}
                    className="w-full py-3 mb-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>AI Coach กำลังวิเคราะห์...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        <span>AI Coach วิเคราะห์สารอาหาร</span>
                      </>
                    )}
                  </button>

                  {/* Coaching Card */}
                  {coaching && (
                    <div className={`mb-5 rounded-xl overflow-hidden border ${
                      coaching.verdict === "GOOD" ? "border-green-200 bg-green-50" :
                      coaching.verdict === "OK" ? "border-blue-200 bg-blue-50" :
                      coaching.verdict === "CAUTION" ? "border-amber-200 bg-amber-50" :
                      "border-red-200 bg-red-50"
                    }`}>
                      <div className={`flex items-center gap-2 px-3 py-2 ${
                        coaching.verdict === "GOOD" ? "bg-green-100" :
                        coaching.verdict === "OK" ? "bg-blue-100" :
                        coaching.verdict === "CAUTION" ? "bg-amber-100" :
                        "bg-red-100"
                      }`}>
                        {coaching.verdict === "GOOD" ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : coaching.verdict === "OK" ? (
                          <ThumbsUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        ) : coaching.verdict === "CAUTION" ? (
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        ) : (
                          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                        )}
                        <span className={`font-bold text-sm ${
                          coaching.verdict === "GOOD" ? "text-green-700" :
                          coaching.verdict === "OK" ? "text-blue-700" :
                          coaching.verdict === "CAUTION" ? "text-amber-700" :
                          "text-red-700"
                        }`}>
                          AI Coach: {coaching.verdictText}
                        </span>
                      </div>
                      <div className="px-3 py-2.5 space-y-2">
                        {coaching.reason && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-0.5">เหตุผล</p>
                            <p className="text-sm text-gray-700">{coaching.reason}</p>
                          </div>
                        )}
                        {coaching.impact && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-0.5">ผลลัพธ์ถ้าทาน</p>
                            <p className="text-sm text-gray-700">{coaching.impact}</p>
                          </div>
                        )}
                        {coaching.suggestion && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-0.5">คำแนะนำจากโค้ช</p>
                            <p className="text-sm text-gray-800 font-medium">{coaching.suggestion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Result - Nutrition Summary */}
                  {aiResult && (
                    <div className="mb-5 bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-3 font-medium">ผลวิเคราะห์สารอาหาร (ต่อหน่วย)</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-orange-600">{aiResult.calories}</p>
                          <p className="text-[10px] text-gray-400">แคลอรี่</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-red-500">{aiResult.protein}g</p>
                          <p className="text-[10px] text-gray-400">โปรตีน</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-yellow-500">{aiResult.carbs}g</p>
                          <p className="text-[10px] text-gray-400">คาร์บ</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-blue-500">{aiResult.fat}g</p>
                          <p className="text-[10px] text-gray-400">ไขมัน</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-purple-500">{aiResult.sodium}</p>
                          <p className="text-[10px] text-gray-400">โซเดียม mg</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-pink-500">{aiResult.sugar}g</p>
                          <p className="text-[10px] text-gray-400">น้ำตาล</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {aiResult && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <p className="text-xs text-gray-500 mb-2">ผลรวมที่จะบันทึก</p>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">{name || "อาหาร"} ×{multiplier}</span>
                        <span className="font-semibold text-gray-900">{Math.round(Number(aiResult.calories) * multiplier)} kcal</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* =================== Manual Tab =================== */}
              {activeTab === "manual" && (
                <>
                  {/* Ingredients */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">ส่วนประกอบ</label>
                    <textarea
                      placeholder="เช่น ข้าว, ไข่ดาว, หมูสับ, ผักบุ้ง..."
                      value={manualIngredients}
                      onChange={(e) => setManualIngredients(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                    />
                  </div>

                  {/* Weight */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">น้ำหนัก (กรัม)</label>
                    <input
                      type="number"
                      placeholder="เช่น 150"
                      value={manualWeight}
                      onChange={(e) => setManualWeight(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>

                  {/* Multiplier */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-2">จำนวน</label>
                    <div className="flex items-center justify-center gap-6 bg-gray-50 rounded-xl py-3">
                      <button onClick={() => adjustMultiplier(-0.5)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Minus className="w-5 h-5 text-gray-600" />
                      </button>
                      <span className="text-2xl font-semibold text-gray-900 min-w-[60px] text-center">×{multiplier}</span>
                      <button onClick={() => adjustMultiplier(0.5)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Plus className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Nutrition Fields */}
                  <div className="mb-5">
                    <label className="block text-sm text-gray-500 mb-3">ข้อมูลโภชนาการ (ต่อหน่วย)</label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-orange-600 mb-1">แคลอรี่</label>
                        <div className="relative">
                          <input type="number" placeholder="0" value={calories} onChange={(e) => setCalories(e.target.value)} className="w-full px-4 py-3 bg-orange-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">kcal</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-600 mb-1">โปรตีน</label>
                        <div className="relative">
                          <input type="number" placeholder="0" value={protein} onChange={(e) => setProtein(e.target.value)} className="w-full px-4 py-3 bg-red-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-yellow-600 mb-1">คาร์โบไฮเดรต</label>
                        <div className="relative">
                          <input type="number" placeholder="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="w-full px-4 py-3 bg-yellow-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-200" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-600 mb-1">ไขมัน</label>
                        <div className="relative">
                          <input type="number" placeholder="0" value={fat} onChange={(e) => setFat(e.target.value)} className="w-full px-4 py-3 bg-blue-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-purple-600 mb-1">โซเดียม</label>
                        <div className="relative">
                          <input type="number" placeholder="0" value={sodium} onChange={(e) => setSodium(e.target.value)} className="w-full px-4 py-3 bg-purple-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">mg</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-pink-600 mb-1">น้ำตาล</label>
                        <div className="relative">
                          <input type="number" placeholder="0" value={sugar} onChange={(e) => setSugar(e.target.value)} className="w-full px-4 py-3 bg-pink-50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">g</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {calories && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <p className="text-xs text-gray-500 mb-2">ผลรวมที่จะบันทึก</p>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">{name || "อาหาร"} ×{multiplier}</span>
                        <span className="font-semibold text-gray-900">{Math.round(Number(calories) * multiplier)} kcal</span>
                      </div>
                      {manualIngredients && (
                        <p className="text-xs text-gray-400 mt-2 truncate">ส่วนประกอบ: {manualIngredients}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 p-4 border-t border-gray-100 pb-8 bg-white">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                ทานมื้อนี้
              </button>
            </div>
          </motion.div>

          <LimitReachedModal
            isOpen={showLimitModal}
            onClose={() => setShowLimitModal(false)}
            limitType="วิเคราะห์อาหารจากข้อความ"
            limitCount={limitInfo.limit}
            usedCount={limitInfo.used}
            lineUserId={lineUserId}
          />
        </>
      )}
    </AnimatePresence>
  );
}
