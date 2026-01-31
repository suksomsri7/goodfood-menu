"use client";

import { cn } from "@/lib/utils";

interface MacroCardProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: "protein" | "carbs" | "fat";
  icon: string;
}

const colorMap = {
  protein: {
    ring: "stroke-red-500",
    bg: "bg-red-50",
    text: "text-red-500",
  },
  carbs: {
    ring: "stroke-blue-400",
    bg: "bg-blue-50",
    text: "text-blue-500",
  },
  fat: {
    ring: "stroke-yellow-400",
    bg: "bg-yellow-50",
    text: "text-yellow-500",
  },
};

export function MacroCard({ label, current, target, unit, color, icon }: MacroCardProps) {
  const percentage = Math.min(100, (current / target) * 100);
  const radius = 40;
  const strokeWidth = 6;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center">
      {/* Circular Progress */}
      <div className="relative mb-2">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90">
          {/* Background circle */}
          <circle
            stroke="#F3F4F6"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <circle
            className={cn(colorMap[color].ring, "transition-all duration-1000 ease-out")}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-bold", colorMap[color].text)}>{target}</span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1">
        <span>{icon}</span>
        <span className="font-semibold text-gray-700">{label}</span>
      </div>
      
      {/* Current / Target */}
      <span className="text-sm text-gray-400">({current}/{target})</span>
    </div>
  );
}
