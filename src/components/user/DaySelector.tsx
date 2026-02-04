"use client";

import { format, addDays, subDays, isToday } from "date-fns";
import { th } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Target, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface DaySelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  cartCount?: number;
}

export function DaySelector({ selectedDate, onDateChange, cartCount = 0 }: DaySelectorProps) {
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
    <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-4">
        {/* Goal Icon - Left */}
        <Link href="/goal" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Target className="w-5 h-5" strokeWidth={1.5} />
        </Link>

        {/* Date Navigation */}
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

        {/* Shopping Cart Icon - Right */}
        <Link href="/menu" className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <ShoppingCart className="w-5 h-5" strokeWidth={1.5} />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
