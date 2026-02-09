"use client";

import { MessageCircle, Target, Utensils } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "เปิดแอปผ่าน LINE",
    description:
      "เพียงเพิ่มเพื่อน LINE Official Account แล้วกดเข้าใช้งาน ไม่ต้องดาวน์โหลดแอปเพิ่ม",
    color: "bg-primary-500",
  },
  {
    number: "02",
    icon: Target,
    title: "ตั้งเป้าหมายสุขภาพ",
    description:
      "กรอกข้อมูลพื้นฐาน ระบบจะคำนวณ BMR, TDEE และเป้าหมายแคลอรี่ให้อัตโนมัติ",
    color: "bg-gray-900",
  },
  {
    number: "03",
    icon: Utensils,
    title: "เริ่มดูแลสุขภาพ",
    description:
      "ถ่ายรูป สแกนบาร์โค้ด หรือบันทึกมื้ออาหาร AI จะช่วยวิเคราะห์และให้คำแนะนำ",
    color: "bg-primary-600",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-sm font-medium text-primary-600 tracking-wide uppercase">
              วิธีใช้งาน
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              เริ่มต้นง่ายๆ
              <br />
              <span className="text-gray-400">เพียง 3 ขั้นตอน</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <ScrollReveal key={step.number} delay={index * 0.15}>
              <div className="relative text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 mb-6">
                  <span className="text-2xl font-bold text-gray-200">
                    {step.number}
                  </span>
                </div>

                {/* Connector line (desktop) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[1px] bg-gray-200" />
                )}

                <div
                  className={`w-12 h-12 ${step.color} rounded-xl flex items-center justify-center mx-auto mb-4`}
                >
                  <step.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
