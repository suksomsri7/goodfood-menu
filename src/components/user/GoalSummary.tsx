"use client";

import { motion } from "framer-motion";
import {
  Target,
  Flame,
  Dumbbell,
  Droplets,
} from "lucide-react";

interface Goal {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  icon: "weight" | "calories" | "exercise" | "water";
  color: string;
  streak?: number;
}

interface GoalSummaryProps {
  goals: Goal[];
  daysToGoal?: number;
  achievements?: number;
}

const iconMap = {
  weight: Target,
  calories: Flame,
  exercise: Dumbbell,
  water: Droplets,
};

export function GoalSummary({
  goals,
  daysToGoal = 45,
}: GoalSummaryProps) {
  const completedGoals = goals.filter((g) => g.current >= g.target).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="bg-white rounded-2xl p-6 border border-slate-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-900">สรุปเป้าหมาย</h3>
          <p className="text-sm text-slate-500">
            {completedGoals}/{goals.length} บรรลุแล้ว
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-slate-900">{daysToGoal}</p>
          <p className="text-xs text-slate-500">วันถึงเป้า</p>
        </div>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {goals.map((goal, index) => {
          const Icon = iconMap[goal.icon];
          const progress = Math.min(100, (goal.current / goal.target) * 100);
          const isCompleted = goal.current >= goal.target;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="flex items-center gap-4"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${goal.color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: goal.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">
                    {goal.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {goal.current}/{goal.target} {goal.unit}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.05 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: goal.color }}
                  />
                </div>
              </div>
              {isCompleted && (
                <span className="text-emerald-500 text-xs">✓</span>
              )}
            </motion.div>
          );
        })}
      </div>

    </motion.div>
  );
}
