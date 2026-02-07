"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/backoffice/Header";
import {
  Users,
  ShoppingCart,
  UtensilsCrossed,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  DollarSign,
  Clock,
  Package,
  Loader2,
  TrendingUp,
  Calendar,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface DashboardStats {
  stats: {
    members: { total: number; thisMonth: number; change: number };
    ordersToday: { count: number; change: number };
    ordersThisMonth: { count: number; change: number };
    revenue: {
      today: number;
      todayChange: number;
      thisMonth: number;
      monthChange: number;
    };
    foods: { total: number; active: number };
    pendingOrders: number;
    messages: { totalConversations: number; unreadCount: number };
    ordersByStatus: Record<string, number>;
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    customer: string;
    customerImage: string | null;
    itemCount: number;
    total: number;
    status: string;
    createdAt: string;
  }[];
  recentConversations: {
    id: string;
    name: string;
    pictureUrl: string | null;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
  }[];
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  paid: "bg-indigo-100 text-indigo-700",
  preparing: "bg-orange-100 text-orange-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  paid: "ชำระแล้ว",
  preparing: "กำลังเตรียม",
  shipped: "จัดส่งแล้ว",
  delivered: "ส่งถึงแล้ว",
  cancelled: "ยกเลิก",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

function formatTimeAgo(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: th });
  } catch {
    return "";
  }
}

export default function BackofficeDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
      </div>
    );
  }

  const stats = data?.stats;
  const recentOrders = data?.recentOrders || [];
  const recentConversations = data?.recentConversations || [];

  const statCards = [
    {
      title: "สมาชิกทั้งหมด",
      value: formatNumber(stats?.members.total || 0),
      change: stats?.members.change || 0,
      subtitle: `+${formatNumber(stats?.members.thisMonth || 0)} เดือนนี้`,
      icon: Users,
      color: "bg-blue-500",
      link: "/backoffice/members",
    },
    {
      title: "ออเดอร์วันนี้",
      value: formatNumber(stats?.ordersToday.count || 0),
      change: stats?.ordersToday.change || 0,
      subtitle: `${formatNumber(stats?.pendingOrders || 0)} รอดำเนินการ`,
      icon: ShoppingCart,
      color: "bg-green-500",
      link: "/backoffice/orders",
    },
    {
      title: "เมนูอาหาร",
      value: formatNumber(stats?.foods.total || 0),
      change: 0,
      subtitle: `${formatNumber(stats?.foods.active || 0)} เปิดขาย`,
      icon: UtensilsCrossed,
      color: "bg-orange-500",
      link: "/backoffice/foods",
    },
    {
      title: "รายได้วันนี้",
      value: formatCurrency(stats?.revenue.today || 0),
      change: stats?.revenue.todayChange || 0,
      subtitle: `เดือนนี้ ${formatCurrency(stats?.revenue.thisMonth || 0)}`,
      icon: DollarSign,
      color: "bg-purple-500",
      link: "/backoffice/orders",
    },
  ];

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="ภาพรวมระบบ"
        actions={
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
        }
      />

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat) => (
            <Link
              key={stat.title}
              href={stat.link}
              className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                {stat.change !== 0 && (
                  <span
                    className={`flex items-center text-sm font-medium ${
                      stat.change > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {stat.change > 0 ? "+" : ""}
                    {stat.change}%
                    {stat.change > 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Order Status Summary */}
        {stats?.ordersByStatus && Object.keys(stats.ordersByStatus).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">สถานะออเดอร์ทั้งหมด</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                <div
                  key={status}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusStyles[status] || "bg-gray-100 text-gray-700"}`}
                >
                  {statusLabels[status] || status}: {formatNumber(count)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">ออเดอร์ล่าสุด</h2>
              </div>
              <Link href="/backoffice/orders" className="text-sm text-[#4CAF50] hover:underline">
                ดูทั้งหมด
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>ยังไม่มีออเดอร์</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/backoffice/orders?id=${order.id}`}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {order.customerImage ? (
                        <img
                          src={order.customerImage}
                          alt={order.customer}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{order.orderNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status] || "bg-gray-100 text-gray-700"}`}
                          >
                            {statusLabels[order.status] || order.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{order.customer}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                      <p className="text-xs text-gray-400">
                        {order.itemCount} รายการ · {formatTimeAgo(order.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Messages */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">ข้อความล่าสุด</h2>
                {(stats?.messages.unreadCount || 0) > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                    {stats?.messages.unreadCount} ยังไม่อ่าน
                  </span>
                )}
              </div>
              <Link href="/backoffice/chat" className="text-sm text-[#4CAF50] hover:underline">
                ดูทั้งหมด
              </Link>
            </div>
            {recentConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>ยังไม่มีข้อความ</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentConversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/backoffice/chat?id=${conv.id}`}
                    className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    {conv.pictureUrl ? (
                      <img
                        src={conv.pictureUrl}
                        alt={conv.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-sm font-medium">
                        {conv.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{conv.name}</span>
                        <span className="text-xs text-gray-400">{formatTimeAgo(conv.lastMessageAt)}</span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{conv.lastMessage || "..."}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#4CAF50] flex items-center justify-center">
                        <span className="text-xs text-white font-medium">{conv.unreadCount}</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
            <div className="p-4 border-t border-gray-100">
              <Link
                href="/backoffice/chat"
                className="w-full py-2 bg-[#E8F5E9] text-[#4CAF50] rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C8E6C9] transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                ไปที่แชท
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Stats Footer */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">ออเดอร์เดือนนี้</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">
              {formatNumber(stats?.ordersThisMonth.count || 0)}
            </p>
            {(stats?.ordersThisMonth.change || 0) !== 0 && (
              <p className={`text-xs mt-1 ${(stats?.ordersThisMonth.change || 0) > 0 ? "text-green-600" : "text-red-600"}`}>
                {(stats?.ordersThisMonth.change || 0) > 0 ? "+" : ""}
                {stats?.ordersThisMonth.change}% จากเดือนก่อน
              </p>
            )}
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">รายได้เดือนนี้</span>
            </div>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(stats?.revenue.thisMonth || 0)}
            </p>
            {(stats?.revenue.monthChange || 0) !== 0 && (
              <p className={`text-xs mt-1 ${(stats?.revenue.monthChange || 0) > 0 ? "text-green-600" : "text-red-600"}`}>
                {(stats?.revenue.monthChange || 0) > 0 ? "+" : ""}
                {stats?.revenue.monthChange}% จากเดือนก่อน
              </p>
            )}
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">รอดำเนินการ</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">
              {formatNumber(stats?.pendingOrders || 0)}
            </p>
            <p className="text-xs text-orange-600 mt-1">ออเดอร์</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">ข้อความรอตอบ</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {formatNumber(stats?.messages.unreadCount || 0)}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              จาก {formatNumber(stats?.messages.totalConversations || 0)} การสนทนา
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
