"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  PieChart,
  UtensilsCrossed,
  Plus,
  Camera,
  Barcode,
  Package,
  PenLine,
  Dumbbell,
  Sparkles,
  ShoppingCart,
  Droplets,
  Target,
  ArrowRight,
  Brain,
  ChevronDown,
} from "lucide-react";

// ==================== Data ====================

interface TipSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  bgColor: string;
  steps: {
    title: string;
    description: string;
    visual?: React.ReactNode;
  }[];
}

const sections: TipSection[] = [
  {
    id: "start",
    icon: <Sparkles className="w-5 h-5" />,
    title: "เริ่มต้นใช้งาน",
    color: "text-green-600",
    bgColor: "bg-green-50",
    steps: [
      {
        title: "เมนูหลัก 3 ปุ่ม",
        description:
          "ด้านล่างจอมีแถบเมนูหลัก 3 ปุ่ม สำหรับเข้าถึงฟีเจอร์ทั้งหมด",
        visual: (
          <div className="flex items-center justify-center gap-6 py-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-[10px] text-gray-500">แคลอรี่</span>
            </div>
            <div className="flex flex-col items-center gap-1 -mt-2">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center shadow-md">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] text-gray-500">เพิ่มข้อมูล</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-[10px] text-gray-500">สั่งอาหาร</span>
            </div>
          </div>
        ),
      },
      {
        title: "ปุ่ม + ตรงกลาง",
        description:
          "กดปุ่ม + เพื่อเพิ่มข้อมูลได้ 5 วิธี",
        visual: (
          <div className="space-y-1.5">
            {[
              { icon: Camera, label: "ถ่ายรูปอาหาร", desc: "AI วิเคราะห์จากภาพ", color: "text-blue-500", bg: "bg-blue-50" },
              { icon: Barcode, label: "สแกนบาร์โค้ด", desc: "ดึงข้อมูลอัตโนมัติ", color: "text-purple-500", bg: "bg-purple-50" },
              { icon: Package, label: "คลังอาหาร", desc: "เลือกจากที่สั่งไว้", color: "text-green-500", bg: "bg-green-50" },
              { icon: PenLine, label: "กรอกเอง", desc: "ใส่ข้อมูลด้วยตนเอง", color: "text-orange-500", bg: "bg-orange-50" },
              { icon: Dumbbell, label: "ออกกำลังกาย", desc: "บันทึกแคลอรี่เผาผลาญ", color: "text-red-500", bg: "bg-red-50" },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-3 ${item.bg} rounded-xl px-3 py-2`}>
                <item.icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                <div>
                  <span className="text-xs font-medium text-gray-800">{item.label}</span>
                  <span className="text-[10px] text-gray-400 ml-1.5">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    id: "cal",
    icon: <PieChart className="w-5 h-5" />,
    title: "ติดตามแคลอรี่",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    steps: [
      {
        title: "วงแหวนแคลอรี่ & น้ำ",
        description:
          "วงนอกแสดงแคลอรี่ที่ทาน/เป้าหมาย วงในแสดงน้ำที่ดื่ม/เป้าหมาย แตะวงน้ำเพื่อบันทึกปริมาณน้ำดื่ม",
        visual: (
          <div className="flex items-center justify-center py-2">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#FF2D55" strokeWidth="7" strokeDasharray={`${0.6 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`} strokeLinecap="round" />
                <circle cx="50" cy="50" r="32" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                <circle cx="50" cy="50" r="32" fill="none" stroke="#00AAFF" strokeWidth="6" strokeDasharray={`${0.35 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Droplets className="w-4 h-4 text-blue-400 mb-0.5" />
                <span className="text-[10px] text-gray-400">แตะเพื่อเพิ่ม</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "แถบโภชนาการ 6 ชนิด",
        description:
          "ติดตามคาร์โบไฮเดรต โปรตีน ไขมัน โซเดียม น้ำตาล และแคลอรี่ที่เผาผลาญในวันเดียว",
        visual: (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "คาร์โบไฮเดรต", pct: 55, color: "bg-amber-400" },
              { label: "โปรตีน", pct: 72, color: "bg-red-400" },
              { label: "ไขมัน", pct: 40, color: "bg-blue-400" },
              { label: "โซเดียม", pct: 25, color: "bg-purple-400" },
              { label: "น้ำตาล", pct: 48, color: "bg-pink-400" },
              { label: "เผาผลาญ", pct: 35, color: "bg-emerald-400" },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-lg px-2 py-1.5">
                <div className="text-[9px] text-gray-400 truncate">{m.label}</div>
                <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "AI Coach",
        description:
          "กดปุ่ม AI Coach เพื่อให้ AI สรุปว่าวันนี้ทานได้ตามเป้าหรือยัง ขาดสารอาหารอะไร และแนะนำมื้อถัดไป",
        visual: (
          <div className="flex justify-center py-1">
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-xs font-medium shadow-sm">
              <Brain className="w-3.5 h-3.5" />
              AI Coach
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "order",
    icon: <UtensilsCrossed className="w-5 h-5" />,
    title: "สั่งอาหาร",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    steps: [
      {
        title: "เลือกร้านอาหาร",
        description:
          "กดแท็บ \"สั่งอาหาร\" จะเห็นรายการร้านทั้งหมด กดเลือกร้านที่ต้องการ",
        visual: (
          <div className="grid grid-cols-2 gap-1.5">
            {["🍱", "🥗", "🍜", "🍣"].map((emoji, i) => (
              <div key={i} className="bg-gray-50 rounded-xl overflow-hidden">
                <div className="aspect-[5/3] bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                  <span className="text-xl">{emoji}</span>
                </div>
                <div className="px-2 py-1">
                  <div className="h-2 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "ดูรายละเอียดเมนู",
        description:
          "กดที่เมนูเพื่อดูข้อมูลโภชนาการ ส่วนผสม แคลอรี่ โปรตีน คาร์โบไฮเดรต และไขมัน",
      },
      {
        title: "ตะกร้า & ชำระเงิน",
        description:
          "กด + เพื่อเพิ่มลงตะกร้า แถบสีเขียวด้านล่างจะแสดงจำนวนและราคา กดแถบนั้นเพื่อตรวจสอบรายการ เลือกที่อยู่จัดส่ง แล้วยืนยันสั่งซื้อ",
        visual: (
          <div className="space-y-1.5">
            <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">อกไก่ย่างสมุนไพร x2</span>
              <span className="font-medium text-gray-700">฿318</span>
            </div>
            <div className="bg-green-500 rounded-lg px-3 py-2 flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>3 รายการ</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">฿507</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "stock",
    icon: <Package className="w-5 h-5" />,
    title: "จัดการอาหารที่สั่ง",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    steps: [
      {
        title: "อาหารของคุณ",
        description:
          "เมื่อออเดอร์เสร็จสิ้น อาหารจะปรากฏในแท็บ \"อาหารของคุณ\" แสดงจำนวนคงเหลือพร้อมข้อมูลโภชนาการ",
      },
      {
        title: "เลือกทาน + AI แนะนำ",
        description:
          "กด \"เลือกทาน\" แล้วเลือกจำนวน AI จะวิเคราะห์ว่าเหมาะกับเป้าหมายวันนี้หรือไม่ ยืนยันแล้วบันทึกเข้าระบบแคลอรี่อัตโนมัติ",
        visual: (
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">AI แนะนำ: </span>
              เหมาะกับเป้าหมายวันนี้ โปรตีนยังขาดอีก 45g
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "goal",
    icon: <Target className="w-5 h-5" />,
    title: "ตั้งเป้าหมาย",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    steps: [
      {
        title: "กำหนดเป้าหมายสุขภาพ",
        description:
          "ตั้งเป้าน้ำหนัก แคลอรี่ น้ำดื่ม ระบบจะคำนวณ BMR/TDEE และติดตามความก้าวหน้าให้อัตโนมัติ กดไอคอนเป้า ⊕ มุมบนขวาของหน้าแคลอรี่เพื่อเข้าหน้าเป้าหมาย",
      },
    ],
  },
];

// ==================== Accordion ====================

function AccordionSection({ section, isOpen, onToggle }: { section: TipSection; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl ${section.bgColor} flex items-center justify-center flex-shrink-0 ${section.color}`}>
          {section.icon}
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-gray-800">
          {section.title}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </motion.div>
      </button>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="px-5 pb-4 space-y-4">
          {section.steps.map((step, i) => (
            <div key={i} className="pl-2">
              {/* Step number + title */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-bold ${section.color} w-4 h-4 rounded-full ${section.bgColor} flex items-center justify-center flex-shrink-0`}>
                  {i + 1}
                </span>
                <h4 className="text-sm font-medium text-gray-700">
                  {step.title}
                </h4>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 leading-relaxed ml-6 mb-2">
                {step.description}
              </p>

              {/* Visual */}
              {step.visual && (
                <div className="ml-6">
                  {step.visual}
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ==================== Page ====================

export default function TipPage() {
  const router = useRouter();
  const [openSection, setOpenSection] = useState<string | null>("start");

  const handleToggle = (id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center h-12 px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center -ml-1 text-gray-500"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold text-gray-800 -ml-8">
            คู่มือการใช้งาน
          </h1>
          <div className="w-8" />
        </div>
      </div>

      {/* Hero */}
      <div className="px-6 pt-8 pb-6 text-center">
        <div className="text-4xl mb-3">📖</div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          วิธีใช้งาน GoodFood
        </h2>
        <p className="text-xs text-gray-400">
          สั่งอาหารเพื่อสุขภาพ พร้อมติดตามแคลอรี่อัจฉริยะ
        </p>
      </div>

      {/* Sections */}
      <div className="bg-white rounded-t-2xl">
        {sections.map((section) => (
          <AccordionSection
            key={section.id}
            section={section}
            isOpen={openSection === section.id}
            onToggle={() => handleToggle(section.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-8 text-center">
        <p className="text-[10px] text-gray-300">
          กดหมวดหมู่เพื่อดูรายละเอียด
        </p>
      </div>
    </div>
  );
}
