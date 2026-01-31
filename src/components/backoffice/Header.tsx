"use client";

import { Bell, Search } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: "ข้อความใหม่", message: "คุณมีข้อความใหม่ 5 ข้อความ", time: "5 นาที", unread: true },
    { id: 2, title: "ออเดอร์ใหม่", message: "มีออเดอร์ใหม่รอดำเนินการ", time: "15 นาที", unread: true },
    { id: 3, title: "สมาชิกใหม่", message: "มีผู้สมัครสมาชิกใหม่ 3 คน", time: "1 ชม.", unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Title */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหา..."
            className="bg-transparent border-none outline-none text-sm w-40"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-100"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-gray-900">การแจ้งเตือน</span>
                <button className="text-xs text-[#4CAF50]">อ่านทั้งหมด</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${n.unread ? "bg-green-50/50" : ""}`}
                  >
                    <div className="flex gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${n.unread ? "bg-[#4CAF50]" : "bg-gray-300"}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
