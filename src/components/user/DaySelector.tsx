"use client";

import { format, addDays, subDays, isToday } from "date-fns";
import { th } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DaySelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function DaySelector({ selectedDate, onDateChange }: DaySelectorProps) {
  const goToPreviousDay = () => {
    onDateChange(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const getDateLabel = () => {
    if (isToday(selectedDate)) {
      return "Today";
    }
    return format(selectedDate, "d MMM", { locale: th });
  };

  return (
    <div className="flex items-center justify-center py-6">
      <button
        onClick={goToPreviousDay}
        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
      </button>

      <span className="mx-8 text-sm font-medium text-gray-800 tracking-wide">
        {getDateLabel()}
      </span>

      <button
        onClick={goToNextDay}
        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
