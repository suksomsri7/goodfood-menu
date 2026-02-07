"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  PieChart,
  UtensilsCrossed,
  Plus,
  Camera,
  Barcode,
  Package,
  PenLine,
  ShoppingCart,
  Sparkles,
  Droplets,
  Dumbbell,
  ArrowRight,
} from "lucide-react";

interface GuideStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  illustration: React.ReactNode;
}

const GUIDE_SECTIONS = [
  {
    id: "intro",
    title: "เริ่มต้นใช้งาน",
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "order",
    title: "สั่งอาหาร",
    color: "from-orange-500 to-amber-600",
  },
  {
    id: "calories",
    title: "ติดตามแคลอรี่",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "stock",
    title: "จัดการอาหาร",
    color: "from-purple-500 to-violet-600",
  },
];

function IntroSteps(): GuideStep[] {
  return [
    {
      title: "ยินดีต้อนรับสู่ GoodFood!",
      description:
        "แอปสั่งอาหารเพื่อสุขภาพ พร้อมติดตามแคลอรี่อัจฉริยะ\nมาทำความรู้จักกันเลย!",
      icon: <Sparkles className="w-6 h-6" />,
      illustration: (
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-4xl">🥗</span>
          </div>
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center border-2 border-green-200">
              <span className="text-xl">🍱</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border-2 border-blue-200">
              <span className="text-xl">📊</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center border-2 border-purple-200">
              <span className="text-xl">🤖</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "แถบเมนูด้านล่าง",
      description:
        "มี 3 ปุ่มหลัก:\n• Cal — ดูแคลอรี่ประจำวัน\n• ปุ่ม + — เพิ่มมื้ออาหาร/ออกกำลังกาย\n• สั่งอาหาร — เปิดหน้าสั่งซื้อ",
      icon: <ArrowRight className="w-6 h-6" />,
      illustration: (
        <div className="bg-white rounded-2xl shadow-lg p-3 w-full max-w-[280px]">
          <div className="flex items-center justify-around h-14">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-[10px] font-medium text-green-600">Cal</span>
            </div>
            <div className="flex flex-col items-center -mt-4">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center shadow-lg">
                <Plus className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-[10px] font-medium text-gray-500">สั่งอาหาร</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'ปุ่ม "+" ตรงกลาง',
      description:
        "กดปุ่ม + เพื่อเพิ่มข้อมูลได้ 5 วิธี:\n• ถ่ายรูปอาหาร — AI วิเคราะห์ให้\n• สแกน Barcode — ดึงข้อมูลอัตโนมัติ\n• Stock — เลือกจากอาหารที่สั่งไว้\n• กรอกเอง — ใส่ข้อมูลด้วยตนเอง\n• ออกกำลังกาย — บันทึกการออกกำลัง",
      icon: <Plus className="w-6 h-6" />,
      illustration: (
        <div className="flex flex-col items-center gap-2 w-full max-w-[240px]">
          {[
            { icon: Camera, label: "ถ่ายรูป", color: "bg-blue-100 text-blue-600" },
            { icon: Barcode, label: "Scan barcode", color: "bg-purple-100 text-purple-600" },
            { icon: Package, label: "Stock", color: "bg-green-100 text-green-600" },
            { icon: PenLine, label: "กรอกเอง", color: "bg-orange-100 text-orange-600" },
            { icon: Dumbbell, label: "ออกกำลังกาย", color: "bg-red-100 text-red-600" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 w-full bg-white rounded-xl p-2.5 shadow-sm"
            >
              <div className={`w-9 h-9 rounded-full ${item.color.split(" ")[0]} flex items-center justify-center`}>
                <item.icon className={`w-4 h-4 ${item.color.split(" ")[1]}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];
}

function OrderSteps(): GuideStep[] {
  return [
    {
      title: "เลือกร้านอาหาร",
      description:
        'กดแท็บ "สั่งอาหาร" ด้านล่าง\nจะเห็นรายการร้านอาหารทั้งหมด\nกดเลือกร้านที่ต้องการได้เลย',
      icon: <UtensilsCrossed className="w-6 h-6" />,
      illustration: (
        <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
          {["🍱 Cleanfit", "🥗 สลัดสด", "🍜 ก๋วยเตี๋ยว", "🍣 อาหารญี่ปุ่น"].map((name) => (
            <div key={name} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="aspect-[4/3] bg-gradient-to-br from-green-200 to-green-300 flex items-center justify-center">
                <span className="text-2xl">{name.split(" ")[0]}</span>
              </div>
              <div className="p-2">
                <span className="text-xs font-medium text-gray-700">{name.split(" ")[1]}</span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "เลือกเมนู & ดูรายละเอียด",
      description:
        "เลื่อนดูเมนูตามหมวดหมู่\nกดที่เมนูเพื่อดูรายละเอียด:\n• คุณค่าทางโภชนาการ\n• ส่วนผสม\n• แคลอรี่ โปรตีน คาร์บ ไขมัน",
      icon: <Sparkles className="w-6 h-6" />,
      illustration: (
        <div className="w-full max-w-[260px]">
          <div className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🥩</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">อกไก่ย่างสมุนไพร</div>
                <div className="text-xs text-gray-500 mt-0.5">245 kcal • P 32g</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-green-600">฿159</span>
                  <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "ตะกร้า & สั่งซื้อ",
      description:
        "กด + เพื่อเพิ่มลงตะกร้า\nแถบสีเขียวด้านล่างจะแสดงจำนวนและราคา\nกดแถบนั้นเพื่อ:\n• ตรวจสอบรายการ\n• เลือกที่อยู่จัดส่ง\n• ยืนยันสั่งซื้อ",
      icon: <ShoppingCart className="w-6 h-6" />,
      illustration: (
        <div className="w-full max-w-[280px] flex flex-col gap-2">
          <div className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">อกไก่ย่างสมุนไพร x2</span>
              <span className="font-medium">฿318</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">สลัดแซลมอน x1</span>
              <span className="font-medium">฿189</span>
            </div>
          </div>
          <div className="bg-green-500 rounded-xl p-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-sm font-medium">3 รายการ</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold">฿507</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      ),
    },
  ];
}

function CalorieSteps(): GuideStep[] {
  return [
    {
      title: "วงแหวนแคลอรี่ & น้ำ",
      description:
        "หน้า Cal แสดงวงแหวน 2 วง:\n• วงนอก — แคลอรี่ที่ทานแล้ว/เป้าหมาย\n• วงใน — น้ำที่ดื่ม/เป้าหมาย\n\nแตะวงน้ำเพื่อบันทึกน้ำดื่ม",
      icon: <PieChart className="w-6 h-6" />,
      illustration: (
        <div className="relative w-36 h-36">
          {/* Outer ring - calories */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#22c55e"
              strokeWidth="7"
              strokeDasharray={`${0.65 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="32"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="6"
              strokeDasharray={`${0.4 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-gray-900">1,300</span>
            <span className="text-[10px] text-gray-500">/ 2,000 kcal</span>
          </div>
        </div>
      ),
    },
    {
      title: "แถบโภชนาการ",
      description:
        "ด้านล่างวงแหวนแสดง 6 แถบ:\n• คาร์โบไฮเดรต / โปรตีน / ไขมัน\n• โซเดียม / น้ำตาล / เผาผลาญ\n\nติดตามทุกสารอาหารในวันเดียว",
      icon: <Sparkles className="w-6 h-6" />,
      illustration: (
        <div className="w-full max-w-[260px] grid grid-cols-3 gap-2">
          {[
            { label: "คาร์บ", value: 65, color: "bg-amber-400" },
            { label: "โปรตีน", value: 72, color: "bg-blue-400" },
            { label: "ไขมัน", value: 45, color: "bg-red-400" },
            { label: "โซเดียม", value: 30, color: "bg-purple-400" },
            { label: "น้ำตาล", value: 55, color: "bg-pink-400" },
            { label: "เผาผลาญ", value: 40, color: "bg-orange-400" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg p-2 shadow-sm">
              <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <div className="text-[10px] font-medium text-gray-700 mt-0.5">{item.value}%</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "AI วิเคราะห์สรุป",
      description:
        'กดปุ่ม "AI วิเคราะห์" เพื่อให้ AI สรุป:\n• ทานได้ตามเป้าหมายหรือยัง\n• ขาดสารอาหารอะไร\n• คำแนะนำมื้อถัดไป\n\nAI จะวิเคราะห์ข้อมูลทั้งวันให้',
      icon: <Sparkles className="w-6 h-6" />,
      illustration: (
        <div className="w-full max-w-[260px]">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-3 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-semibold">AI วิเคราะห์</span>
            </div>
            <div className="bg-white/20 rounded-lg p-2 text-xs leading-relaxed backdrop-blur-sm">
              วันนี้ทานโปรตีนได้ดีมาก แต่ยังขาดผักใยอาหาร แนะนำมื้อเย็นเน้นผักเพิ่ม...
            </div>
          </div>
        </div>
      ),
    },
  ];
}

function StockSteps(): GuideStep[] {
  return [
    {
      title: "อาหารของคุณ",
      description:
        'เมื่อออเดอร์เสร็จสิ้น อาหารจะปรากฏในแท็บ\n"อาหารของคุณ" ที่หน้ารายการสั่งซื้อ\n\nแสดงจำนวนคงเหลือพร้อมข้อมูลโภชนาการ',
      icon: <Package className="w-6 h-6" />,
      illustration: (
        <div className="w-full max-w-[260px] flex flex-col gap-2">
          {[
            { name: "อกไก่ย่างสมุนไพร", qty: 3, cal: 245 },
            { name: "สลัดแซลมอนรมควัน", qty: 2, cal: 310 },
          ].map((item) => (
            <div key={item.name} className="bg-white rounded-xl shadow-sm p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.cal} kcal • เหลือ {item.qty} กล่อง
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-full font-medium">
                  เลือกทาน
                </button>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "เลือกทาน → AI แนะนำ",
      description:
        'กด "เลือกทาน" แล้วเลือกจำนวน\nAI จะวิเคราะห์ว่าเหมาะกับเป้าหมายวันนี้หรือไม่\n\nยืนยัน → บันทึกเข้าระบบแคลอรี่อัตโนมัติ!',
      icon: <Sparkles className="w-6 h-6" />,
      illustration: (
        <div className="w-full max-w-[260px]">
          <div className="bg-white rounded-xl shadow-sm p-3">
            <div className="text-sm font-medium text-gray-900 mb-2">อกไก่ย่างสมุนไพร</div>
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                -
              </div>
              <span className="text-2xl font-bold text-gray-900">1</span>
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                +
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium">AI แนะนำ</span>
              </div>
              เหมาะสมกับเป้าหมายวันนี้ โปรตีนยังขาดอีก 45g
            </div>
            <button className="w-full mt-2 py-2 bg-green-500 text-white text-sm rounded-xl font-medium">
              ยืนยัน → บันทึกแคลอรี่
            </button>
          </div>
        </div>
      ),
    },
  ];
}

const LOCALSTORAGE_KEY = "goodfood-guide-seen";

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuide({ isOpen, onClose }: UserGuideProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const allSections = [
    { ...GUIDE_SECTIONS[0], steps: IntroSteps() },
    { ...GUIDE_SECTIONS[1], steps: OrderSteps() },
    { ...GUIDE_SECTIONS[2], steps: CalorieSteps() },
    { ...GUIDE_SECTIONS[3], steps: StockSteps() },
  ];

  const section = allSections[currentSection];
  const step = section.steps[currentStep];
  const totalStepsInSection = section.steps.length;

  // Count total steps across all sections for the overall progress
  const totalSteps = allSections.reduce((sum, s) => sum + s.steps.length, 0);
  const currentOverallStep =
    allSections.slice(0, currentSection).reduce((sum, s) => sum + s.steps.length, 0) +
    currentStep;

  const handleNext = useCallback(() => {
    setDirection(1);
    if (currentStep < totalStepsInSection - 1) {
      setCurrentStep((prev) => prev + 1);
    } else if (currentSection < allSections.length - 1) {
      setCurrentSection((prev) => prev + 1);
      setCurrentStep(0);
    } else {
      // Last step - mark as seen and close
      localStorage.setItem(LOCALSTORAGE_KEY, "true");
      onClose();
    }
  }, [currentStep, totalStepsInSection, currentSection, allSections.length, onClose]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else if (currentSection > 0) {
      const prevSectionSteps = allSections[currentSection - 1].steps.length;
      setCurrentSection((prev) => prev - 1);
      setCurrentStep(prevSectionSteps - 1);
    }
  }, [currentStep, currentSection, allSections]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(LOCALSTORAGE_KEY, "true");
    onClose();
  }, [onClose]);

  const jumpToSection = useCallback(
    (sectionIndex: number) => {
      setDirection(sectionIndex > currentSection ? 1 : -1);
      setCurrentSection(sectionIndex);
      setCurrentStep(0);
    },
    [currentSection]
  );

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentSection(0);
      setCurrentStep(0);
      setDirection(1);
    }
  }, [isOpen]);

  const isFirst = currentSection === 0 && currentStep === 0;
  const isLast =
    currentSection === allSections.length - 1 &&
    currentStep === totalStepsInSection - 1;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Guide Card */}
          <motion.div
            className="relative w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            {/* Header with gradient */}
            <div
              className={`bg-gradient-to-r ${section.color} px-5 pt-5 pb-4 text-white relative`}
            >
              {/* Skip button */}
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Section tabs */}
              <div className="flex gap-1 mb-3">
                {allSections.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => jumpToSection(i)}
                    className={`flex-1 h-1 rounded-full transition-all ${
                      i === currentSection
                        ? "bg-white"
                        : i < currentSection
                        ? "bg-white/60"
                        : "bg-white/25"
                    }`}
                  />
                ))}
              </div>

              {/* Section title */}
              <div className="text-xs font-medium text-white/70 mb-1">
                {section.title} • {currentStep + 1}/{totalStepsInSection}
              </div>

              {/* Step title */}
              <AnimatePresence mode="wait">
                <motion.h2
                  key={`${currentSection}-${currentStep}-title`}
                  className="text-xl font-bold"
                  initial={{ opacity: 0, x: direction * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {step.title}
                </motion.h2>
              </AnimatePresence>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentSection}-${currentStep}-content`}
                  initial={{ opacity: 0, x: direction * 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -30 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center"
                >
                  {/* Illustration */}
                  <div className="flex items-center justify-center mb-4 min-h-[140px] w-full">
                    {step.illustration}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line text-center w-full">
                    {step.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-2 flex items-center justify-between">
              {/* Back button */}
              <button
                onClick={handlePrev}
                disabled={isFirst}
                className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
                  isFirst
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                ย้อนกลับ
              </button>

              {/* Step dots */}
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === currentOverallStep
                        ? "bg-gray-900 w-4"
                        : i < currentOverallStep
                        ? "bg-gray-400"
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {/* Next / Done button */}
              <button
                onClick={handleNext}
                className={`flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                  isLast
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {isLast ? "เริ่มใช้งาน" : "ถัดไป"}
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { LOCALSTORAGE_KEY };
