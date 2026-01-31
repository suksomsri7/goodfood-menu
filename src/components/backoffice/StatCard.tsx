"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: "primary" | "blue" | "orange" | "red" | "purple";
}

const colorMap = {
  primary: {
    bg: "bg-primary-50",
    icon: "bg-primary-500",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-500",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "bg-orange-500",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-500",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-500",
  },
};

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  color,
}: StatCardProps) {
  const isPositive = change && change > 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  isPositive ? "text-green-500" : "text-red-500"
                )}
              >
                {isPositive ? "+" : ""}{change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-gray-400">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        
        <div className={cn("p-3 rounded-xl", colorMap[color].icon)}>
          <div className="text-white">{icon}</div>
        </div>
      </div>
    </div>
  );
}
