"use client";

import {
  Camera,
  Brain,
  ShoppingBag,
  ScanBarcode,
  Bot,
  TrendingUp,
} from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const features = [
  {
    icon: Camera,
    title: "นับแคลอรี่อัจฉริยะ",
    description:
      "ถ่ายรูปอาหาร AI จะวิเคราะห์แคลอรี่และสารอาหารให้โดยอัตโนมัติ ไม่ต้องค้นหาหรือกรอกข้อมูลเอง",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Brain,
    title: "AI วิเคราะห์โภชนาการ",
    description:
      "รู้ลึกทุกมื้ออาหาร ทั้งโปรตีน คาร์บ ไขมัน โซเดียม และน้ำตาล พร้อมคำแนะนำเฉพาะบุคคล",
    color: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    icon: ShoppingBag,
    title: "สั่งอาหารเพื่อสุขภาพ",
    description:
      "เมนูอาหารเพื่อสุขภาพจากร้านที่คัดสรร พร้อมข้อมูลโภชนาการครบถ้วนทุกเมนู",
    color: "bg-primary-50",
    iconColor: "text-primary-600",
  },
  {
    icon: ScanBarcode,
    title: "สแกนบาร์โค้ด",
    description:
      "สแกนบาร์โค้ดสินค้าง่ายๆ รู้คุณค่าทางโภชนาการทันที บันทึกมื้ออาหารได้รวดเร็ว",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Bot,
    title: "AI โค้ชส่วนตัว",
    description:
      "คำแนะนำเฉพาะบุคคล ปรับตามเป้าหมายและพฤติกรรมการกิน พร้อมสรุปรายวันและรายสัปดาห์",
    color: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  {
    icon: TrendingUp,
    title: "ติดตามความก้าวหน้า",
    description:
      "กราฟ สถิติ และรายงานรายสัปดาห์ เห็นพัฒนาการชัดเจน ทั้งน้ำหนัก แคลอรี่ และการออกกำลังกาย",
    color: "bg-rose-50",
    iconColor: "text-rose-600",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-sm font-medium text-primary-600 tracking-wide uppercase">
              คุณสมบัติ
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              ทุกสิ่งที่คุณต้องการ
              <br />
              <span className="text-gray-400">เพื่อสุขภาพที่ดีขึ้น</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.1}>
              <div className="group p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
                <div
                  className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-5`}
                >
                  <feature.icon
                    className={`w-6 h-6 ${feature.iconColor}`}
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
