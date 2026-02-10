"use client";

import { format, addDays, subDays, isToday } from "date-fns";
import { th } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Target, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface DaySelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  showGoalIcon?: boolean;
  onHelpClick?: () => void;
}

export function DaySelector({ selectedDate, onDateChange, showGoalIcon = false, onHelpClick }: DaySelectorProps) {
  const router = useRouter();
  
  const goToPreviousDay = () => {
    onDateChange(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const getDateLabel = () => {
    if (isToday(selectedDate)) {
      return "วันนี้";
    }
    return format(selectedDate, "d MMM", { locale: th });
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-4">
        {/* Help Icon - Left */}
        {onHelpClick ? (
          <button
            onClick={onHelpClick}
            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
            aria-label="คู่มือการใช้งาน"
          >
            <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ) : (
          <div className="w-10" />
        )}

        {/* Date Navigation - Center */}
        <div className="flex items-center gap-3">
          <button
            onClick={goToPreviousDay}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <span className="text-sm font-medium text-gray-800 tracking-wide min-w-[80px] text-center">
            {getDateLabel()}
          </span>

          <button
            onClick={goToNextDay}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Goal Icon - Right */}
        {showGoalIcon ? (
          <button
            onClick={() => router.push("/goal")}
            className="p-2 text-gray-500 hover:text-green-600 transition-colors"
          >
            <Target className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </div>
  );
}
