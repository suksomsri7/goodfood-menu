"use client";

import { Flame, Clock, Trash2 } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  type?: string;
  duration: number;
  calories: number;
  intensity?: string;
  note?: string;
  time: string;
}

interface ExerciseListProps {
  exercises: Exercise[];
  onDelete?: (id: string) => void;
}

const INTENSITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-600",
  moderate: "bg-yellow-100 text-yellow-600",
  high: "bg-red-100 text-red-600",
};

const INTENSITY_LABELS: Record<string, string> = {
  low: "เบา",
  moderate: "ปานกลาง",
  high: "หนัก",
};

export function ExerciseList({ exercises, onDelete }: ExerciseListProps) {
  if (exercises.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💪</span>
        <h3 className="font-semibold text-gray-800">การออกกำลังกาย</h3>
      </div>
      
      {exercises.map((exercise) => (
        <div
          key={exercise.id}
          className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-4 border border-orange-100"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">{exercise.name}</h4>
                {exercise.intensity && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${INTENSITY_COLORS[exercise.intensity] || "bg-gray-100 text-gray-600"}`}>
                    {INTENSITY_LABELS[exercise.intensity] || exercise.intensity}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {exercise.duration} นาที
                </span>
                <span>{exercise.time}</span>
              </div>
              {exercise.note && (
                <p className="text-xs text-gray-400 mt-1">{exercise.note}</p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1 text-orange-500">
                  <Flame className="w-4 h-4" />
                  <span className="font-semibold">{exercise.calories}</span>
                </div>
                <span className="text-xs text-gray-400">kcal</span>
              </div>
              
              {onDelete && (
                <button
                  onClick={() => onDelete(exercise.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
