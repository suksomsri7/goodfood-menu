"use client";

import { Lightbulb } from "lucide-react";

interface RecommendationCardProps {
  message?: string;
}

export function RecommendationCard({ 
  message = "คุณยังเหลือแคลอรี่อีก 257 Kcal วันนี้ลองเพิ่มผักและโปรตีนเพื่อให้ครบโภชนาการ" 
}: RecommendationCardProps) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Lightbulb className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}
