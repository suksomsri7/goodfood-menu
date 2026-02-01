"use client";

import { useState, useEffect } from "react";

interface OrderItem {
  id: string;
  foodId: string;
  foodName: string;
  quantity: number;
  dayNumber: number;
  mealType: string;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  memberId: string | null;
  coursePlan: string;
  totalDays: number;
  totalPrice: number;
  status: string;
  note: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "รอดำเนินการ", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  confirmed: { label: "ยืนยันแล้ว", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  preparing: { label: "กำลังเตรียม", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
  delivered: { label: "จัดส่งแล้ว", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  cancelled: { label: "ยกเลิก", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
};

const planLabels: Record<string, string> = {
  "7_DAYS": "7 วัน",
  "15_DAYS": "15 วัน",
  "30_DAYS": "30 วัน",
  "CUSTOM": "กำหนดเอง",
};

const mealLabels: Record<string, string> = {
  breakfast: "🌅 เช้า",
  lunch: "☀️ กลางวัน",
  dinner: "🌙 เย็น",
  snack: "🍎 ว่าง",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (res.ok) {
        fetchOrders();
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const filteredOrders = orders.filter(
    order => filterStatus === "all" || order.status === filterStatus
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group items by day
  const groupItemsByDay = (items: OrderItem[]) => {
    return items.reduce((acc, item) => {
      const day = item.dayNumber;
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    }, {} as Record<number, OrderItem[]>);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📦 ออเดอร์</h1>
          <p className="text-sm text-gray-500">จัดการรายการสั่งซื้อจากลูกค้า</p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
        >
          <span>🔄</span>
          <span>รีเฟรช</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { status: "all", label: "ทั้งหมด", icon: "📋", count: orders.length },
          { status: "pending", label: "รอดำเนินการ", icon: "⏳", count: orders.filter(o => o.status === "pending").length },
          { status: "confirmed", label: "ยืนยันแล้ว", icon: "✅", count: orders.filter(o => o.status === "confirmed").length },
          { status: "preparing", label: "กำลังเตรียม", icon: "👨‍🍳", count: orders.filter(o => o.status === "preparing").length },
          { status: "delivered", label: "จัดส่งแล้ว", icon: "🚚", count: orders.filter(o => o.status === "delivered").length },
        ].map((stat) => (
          <button
            key={stat.status}
            onClick={() => setFilterStatus(stat.status)}
            className={`p-4 rounded-xl border transition-all ${
              filterStatus === stat.status
                ? "border-primary-500 bg-primary-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-primary-200"
            }`}
          >
            <span className="text-2xl">{stat.icon}</span>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stat.count}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 mt-4">กำลังโหลด...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-5xl">📭</span>
            <p className="text-gray-500 mt-4">ยังไม่มีออเดอร์</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">เลขออเดอร์</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">แพ็คเกจ</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">จำนวนเมนู</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ราคารวม</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">สถานะ</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">วันที่สั่ง</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-primary-600">{order.orderNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-800">{planLabels[order.coursePlan] || order.coursePlan}</span>
                      <span className="text-gray-400 text-sm ml-1">({order.totalDays} วัน)</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-800">{order.items.length} รายการ</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">฿{order.totalPrice.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color}`}>
                        {statusConfig[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                      >
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">รายละเอียดออเดอร์</h2>
                <p className="text-sm text-primary-600 font-mono">{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">แพ็คเกจ</p>
                  <p className="font-semibold">{planLabels[selectedOrder.coursePlan]} ({selectedOrder.totalDays} วัน)</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">ราคารวม</p>
                  <p className="font-bold text-primary-600 text-xl">฿{selectedOrder.totalPrice.toLocaleString()}</p>
                </div>
              </div>

              {/* Items by Day */}
              <h3 className="font-semibold text-gray-800 mb-3">รายการเมนู</h3>
              {Object.entries(groupItemsByDay(selectedOrder.items))
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([day, items]) => (
                  <div key={day} className="mb-4">
                    <p className="text-sm font-medium text-primary-600 mb-2">📅 วันที่ {day}</p>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-800">{item.foodName}</p>
                            <p className="text-xs text-gray-500">{mealLabels[item.mealType] || item.mealType}</p>
                          </div>
                          <p className="font-semibold text-gray-700">฿{item.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Footer - Status Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-sm text-gray-500 mb-3">เปลี่ยนสถานะ</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([status, config]) => (
                  <button
                    key={status}
                    onClick={() => updateOrderStatus(selectedOrder.id, status)}
                    disabled={selectedOrder.status === status}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      selectedOrder.status === status
                        ? `${config.bgColor} ${config.color} cursor-not-allowed`
                        : "bg-white border-gray-200 text-gray-600 hover:border-primary-300"
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
