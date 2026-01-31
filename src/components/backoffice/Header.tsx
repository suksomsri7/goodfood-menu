"use client";

import { Bell, Search, ChevronDown } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: "ข้อความใหม่", message: "คุณมีข้อความใหม่จากลูกค้า", time: "5 นาทีที่แล้ว", unread: true },
    { id: 2, title: "ออเดอร์ใหม่", message: "ออเดอร์ #1234 รอดำเนินการ", time: "10 นาทีที่แล้ว", unread: true },
    { id: 3, title: "สมาชิกใหม่", message: "มีสมาชิกใหม่ลงทะเบียน", time: "1 ชั่วโมงที่แล้ว", unread: false },
  ];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหา..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">การแจ้งเตือน</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                        notification.unread ? "bg-primary-50/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {notification.unread && (
                          <span className="w-2 h-2 mt-2 bg-primary-500 rounded-full flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm">
                            {notification.title}
                          </p>
                          <p className="text-gray-500 text-sm truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-100">
                  <button className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium">
                    ดูทั้งหมด
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-sm font-medium text-primary-700">AD</span>
          </div>
          <span className="text-sm font-medium text-gray-700">Admin</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </header>
  );
}
