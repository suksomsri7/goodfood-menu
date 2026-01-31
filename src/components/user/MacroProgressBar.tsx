"use client";

import { motion } from "framer-motion";

interface MacroProgressBarProps {
  label: string;
  current: number;
  target: number;
  color: string;
  delay?: number;
}

export function MacroProgressBar({
  label,
  current,
  target,
  color,
  delay = 0,
}: MacroProgressBarProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOver = current > target;

  return (
    <motion.div
      className="flex flex-col items-center flex-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
    >
      <span className="text-xs text-gray-400 mb-4 tracking-wide">{label}</span>
      
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: delay + 0.2, ease: "easeOut" }}
        />
      </div>
      
      <span className={`text-xs mt-4 tabular-nums ${isOver ? 'text-red-400' : 'text-gray-500'}`}>
        {current} / {target} g
      </span>
    </motion.div>
  );
}
