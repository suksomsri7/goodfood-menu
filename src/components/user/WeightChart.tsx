"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingDown, TrendingUp, X } from "lucide-react";

interface WeightData {
  date: string;
  weight: number;
  label?: string;
}

interface WeightChartProps {
  data: WeightData[];
  targetWeight: number;
  currentWeight: number;
  startWeight: number;
  onUpdateWeight?: (weight: number) => void;
  // External control for modal
  showUpdateModal?: boolean;
  onCloseUpdateModal?: () => void;
  hideInternalButton?: boolean;
}

export function WeightChart({
  data,
  targetWeight,
  currentWeight,
  startWeight,
  onUpdateWeight,
  showUpdateModal,
  onCloseUpdateModal,
  hideInternalButton = false,
}: WeightChartProps) {
  const [internalShowModal, setInternalShowModal] = useState(false);
  const [inputWeight, setInputWeight] = useState(currentWeight.toString());

  // Use external control if provided, otherwise use internal state
  const showModal = showUpdateModal !== undefined ? showUpdateModal : internalShowModal;
  const setShowModal = (value: boolean) => {
    if (showUpdateModal !== undefined) {
      if (!value && onCloseUpdateModal) {
        onCloseUpdateModal();
      }
    } else {
      setInternalShowModal(value);
    }
  };

  const weightDiff = startWeight - currentWeight;
  const isLosing = weightDiff > 0;
  const progressPercent = Math.min(
    100,
    Math.abs((weightDiff / (startWeight - targetWeight)) * 100)
  );

  const minWeight = Math.min(...data.map((d) => d.weight), targetWeight) - 2;
  const maxWeight = Math.max(...data.map((d) => d.weight), startWeight) + 2;

  const handleSave = () => {
    const weight = parseFloat(inputWeight);
    if (!isNaN(weight) && weight > 0) {
      onUpdateWeight?.(weight);
      setShowModal(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl p-6 border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">น้ำหนักปัจจุบัน</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-slate-900">{currentWeight}</span>
              <span className="text-slate-400">kg</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                isLosing 
                  ? "bg-rose-50 text-rose-600" 
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              {isLosing ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              <span>
                {isLosing ? "-" : "+"}
                {Math.abs(weightDiff).toFixed(1)} kg
              </span>
            </div>
          </div>
        </div>

        {/* Update Button (can be hidden when controlled externally) */}
        {!hideInternalButton && (
          <button
            onClick={() => {
              setInputWeight(currentWeight.toString());
              setShowModal(true);
            }}
            className="w-full mb-6 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-600 transition-colors"
          >
            อัพเดทน้ำหนักปัจจุบัน
          </button>
        )}

        {/* Chart */}
        <div className="h-44 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 5, left: -25, bottom: 5 }}
            >
              <XAxis
                dataKey="label"
                stroke="#cbd5e1"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[minWeight, maxWeight]}
                stroke="#cbd5e1"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${value} kg`, "น้ำหนัก"]}
              />
              <ReferenceLine
                y={targetWeight}
                stroke="#94a3b8"
                strokeDasharray="4 4"
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: "#059669" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">ความคืบหน้า</span>
            <span className="font-medium text-slate-700">
              {progressPercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-rose-500 rounded-full"
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>เริ่ม {startWeight} kg</span>
            <span>เป้า {targetWeight} kg</span>
          </div>
        </div>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/40 z-50"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm"
            >
              <div className="bg-white rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-slate-900">อัพเดทน้ำหนัก</h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Input */}
                <div className="mb-6">
                  <label className="block text-sm text-slate-500 mb-2">
                    น้ำหนักของคุณ (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputWeight}
                    onChange={(e) => setInputWeight(e.target.value)}
                    className="w-full px-4 py-3 text-2xl font-semibold text-center border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    placeholder="0.0"
                    autoFocus
                  />
                </div>

                {/* Quick Adjust */}
                <div className="flex gap-2 mb-6">
                  {[-0.5, -0.1, 0.1, 0.5].map((adj) => (
                    <button
                      key={adj}
                      onClick={() => {
                        const current = parseFloat(inputWeight) || 0;
                        setInputWeight((current + adj).toFixed(1));
                      }}
                      className="flex-1 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {adj > 0 ? "+" : ""}{adj}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm font-medium text-white transition-colors"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
