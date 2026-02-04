"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiff } from "@/components/providers/LiffProvider";
import {
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  Package,
  XCircle,
} from "lucide-react";
import Link from "next/link";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

interface FoodInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface OrderItem {
  id: string;
  foodName: string;
  quantity: number;
  calories: number;
  price: number;
  food?: FoodInfo;
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

interface SelectedFoodItem extends OrderItem {
  orderId: string;
  orderNumber: string;
}

export default function OrdersPage() {
  const { profile, isReady, isLoggedIn, error } = useLiff();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("completed");
  const [selectedItem, setSelectedItem] = useState<SelectedFoodItem | null>(null);
  const [selectQuantity, setSelectQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

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
    document.title = "รายการอาหาร";
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

  const handleSelectClick = (item: SelectedFoodItem) => {
    setSelectedItem(item);
    setSelectQuantity(1);
  };

  const handleConfirmEat = async () => {
    if (!selectedItem || !lineUserId) return;

    setIsSaving(true);
    try {
      const food = selectedItem.food;
      const multiplier = selectQuantity;

      // บันทึกเป็น meal
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          name: selectedItem.foodName,
          calories: (food?.calories || selectedItem.calories || 0) * multiplier,
          protein: (food?.protein || 0) * multiplier,
          carbs: (food?.carbs || 0) * multiplier,
          fat: (food?.fat || 0) * multiplier,
          sodium: 0,
          sugar: 0,
          multiplier,
          date: new Date().toISOString(),
        }),
      });

      setSelectedItem(null);
      // Optionally refresh orders or show success
    } catch (error) {
      console.error("Failed to save meal:", error);
    } finally {
      setIsSaving(false);
    }
  };

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
            เปิดผ่าน LINE เพื่อดูรายการอาหารของคุณ
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
            อาหารของคุณ ({completedOrders.reduce((sum, o) => sum + o.items.length, 0)})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "active"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            รายการสั่งซื้อ ({activeOrders.length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 pt-4 space-y-3">
        {activeTab === "completed" ? (
          // อาหารของคุณ - แสดงเป็น flat list อาหารพร้อมสารอาหาร + ปุ่มเลือกทาน
          (() => {
            const allFoodItems = completedOrders.flatMap((order) =>
              order.items.map((item) => ({
                ...item,
                orderId: order.id,
                orderNumber: order.orderNumber,
              }))
            );

            if (allFoodItems.length === 0) {
              return (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">ยังไม่มีอาหารของคุณ</p>
                  <Link
                    href="/menu"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    สั่งอาหาร
                  </Link>
                </div>
              );
            }

            return allFoodItems.map((item, index) => {
              const food = item.food;
              return (
                <motion.div
                  key={`${item.orderId}-${item.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white rounded-2xl p-4 border border-slate-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{item.foodName}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {food?.calories || item.calories || 0} kcal • P {food?.protein || 0}g • C {food?.carbs || 0}g • F {food?.fat || 0}g
                      </p>
                    </div>
                    <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                      ×{item.quantity}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelectClick(item)}
                    className="mt-3 w-full py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    เลือกทาน
                  </button>
                </motion.div>
              );
            });
          })()
        ) : (
          // รายการสั่งซื้อ - ไม่แสดงยอดเงิน
          activeOrders.length > 0 ? (
            activeOrders.map((order, index) => {
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
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{item.foodName}</span>
                          <span className="text-slate-400">×{item.quantity}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {item.food?.calories || item.calories || 0} kcal
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer - แค่ calories ไม่แสดงราคา */}
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      รวม {totalCalories} kcal
                    </span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="py-16 text-center">
              <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">ไม่มีรายการสั่งซื้อ</p>
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                สั่งอาหาร
              </Link>
            </div>
          )
        )}
      </div>

      {/* Quantity Selection Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              className="w-full bg-white rounded-t-3xl p-6"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

              <h3 className="text-lg font-semibold text-center mb-2">
                {selectedItem.foodName}
              </h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                คงเหลือ ×{selectedItem.quantity}
              </p>

              {/* Quantity Selector */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <button
                  onClick={() => setSelectQuantity(Math.max(1, selectQuantity - 1))}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                  disabled={selectQuantity <= 1}
                >
                  <Minus className="w-5 h-5" />
                </button>

                <span className="text-3xl font-semibold text-slate-800 min-w-[60px] text-center">
                  {selectQuantity}
                </span>

                <button
                  onClick={() => setSelectQuantity(Math.min(selectedItem.quantity, selectQuantity + 1))}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                  disabled={selectQuantity >= selectedItem.quantity}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Nutrition Preview */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-xs text-slate-500 mb-2">สารอาหารที่จะได้รับ</p>
                <p className="text-sm text-slate-700">
                  {(selectedItem.food?.calories || selectedItem.calories || 0) * selectQuantity} kcal •
                  P {(selectedItem.food?.protein || 0) * selectQuantity}g •
                  C {(selectedItem.food?.carbs || 0) * selectQuantity}g •
                  F {(selectedItem.food?.fat || 0) * selectQuantity}g
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmEat}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {isSaving ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
