"use client";

import { useState, useEffect } from "react";
import { Clock, Save, RefreshCw, Bell, UserX } from "lucide-react";

interface MemberType {
  id: string;
  name: string;
  morningCoachTime: string;
  lunchReminderTime: string;
  dinnerReminderTime: string;
  eveningSummaryTime: string;
  weeklyInsightsTime: string;
}

interface InactiveSettings {
  inactiveDaysThreshold: number;
  gracePeriodDays: number;
}

export default function SchedulePage() {
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [editedTimes, setEditedTimes] = useState<Record<string, Partial<MemberType>>>({});
  
  // Inactive settings
  const [inactiveSettings, setInactiveSettings] = useState<InactiveSettings>({
    inactiveDaysThreshold: 7,
    gracePeriodDays: 2,
  });
  const [inactiveLoading, setInactiveLoading] = useState(true);
  const [inactiveSaving, setInactiveSaving] = useState(false);

  const fetchMemberTypes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/member-types");
      if (res.ok) {
        const data = await res.json();
        setMemberTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch member types:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInactiveSettings = async () => {
    setInactiveLoading(true);
    try {
      const res = await fetch("/api/settings/ai-coach");
      if (res.ok) {
        const data = await res.json();
        setInactiveSettings({
          inactiveDaysThreshold: data.inactiveDaysThreshold ?? 7,
          gracePeriodDays: data.gracePeriodDays ?? 2,
        });
      }
    } catch (error) {
      console.error("Failed to fetch inactive settings:", error);
    } finally {
      setInactiveLoading(false);
    }
  };

  const saveInactiveSettings = async () => {
    setInactiveSaving(true);
    try {
      const res = await fetch("/api/settings/ai-coach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inactiveSettings),
      });
      if (res.ok) {
        alert("บันทึกการตั้งค่าเรียบร้อย");
      } else {
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } catch (error) {
      console.error("Failed to save inactive settings:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setInactiveSaving(false);
    }
  };

  useEffect(() => {
    fetchMemberTypes();
    fetchInactiveSettings();
  }, []);

  const handleTimeChange = (typeId: string, field: keyof MemberType, value: string) => {
    setEditedTimes((prev) => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (typeId: string) => {
    const edited = editedTimes[typeId];
    if (!edited) return;

    setIsSaving(typeId);
    try {
      const res = await fetch(`/api/member-types/${typeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited),
      });

      if (res.ok) {
        // Update local state
        setMemberTypes((prev) =>
          prev.map((mt) =>
            mt.id === typeId ? { ...mt, ...edited } : mt
          )
        );
        // Clear edited state
        setEditedTimes((prev) => {
          const newState = { ...prev };
          delete newState[typeId];
          return newState;
        });
        alert("บันทึกเรียบร้อย");
      } else {
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSaving(null);
    }
  };

  const getDisplayValue = (type: MemberType, field: keyof MemberType) => {
    return editedTimes[type.id]?.[field] ?? type[field];
  };

  const hasChanges = (typeId: string) => {
    return !!editedTimes[typeId] && Object.keys(editedTimes[typeId]).length > 0;
  };

  if (isLoading || inactiveLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งเวลาแจ้งเตือน</h1>
          <p className="text-gray-500 mt-1">กำหนดเวลาแจ้งเตือนและการติดตาม User</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Inactive User Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <UserX className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">การแจ้งเตือน User ที่ไม่ได้เข้าใช้งาน</h2>
              <p className="text-sm text-gray-500">ระบบจะส่งข้อความเตือนเมื่อ User ไม่ได้เปิดแอปตามจำนวนวันที่กำหนด</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inactive Days Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                จำนวนวันก่อนเปลี่ยนสถานะเป็น Inactive
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={inactiveSettings.inactiveDaysThreshold}
                  onChange={(e) => setInactiveSettings(prev => ({
                    ...prev,
                    inactiveDaysThreshold: parseInt(e.target.value) || 7,
                  }))}
                  className="w-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-center"
                />
                <span className="text-gray-600">วัน</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                หาก User ไม่เปิดแอปเกินจำนวนวันนี้ ระบบจะเปลี่ยนสถานะเป็น Inactive และหยุดส่งข้อความ
              </p>
            </div>

            {/* Grace Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ระยะเวลาเตือนก่อนเปลี่ยนสถานะ (Grace Period)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={inactiveSettings.gracePeriodDays}
                  onChange={(e) => setInactiveSettings(prev => ({
                    ...prev,
                    gracePeriodDays: parseInt(e.target.value) || 0,
                  }))}
                  className="w-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-center"
                />
                <span className="text-gray-600">วัน</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                ระบบจะส่งข้อความเตือน &quot;คิดถึงนะ&quot; ในช่วงนี้ก่อนเปลี่ยนสถานะ
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={saveInactiveSettings}
              disabled={inactiveSaving}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {inactiveSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>

        {/* Notification Times Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">เวลาแจ้งเตือน AI Coach</h2>
            <p className="text-sm text-gray-500">กำหนดเวลาส่งข้อความสำหรับแต่ละประเภทสมาชิก</p>
          </div>
        </div>
        {memberTypes.map((type) => (
          <div key={type.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{type.name}</h2>
              {hasChanges(type.id) && (
                <button
                  onClick={() => handleSave(type.id)}
                  disabled={isSaving === type.id}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {isSaving === type.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  บันทึก
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Morning Coach */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="mr-2">🌅</span>
                  กำลังใจเช้า
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={getDisplayValue(type, "morningCoachTime") as string}
                    onChange={(e) => handleTimeChange(type.id, "morningCoachTime", e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Lunch Reminder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="mr-2">🍽️</span>
                  เตือนมื้อกลางวัน
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={getDisplayValue(type, "lunchReminderTime") as string}
                    onChange={(e) => handleTimeChange(type.id, "lunchReminderTime", e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Dinner Reminder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="mr-2">🍽️</span>
                  เตือนมื้อเย็น
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={getDisplayValue(type, "dinnerReminderTime") as string}
                    onChange={(e) => handleTimeChange(type.id, "dinnerReminderTime", e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Evening Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="mr-2">🌙</span>
                  สรุปตอนเย็น
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={getDisplayValue(type, "eveningSummaryTime") as string}
                    onChange={(e) => handleTimeChange(type.id, "eveningSummaryTime", e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Weekly Insights */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="mr-2">📊</span>
                  สรุปประจำสัปดาห์
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={getDisplayValue(type, "weeklyInsightsTime") as string}
                    onChange={(e) => handleTimeChange(type.id, "weeklyInsightsTime", e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {memberTypes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>ยังไม่มีประเภทสมาชิก</p>
          <p className="text-sm">กรุณาสร้างประเภทสมาชิกก่อนในหน้า AI Coach</p>
        </div>
      )}
    </div>
  );
}
