"use client";

import { Bell, Search, ShoppingCart, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: "order" | "chat" | "system";
}

export function Header({ title, subtitle }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({ pendingOrders: 0, unreadChats: 0 });

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Fetch pending orders count
        const ordersRes = await fetch("/api/orders/pending-count");
        const ordersData = ordersRes.ok ? await ordersRes.json() : { count: 0 };
        
        // Fetch unread chat count
        const chatRes = await fetch("/api/line/unread");
        const chatData = chatRes.ok ? await chatRes.json() : { unreadCount: 0 };
        
        setStats({
          pendingOrders: ordersData.count || 0,
          unreadChats: chatData.unreadCount || 0,
        });
        
        // Build notifications list
        const newNotifications: Notification[] = [];
        
        if (ordersData.count > 0) {
          newNotifications.push({
            id: "orders",
            title: "ออเดอร์รอดำเนินการ",
            message: `มี ${ordersData.count} ออเดอร์รอดำเนินการ`,
            time: "ตอนนี้",
            unread: true,
            type: "order",
          });
        }
        
        if (chatData.unreadCount > 0) {
          newNotifications.push({
            id: "chat",
            title: "ข้อความใหม่",
            message: `มี ${chatData.unreadCount} ข้อความที่ยังไม่ได้อ่าน`,
            time: "ตอนนี้",
            unread: true,
            type: "chat",
          });
        }
        
        setNotifications(newNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalBadge = stats.pendingOrders + stats.unreadChats;

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

        {/* Quick Stats */}
        {(stats.pendingOrders > 0 || stats.unreadChats > 0) && (
          <div className="hidden md:flex items-center gap-2">
            {stats.pendingOrders > 0 && (
              <a
                href="/backoffice/orders"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{stats.pendingOrders} ออเดอร์ใหม่</span>
              </a>
            )}
            {stats.unreadChats > 0 && (
              <a
                href="/backoffice/chat"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{stats.unreadChats} ข้อความ</span>
              </a>
            )}
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-100"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {totalBadge > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-gray-900">การแจ้งเตือน</span>
                {notifications.length > 0 && (
                  <span className="text-xs text-gray-500">{notifications.length} รายการ</span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">ไม่มีการแจ้งเตือน</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <a
                      key={n.id}
                      href={n.type === "order" ? "/backoffice/orders" : n.type === "chat" ? "/backoffice/chat" : "#"}
                      className={`block p-3 border-b border-gray-50 hover:bg-gray-50 ${n.unread ? "bg-green-50/50" : ""}`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          n.type === "order" ? "bg-orange-100 text-orange-600" :
                          n.type === "chat" ? "bg-blue-100 text-blue-600" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {n.type === "order" ? <ShoppingCart className="w-4 h-4" /> :
                           n.type === "chat" ? <MessageSquare className="w-4 h-4" /> :
                           <Bell className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                        </div>
                        {n.unread && (
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                        )}
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
