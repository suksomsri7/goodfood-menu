"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useLiff } from "@/components/providers/LiffProvider";
import {
  Plus,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  Package,
  XCircle,
} from "lucide-react";
import Link from "next/link";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderItem {
  id: string;
  foodName: string;
  quantity: number;
  calories: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: "รอยืนยัน", color: "text-yellow-600", bgColor: "bg-yellow-50", icon: Clock },
  confirmed: { label: "ยืนยันแล้ว", color: "text-blue-600", bgColor: "bg-blue-50", icon: CheckCircle },
  preparing: { label: "กำลังเตรียม", color: "text-orange-600", bgColor: "bg-orange-50", icon: Package },
  ready: { label: "พร้อมรับ", color: "text-green-600", bgColor: "bg-green-50", icon: Truck },
  completed: { label: "เสร็จสิ้น", color: "text-emerald-600", bgColor: "bg-emerald-50", icon: CheckCircle },
  cancelled: { label: "ยกเลิก", color: "text-red-600", bgColor: "bg-red-50", icon: XCircle },
};

export default function OrdersPage() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("completed");

  const lineUserId = profile?.userId;

  const fetchOrders = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/orders?lineUserId=${lineUserId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, [lineUserId]);

  useEffect(() => {
    document.title = "รายการสั่งซื้อ";
  }, []);

  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      fetchOrders().finally(() => setIsLoading(false));
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [isReady, lineUserId, isLoggedIn, fetchOrders]);

  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  );

  const displayOrders = activeTab === "active" ? activeOrders : completedOrders;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const orderDate = date.toDateString();

    if (orderDate === today) {
      return `วันนี้ ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (orderDate === yesterday) {
      return `เมื่อวาน ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading state
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!isLoggedIn || !lineUserId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            กรุณาเข้าสู่ระบบ
          </h2>
          <p className="text-gray-500 text-sm">
            เปิดผ่าน LINE เพื่อดูรายการสั่งซื้อของคุณ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Tabs */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "completed"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            พร้อมทาน ({completedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "active"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            กำลังดำเนินการ ({activeOrders.length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 pt-4 space-y-4">
        {displayOrders.length > 0 ? (
          displayOrders.map((order, index) => {
            const config = statusConfig[order.status];
            const StatusIcon = config.icon;
            const totalCalories = order.items.reduce(
              (sum, item) => sum + (item.calories || 0) * item.quantity,
              0
            );

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-5 border border-slate-200"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-slate-900">
                      #{order.orderNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                </div>

                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{item.foodName}</span>
                        <span className="text-slate-400">×{item.quantity}</span>
                      </div>
                      <span className="text-slate-600">
                        ฿{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Order Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    {totalCalories} kcal
                  </span>
                  <span className="font-semibold text-slate-900">
                    ฿{order.totalAmount}
                  </span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="py-16 text-center">
            <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">
              {activeTab === "active"
                ? "ไม่มีรายการที่กำลังดำเนินการ"
                : "ยังไม่มีรายการที่พร้อมทาน"}
            </p>
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              สั่งอาหาร
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
