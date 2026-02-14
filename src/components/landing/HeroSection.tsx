"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Camera, BarChart3 } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative lg:min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-white to-white" />

      {/* Decorative blobs */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary-100/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary-50/50 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 lg:py-40">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Content */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-full mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary-600" />
              <span className="text-sm text-primary-700 font-medium">
                ขับเคลื่อนด้วย AI
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight"
            >
              ลดน้ำหนัก ดูแลสุขภาพ
              <br />
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                ง่ายๆ ด้วย AI
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-lg text-gray-500 leading-relaxed max-w-lg mx-auto lg:mx-0"
            >
              แอปนับแคลอรี่อัจฉริยะ ถ่ายรูปอาหาร AI วิเคราะห์โภชนาการทันที
              สั่งอาหารเพื่อสุขภาพ พร้อมโค้ชส่วนตัวตลอด 24 ชั่วโมง
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-wrap justify-center lg:justify-start gap-4"
            >
              <a
                href="https://lin.ee/CPSTFxN"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#06C755] text-white font-medium rounded-full hover:bg-[#05b04c] transition-all hover:shadow-lg hover:shadow-green-500/20"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                เพิ่มเพื่อน LINE
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  document
                    .querySelector("#features")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 px-8 py-4 text-gray-600 font-medium rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                ดูคุณสมบัติ
              </button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 flex flex-wrap justify-center lg:justify-start items-center gap-4 md:gap-6 text-sm text-gray-400"
            >
              <span>ฟรี ไม่มีค่าใช้จ่าย</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full hidden md:block" />
              <span>ใช้งานผ่าน LINE</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full hidden md:block" />
              <span>ไม่ต้องติดตั้งแอป</span>
            </motion.div>
          </div>

          {/* Right - Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex justify-center"
          >
            <div className="relative scale-[0.85] md:scale-100 origin-top">
              {/* Phone frame */}
              <div className="w-[280px] h-[580px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl shadow-gray-900/20">
                <div className="w-full h-full bg-white rounded-[2.4rem] overflow-hidden relative">
                  {/* Status bar */}
                  <div className="h-12 bg-primary-500 flex items-center justify-center">
                    <div className="w-20 h-5 bg-black/20 rounded-full mt-1" />
                  </div>
                  {/* App content */}
                  <div className="p-4 space-y-4">
                    {/* Calorie ring */}
                    <div className="flex justify-center py-4">
                      <div className="w-32 h-32 rounded-full border-8 border-primary-100 relative flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-8 border-primary-500 border-t-transparent border-r-transparent rotate-45" />
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            1,240
                          </div>
                          <div className="text-xs text-gray-400">แคลอรี่</div>
                        </div>
                      </div>
                    </div>
                    {/* Macro bars */}
                    <div className="space-y-3">
                      {[
                        { label: "โปรตีน", w: "70%", color: "bg-blue-400" },
                        { label: "คาร์บ", w: "45%", color: "bg-amber-400" },
                        { label: "ไขมัน", w: "60%", color: "bg-rose-400" },
                      ].map((bar) => (
                        <div key={bar.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">{bar.label}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${bar.color}`}
                              initial={{ width: 0 }}
                              animate={{ width: bar.w }}
                              transition={{ duration: 1, delay: 0.8 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Meal items */}
                    <div className="space-y-2 mt-4">
                      {[
                        { name: "มื้อเช้า", cal: "420 kcal", emoji: "🍳", bg: "bg-amber-100" },
                        { name: "มื้อกลางวัน", cal: "580 kcal", emoji: "🥗", bg: "bg-primary-100" },
                      ].map((meal) => (
                        <div
                          key={meal.name}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg ${meal.bg} flex items-center justify-center`}
                          >
                            <span className="text-sm">{meal.emoji}</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-700">
                              {meal.name}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {meal.cal}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating card - left (hidden on mobile to prevent overflow) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="hidden md:block absolute -left-20 top-32 bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-4 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                    <Camera className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-900">
                      ถ่ายรูปอาหาร
                    </div>
                    <div className="text-[10px] text-gray-400">
                      AI วิเคราะห์ทันที
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating card - right (hidden on mobile to prevent overflow) */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 1.2 }}
                className="hidden md:block absolute -right-16 bottom-40 bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-4 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-900">
                      ติดตามผล
                    </div>
                    <div className="text-[10px] text-gray-400">
                      กราฟ & สถิติ
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
