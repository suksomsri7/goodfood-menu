"use client";

import {
  Sparkles,
  Camera,
  MessageSquare,
  BarChart3,
  Clock,
} from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const aiFeatures = [
  {
    icon: Camera,
    title: "วิเคราะห์อาหารจากรูปถ่าย",
    description:
      "ถ่ายรูปอาหาร AI รู้จักทันที พร้อมคำนวณแคลอรี่และสารอาหาร",
  },
  {
    icon: MessageSquare,
    title: "แนะนำเมนูตามเป้าหมาย",
    description:
      "AI เลือกเมนูที่เหมาะกับเป้าหมายและโภชนาการที่เหลือในแต่ละวัน",
  },
  {
    icon: BarChart3,
    title: "สรุปรายวัน / รายสัปดาห์",
    description:
      "รายงานอัตโนมัติ วิเคราะห์แนวโน้มและให้คำแนะนำปรับปรุง",
  },
  {
    icon: Clock,
    title: "โค้ชส่วนตัว 24 ชม.",
    description:
      "ให้คำปรึกษาด้านโภชนาการตลอดเวลา ตอบทุกคำถามเรื่องอาหาร",
  },
];

export function AISection() {
  return (
    <section id="ai" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Content */}
          <div>
            <ScrollReveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full mb-6">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-700 font-medium">
                  AI Technology
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                เทคโนโลยี AI
                <br />
                <span className="text-gray-400">ที่เข้าใจคุณ</span>
              </h2>

              <p className="mt-4 text-gray-500 leading-relaxed max-w-lg">
                ระบบ AI อัจฉริยะที่เรียนรู้และปรับตัวตามพฤติกรรมของคุณ
                ให้คำแนะนำที่แม่นยำและเหมาะสมกับเป้าหมายสุขภาพของคุณมากที่สุด
              </p>
            </ScrollReveal>

            <div className="mt-10 space-y-6">
              {aiFeatures.map((feature, index) => (
                <ScrollReveal key={feature.title} delay={index * 0.1}>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* Right - AI Analysis Visual */}
          <ScrollReveal direction="right">
            <div className="relative">
              {/* Main card */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      AI วิเคราะห์มื้ออาหาร
                    </div>
                    <div className="text-xs text-gray-400">เมื่อสักครู่</div>
                  </div>
                </div>

                {/* AI Analysis mockup */}
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-4">
                    <div className="text-xs text-gray-400 mb-2">
                      รูปอาหารที่วิเคราะห์
                    </div>
                    <div className="w-full h-32 bg-white/5 rounded-xl flex items-center justify-center">
                      <span className="text-4xl">🍛</span>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-4">
                    <div className="text-xs text-gray-400 mb-3">
                      ผลการวิเคราะห์
                    </div>
                    <div className="text-sm font-medium mb-3">
                      ข้าวผัดกุ้ง + ไข่ดาว
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          label: "แคลอรี่",
                          value: "520 kcal",
                          color: "text-primary-400",
                        },
                        {
                          label: "โปรตีน",
                          value: "22g",
                          color: "text-blue-400",
                        },
                        {
                          label: "คาร์บ",
                          value: "65g",
                          color: "text-amber-400",
                        },
                        {
                          label: "ไขมัน",
                          value: "18g",
                          color: "text-rose-400",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="bg-white/5 rounded-xl p-3"
                        >
                          <div className="text-xs text-gray-400">
                            {item.label}
                          </div>
                          <div
                            className={`text-sm font-semibold ${item.color}`}
                          >
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-primary-200 leading-relaxed">
                        มื้อนี้โปรตีนดี แต่คาร์บสูงเล็กน้อย
                        แนะนำมื้อเย็นเน้นผักและโปรตีนเพิ่ม ลดแป้งลง
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Background accent */}
              <div className="absolute -z-10 -bottom-4 -right-4 w-full h-full bg-primary-100 rounded-3xl" />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
