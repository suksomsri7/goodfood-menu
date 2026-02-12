"use client";

import { Sparkles, RefreshCw } from "lucide-react";

interface RecommendationCardProps {
  message?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function RecommendationCard({
  message,
  isLoading = false,
  onRefresh,
}: RecommendationCardProps) {
  return (
    <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-4 border border-red-100">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-red-700">
              AI แนะนำสำหรับคุณ
            </span>
            {onRefresh && !isLoading && (
              <button
                onClick={onRefresh}
                className="p-1 text-red-500 hover:text-red-700 transition-colors"
                title="วิเคราะห์ใหม่"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-red-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-red-100 rounded animate-pulse w-3/4" />
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              {message || "กำลังวิเคราะห์ข้อมูลของคุณ..."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
