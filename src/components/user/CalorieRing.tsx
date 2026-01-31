"use client";

import { motion } from "framer-motion";

interface CalorieRingProps {
  remaining: number;
  consumed: number;
  burnt: number;
  target: number;
}

export function CalorieRing({ remaining, consumed, burnt, target }: CalorieRingProps) {
  const percentage = Math.min((consumed / target) * 100, 100);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      {/* Consumed */}
      <div className="flex flex-col items-center flex-1">
        <span className="text-2xl font-light text-gray-900 tabular-nums">
          {consumed.toLocaleString()}
        </span>
        <span className="text-[10px] text-gray-400 mt-2 tracking-widest uppercase">Consumed</span>
      </div>

      {/* Ring */}
      <div className="relative w-36 h-36 mx-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#f5f5f5"
            strokeWidth="6"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-light text-gray-900 tabular-nums">
            {remaining.toLocaleString()}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 tracking-widest uppercase">Kcal</span>
        </div>
      </div>

      {/* Burned */}
      <div className="flex flex-col items-center flex-1">
        <span className="text-2xl font-light text-gray-900 tabular-nums">
          {burnt}
        </span>
        <span className="text-[10px] text-gray-400 mt-2 tracking-widest uppercase">Burned</span>
      </div>
    </div>
  );
}
