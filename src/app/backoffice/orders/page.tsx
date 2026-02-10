"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/backoffice/Header";
import { User, Phone, Mail, MessageCircle, Package, Truck, Trash2, Store, MapPin, Calendar, Clock, Edit3, Save, X, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  phone: string | null;
  email: string | null;
}

interface OrderItem {
  id: string;
  foodId: string;
  foodName: string;
  quantity: number;
  dayNumber: number;
  mealType: string;
  price: number;
}

interface Restaurant {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  memberId: string | null;
  member: Member | null;
  restaurantId: string | null;
  restaurant: Restaurant | null;
  coursePlan: string;
  totalDays: number;
  totalPrice: number;
  deliveryFee: number;
  discount: number;
  discountType: string | null;
  discountValue: number | null;
  packageName: string | null;
  finalPrice: number | null;
  status: string;
  note: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: "รอดำเนินการ", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: "⏳" },
  confirmed: { label: "ยืนยันคำสั่งซื้อ", color: "text-green-700", bgColor: "bg-green-50 border-green-200", icon: "✅" },
  preparing: { label: "รับชำระเงิน", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200", icon: "💰" },
  shipping: { label: "กำลังจัดส่ง", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", icon: "🚚" },
  completed: { label: "จัดส่งเรียบร้อย", color: "text-teal-700", bgColor: "bg-teal-50 border-teal-200", icon: "✅" },
  cancelled: { label: "ยกเลิก", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: "❌" },
};

const carrierOptions = [
  "Kerry Express",
  "Flash Express",
  "J&T Express",
  "Thailand Post",
  "Ninja Van",
  "Best Express",
  "DHL",
  "Grab Express",
  "Lalamove",
  "อื่นๆ",
];

const planLabels: Record<string, string> = {
  "7_DAYS": "7 วัน",
  "15_DAYS": "15 วัน",
  "30_DAYS": "30 วัน",
  "CUSTOM": "กำหนดเอง",
  "single": "สั่งทีละรายการ",
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
  
  // Tracking modal state
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Edit price state
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editDeliveryFee, setEditDeliveryFee] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editItemPrices, setEditItemPrices] = useState<Record<string, number>>({});
  const [savingPrice, setSavingPrice] = useState(false);

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

  const updateOrderStatus = async (orderId: string, newStatus: string, extraData?: { trackingNumber?: string; carrier?: string }) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          ...extraData
        }),
      });
      
      if (res.ok) {
        const updatedOrder = await res.json();
        fetchOrders();
        // Update selected order
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updatedOrder);
        }
        setShowTrackingModal(false);
        setTrackingNumber("");
        setCarrier("");
      }
    } catch (error) {
      console.error("Error updating order:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusClick = (orderId: string, newStatus: string) => {
    if (newStatus === "shipping") {
      // Show tracking modal for shipping status
      setShowTrackingModal(true);
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  const handleShippingSubmit = () => {
    if (!selectedOrder) return;
    updateOrderStatus(selectedOrder.id, "shipping", {
      trackingNumber: trackingNumber || undefined,
      carrier: carrier || undefined,
    });
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`ต้องการลบออเดอร์ #${orderNumber} หรือไม่?\n\nการลบจะไม่สามารถกู้คืนได้`)) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "เกิดข้อผิดพลาดในการลบ");
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // Start editing prices
  const startEditingPrice = () => {
    if (!selectedOrder) return;
    setEditDeliveryFee(selectedOrder.deliveryFee || 0);
    setEditDiscount(selectedOrder.discount || 0);
    const itemPrices: Record<string, number> = {};
    selectedOrder.items.forEach(item => {
      itemPrices[item.id] = item.price;
    });
    setEditItemPrices(itemPrices);
    setIsEditingPrice(true);
  };

  // Cancel editing
  const cancelEditingPrice = () => {
    setIsEditingPrice(false);
    setEditItemPrices({});
  };

  // Save price changes
  const savePriceChanges = async () => {
    if (!selectedOrder) return;
    setSavingPrice(true);

    try {
      // Calculate new total
      const itemsTotal = selectedOrder.items.reduce((sum, item) => {
        const newPrice = editItemPrices[item.id] ?? item.price;
        return sum + (newPrice * item.quantity);
      }, 0);
      
      const newTotalPrice = itemsTotal;
      const newFinalPrice = itemsTotal + editDeliveryFee - editDiscount;

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryFee: editDeliveryFee,
          discount: editDiscount,
          totalPrice: newTotalPrice,
          finalPrice: newFinalPrice,
          items: Object.entries(editItemPrices).map(([itemId, price]) => ({
            id: itemId,
            price,
          })),
          sendNotification: false,
        }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setSelectedOrder(updatedOrder);
        fetchOrders();
        setIsEditingPrice(false);
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      console.error("Error saving prices:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setSavingPrice(false);
    }
  };

  // Calculate totals for edit mode
  const calculateEditTotals = () => {
    if (!selectedOrder) return { itemsTotal: 0, finalPrice: 0 };
    const itemsTotal = selectedOrder.items.reduce((sum, item) => {
      const newPrice = editItemPrices[item.id] ?? item.price;
      return sum + (newPrice * item.quantity);
    }, 0);
    const finalPrice = itemsTotal + editDeliveryFee - editDiscount;
    return { itemsTotal, finalPrice };
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
      const day = item.dayNumber || 1;
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    }, {} as Record<number, OrderItem[]>);
  };

  return (
    <div>
      <Header title="ออเดอร์" subtitle="จัดการรายการสั่งซื้อจากลูกค้า" />
      
      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {[
            { status: "all", label: "ทั้งหมด", icon: "📋", count: orders.length },
            { status: "pending", label: "รอดำเนินการ", icon: "⏳", count: orders.filter(o => o.status === "pending").length },
            { status: "confirmed", label: "ยืนยันคำสั่งซื้อ", icon: "✅", count: orders.filter(o => o.status === "confirmed").length },
            { status: "preparing", label: "รับชำระเงิน", icon: "💰", count: orders.filter(o => o.status === "preparing").length },
            { status: "shipping", label: "กำลังจัดส่ง", icon: "🚚", count: orders.filter(o => o.status === "shipping").length },
            { status: "completed", label: "จัดส่งเรียบร้อย", icon: "✅", count: orders.filter(o => o.status === "completed").length },
          ].map((stat) => (
            <button
              key={stat.status}
              onClick={() => setFilterStatus(stat.status)}
              className={`p-4 rounded-xl border transition-all ${
                filterStatus === stat.status
                  ? "border-green-500 bg-green-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-green-200"
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
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mx-auto" />
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
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ลูกค้า</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">เลขออเดอร์</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ร้านค้า</th>
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
                        <div className="flex items-center gap-3">
                          {order.member?.pictureUrl ? (
                            <img 
                              src={order.member.pictureUrl} 
                              alt={order.member.displayName || "User"}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">
                              {order.member?.displayName || "ไม่ระบุชื่อ"}
                            </p>
                            {order.member?.phone && (
                              <p className="text-xs text-gray-500">{order.member.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-green-600">{order.orderNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        {order.restaurant ? (
                          <span className="text-gray-800">{order.restaurant.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-800">{planLabels[order.coursePlan] || order.coursePlan}</span>
                        {order.totalDays > 1 && (
                          <span className="text-gray-400 text-sm ml-1">({order.totalDays} วัน)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-800">{order.items.length} รายการ</span>
                      </td>
                      <td className="px-6 py-4">
                        {order.discount > 0 ? (
                          <div>
                            <span className="font-semibold text-green-600">฿{(order.finalPrice || order.totalPrice).toLocaleString()}</span>
                            <div className="text-xs text-gray-400 line-through">฿{order.totalPrice.toLocaleString()}</div>
                            <div className="text-xs text-green-500">-฿{order.discount.toLocaleString()}</div>
                          </div>
                        ) : (
                          <span className="font-semibold text-gray-800">฿{order.totalPrice.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color}`}>
                          {statusConfig[order.status]?.icon} {statusConfig[order.status]?.label || order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                          >
                            ดูรายละเอียด
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบออเดอร์"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setSelectedOrder(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">รายละเอียดออเดอร์</h2>
                  <p className="text-sm text-green-600 font-mono">{selectedOrder.orderNumber}</p>
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
                {/* Order Info: Date & Restaurant */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Date/Time */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      วันที่สั่งซื้อ
                    </h3>
                    <p className="text-lg font-semibold text-gray-800">
                      {new Date(selectedOrder.createdAt).toLocaleDateString("th-TH", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4" />
                      {new Date(selectedOrder.createdAt).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} น.
                    </p>
                  </div>

                  {/* Restaurant */}
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Store className="w-4 h-4 text-orange-600" />
                      ร้านค้า
                    </h3>
                    {selectedOrder.restaurant ? (
                      <div className="flex items-center gap-3">
                        {selectedOrder.restaurant.logoUrl ? (
                          <img
                            src={selectedOrder.restaurant.logoUrl}
                            alt={selectedOrder.restaurant.name}
                            className="w-12 h-12 rounded-lg object-cover border border-orange-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Store className="w-6 h-6 text-orange-400" />
                          </div>
                        )}
                        <p className="font-semibold text-gray-800">{selectedOrder.restaurant.name}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500">ไม่ระบุร้านค้า</p>
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    ข้อมูลลูกค้า
                  </h3>
                  <div className="flex items-start gap-4">
                    {selectedOrder.member?.pictureUrl ? (
                      <img 
                        src={selectedOrder.member.pictureUrl} 
                        alt={selectedOrder.member.displayName || "User"}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white shadow-md">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-lg">
                        {selectedOrder.member?.displayName || "ไม่ระบุชื่อ"}
                      </p>
                      {selectedOrder.member?.phone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Phone className="w-4 h-4" />
                          {selectedOrder.member.phone}
                        </p>
                      )}
                      {selectedOrder.member?.email && (
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Mail className="w-4 h-4" />
                          {selectedOrder.member.email}
                        </p>
                      )}
                      {selectedOrder.member?.lineUserId && (
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-2">
                          <MessageCircle className="w-3 h-3" />
                          LINE ID: {selectedOrder.member.lineUserId.slice(0, 10)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                {(selectedOrder.deliveryName || selectedOrder.deliveryAddress) && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      ที่อยู่จัดส่ง
                    </h3>
                    <div className="space-y-2">
                      {selectedOrder.deliveryName && (
                        <p className="font-semibold text-gray-800">{selectedOrder.deliveryName}</p>
                      )}
                      {selectedOrder.deliveryPhone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {selectedOrder.deliveryPhone}
                        </p>
                      )}
                      {selectedOrder.deliveryAddress && (
                        <p className="text-sm text-gray-600">{selectedOrder.deliveryAddress}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tracking Info (if shipping or completed) */}
                {(selectedOrder.status === "shipping" || selectedOrder.status === "completed") && (selectedOrder.trackingNumber || selectedOrder.carrier) && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      ข้อมูลการจัดส่ง
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedOrder.trackingNumber && (
                        <div>
                          <p className="text-xs text-gray-500">เลขพัสดุ</p>
                          <p className="font-mono font-semibold text-blue-600">{selectedOrder.trackingNumber}</p>
                        </div>
                      )}
                      {selectedOrder.carrier && (
                        <div>
                          <p className="text-xs text-gray-500">ขนส่ง</p>
                          <p className="font-semibold text-gray-800">{selectedOrder.carrier}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Info */}
                <div className="mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl mb-4">
                    <p className="text-xs text-gray-500 mb-1">แพ็คเกจ</p>
                    <p className="font-semibold">{planLabels[selectedOrder.coursePlan] || selectedOrder.coursePlan} {selectedOrder.totalDays > 1 && `(${selectedOrder.totalDays} วัน)`}</p>
                  </div>

                  {/* Note */}
                  {selectedOrder.note && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
                      <p className="text-xs text-amber-600 font-medium mb-1">📝 หมายเหตุ</p>
                      <p className="text-gray-700">{selectedOrder.note}</p>
                    </div>
                  )}

                  {/* Items by Day */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">🍽️ รายการเมนู</h3>
                    {!isEditingPrice ? (
                      <button
                        onClick={startEditingPrice}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        แก้ไขราคา
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEditingPrice}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          ยกเลิก
                        </button>
                        <button
                          onClick={savePriceChanges}
                          disabled={savingPrice}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {savingPrice ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                      </div>
                    )}
                  </div>
                  {Object.entries(groupItemsByDay(selectedOrder.items))
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([day, items]) => (
                      <div key={day} className="mb-4">
                        {selectedOrder.totalDays > 1 && (
                          <p className="text-sm font-medium text-green-600 mb-2">📅 วันที่ {day}</p>
                        )}
                        <div className="space-y-2">
                          {items.map((item) => {
                            const itemPrice = isEditingPrice ? (editItemPrices[item.id] ?? item.price) : item.price;
                            const totalItemPrice = itemPrice * item.quantity;
                            return (
                              <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-gray-800">{item.foodName}</p>
                                  <p className="text-xs text-gray-500">{mealLabels[item.mealType] || item.mealType}</p>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  {isEditingPrice ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500">{item.quantity} x</span>
                                      <input
                                        type="number"
                                        value={editItemPrices[item.id] ?? item.price}
                                        onChange={(e) => setEditItemPrices({
                                          ...editItemPrices,
                                          [item.id]: parseFloat(e.target.value) || 0
                                        })}
                                        className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right font-mono"
                                        min="0"
                                      />
                                      <span className="text-gray-400">฿</span>
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">
                                      {item.quantity} x ฿{item.price.toLocaleString()}
                                    </p>
                                  )}
                                  <p className="font-semibold text-gray-700">= ฿{totalItemPrice.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                  {/* Price Summary */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 mt-4">
                    {/* ยอดรวมก่อนส่วนลด */}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">ยอดรวมอาหาร</span>
                      <span className="font-semibold text-gray-800">
                        ฿{isEditingPrice ? calculateEditTotals().itemsTotal.toLocaleString() : selectedOrder.totalPrice.toLocaleString()}
                      </span>
                    </div>

                    {/* ค่าจัดส่ง */}
                    <div className="flex items-center justify-between py-2 border-t border-green-200">
                      <span className="text-gray-600">ค่าจัดส่ง</span>
                      {isEditingPrice ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editDeliveryFee}
                            onChange={(e) => setEditDeliveryFee(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right font-mono"
                            min="0"
                          />
                          <span className="text-gray-400">฿</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-800">฿{(selectedOrder.deliveryFee || 0).toLocaleString()}</span>
                      )}
                    </div>

                    {/* ส่วนลด */}
                    <div className="flex items-center justify-between py-2 border-t border-green-200">
                      <div>
                        <span className="text-green-600">ส่วนลด</span>
                        {!isEditingPrice && selectedOrder.packageName && (
                          <p className="text-xs text-green-500">🎉 {selectedOrder.packageName}</p>
                        )}
                      </div>
                      {isEditingPrice ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-500">-</span>
                          <input
                            type="number"
                            value={editDiscount}
                            onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right font-mono"
                            min="0"
                          />
                          <span className="text-gray-400">฿</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-green-600">-฿{(selectedOrder.discount || 0).toLocaleString()}</span>
                      )}
                    </div>

                    {/* ที่ต้องชำระ */}
                    <div className="flex items-center justify-between py-3 border-t-2 border-green-300 mt-2">
                      <span className="font-bold text-gray-800 text-lg">ที่ต้องชำระ</span>
                      <span className="font-bold text-green-600 text-2xl">
                        ฿{isEditingPrice 
                          ? calculateEditTotals().finalPrice.toLocaleString() 
                          : (selectedOrder.finalPrice || selectedOrder.totalPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Quotation Link */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">ใบเสนอราคา</span>
                      </div>
                      <a
                        href={`/quotation/${selectedOrder.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        ดูใบเสนอราคา
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer - Status Actions */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">เปลี่ยนสถานะ (จะแจ้งลูกค้าทาง LINE อัตโนมัติ)</p>
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id, selectedOrder.orderNumber)}
                    className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    ลบออเดอร์
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => handleStatusClick(selectedOrder.id, status)}
                      disabled={selectedOrder.status === status || updatingStatus}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                        selectedOrder.status === status
                          ? `${config.bgColor} ${config.color} cursor-not-allowed`
                          : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                      } disabled:opacity-50`}
                    >
                      {config.icon} {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tracking Number Modal */}
      <AnimatePresence>
        {showTrackingModal && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowTrackingModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  ข้อมูลการจัดส่ง
                </h3>
                <p className="text-sm text-gray-500">กรอกเลขพัสดุและขนส่งก่อนเปลี่ยนสถานะ</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ขนส่ง
                  </label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">เลือกขนส่ง</option>
                    {carrierOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขพัสดุ
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="เช่น TH12345678901"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowTrackingModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleShippingSubmit}
                  disabled={updatingStatus}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      กำลังจัดส่ง
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
