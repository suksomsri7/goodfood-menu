"use client";

import { motion } from "framer-motion";
import { Plus, ShoppingBag, Clock, CheckCircle, Truck, Package, XCircle } from "lucide-react";
import Link from "next/link";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderedFood {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  price: number;
  date: string;
  status?: OrderStatus;
  orderNumber?: string;
}

interface FoodStockCardProps {
  items: OrderedFood[];
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: "รอยืนยัน", color: "text-yellow-600", bgColor: "bg-yellow-50", icon: Clock },
  confirmed: { label: "ยืนยันแล้ว", color: "text-blue-600", bgColor: "bg-blue-50", icon: CheckCircle },
  preparing: { label: "กำลังเตรียม", color: "text-orange-600", bgColor: "bg-orange-50", icon: Package },
  ready: { label: "พร้อมส่ง", color: "text-red-600", bgColor: "bg-red-50", icon: Truck },
  completed: { label: "เสร็จสิ้น", color: "text-rose-600", bgColor: "bg-rose-50", icon: CheckCircle },
  cancelled: { label: "ยกเลิก", color: "text-red-600", bgColor: "bg-red-50", icon: XCircle },
};

export function FoodStockCard({ items }: FoodStockCardProps) {
  const totalCalories = items.reduce((sum, item) => sum + item.calories * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-white rounded-2xl p-6 border border-slate-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-900">รายการอาหารที่สั่ง</h3>
          <p className="text-sm text-slate-500">{totalItems} รายการ · {totalCalories} kcal</p>
        </div>
        <Link
          href="/menu"
          className="w-9 h-9 bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center justify-center transition-colors"
        >
          <Plus className="w-4 h-4 text-white" />
        </Link>
      </div>

      {/* Order List */}
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => {
            const status = item.status || "pending";
            const config = statusConfig[status];
            const StatusIcon = config.icon;
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="py-3 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.calories} kcal · {item.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">×{item.quantity}</p>
                    <p className="text-xs text-slate-500">฿{item.price * item.quantity}</p>
                  </div>
                </div>
                {/* Status Badge */}
                <div className="flex items-center justify-between mt-2">
                  {item.orderNumber && (
                    <span className="text-xs text-slate-400">#{item.orderNumber}</span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">ยังไม่มีรายการอาหาร</p>
          <Link
            href="/menu"
            className="inline-block mt-3 text-sm font-medium text-slate-900 hover:underline"
          >
            ไปเลือกเมนู →
          </Link>
        </div>
      )}

      {/* Footer */}
      {items.length > 0 && (
        <Link
          href="/menu"
          className="block w-full mt-4 pt-4 border-t border-slate-100 text-sm text-center text-slate-500 hover:text-slate-700 transition-colors"
        >
          เพิ่มรายการอาหาร →
        </Link>
      )}
    </motion.div>
  );
}
