"use client";

import { StatCard } from "@/components/backoffice/StatCard";
import {
  Users,
  Utensils,
  ShoppingBag,
  MessageSquare,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";

// Mock data
const stats = [
  {
    title: "สมาชิกทั้งหมด",
    value: "1,234",
    change: 12.5,
    changeLabel: "จากเดือนที่แล้ว",
    icon: <Users className="w-6 h-6" />,
    color: "primary" as const,
  },
  {
    title: "เมนูอาหาร",
    value: "156",
    change: 8,
    changeLabel: "เมนูใหม่",
    icon: <Utensils className="w-6 h-6" />,
    color: "blue" as const,
  },
  {
    title: "ออเดอร์วันนี้",
    value: "48",
    change: 23,
    changeLabel: "จากเมื่อวาน",
    icon: <ShoppingBag className="w-6 h-6" />,
    color: "orange" as const,
  },
  {
    title: "ข้อความใหม่",
    value: "12",
    change: -5,
    changeLabel: "จากเมื่อวาน",
    icon: <MessageSquare className="w-6 h-6" />,
    color: "purple" as const,
  },
];

const recentOrders = [
  { id: "#1234", customer: "สมชาย ใจดี", items: 3, total: 450, status: "pending" },
  { id: "#1233", customer: "สมหญิง รักสุข", items: 2, total: 280, status: "preparing" },
  { id: "#1232", customer: "วิชัย นามสกุล", items: 5, total: 720, status: "delivered" },
  { id: "#1231", customer: "ปรีชา สุขสบาย", items: 1, total: 150, status: "delivered" },
];

const recentMessages = [
  { id: 1, name: "สมชาย ใจดี", message: "สอบถามเรื่องแคลอรี่ครับ", time: "5 นาที", unread: true },
  { id: 2, name: "สมหญิง รักสุข", message: "ขอบคุณค่ะ", time: "15 นาที", unread: false },
  { id: 3, name: "วิชัย นามสกุล", message: "อาหารมื้อไหนดีครับ", time: "1 ชม.", unread: true },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  preparing: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  pending: "รอดำเนินการ",
  preparing: "กำลังเตรียม",
  delivered: "ส่งแล้ว",
  cancelled: "ยกเลิก",
};

export default function BackofficeDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">ภาพรวมระบบ GoodFood Menu</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>{new Date().toLocaleDateString("th-TH", { 
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">ออเดอร์ล่าสุด</h2>
            <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              ดูทั้งหมด
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="p-4 font-medium">ออเดอร์</th>
                  <th className="p-4 font-medium">ลูกค้า</th>
                  <th className="p-4 font-medium">รายการ</th>
                  <th className="p-4 font-medium">ยอดรวม</th>
                  <th className="p-4 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4 font-medium text-gray-800">{order.id}</td>
                    <td className="p-4 text-gray-600">{order.customer}</td>
                    <td className="p-4 text-gray-600">{order.items} รายการ</td>
                    <td className="p-4 font-medium text-gray-800">฿{order.total}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusColors[order.status]
                        }`}
                      >
                        {statusLabels[order.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">ข้อความล่าสุด</h2>
            <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              ดูทั้งหมด
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-primary-700">
                      {msg.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {msg.name}
                      </p>
                      {msg.unread && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{msg.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{msg.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">เริ่มต้นใช้งาน</h3>
            <p className="text-primary-100">
              เพิ่มเมนูอาหาร จัดการสมาชิก และตั้งค่าระบบเพื่อเริ่มใช้งาน
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-primary-50 transition-colors">
              เพิ่มเมนูอาหาร
            </button>
            <button className="px-4 py-2 bg-primary-400 text-white rounded-lg font-medium hover:bg-primary-300 transition-colors">
              ตั้งค่าระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
