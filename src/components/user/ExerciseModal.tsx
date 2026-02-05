"use client";

import { useState } from "react";
import { X, Flame, Clock, Dumbbell, ChevronDown } from "lucide-react";

interface ExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exercise: {
    name: string;
    type: string;
    duration: number;
    calories: number;
    intensity: string;
    note?: string;
  }) => void;
}

const EXERCISE_TYPES = [
  { category: "คาร์ดิโอ", exercises: ["วิ่ง", "เดินเร็ว", "ปั่นจักรยาน", "ว่ายน้ำ", "กระโดดเชือก", "เต้นแอโรบิค", "เดินขึ้นบันได"] },
  { category: "เวทเทรนนิ่ง", exercises: ["ยกน้ำหนัก", "วิดพื้น", "สควอท", "แพลงค์"] },
  { category: "กีฬา", exercises: ["แบดมินตัน", "เทนนิส", "บาสเกตบอล", "ฟุตบอล"] },
  { category: "ยืดหยุ่น", exercises: ["โยคะ", "ยืดเหยียด"] },
];

const CALORIES_PER_MINUTE: Record<string, number> = {
  "วิ่ง": 10,
  "เดินเร็ว": 5,
  "ปั่นจักรยาน": 8,
  "ว่ายน้ำ": 9,
  "กระโดดเชือก": 12,
  "เต้นแอโรบิค": 7,
  "เดินขึ้นบันได": 8,
  "ยกน้ำหนัก": 6,
  "วิดพื้น": 7,
  "สควอท": 6,
  "แพลงค์": 4,
  "แบดมินตัน": 7,
  "เทนนิส": 8,
  "บาสเกตบอล": 8,
  "ฟุตบอล": 9,
  "โยคะ": 3,
  "ยืดเหยียด": 2,
};

const INTENSITY_LABELS: Record<string, string> = {
  low: "เบา",
  moderate: "ปานกลาง",
  high: "หนัก",
};

export function ExerciseModal({ isOpen, onClose, onSave }: ExerciseModalProps) {
  const [selectedExercise, setSelectedExercise] = useState("");
  const [customExercise, setCustomExercise] = useState("");
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState("moderate");
  const [note, setNote] = useState("");
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const exerciseName = selectedExercise || customExercise || "";
  
  // Calculate estimated calories
  const calculateCalories = () => {
    const baseRate = CALORIES_PER_MINUTE[exerciseName] || 5;
    let multiplier = 1;
    if (intensity === "low") multiplier = 0.8;
    if (intensity === "high") multiplier = 1.3;
    return Math.round(baseRate * duration * multiplier);
  };

  const estimatedCalories = calculateCalories();

  const handleSubmit = async () => {
    if (!exerciseName || duration <= 0) return;

    setIsSubmitting(true);
    
    const exerciseType = EXERCISE_TYPES.find(t => 
      t.exercises.includes(exerciseName)
    )?.category || "อื่นๆ";

    onSave({
      name: exerciseName,
      type: exerciseType,
      duration,
      calories: estimatedCalories,
      intensity,
      note: note || undefined,
    });

    // Reset form
    setSelectedExercise("");
    setCustomExercise("");
    setDuration(30);
    setIntensity("moderate");
    setNote("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setSelectedExercise("");
    setCustomExercise("");
    setDuration(30);
    setIntensity("moderate");
    setNote("");
    setShowExerciseList(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">บันทึกการออกกำลังกาย</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Exercise Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Dumbbell className="w-4 h-4 inline mr-1" />
              ประเภทการออกกำลังกาย
            </label>
            
            {/* Selected/Custom Input */}
            <div 
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white cursor-pointer flex items-center justify-between"
              onClick={() => setShowExerciseList(!showExerciseList)}
            >
              <span className={selectedExercise ? "text-gray-900" : "text-gray-400"}>
                {selectedExercise || "เลือกการออกกำลังกาย"}
              </span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showExerciseList ? "rotate-180" : ""}`} />
            </div>

            {/* Exercise List Dropdown */}
            {showExerciseList && (
              <div className="mt-2 border border-gray-200 rounded-xl bg-white max-h-48 overflow-y-auto">
                {EXERCISE_TYPES.map((group) => (
                  <div key={group.category}>
                    <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0">
                      {group.category}
                    </div>
                    {group.exercises.map((exercise) => (
                      <button
                        key={exercise}
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                          selectedExercise === exercise ? "bg-green-50 text-green-600" : "text-gray-700"
                        }`}
                        onClick={() => {
                          setSelectedExercise(exercise);
                          setCustomExercise("");
                          setShowExerciseList(false);
                        }}
                      >
                        {exercise}
                        <span className="text-xs text-gray-400 ml-2">
                          ~{CALORIES_PER_MINUTE[exercise]} kcal/นาที
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Custom Exercise Input */}
            <div className="mt-3">
              <input
                type="text"
                value={customExercise}
                onChange={(e) => {
                  setCustomExercise(e.target.value);
                  setSelectedExercise("");
                }}
                placeholder="หรือพิมพ์ชื่อการออกกำลังกาย..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              ระยะเวลา (นาที)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-center"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 นาที</span>
              <span>180 นาที</span>
            </div>
          </div>

          {/* Intensity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ความหนัก
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "moderate", "high"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setIntensity(level)}
                  className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                    intensity === level
                      ? level === "low" 
                        ? "bg-blue-100 text-blue-600 border-2 border-blue-300"
                        : level === "moderate"
                        ? "bg-yellow-100 text-yellow-600 border-2 border-yellow-300"
                        : "bg-red-100 text-red-600 border-2 border-red-300"
                      : "bg-gray-100 text-gray-600 border-2 border-transparent"
                  }`}
                >
                  {INTENSITY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Calories */}
          {exerciseName && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">แคลอรี่ที่เผาผลาญ (โดยประมาณ)</span>
                </div>
                <span className="text-2xl font-bold text-orange-500">
                  {estimatedCalories} <span className="text-sm font-normal">kcal</span>
                </span>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              บันทึกเพิ่มเติม (ไม่บังคับ)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น วิ่งที่สวนลุม, ออกกำลังกายที่ฟิตเนส..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button
            onClick={handleSubmit}
            disabled={!exerciseName || duration <= 0 || isSubmitting}
            className="w-full py-3.5 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
