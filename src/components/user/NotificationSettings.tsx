"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  Sun,
  Moon,
  Utensils,
  Droplets,
  Camera,
  Dumbbell,
  TrendingUp,
  Clock,
  Play,
  Sparkles,
  Calendar,
  Rocket,
  RefreshCw,
} from "lucide-react";

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  lineUserId: string | undefined;
}

interface Settings {
  morningCoach: boolean;
  eveningSummary: boolean;
  weeklyInsights: boolean;
  lunchSuggestion: boolean;
  dinnerSuggestion: boolean;
  waterReminder: boolean;
  progressPhoto: boolean;
  postExercise: boolean;
  pausedUntil: string | null;
}

interface Schedule {
  morningCoachTime: string;
  lunchReminderTime: string;
  dinnerReminderTime: string;
  eveningSummaryTime: string;
  waterReminderTimes: string[];
  weeklyInsightsTime: string;
}

interface CourseProgress {
  currentDay: number;
  totalDays: number;
  progress: number;
  isActive: boolean;
}

interface MemberType {
  id: string;
  name: string;
  courseDuration?: number;
}

export function NotificationSettings({
  isOpen,
  onClose,
  lineUserId,
}: NotificationSettingsProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [course, setCourse] = useState<CourseProgress | null>(null);
  const [memberType, setMemberType] = useState<MemberType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (isOpen && lineUserId) {
      fetchSettings();
    }
  }, [isOpen, lineUserId]);

  const fetchSettings = async () => {
    if (!lineUserId) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/member/notification-settings?lineUserId=${lineUserId}`
      );
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSchedule(data.schedule);
        setCourse(data.course);
        setMemberType(data.memberType);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    if (!lineUserId || !settings) return;

    // Optimistic update
    setSettings({ ...settings, [key]: value });

    try {
      const res = await fetch(
        `/api/member/notification-settings?lineUserId=${lineUserId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        }
      );

      if (!res.ok) {
        // Revert on error
        setSettings({ ...settings, [key]: !value });
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      setSettings({ ...settings, [key]: !value });
    }
  };

  const startCourse = async (startDate: string) => {
    if (!lineUserId) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/member/notification-settings?lineUserId=${lineUserId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseStartDate: startDate }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
        setMemberType(data.memberType);
        setShowDatePicker(false);
        setSelectedDate("");
      }
    } catch (error) {
      console.error("Error starting course:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetCourse = async () => {
    if (!lineUserId) return;
    if (!confirm("ต้องการรีเซ็ตคอร์สใช่หรือไม่? ความคืบหน้าจะถูกล้าง")) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/member/notification-settings?lineUserId=${lineUserId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseStartDate: null }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
      }
    } catch (error) {
      console.error("Error resetting course:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const settingItems = [
    {
      key: "morningCoach" as const,
      icon: Sun,
      label: "กำลังใจตอนเช้า",
      description: schedule ? `เวลา ${schedule.morningCoachTime}` : "",
      color: "text-amber-500",
      bgColor: "bg-amber-100",
    },
    {
      key: "lunchSuggestion" as const,
      icon: Utensils,
      label: "แนะนำมื้อกลางวัน",
      description: schedule ? `เวลา ${schedule.lunchReminderTime}` : "",
      color: "text-orange-500",
      bgColor: "bg-orange-100",
    },
    {
      key: "dinnerSuggestion" as const,
      icon: Utensils,
      label: "แนะนำมื้อเย็น",
      description: schedule ? `เวลา ${schedule.dinnerReminderTime}` : "",
      color: "text-red-500",
      bgColor: "bg-red-100",
    },
    {
      key: "eveningSummary" as const,
      icon: Moon,
      label: "สรุปท้ายวัน",
      description: schedule ? `เวลา ${schedule.eveningSummaryTime}` : "",
      color: "text-indigo-500",
      bgColor: "bg-indigo-100",
    },
    {
      key: "waterReminder" as const,
      icon: Droplets,
      label: "เตือนดื่มน้ำ",
      description: schedule
        ? `${schedule.waterReminderTimes.length} ครั้ง/วัน`
        : "",
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
    {
      key: "weeklyInsights" as const,
      icon: TrendingUp,
      label: "Insights สัปดาห์",
      description: "ทุก 7 วัน",
      color: "text-purple-500",
      bgColor: "bg-purple-100",
    },
    {
      key: "progressPhoto" as const,
      icon: Camera,
      label: "เตือนถ่ายรูปความคืบหน้า",
      description: "ทุก 7 วัน",
      color: "text-pink-500",
      bgColor: "bg-pink-100",
    },
    {
      key: "postExercise" as const,
      icon: Dumbbell,
      label: "แนะนำหลังออกกำลังกาย",
      description: "หลังบันทึกการออกกำลังกาย",
      color: "text-green-500",
      bgColor: "bg-green-100",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      AI Coach
                    </h2>
                    <p className="text-sm text-gray-500">ตั้งค่าการแจ้งเตือน</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Course Progress - Active Course */}
              {course && course.isActive && (
                <div className="mt-4 p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700">
                      คอร์ส {course.totalDays} วัน
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600">
                        วันที่ {course.currentDay}/{course.totalDays}
                      </span>
                      <button
                        onClick={resetCourse}
                        disabled={isSaving}
                        className="p-1 hover:bg-green-200 rounded transition-colors"
                        title="รีเซ็ตคอร์ส"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-green-600" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-green-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Course Completed */}
              {course && !course.isActive && (
                <div className="mt-4 p-3 bg-amber-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-amber-700">
                        🎉 คอร์สเสร็จสิ้นแล้ว!
                      </span>
                      <p className="text-xs text-amber-600 mt-1">
                        คุณสามารถเริ่มคอร์สใหม่ได้
                      </p>
                    </div>
                    <button
                      onClick={resetCourse}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                    >
                      เริ่มใหม่
                    </button>
                  </div>
                </div>
              )}

              {/* No Course Started Yet - But Has Member Type */}
              {!course && memberType && (
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Rocket className="w-5 h-5 text-purple-500" />
                    <span className="font-medium text-purple-700">
                      พร้อมเริ่มคอร์ส {memberType.name}
                    </span>
                  </div>
                  
                  {!showDatePicker ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => startCourse(getTodayDate())}
                        disabled={isSaving}
                        className="w-full py-2.5 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            เริ่มคอร์สวันนี้
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowDatePicker(true)}
                        className="w-full py-2 text-purple-600 text-sm hover:bg-purple-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        เลือกวันเริ่มเอง
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDatePicker(false)}
                          className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => selectedDate && startCourse(selectedDate)}
                          disabled={!selectedDate || isSaving}
                          className="flex-1 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                          {isSaving ? "กำลังบันทึก..." : "เริ่มคอร์ส"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] pb-8">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-green-200 border-t-green-500 rounded-full animate-spin" />
                </div>
              ) : !memberType ? (
                /* No Member Type - Show contact admin message */
                <div className="p-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      เปิดระบบ AI Coach
                    </h3>
                    <p className="text-gray-500 mb-4">
                      สอบถามแอดมินเพื่อเปิดใช้งาน AI Coach
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
                      <Bell className="w-4 h-4" />
                      รอการกำหนดจากแอดมิน
                    </div>
                  </div>
                </div>
              ) : settings ? (
                <div className="p-6 space-y-6">
                  {/* Settings List */}
                  <div className="space-y-3">
                    {settingItems.map((item) => (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between p-4 rounded-2xl transition-colors ${
                          settings[item.key] ? "bg-white border border-gray-100" : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              settings[item.key] ? item.bgColor : "bg-gray-200"
                            }`}
                          >
                            <item.icon
                              className={`w-5 h-5 ${
                                settings[item.key] ? item.color : "text-gray-400"
                              }`}
                            />
                          </div>
                          <div>
                            <p
                              className={`font-medium ${
                                settings[item.key] ? "text-gray-800" : "text-gray-500"
                              }`}
                            >
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-sm text-gray-400">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => updateSetting(item.key, !settings[item.key])}
                          className={`relative w-12 h-7 rounded-full transition-colors ${
                            settings[item.key] ? "bg-green-500" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              settings[item.key] ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Schedule Info */}
                  {schedule && (
                    <div className="p-4 bg-blue-50 rounded-2xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700">
                          ตารางเวลาแจ้งเตือน
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-600">
                          🌅 เช้า: {schedule.morningCoachTime}
                        </div>
                        <div className="text-gray-600">
                          🍽️ กลางวัน: {schedule.lunchReminderTime}
                        </div>
                        <div className="text-gray-600">
                          🍽️ เย็น: {schedule.dinnerReminderTime}
                        </div>
                        <div className="text-gray-600">
                          🌙 สรุป: {schedule.eveningSummaryTime}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        💧 น้ำ: {schedule.waterReminderTimes.join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">ไม่สามารถโหลดข้อมูลได้</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
