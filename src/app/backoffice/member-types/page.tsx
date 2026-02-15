"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/backoffice/Header";
import {
  Plus,
  Edit2,
  Trash2,
  Camera,
  Sparkles,
  Users,
  Check,
  X,
  Crown,
  Infinity,
  Brain,
  ScanLine,
  Settings,
  Clock,
  Dumbbell,
  Utensils,
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  Layers,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MemberType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  // AI Limit Mode
  aiLimitMode: "by_type" | "combined";
  totalDailyAiLimit: number;
  // AI Usage Limits
  dailyPhotoLimit: number;
  dailyAiAnalysisLimit: number;
  dailyAiTextAnalysisLimit: number;
  dailyAiRecommendLimit: number;
  dailyExerciseAnalysisLimit: number;
  dailyMenuSelectLimit: number;
  dailyScanLimit: number;
  isDefault: boolean;
  isActive: boolean;
  order: number;
  // AI Coach settings
  morningCoachTime: string;
  lunchReminderTime: string;
  dinnerReminderTime: string;
  eveningSummaryTime: string;
  waterReminderTimes: string;
  weeklyInsightsTime: string;
  inactiveReminderDays: number;
  _count?: {
    members: number;
  };
}

interface AiCoachSettings {
  trialDays: number;
  trialMemberTypeId: string | null;
  generalMemberTypeId: string | null;
  memberTypes: { id: string; name: string; isDefault: boolean }[];
}

const colorOptions = [
  { value: "#4CAF50", label: "เขียว" },
  { value: "#2196F3", label: "น้ำเงิน" },
  { value: "#9C27B0", label: "ม่วง" },
  { value: "#FF9800", label: "ส้ม" },
  { value: "#F44336", label: "แดง" },
  { value: "#607D8B", label: "เทา" },
  { value: "#E91E63", label: "ชมพู" },
  { value: "#00BCD4", label: "ฟ้า" },
  { value: "#795548", label: "น้ำตาล" },
  { value: "#FFD700", label: "ทอง" },
];

