"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Target, ArrowRight, Sparkles } from "lucide-react";

interface WelcomeBackModalProps {
  isOpen: boolean;
  displayName?: string;
  onSetNewGoal: () => void;
  onSkip: () => void;
}

export function WelcomeBackModal({
  isOpen,
  displayName,
  onSetNewGoal,
  onSkip,
}: WelcomeBackModalProps) {
  if (!isOpen) return null;

  const name = displayName || "คุณ";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onSkip}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 px-6 pt-8 pb-12 text-center">
            {/* Close button */}
            <button
              onClick={onSkip}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Sparkle decoration */}
            <div className="relative inline-flex items-center justify-center mb-4">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 bg-white/20 rounded-full blur-xl"
              />
              <div className="relative bg-white/20 rounded-full p-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              ยินดีต้อนรับกลับ!
            </h2>
            <p className="text-white/90 text-lg">
              {name}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-6 -mt-6 bg-white rounded-t-3xl relative">
            <div className="text-center mb-6">
              <p className="text-gray-600 leading-relaxed">
                เรารอคุณอยู่นะ! พร้อมที่จะกลับมาดูแลสุขภาพด้วยกันหรือยัง?
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSetNewGoal}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all"
              >
                <Target className="w-5 h-5" />
                ตั้งเป้าหมายใหม่
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSkip}
                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                ข้าม
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Motivational text */}
            <p className="text-center text-sm text-gray-400 mt-4">
              ทุกก้าวเล็กๆ นำไปสู่การเปลี่ยนแปลงที่ยิ่งใหญ่
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
