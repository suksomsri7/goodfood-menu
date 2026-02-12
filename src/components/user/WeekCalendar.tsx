"use client";

import { useState } from "react";
import { addDays, format, startOfWeek, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function WeekCalendar({ selectedDate, onSelectDate }: WeekCalendarProps) {
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  
  // Start from Sunday, show 7 days (Sun-Sat)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1" />
        <button
          onClick={() => setShowFullCalendar(!showFullCalendar)}
          className="w-10 h-10 rounded-2xl bg-[#FEF2F2] flex items-center justify-center"
        >
          <Calendar className="w-5 h-5 text-[#5C6B5C]" />
        </button>
      </div>

      <div className="flex justify-between gap-1.5">
        {days.map((day, index) => {
          const isSelected = isSameDay(day, selectedDate);

          return (
            <motion.button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex flex-col items-center py-3 px-1.5 rounded-2xl flex-1 min-w-[40px]",
                isSelected
                  ? "bg-[#EF4444] text-white"
                  : "bg-[#FEF2F2] text-gray-700"
              )}
              whileTap={{ scale: 0.95 }}
            >
              <span
                className={cn(
                  "text-xs font-semibold mb-1",
                  isSelected ? "text-white/80" : "text-[#8B9B8B]"
                )}
              >
                {dayLabels[index]}
              </span>
              <span
                className={cn(
                  "text-lg font-bold",
                  isSelected ? "text-white" : "text-[#3D4A3D]"
                )}
              >
                {format(day, "d")}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
