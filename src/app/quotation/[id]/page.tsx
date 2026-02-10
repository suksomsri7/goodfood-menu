"use client";

import { useState, useEffect, use } from "react";
import { FileText, CreditCard, Copy, Check, QrCode, Building2, User, Phone, MapPin, Calendar, Package } from "lucide-react";

interface OrderItem {
  id: string;
  foodName: string;
  quantity: number;
  dayNumber: number;
  mealType: string;
  price: number;
}

interface PaymentAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  qrCodeUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  member: {
    displayName: string | null;
    phone: string | null;
  } | null;
  restaurant: {
    name: string;
    logoUrl: string | null;
  } | null;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  coursePlan: string | null;
  totalDays: number | null;
  totalPrice: number;
  deliveryFee: number;
  discount: number;
  finalPrice: number | null;
  status: string;
  items: OrderItem[];
  createdAt: string;
}

const planLabels: Record<string, string> = {
  "7_DAYS": "7 วัน",
  "15_DAYS": "15 วัน",
  "30_DAYS": "30 วัน",
  "CUSTOM": "กำหนดเอง",
  "single": "สั่งทีละรายการ",
};

const mealLabels: Record<string, string> = {
  breakfast: "เช้า",
  lunch: "กลางวัน",
  dinner: "เย็น",
  snack: "ว่าง",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "รอดำเนินการ", color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "รอชำระเงิน", color: "text-blue-600 bg-blue-50" },
  preparing: { label: "ชำระเงินแล้ว", color: "text-purple-600 bg-purple-50" },
  shipping: { label: "กำลังจัดส่ง", color: "text-blue-600 bg-blue-50" },
  completed: { label: "จัดส่งแล้ว", color: "text-green-600 bg-green-50" },
  cancelled: { label: "ยกเลิก", color: "text-red-600 bg-red-50" },
};

export default function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const fetchData = async () => {
    try {
      // Fetch order
      const orderRes = await fetch(`/api/orders/${resolvedParams.id}`);
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrder(orderData);
      }

      // Fetch payment account
      const paymentRes = await fetch("/api/settings/payment-accounts/default");
      if (paymentRes.ok) {
        const paymentData = await paymentRes.json();
        setPaymentAccount(paymentData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyAccountNumber = () => {
    if (paymentAccount?.accountNumber) {
      navigator.clipboard.writeText(paymentAccount.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto" />
          <p className="text-gray-500 mt-4">ไม่พบข้อมูลออเดอร์</p>
        </div>
      </div>
    );
  }

  const finalAmount = order.finalPrice ?? (order.totalPrice + order.deliveryFee - order.discount);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">ใบเสนอราคา</h1>
          <p className="text-green-100 mt-1">เลขที่ {order.orderNumber}</p>
          <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-medium ${statusLabels[order.status]?.color || "bg-gray-100 text-gray-600"}`}>
            {statusLabels[order.status]?.label || order.status}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 -mt-4">
        {/* Order Info Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
          {/* Date & Restaurant */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Calendar className="w-4 h-4" />
              {formatDate(order.createdAt)}
            </div>
            {order.restaurant && (
              <div className="flex items-center gap-3">
                {order.restaurant.logoUrl ? (
                  <img
                    src={order.restaurant.logoUrl}
                    alt={order.restaurant.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-orange-500" />
                  </div>
                )}
                <p className="font-semibold text-gray-800">{order.restaurant.name}</p>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              ข้อมูลผู้สั่ง
            </h3>
            <div className="space-y-2 text-sm">
              {order.deliveryName && (
                <p className="text-gray-800 font-medium">{order.deliveryName}</p>
              )}
              {order.deliveryPhone && (
                <p className="text-gray-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {order.deliveryPhone}
                </p>
              )}
              {order.deliveryAddress && (
                <p className="text-gray-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span>{order.deliveryAddress}</span>
                </p>
              )}
            </div>
          </div>

          {/* Package Info */}
          {order.coursePlan && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                <span className="font-medium text-gray-800">
                  {planLabels[order.coursePlan] || order.coursePlan}
                </span>
                {order.totalDays && order.totalDays > 1 && (
                  <span className="text-sm text-gray-500">({order.totalDays} วัน)</span>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">รายการ</h3>
            {Object.entries(groupItemsByDay(order.items))
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, items]) => (
                <div key={day} className="mb-4">
                  {order.totalDays && order.totalDays > 1 && (
                    <p className="text-sm font-medium text-green-600 mb-2">วันที่ {day}</p>
                  )}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-gray-800">{item.foodName}</p>
                          <p className="text-xs text-gray-500">
                            {mealLabels[item.mealType] || item.mealType} • {item.quantity} ชิ้น
                          </p>
                        </div>
                        <p className="font-medium text-gray-800">
                          ฿{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {/* Price Summary */}
            <div className="mt-4 pt-4 border-t-2 border-gray-200 space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>ยอดรวมอาหาร</span>
                <span>฿{order.totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ค่าจัดส่ง</span>
                <span>฿{order.deliveryFee.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>ส่วนลด</span>
                  <span>-฿{order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-200">
                <span>ยอดที่ต้องชำระ</span>
                <span className="text-green-600">฿{finalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Info Card */}
        {order.status === "confirmed" && paymentAccount && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                ช่องทางการชำระเงิน
              </h3>
              <p className="text-blue-100 text-sm mt-1">กรุณาโอนเงินตามข้อมูลด้านล่าง</p>
            </div>

            <div className="p-4">
              {/* QR Code */}
              {paymentAccount.qrCodeUrl && (
                <div className="text-center mb-4">
                  <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
                    <img
                      src={paymentAccount.qrCodeUrl}
                      alt="QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2 flex items-center justify-center gap-1">
                    <QrCode className="w-4 h-4" />
                    สแกน QR เพื่อชำระเงิน
                  </p>
                </div>
              )}

              {/* Bank Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">ธนาคาร</p>
                    <p className="font-semibold text-gray-800">{paymentAccount.bankName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ชื่อบัญชี</p>
                    <p className="font-semibold text-gray-800">{paymentAccount.accountName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">เลขบัญชี</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-xl text-blue-600">{paymentAccount.accountNumber}</p>
                      <button
                        onClick={copyAccountNumber}
                        className={`p-2 rounded-lg transition-colors ${
                          copied ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount to Pay */}
              <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm text-green-700 mb-1">ยอดที่ต้องโอน</p>
                <p className="text-3xl font-bold text-green-600">฿{finalAmount.toLocaleString()}</p>
              </div>

              {/* Note */}
              <p className="text-xs text-gray-500 mt-4 text-center">
                หลังโอนเงิน กรุณาแจ้งสลิปการโอนทาง LINE เพื่อยืนยันการชำระเงิน
              </p>
            </div>
          </div>
        )}

        {/* Already Paid */}
        {(order.status === "preparing" || order.status === "shipping" || order.status === "completed") && (
          <div className="bg-green-50 rounded-2xl p-6 text-center border border-green-200">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-bold text-green-800 text-lg">ชำระเงินเรียบร้อยแล้ว</h3>
            <p className="text-green-600 mt-1">ขอบคุณที่ใช้บริการ</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-sm text-gray-400">
          <p>หากมีข้อสงสัย กรุณาติดต่อทาง LINE</p>
        </div>
      </div>
    </div>
  );
}
