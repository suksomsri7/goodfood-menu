"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  Sun,
  Moon,
  Utensils,
  Camera,
  Dumbbell,
  TrendingUp,
  Clock,
  Sparkles,
  Calendar,
  AlertCircle,
  Infinity,
  Scale,
  MessageCircle,
  Power,
} from "lucide-react";
import { sendMessage, closeWindow, isInClient } from "@/lib/liff";

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
  progressPhoto: boolean;
  postExercise: boolean;
  weightReminder: boolean;
  pausedUntil: string | null;
}

interface Schedule {
  morningCoachTime: string;
  lunchReminderTime: string;
  dinnerReminderTime: string;
  eveningSummaryTime: string;
  weeklyInsightsTime: string;
}

interface AiCoachStatus {
  status: "not_assigned" | "active" | "expired" | "unlimited" | "disabled";
  expireDate: string | null;
  daysRemaining: number | null;
  memberTypeName: string | null;
  courseDuration: number | null;
}

export function NotificationSettings({
  isOpen,
  onClose,
  lineUserId,
}: NotificationSettingsProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [aiCoach, setAiCoach] = useState<AiCoachStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        setAiCoach(data.aiCoach);
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

  const formatExpireDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Send message to admin requesting AI Coach activation
  const requestAiCoachActivation = async () => {
    const message = "ขอเปิด AI Coach";
    
    try {
      // Send message via LIFF to the chat
      const success = await sendMessage(message);
      
      if (success) {
        // Close LIFF window and go back to LINE chat
        if (isInClient()) {
          closeWindow();
        } else {
          // If not in LIFF client, close modal
          onClose();
        }
      } else {
        alert("ไม่สามารถส่งข้อความได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("ไม่สามารถส่งข้อความได้ กรุณาลองใหม่อีกครั้ง");
    }
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
      color: "text-red-500",
      bgColor: "bg-red-100",
    },
    {
      key: "weightReminder" as const,
      icon: Scale,
      label: "เตือนชั่งน้ำหนัก",
      description: "ทุก 7 วัน ตอนเช้า",
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
  ];

  // Check if AI Coach is available for use (not disabled, not expired, not unassigned)
  const isAiCoachAvailable = aiCoach?.status === "active" || aiCoach?.status === "unlimited";

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
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      AI Coach
                    </h2>
                    <p className="text-sm text-gray-500">
                      {aiCoach?.memberTypeName || "ตั้งค่าการแจ้งเตือน"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Status Banner */}
              {aiCoach && (
                <div className="mt-4">
                  {aiCoach.status === "active" && (
                    <div className="p-3 bg-red-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">
                          เหลืออีก {aiCoach.daysRemaining} วัน
                        </span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        หมดอายุ: {formatExpireDate(aiCoach.expireDate!)}
                      </p>
                    </div>
                  )}

                  {aiCoach.status === "unlimited" && (
                    <div className="p-3 bg-purple-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Infinity className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">
                          ไม่จำกัดระยะเวลา
                        </span>
                      </div>
                    </div>
                  )}

                  {(aiCoach.status === "expired" || aiCoach.status === "disabled") && (
                    <div className="p-3 bg-orange-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Power className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-700">
                          หมดเวลาการใช้งาน
                        </span>
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
                  <div className="w-8 h-8 border-3 border-red-200 border-t-red-500 rounded-full animate-spin" />
                </div>
              ) : !aiCoach || aiCoach.status === "not_assigned" ? (
                /* Not Assigned - Show contact admin message */
                <div className="p-6">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      เปิดระบบ AI Coach
                    </h3>
                    <p className="text-gray-500 mb-6">
                      สอบถามแอดมินเพื่อเปิดใช้งาน AI Coach
                    </p>
                    <button
                      onClick={requestAiCoachActivation}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      ขอเปิด AI Coach
                    </button>
                  </div>
                </div>
              ) : aiCoach.status === "disabled" || aiCoach.status === "expired" ? (
                /* Disabled or Expired - Show message with contact button */
                <div className="p-6 pb-24">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
                      <Power className="w-8 h-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      ระบบ AI Coach ของคุณได้หมดเวลาการใช้งาน
                    </h3>
                    <p className="text-gray-500 mb-6">
                      หากต้องการใช้งานต่อโปรดติดต่อแอดมิน
                    </p>
                    {aiCoach.status === "expired" && aiCoach.expireDate && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full text-sm text-red-600 mb-6">
                        <Calendar className="w-4 h-4" />
                        หมดอายุเมื่อ {formatExpireDate(aiCoach.expireDate)}
                      </div>
                    )}
                    <div className="mb-8">
                      <button
                        onClick={requestAiCoachActivation}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                      >
                        <MessageCircle className="w-5 h-5" />
                        ขอเปิด AI Coach
                      </button>
                    </div>
                  </div>
                </div>
              ) : settings && isAiCoachAvailable ? (
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
                            settings[item.key] ? "bg-red-500" : "bg-gray-300"
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
