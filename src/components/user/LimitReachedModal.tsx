"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Clock, Crown, UtensilsCrossed, Sparkles, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName?: string;
  memberTypeName?: string;
  limitType?: string;
  limitCount?: number;
  usedCount?: number;
  lineUserId?: string;
}

export function LimitReachedModal({
  isOpen,
  onClose,
  memberName,
  memberTypeName = "ทั่วไป",
  limitType = "AI",
  limitCount,
  usedCount,
  lineUserId,
}: LimitReachedModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"options" | "confirm" | "success">("options");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // Premium settings from API
  const [premiumPrice, setPremiumPrice] = useState(299);
  const [premiumDays, setPremiumDays] = useState(30);

  // Fetch premium settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings/ai-coach");
        if (res.ok) {
          const data = await res.json();
          setPremiumPrice(data.premiumPrice ?? 299);
          setPremiumDays(data.premiumDays ?? 30);
        }
      } catch (error) {
        console.error("Error fetching premium settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("options");
      setOrderNumber(null);
      setOrderId(null);
    }
  }, [isOpen]);

  const handleUpgradePremium = () => {
    setStep("confirm");
  };

  const handleConfirmOrder = async () => {
    setIsCreatingOrder(true);
    const requestBody = {
      coursePlan: "PREMIUM_UPGRADE",
      totalDays: premiumDays,
      totalPrice: premiumPrice,
      finalPrice: premiumPrice,
      lineUserId,
      packageName: `Premium AI Coach ${premiumDays} วัน`,
      note: `อัพเกรดเป็น Premium - ใช้ AI ได้ไม่จำกัด ${premiumDays} วัน`,
      items: [],
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const order = await res.json();
        setOrderNumber(order.orderNumber);
        setOrderId(order.id);
        setStep("success");
      } else {
        alert("ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleViewQuotation = () => {
    if (orderId) {
      onClose();
      router.push(`/quotation/${orderId}`);
    }
  };

  const handleOrderFood = () => {
    onClose();
    router.push("/menu");
  };

  const handleBack = () => {
    setStep("options");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - z-[60] to be above other modals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={step === "options" ? onClose : undefined}
            className="fixed inset-0 bg-black/50 z-[60]"
          />

          {/* Modal - z-[60] to be above other modals */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white rounded-3xl shadow-2xl z-[60] overflow-hidden"
          >
            {step === "options" && (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 relative">
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">ถึงขีดจำกัดการใช้งานแล้ว</h2>
                      <p className="text-white/80 text-sm">
                        {limitCount ? `ใช้ ${limitType} ครบ ${limitCount} ครั้ง/วันแล้ว` : `ใช้งาน ${limitType} ครบแล้ววันนี้`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                  {memberName && (
                    <p className="text-gray-600">
                      สวัสดีคุณ <span className="font-semibold">{memberName}</span> 👋
                    </p>
                  )}
                  
                  <p className="text-gray-500 text-sm">
                    ประเภทสมาชิกปัจจุบัน: <span className="font-medium text-gray-700">{memberTypeName}</span>
                  </p>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      วิธีเพิ่ม Limit การใช้งาน
                    </h3>

                    {/* Options */}
                    <div className="space-y-3">
                      {/* Option 1: Wait */}
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">รอวันพรุ่งนี้</p>
                          <p className="text-gray-500 text-xs">Limit รีเซ็ตทุกวันเวลา 00:00 น.</p>
                        </div>
                      </div>

                      {/* Option 2: Upgrade Premium */}
                      <button
                        onClick={handleUpgradePremium}
                        className="w-full flex items-start gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Crown className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-700 text-sm">อัพเกรดเป็น Premium</p>
                          <p className="text-purple-600 text-xs font-medium">เพียง {premiumPrice} บาท ใช้ได้ Unlimited {premiumDays} วัน</p>
                        </div>
                        <span className="text-purple-500 text-xl">→</span>
                      </button>

                      {/* Option 3: Order Food */}
                      <button
                        onClick={handleOrderFood}
                        className="w-full flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-200 hover:border-green-400 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-green-700 text-sm">สั่งอาหารจากเมนู</p>
                          <p className="text-green-600 text-xs">ได้รับ Limit เพิ่มเมื่อสั่งอาหาร</p>
                        </div>
                        <span className="text-green-500 text-xl">→</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <button
                    onClick={onClose}
                    className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5 relative">
                  <button
                    onClick={handleBack}
                    className="absolute left-4 top-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                  <div className="text-center pt-2">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Crown className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">อัพเกรด Premium</h2>
                    <p className="text-white/80 text-sm">ใช้ AI ได้ไม่จำกัด {premiumDays} วัน</p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  {/* Package Info */}
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600 text-sm">แพ็คเกจ</span>
                      <span className="font-semibold text-purple-700">Premium AI Coach</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600 text-sm">ระยะเวลา</span>
                      <span className="font-medium text-gray-800">{premiumDays} วัน</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                      <span className="text-gray-700 font-medium">ราคา</span>
                      <span className="text-2xl font-bold text-purple-600">฿{premiumPrice}</span>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                    <h3 className="font-semibold text-purple-800 text-sm mb-3">✨ สิทธิพิเศษที่ได้รับ</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>ใช้ AI วิเคราะห์อาหารได้ไม่จำกัด</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>ใช้ AI Coach ได้ไม่จำกัด</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>สแกนบาร์โค้ดได้ไม่จำกัด</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>AI เลือกเมนูให้ได้ไม่จำกัด</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 space-y-3">
                  <button
                    onClick={handleConfirmOrder}
                    disabled={isCreatingOrder}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingOrder ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>กำลังสร้างคำสั่งซื้อ...</span>
                      </>
                    ) : (
                      <>
                        <span>ยืนยันสั่งซื้อ ฿{premiumPrice}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleBack}
                    className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                  >
                    ย้อนกลับ
                  </button>
                </div>
              </>
            )}

            {step === "success" && (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-8 text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">สร้างคำสั่งซื้อสำเร็จ!</h2>
                  <p className="text-white/80 text-sm mt-1">หมายเลขคำสั่งซื้อ: {orderNumber}</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <p className="text-amber-800 text-sm">
                      <strong>ขั้นตอนต่อไป:</strong> กรุณาโอนเงิน ฿{premiumPrice} แล้วแจ้งสลิปผ่านแชท LINE เพื่อยืนยันการชำระเงิน
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600 text-sm">แพ็คเกจ</span>
                      <span className="font-medium text-gray-800">Premium AI Coach {premiumDays} วัน</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-700 font-medium">ยอดชำระ</span>
                      <span className="text-xl font-bold text-green-600">฿{premiumPrice}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 space-y-3">
                  <button
                    onClick={handleViewQuotation}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>รายละเอียดการชำระเงิน</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
