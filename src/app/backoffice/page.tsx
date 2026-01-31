"use client";

import { Header } from "@/components/backoffice/Header";
import {
  Users,
  ShoppingCart,
  UtensilsCrossed,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  DollarSign,
} from "lucide-react";

const stats = [
  { title: "สมาชิก", value: "1,234", change: "+12%", trend: "up", icon: Users, color: "bg-blue-500" },
  { title: "ออเดอร์วันนี้", value: "56", change: "+8%", trend: "up", icon: ShoppingCart, color: "bg-green-500" },
  { title: "เมนูอาหาร", value: "89", change: "+3", trend: "up", icon: UtensilsCrossed, color: "bg-orange-500" },
  { title: "รายได้", value: "฿12,450", change: "-5%", trend: "down", icon: DollarSign, color: "bg-purple-500" },
];

const recentOrders = [
  { id: "ORD001", customer: "สมชาย ใจดี", items: 3, total: 450, status: "pending" },
  { id: "ORD002", customer: "สมหญิง รักสุขภาพ", items: 2, total: 320, status: "preparing" },
  { id: "ORD003", customer: "มานะ ตั้งใจ", items: 5, total: 890, status: "ready" },
];

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  preparing: "bg-blue-100 text-blue-700",
  ready: "bg-green-100 text-green-700",
};

const statusLabels: Record<string, string> = {
  pending: "รอ",
  preparing: "เตรียม",
  ready: "พร้อม",
};

export default function BackofficeDashboard() {
  return (
    <div>
      <Header title="Dashboard" subtitle="ภาพรวมระบบ" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.title} className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <span className={`flex items-center text-sm font-medium ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                  {stat.change}
                  {stat.trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">ออเดอร์ล่าสุด</h2>
              <button className="text-sm text-[#4CAF50]">ดูทั้งหมด</button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{order.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">฿{order.total}</p>
                    <p className="text-xs text-gray-400">{order.items} รายการ</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">ข้อความล่าสุด</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[
                  { name: "คุณสมชาย", msg: "สอบถามเรื่องโปรโมชั่น", time: "5 นาที", unread: true },
                  { name: "คุณวิภา", msg: "ขอบคุณค่ะ", time: "15 นาที", unread: false },
                  { name: "คุณมานะ", msg: "อาหารอร่อยมากครับ", time: "1 ชม.", unread: false },
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-sm font-medium">
                      {m.name.charAt(3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{m.name}</span>
                        <span className="text-xs text-gray-400">{m.time}</span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{m.msg}</p>
                    </div>
                    {m.unread && <div className="w-2 h-2 rounded-full bg-[#4CAF50]" />}
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2 bg-[#E8F5E9] text-[#4CAF50] rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                ไปที่แชท
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
