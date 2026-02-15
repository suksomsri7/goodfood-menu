"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Clock, Crown, UtensilsCrossed, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName?: string;
  memberTypeName?: string;
  limitType?: string;
  limitCount?: number;
  usedCount?: number;
}

export function LimitReachedModal({
  isOpen,
  onClose,
  memberName,
  memberTypeName = "ทั่วไป",
  limitType = "AI",
  limitCount,
  usedCount,
}: LimitReachedModalProps) {
  const router = useRouter();

  const handleUpgradePremium = () => {
    // TODO: Navigate to premium signup or show payment modal
    onClose();
    // For now, we can send a message to LINE chat
    alert("กรุณาพิมพ์ 'สมัคร Premium' ในแชท LINE เพื่อดำเนินการ");
  };

  const handleOrderFood = () => {
    onClose();
    router.push("/menu");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
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
              {/* Greeting */}
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
                      <p className="text-purple-600 text-xs font-medium">เพียง 350 บาท ใช้ได้ Unlimited 30 วัน</p>
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