export default function MemberTypesPage() {
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<MemberType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // AI Coach Global Settings
  const [aiCoachSettings, setAiCoachSettings] = useState<AiCoachSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#4CAF50",
    // AI Limit Mode
    aiLimitMode: "by_type" as "by_type" | "combined",
    totalDailyAiLimit: 15,
    // AI Usage Limits
    dailyPhotoLimit: 3,
    dailyAiAnalysisLimit: 3,
    dailyAiTextAnalysisLimit: 3,
    dailyAiRecommendLimit: 3,
    dailyExerciseAnalysisLimit: 3,
    dailyMenuSelectLimit: 3,
    dailyScanLimit: 5,
    isDefault: false,
    isActive: true,
    // AI Coach settings
    morningCoachTime: "07:00",
    lunchReminderTime: "11:30",
    dinnerReminderTime: "17:30",
    eveningSummaryTime: "20:00",
    waterReminderTimes: "09:00,11:00,14:00,16:00",
    weeklyInsightsTime: "09:00",
    inactiveReminderDays: 2,
  });

  useEffect(() => {
    fetchMemberTypes();
    fetchAiCoachSettings();
  }, []);

  const fetchMemberTypes = async () => {
    try {
      const res = await fetch("/api/member-types");
      if (res.ok) {
        const data = await res.json();
        setMemberTypes(data);
      }
    } catch (error) {
      console.error("Error fetching member types:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAiCoachSettings = async () => {
    try {
      const res = await fetch("/api/settings/ai-coach");
      if (res.ok) {
        const data = await res.json();
        setAiCoachSettings(data);
      }
    } catch (error) {
      console.error("Error fetching AI Coach settings:", error);
    }
  };

  const updateAiCoachSetting = async (key: string, value: boolean | number | string | null) => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings/ai-coach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setAiCoachSettings(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (error) {
      console.error("Error updating AI Coach settings:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  const openCreateModal = () => {
    setEditingType(null);
    setFormData({
      name: "",
      description: "",
      color: "#4CAF50",
      aiLimitMode: "by_type",
      totalDailyAiLimit: 15,
      dailyPhotoLimit: 3,
      dailyAiAnalysisLimit: 3,
      dailyAiTextAnalysisLimit: 3,
      dailyAiRecommendLimit: 3,
      dailyExerciseAnalysisLimit: 3,
      dailyMenuSelectLimit: 3,
      dailyScanLimit: 5,
      isDefault: false,
      isActive: true,
      morningCoachTime: "07:00",
      lunchReminderTime: "11:30",
      dinnerReminderTime: "17:30",
      eveningSummaryTime: "20:00",
      waterReminderTimes: "09:00,11:00,14:00,16:00",
      weeklyInsightsTime: "09:00",
      inactiveReminderDays: 2,
    });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (type: MemberType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || "",
      color: type.color,
      aiLimitMode: type.aiLimitMode ?? "by_type",
      totalDailyAiLimit: type.totalDailyAiLimit ?? 15,
      dailyPhotoLimit: type.dailyPhotoLimit ?? 3,
      dailyAiAnalysisLimit: type.dailyAiAnalysisLimit ?? 3,
      dailyAiTextAnalysisLimit: type.dailyAiTextAnalysisLimit ?? 3,
      dailyAiRecommendLimit: type.dailyAiRecommendLimit ?? 3,
      dailyExerciseAnalysisLimit: type.dailyExerciseAnalysisLimit ?? 3,
      dailyMenuSelectLimit: type.dailyMenuSelectLimit ?? 3,
      dailyScanLimit: type.dailyScanLimit ?? 5,
      isDefault: type.isDefault,
      isActive: type.isActive,
      morningCoachTime: type.morningCoachTime ?? "07:00",
      lunchReminderTime: type.lunchReminderTime ?? "11:30",
      dinnerReminderTime: type.dinnerReminderTime ?? "17:30",
      eveningSummaryTime: type.eveningSummaryTime ?? "20:00",
      waterReminderTimes: type.waterReminderTimes ?? "09:00,11:00,14:00,16:00",
      weeklyInsightsTime: type.weeklyInsightsTime ?? "09:00",
      inactiveReminderDays: type.inactiveReminderDays ?? 2,
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("กรุณากรอกชื่อ AI Coach");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingType
        ? `/api/member-types/${editingType.id}`
        : "/api/member-types";
      const method = editingType ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchMemberTypes();
      } else {
        const data = await res.json();
        setError(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      setError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: MemberType) => {
    if (type._count && type._count.members > 0) {
      alert(`ไม่สามารถลบได้ มีสมาชิก ${type._count.members} คนใช้ประเภทนี้อยู่`);
      return;
    }

    if (!confirm(`ต้องการลบ "${type.name}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/member-types/${type.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchMemberTypes();
      } else {
        const data = await res.json();
        alert(data.error || "เกิดข้อผิดพลาดในการลบ");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const formatLimit = (limit: number) => {
    if (limit === 0) return <Infinity className="w-4 h-4 inline" />;
    return `${limit} ครั้ง`;
  };

  // Toggle member type active status
  const toggleMemberTypeActive = async (typeId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/member-types/${typeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      
      if (res.ok) {
        setMemberTypes(prev => 
          prev.map(type => 
            type.id === typeId ? { ...type, isActive: !currentStatus } : type
          )
        );
      }
    } catch (error) {
      console.error("Error toggling member type:", error);
    }
  };

  return (
    <div>
      <Header
        title="AI Coach"
        subtitle="จัดการประเภท AI Coach และการตั้งค่าคอร์ส"
      />

      <div className="p-6">
        {/* New Member Card Settings */}
        {aiCoachSettings && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">ตั้งค่าสมาชิกใหม่</h3>
                <p className="text-sm text-gray-500">กำหนด Card เริ่มต้นสำหรับสมาชิกที่เข้ามาใหม่</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Trial Card */}
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-3 mb-3">
                  <Crown className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-800">Card ทดลอง</p>
                    <p className="text-xs text-gray-500">สมาชิกใหม่จะได้ Card นี้</p>
                  </div>
                </div>
                <select
                  value={aiCoachSettings.trialMemberTypeId || ""}
                  onChange={(e) => updateAiCoachSetting("trialMemberTypeId", e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">-- ไม่กำหนด --</option>
                  {aiCoachSettings.memberTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trial Days */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-800">ระยะเวลาทดลอง</p>
                    <p className="text-xs text-gray-500">จำนวนวันที่ให้ทดลองใช้</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={aiCoachSettings.trialDays}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 0;
                      setAiCoachSettings(prev => prev ? { ...prev, trialDays: days } : null);
                    }}
                    onBlur={(e) => updateAiCoachSetting("trialDays", parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                  />
                  <span className="text-sm text-gray-600">วัน (0 = ไม่มีทดลอง)</span>
                </div>
              </div>

              {/* After Trial Card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-800">Card หลังทดลอง</p>
                    <p className="text-xs text-gray-500">เมื่อหมดทดลองจะเปลี่ยนไป Card นี้</p>
                  </div>
                </div>
                <select
                  value={aiCoachSettings.generalMemberTypeId || ""}
                  onChange={(e) => updateAiCoachSetting("generalMemberTypeId", e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">-- ไม่กำหนด (ลบ AI Coach) --</option>
                  {aiCoachSettings.memberTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl">
              <Users className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-700">
                {memberTypes.length} ประเภท
              </span>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-green-500/20"
          >
            <Plus className="w-5 h-5" />
            เพิ่ม AI Coach
          </button>
        </div>

        {/* Member Types List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-4">กำลังโหลด...</p>
            </div>
          ) : memberTypes.length === 0 ? (
            <div className="p-12 text-center">
              <Crown className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                ยังไม่มี AI Coach
              </h3>
              <p className="text-gray-400 mb-4">
                สร้าง AI Coach เพื่อกำหนดคอร์สและการแจ้งเตือน
              </p>
              <button
                onClick={openCreateModal}
                className="px-6 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                เพิ่ม AI Coach
              </button>
            </div>
          ) : (
            <div className="grid gap-4 p-6">
              {memberTypes.map((type) => (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    {/* Left Section */}
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                        style={{ backgroundColor: type.color }}
                      >
                        <Crown className="w-6 h-6" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800 text-lg">
                            {type.name}
                          </h3>
                          {type.isDefault && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              ค่าเริ่มต้น
                            </span>
                          )}
                          {!type.isActive && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                              ปิดใช้งาน
                            </span>
                          )}
                        </div>
                        {type.description && (
                          <p className="text-sm text-gray-500 mb-3">
                            {type.description}
                          </p>
                        )}

                        {/* Limits */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* AI Limit Mode Badge */}
                          <div className="flex items-center gap-2 text-sm">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              type.aiLimitMode === "combined" ? "bg-purple-100" : "bg-indigo-100"
                            }`}>
                              {type.aiLimitMode === "combined" ? (
                                <Hash className="w-3.5 h-3.5 text-purple-600" />
                              ) : (
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">โหมด AI</p>
                              <p className={`font-semibold text-xs ${
                                type.aiLimitMode === "combined" ? "text-purple-700" : "text-indigo-700"
                              }`}>
                                {type.aiLimitMode === "combined" ? "รวมทั้งหมด" : "แยกประเภท"}
                              </p>
                            </div>
                          </div>

                          {/* Combined Limit */}
                          {type.aiLimitMode === "combined" && (
                            <div className="flex items-center gap-2 text-sm px-3 py-1.5 bg-purple-100 rounded-lg border border-purple-200">
                              <Hash className="w-4 h-4 text-purple-600" />
                              <span className="font-semibold text-purple-700">
                                {formatLimit(type.totalDailyAiLimit)}/วัน รวม
                              </span>
                            </div>
                          )}

                          {/* Individual Limits - only show if by_type mode */}
                          {type.aiLimitMode === "by_type" && (
                            <>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Camera className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Take Photo</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyPhotoLimit)}/วัน
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">AI วิเคราะห์</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyAiAnalysisLimit)}/วัน
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                              <Brain className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">AI คำแนะนำ</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyAiRecommendLimit)}/วัน
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                              <MessageSquare className="w-3.5 h-3.5 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">AI ข้อความ</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyAiTextAnalysisLimit ?? 3)}/วัน
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                              <Dumbbell className="w-3.5 h-3.5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">AI ออกกำลังกาย</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyExerciseAnalysisLimit ?? 3)}/วัน
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center">
                              <Utensils className="w-3.5 h-3.5 text-pink-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">AI เลือกเมนู</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyMenuSelectLimit ?? 3)}/วัน
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center">
                              <ScanLine className="w-3.5 h-3.5 text-cyan-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">สแกน Barcode</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {formatLimit(type.dailyScanLimit)}/วัน
                              </p>
                            </div>
                          </div>
                            </>
                          )}

                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Users className="w-3.5 h-3.5 text-gray-600" />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">สมาชิก</p>
                              <p className="font-semibold text-gray-700 text-xs">
                                {type._count?.members || 0} คน
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Toggle Active - Inside Card */}
                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                          <span className="text-sm text-gray-600">สถานะ AI Coach:</span>
                          <button
                            onClick={() => toggleMemberTypeActive(type.id, type.isActive)}
                            className={`relative w-14 h-7 rounded-full transition-colors ${
                              type.isActive ? "bg-green-500" : "bg-gray-300"
                            }`}
                            title={type.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          >
                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              type.isActive ? "translate-x-7" : "translate-x-0.5"
                            }`} />
                          </button>
                          <span className={`text-sm font-medium ${type.isActive ? "text-green-600" : "text-gray-500"}`}>
                            {type.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(type)}
                        className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(type)}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="ลบ"
                        disabled={type._count && type._count.members > 0}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingType ? "แก้ไข AI Coach" : "เพิ่ม AI Coach"}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อประเภท <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="เช่น Free, Basic, Premium"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คำอธิบาย
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="รายละเอียดเพิ่มเติม..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    สี
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, color: color.value })
                        }
                        className={`w-10 h-10 rounded-xl transition-all ${
                          formData.color === color.value
                            ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                {/* AI Limit Mode */}
                <div className="border-t border-gray-200 pt-5">
                  <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    🎯 จำกัดการใช้งาน AI
                  </h4>
                  
                  {/* Mode Toggle */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-4 border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span className="font-medium text-gray-800">โหมดจำกัดการใช้งาน</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, aiLimitMode: "by_type" })}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                          formData.aiLimitMode === "by_type"
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        แยกตามประเภท
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, aiLimitMode: "combined" })}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                          formData.aiLimitMode === "combined"
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                        }`}
                      >
                        <Hash className="w-4 h-4" />
                        รวมทั้งหมด
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.aiLimitMode === "by_type" 
                        ? "กำหนดโควต้าแยกตามประเภท AI แต่ละอย่าง"
                        : "กำหนดโควต้ารวมทุกประเภท AI ไม่แยกแต่ละอย่าง"}
                    </p>
                  </div>

                  {/* Combined Limit (show when mode is combined) */}
                  {formData.aiLimitMode === "combined" && (
                    <div className="bg-purple-50 rounded-xl p-4 mb-4 border border-purple-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Hash className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">จำนวนครั้งรวมต่อวัน</p>
                          <p className="text-xs text-gray-500">จำกัดการใช้ AI ทุกประเภทรวมกัน (0 = ไม่จำกัด)</p>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={formData.totalDailyAiLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            totalDailyAiLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-lg font-semibold text-center"
                      />
                    </div>
                  )}

                  {/* Individual Limits (show when mode is by_type) */}
                  {formData.aiLimitMode === "by_type" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Camera className="w-4 h-4 inline mr-1" />
                        ถ่ายรูปอาหาร
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyPhotoLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyPhotoLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        AI วิเคราะห์รูปอาหาร
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyAiAnalysisLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyAiAnalysisLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MessageSquare className="w-4 h-4 inline mr-1" />
                        AI วิเคราะห์ข้อความอาหาร
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyAiTextAnalysisLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyAiTextAnalysisLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Brain className="w-4 h-4 inline mr-1" />
                        AI คำแนะนำรายวัน
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyAiRecommendLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyAiRecommendLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Dumbbell className="w-4 h-4 inline mr-1" />
                        AI วิเคราะห์ออกกำลังกาย
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyExerciseAnalysisLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyExerciseAnalysisLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Utensils className="w-4 h-4 inline mr-1" />
                        AI เลือกเมนู
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyMenuSelectLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyMenuSelectLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <ScanLine className="w-4 h-4 inline mr-1" />
                        สแกน Barcode
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.dailyScanLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dailyScanLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  )}
                </div>

                {/* AI Coach Settings */}
                <div className="border-t border-gray-200 pt-5 mt-5">
                  <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    🤖 ตั้งค่า AI Coach
                  </h4>

                  {/* Coaching Times */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🌅 กำลังใจเช้า
                      </label>
                      <input
                        type="time"
                        value={formData.morningCoachTime}
                        onChange={(e) => setFormData({ ...formData, morningCoachTime: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🍽️ แนะนำมื้อกลางวัน
                      </label>
                      <input
                        type="time"
                        value={formData.lunchReminderTime}
                        onChange={(e) => setFormData({ ...formData, lunchReminderTime: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🍽️ แนะนำมื้อเย็น
                      </label>
                      <input
                        type="time"
                        value={formData.dinnerReminderTime}
                        onChange={(e) => setFormData({ ...formData, dinnerReminderTime: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🌙 สรุปท้ายวัน
                      </label>
                      <input
                        type="time"
                        value={formData.eveningSummaryTime}
                        onChange={(e) => setFormData({ ...formData, eveningSummaryTime: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  {/* Water Reminder Times */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💧 เตือนดื่มน้ำ (คั่นด้วยเครื่องหมายจุลภาค)
                    </label>
                    <input
                      type="text"
                      value={formData.waterReminderTimes}
                      onChange={(e) => setFormData({ ...formData, waterReminderTimes: e.target.value })}
                      placeholder="09:00,11:00,14:00,16:00"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">เช่น 09:00,11:00,14:00,16:00</p>
                  </div>

                  {/* Inactive Reminder */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ⚠️ เตือนเมื่อไม่ active (วัน)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={formData.inactiveReminderDays}
                      onChange={(e) => setFormData({ ...formData, inactiveReminderDays: parseInt(e.target.value) || 2 })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) =>
                        setFormData({ ...formData, isDefault: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">
                      ตั้งเป็นค่าเริ่มต้น
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">เปิดใช้งาน</span>
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        บันทึก
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
