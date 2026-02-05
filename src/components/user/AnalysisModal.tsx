"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, Target, Lightbulb } from "lucide-react";

interface AnalysisData {
  summary?: string | string[] | null;
  goalAnalysis?: string | string[] | null;
  recommendations?: string | string[] | null;
}

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalysisData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

// Helper function to render content that could be string or array
function renderContent(content: string | string[] | undefined | null): React.ReactNode {
  // Handle null, undefined, empty string
  if (!content) return null;
  
  // Handle array
  if (Array.isArray(content)) {
    if (content.length === 0) return null;
    return (
      <ul className="space-y-2">
        {content.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>{String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  
  // Handle string
  if (typeof content === 'string') {
    return <p className="whitespace-pre-line">{content}</p>;
  }
  
  // Handle object (in case AI returns nested object)
  if (typeof content === 'object') {
    try {
      return <p className="whitespace-pre-line">{JSON.stringify(content)}</p>;
    } catch {
      return null;
    }
  }
  
  return null;
}

export function AnalysisModal({
  isOpen,
  onClose,
  analysis,
  isLoading,
  onRefresh,
}: AnalysisModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-hidden"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">AI วิเคราะห์สุขภาพ</h2>
                <p className="text-xs text-gray-500">ผลวิเคราะห์ประจำวัน</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 pb-24 overflow-y-auto max-h-[calc(85vh-80px)]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-500 text-sm">กำลังวิเคราะห์ข้อมูล...</p>
                <p className="text-gray-400 text-xs mt-1">อาจใช้เวลาสักครู่</p>
              </div>
            ) : analysis ? (
              <div className="space-y-6">
                {/* Summary Section */}
                {analysis.summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Brain className="w-4 h-4 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-purple-900">📊 สรุปผล</h3>
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      {renderContent(analysis.summary)}
                    </div>
                  </motion.div>
                )}

                {/* Goal Analysis Section */}
                {analysis.goalAnalysis && (Array.isArray(analysis.goalAnalysis) ? analysis.goalAnalysis.length > 0 : true) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-blue-900">🎯 วิเคราะห์จากเป้าหมาย</h3>
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      {renderContent(analysis.goalAnalysis)}
                    </div>
                  </motion.div>
                )}

                {/* Recommendations Section */}
                {analysis.recommendations && (Array.isArray(analysis.recommendations) ? analysis.recommendations.length > 0 : true) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-amber-600" />
                      </div>
                      <h3 className="font-semibold text-amber-900">💡 คำแนะนำ</h3>
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      {renderContent(analysis.recommendations)}
                    </div>
                  </motion.div>
                )}
                
                {/* Fallback if no content */}
                {!analysis.summary && !analysis.goalAnalysis && !analysis.recommendations && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">ไม่มีข้อมูลการวิเคราะห์</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-gray-500 text-sm">ไม่สามารถวิเคราะห์ข้อมูลได้</p>
                <button
                  onClick={onRefresh}
                  className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold"
            >
              ปิด
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
