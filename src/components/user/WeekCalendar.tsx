"use client";

import { useState } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {format(selectedDate, "MMMM yyyy", { locale: th })}
        </h2>
        <button className="p-2 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors">
          <Calendar className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex gap-2">
        {days.map((day, index) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          
          return (
            <button
              key={index}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex-1 py-3 px-2 rounded-xl transition-all duration-200",
                "flex flex-col items-center gap-1",
                isSelected 
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" 
                  : isToday 
                    ? "bg-primary-100 text-primary-700"
                    : "bg-primary-50 text-gray-600 hover:bg-primary-100"
              )}
            >
              <span className="text-xs font-medium">{DAYS_EN[index]}</span>
              <span className={cn(
                "text-lg font-bold",
                isSelected ? "text-white" : "text-gray-800"
              )}>
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
