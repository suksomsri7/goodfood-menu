"use client";

import { Utensils, Flame } from "lucide-react";

interface CalorieGaugeProps {
  consumed: number;
  burnt: number;
  target: number;
}

export function CalorieGauge({ consumed, burnt, target }: CalorieGaugeProps) {
  const remaining = Math.max(0, target - consumed + burnt);
  const percentage = Math.min(100, ((consumed - burnt) / target) * 100);
  
  // SVG arc calculation
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI; // Half circle
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Consumed */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mb-2">
            <Utensils className="w-6 h-6 text-primary-600" />
          </div>
          <span className="text-sm text-primary-600 font-medium">Consumed</span>
          <span className="text-xl font-bold text-gray-800">{consumed}</span>
        </div>

        {/* Gauge */}
        <div className="relative flex flex-col items-center">
          <svg
            height={radius + 20}
            width={radius * 2 + 20}
            className="transform -rotate-0"
          >
            {/* Background arc */}
            <path
              d={`M ${strokeWidth / 2 + 10} ${radius + 10} 
                  A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - strokeWidth / 2 + 10} ${radius + 10}`}
              fill="none"
              stroke="#E8F5E9"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d={`M ${strokeWidth / 2 + 10} ${radius + 10} 
                  A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - strokeWidth / 2 + 10} ${radius + 10}`}
              fill="none"
              stroke="#4CAF50"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute top-8 flex flex-col items-center">
            <span className="text-4xl font-bold text-gray-800">{remaining}</span>
            <span className="text-sm text-gray-500">Remaining Kcal</span>
          </div>
        </div>

        {/* Burnt */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-2">
            <Flame className="w-6 h-6 text-green-500" />
          </div>
          <span className="text-sm text-green-600 font-medium">Burnt</span>
          <span className="text-xl font-bold text-gray-800">{burnt}</span>
        </div>
      </div>
    </div>
  );
}
