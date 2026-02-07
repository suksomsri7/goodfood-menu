"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Plus, Minus } from "lucide-react";

interface RingData {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  bgColor: string;
}

interface FitnessRingsProps {
  calories: { current: number; target: number };
  water: { current: number; target: number };
  onAddWater: (amount: number) => Promise<void>;
}

const WATER_OPTIONS = [100, 200, 250, 500];

export function FitnessRings({
  calories,
  water,
  onAddWater,
}: FitnessRingsProps) {
  const [isWaterModalOpen, setIsWaterModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [customAmount, setCustomAmount] = useState(250);

  const rings: RingData[] = [
    {
      label: "แคลอรี่",
      current: calories.current,
      target: calories.target,
      unit: "kcal",
      color: "#FF2D55",
      bgColor: "rgba(255, 45, 85, 0.12)",
    },
    {
      label: "น้ำ",
      current: water.current,
      target: water.target,
      unit: "ml",
      color: "#00AAFF",
      bgColor: "rgba(0, 170, 255, 0.12)",
    },
  ];

  const radii = [78, 60];
  const strokeWidth = 14;
  const size = 190;
  const center = size / 2;

  const handleAddWater = async (amount: number) => {
    setIsAdding(true);
    try {
      await onAddWater(amount);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl p-5 mx-6 mb-6"
      >
        <div className="flex items-center gap-5">
          {/* Rings SVG */}
          <button
            onClick={() => setIsWaterModalOpen(true)}
            className="relative flex-shrink-0 active:scale-95 transition-transform"
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90"
            >
              {/* Background rings */}
              {rings.map((ring, i) => (
                <circle
                  key={`bg-${i}`}
                  cx={center}
                  cy={center}
                  r={radii[i]}
                  fill="none"
                  stroke={ring.bgColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              ))}

              {/* Progress rings */}
              {rings.map((ring, i) => {
                const circumference = 2 * Math.PI * radii[i];
                const percentage = Math.min(ring.current / ring.target, 1);
                const offset = circumference - percentage * circumference;

                return (
                  <motion.circle
                    key={`progress-${i}`}
                    cx={center}
                    cy={center}
                    r={radii[i]}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{
                      duration: 1.2,
                      delay: 0.15 * i,
                      ease: "easeOut",
                    }}
                  />
                );
              })}

              {/* Overflow glow for >100% */}
              {rings.map((ring, i) => {
                if (ring.current <= ring.target) return null;
                const circumference = 2 * Math.PI * radii[i];
                const overflowPct = Math.min(
                  (ring.current - ring.target) / ring.target,
                  1
                );
                const offset =
                  circumference - overflowPct * circumference;

                return (
                  <motion.circle
                    key={`overflow-${i}`}
                    cx={center}
                    cy={center}
                    r={radii[i]}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    opacity={0.35}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{
                      duration: 1,
                      delay: 1.2 + 0.15 * i,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
            </svg>

            {/* Center tap hint */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <Droplets className="w-5 h-5 text-blue-400 mb-0.5" />
                <span className="text-[10px] text-gray-400">+ น้ำ</span>
              </div>
            </div>
          </button>

          {/* Legend */}
          <div className="flex-1 space-y-4">
            {rings.map((ring, i) => {
              const pct = Math.round(
                (ring.current / ring.target) * 100
              );
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: ring.color,
                      boxShadow: `0 0 6px ${ring.color}50`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">
                        {ring.label}
                      </span>
                      <span className="text-xs font-medium text-gray-600 tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">
                      {ring.current.toLocaleString()}
                      <span className="text-gray-400 font-normal">
                        {" "}/ {ring.target.toLocaleString()} {ring.unit}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Water Modal */}
      <AnimatePresence>
        {isWaterModalOpen && (
          <div className="fixed inset-0 z-[60]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsWaterModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-24"
            >
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                  <Droplets className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  บันทึกการดื่มน้ำ
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  วันนี้ดื่มไปแล้ว {water.current} / {water.target} ml
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min((water.current / water.target) * 100, 100)}%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  {Math.round((water.current / water.target) * 100)}%
                  ของเป้าหมาย
                </p>
              </div>

              {/* Quick Add Options */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {WATER_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAddWater(amount)}
                    disabled={isAdding}
                    className="py-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700 font-semibold transition-colors disabled:opacity-50"
                  >
                    +{amount}
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-600 mb-3 text-center">
                  หรือกำหนดเอง
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() =>
                      setCustomAmount(Math.max(50, customAmount - 50))
                    }
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {customAmount}
                    </p>
                    <p className="text-xs text-gray-500">ml</p>
                  </div>
                  <button
                    onClick={() => setCustomAmount(customAmount + 50)}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={() => {
                  handleAddWater(customAmount);
                  setIsWaterModalOpen(false);
                }}
                disabled={isAdding}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isAdding
                  ? "กำลังบันทึก..."
                  : `เพิ่ม ${customAmount} ml`}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
