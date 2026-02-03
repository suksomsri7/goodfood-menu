"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Plus, Minus } from "lucide-react";

interface WaterIntakeButtonProps {
  current: number;
  target: number;
  onAddWater: (amount: number) => Promise<void>;
}

const WATER_OPTIONS = [100, 200, 250, 500];

export function WaterIntakeButton({
  current,
  target,
  onAddWater,
}: WaterIntakeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [customAmount, setCustomAmount] = useState(250);

  const percentage = Math.min((current / target) * 100, 100);

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
      {/* Water Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex-1 relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 hover:border-cyan-300 transition-colors group"
      >
        {/* Progress Background */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-cyan-200/50 transition-all duration-500"
          style={{ height: `${percentage}%` }}
        />

        <div className="relative flex flex-col items-center">
          <Droplets className="w-5 h-5 text-cyan-500 mb-1" />
          <p className="text-xs font-semibold text-cyan-700">
            {current} / {target}
          </p>
          <p className="text-[10px] text-cyan-600">ml</p>
          <p className="text-[9px] text-cyan-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            + เพิ่มน้ำ
          </p>
        </div>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-10"
            >
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-3 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Droplets className="w-8 h-8 text-cyan-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">บันทึกการดื่มน้ำ</h3>
                <p className="text-gray-500 text-sm mt-1">
                  วันนี้ดื่มไปแล้ว {current} / {target} ml
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  {percentage.toFixed(0)}% ของเป้าหมาย
                </p>
              </div>

              {/* Quick Add Options */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {WATER_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAddWater(amount)}
                    disabled={isAdding}
                    className="py-3 bg-cyan-50 hover:bg-cyan-100 rounded-xl text-cyan-700 font-semibold transition-colors disabled:opacity-50"
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
                    onClick={() => setCustomAmount(Math.max(50, customAmount - 50))}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{customAmount}</p>
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
                  setIsOpen(false);
                }}
                disabled={isAdding}
                className="w-full py-4 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-50"
              >
                {isAdding ? "กำลังบันทึก..." : `เพิ่ม ${customAmount} ml`}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
