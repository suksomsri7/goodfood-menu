"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MacroCardProps {
  label: string;
  current: number;
  target: number;
  color: "red" | "blue" | "yellow";
  delay?: number;
}

const colorMap = {
  red: {
    stroke: "#EF5350",
    track: "#FFEBEE",
    text: "text-[#EF5350]",
  },
  blue: {
    stroke: "#42A5F5",
    track: "#E3F2FD",
    text: "text-[#42A5F5]",
  },
  yellow: {
    stroke: "#FFCA28",
    track: "#FFF8E1",
    text: "text-[#F9A825]",
  },
};

export function MacroCard({
  label,
  current,
  target,
  color,
  delay = 0,
}: MacroCardProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const circumference = 2 * Math.PI * 38;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const colors = colorMap[color];

  return (
    <motion.div
      className="flex flex-col items-center py-4 px-2 bg-white rounded-2xl border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      {/* Circular progress */}
      <div className="relative w-20 h-20 mb-3">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
          {/* Background circle */}
          <circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            stroke={colors.track}
            strokeWidth="6"
          />
          {/* Progress circle */}
          <motion.circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#3D4A3D]">{target}</span>
          <span className="text-xs text-[#8B9B8B]">g</span>
        </div>
      </div>

      {/* Label - No icon, Thai text */}
      <span className={cn("text-sm font-bold", colors.text)}>{label}</span>

      {/* Progress text */}
      <span className="text-xs text-[#8B9B8B] mt-1">
        ({current}/{target})
      </span>
    </motion.div>
  );
}
