"use client";

import { useState } from "react";

interface Food {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

interface SelectedItem {
  food: Food;
  dayNumber: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  quantity: number;
}

interface Props {
  items: SelectedItem[];
  totalDays: number;
  coursePlan: string;
  onClose: () => void;
  onRemoveItem: (index: number) => void;
  onSubmit: () => void;
}

const mealLabels = {
  breakfast: { icon: "🌅", label: "มื้อเช้า" },
  lunch: { icon: "☀️", label: "มื้อกลางวัน" },
  dinner: { icon: "🌙", label: "มื้อเย็น" },
  snack: { icon: "🍎", label: "ของว่าง" },
};

const planLabels: Record<string, string> = {
  "7_DAYS": "แพ็คเกจ 7 วัน",
  "15_DAYS": "แพ็คเกจ 15 วัน",
  "30_DAYS": "แพ็คเกจ 30 วัน",
  "CUSTOM": "แพ็คเกจกำหนดเอง",
};

export function OrderSummary({ items, totalDays, coursePlan, onClose, onRemoveItem, onSubmit }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const total = items.reduce((sum, item) => sum + item.food.price * item.quantity, 0);
  
  // Group by day
  const groupedByDay = items.reduce((acc, item, index) => {
    const day = item.dayNumber;
    if (!acc[day]) acc[day] = [];
    acc[day].push({ ...item, index });
    return acc;
  }, {} as Record<number, (SelectedItem & { index: number })[]>);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] bg-white rounded-t-3xl overflow-hidden animate-slide-up shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">🛒 รายการสั่งซื้อ</h2>
            <p className="text-sm text-gray-500">
              {planLabels[coursePlan] || coursePlan} • {totalDays} วัน • {items.length} รายการ
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <span className="text-gray-500 text-lg">✕</span>
          </button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto max-h-[50vh] px-6 py-4">
          {Object.keys(groupedByDay).length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl">🛒</span>
              <p className="text-gray-500 mt-4">ยังไม่มีรายการ</p>
            </div>
          ) : (
            Object.entries(groupedByDay)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, dayItems]) => (
                <div key={day} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white py-1">
                    <span className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">
                      {day}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">วันที่ {day}</span>
                    <span className="text-xs text-gray-400">({dayItems.length} เมนู)</span>
                  </div>
                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <div
                        key={item.index}
                        className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 group hover:border-primary-200 transition-colors"
                      >
                        <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 shadow-sm">
                          {item.food.imageUrl ? (
                            <img 
                              src={item.food.imageUrl} 
                              alt={item.food.name} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-2xl">
                              🍽️
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{item.food.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <span>{mealLabels[item.mealType].icon}</span>
                            <span>{mealLabels[item.mealType].label}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-primary-600">฿{item.food.price}</p>
                          <button
                            onClick={() => onRemoveItem(item.index)}
                            className="text-xs text-gray-400 hover:text-accent-red transition-colors"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-5 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm text-gray-500">รวมทั้งหมด</span>
              <p className="text-xs text-gray-400">{items.length} รายการ</p>
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              ฿{total.toLocaleString()}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={items.length === 0 || isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-semibold shadow-lg shadow-primary-200/50 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังสั่งซื้อ...</span>
              </>
            ) : (
              <>
                <span>ยืนยันสั่งซื้อ</span>
                <span>🎉</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
