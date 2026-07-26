"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Camera,
  Barcode,
  Package,
  PenLine,
  Dumbbell,
  Sparkles,
} from "lucide-react";

// ===================== Types =====================

interface TooltipStep {
  target: string; // data-guide attribute value, "" for center overlay
  title: string;
  description: string;
  position?: "top" | "bottom" | "auto";
  icon?: React.ReactNode;
  spotlightPadding?: number;
  spotlightRadius?: number;
  /** Extra content below description */
  extra?: React.ReactNode;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

// ===================== Steps =====================

const STEPS: TooltipStep[] = [
  {
    target: "", // center overlay - welcome
    title: "ยินดีต้อนรับ!",
    description:
      "GoodFood ช่วยคุณสั่งอาหารเพื่อสุขภาพ\nพร้อมติดตามแคลอรี่อัจฉริยะ\n\nมาทำความรู้จักกันเลย!",
    icon: <span className="text-3xl">🥗</span>,
  },
  {
    target: "fitness-rings",
    title: "วงแหวนแคลอรี่ & น้ำ",
    description:
      "วงนอก = แคลอรี่ที่ทาน / เป้าหมาย\nวงใน = น้ำที่ดื่ม / เป้าหมาย\n\nแตะวงน้ำเพื่อบันทึกน้ำดื่ม",
    position: "bottom",
    spotlightPadding: 8,
    spotlightRadius: 16,
  },
  {
    target: "ai-button",
    title: "AI ผู้ช่วยของคุณ",
    description:
      "มี 2 ปุ่มให้เลือก:\n\n🧠 AI Coach - วิเคราะห์โภชนาการวันนี้\n• ทานได้ตามเป้าหรือยัง\n• ขาดสารอาหารอะไร\n\n✨ ตั้งค่า - โค้ชส่วนตัว\n• ตั้งค่าการแจ้งเตือน\n• รับคำแนะนำอัตโนมัติ",
    position: "top",
    spotlightPadding: 8,
    spotlightRadius: 24,
  },
  {
    target: "macros",
    title: "แถบโภชนาการ",
    description:
      "ติดตาม 6 สารอาหารในวันเดียว:\nคาร์โบไฮเดรต โปรตีน ไขมัน\nโซเดียม น้ำตาล แคลอรี่เผาผลาญ",
    position: "top",
    spotlightPadding: 8,
    spotlightRadius: 12,
  },
  {
    target: "fab-button",
    title: "เพิ่มมื้ออาหาร",
    description: "กดปุ่ม + เพื่อเพิ่มข้อมูลได้ 5 วิธี:",
    position: "top",
    spotlightPadding: 6,
    spotlightRadius: 999,
    extra: (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[
          { icon: Camera, label: "ถ่ายรูป", bg: "bg-blue-100", fg: "text-blue-600" },
          { icon: Barcode, label: "สแกนบาร์โค้ด", bg: "bg-purple-100", fg: "text-purple-600" },
          { icon: Package, label: "คลังอาหาร", bg: "bg-emerald-100", fg: "text-emerald-600" },
          { icon: PenLine, label: "กรอกเอง", bg: "bg-orange-100", fg: "text-orange-600" },
          { icon: Dumbbell, label: "ออกกำลังกาย", bg: "bg-emerald-100", fg: "text-emerald-600" },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-1 ${item.bg} rounded-full px-2 py-1`}
          >
            <item.icon className={`w-3 h-3 ${item.fg}`} />
            <span className="text-[11px] font-medium text-gray-700">{item.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    target: "menu-tab",
    title: "สั่งอาหาร",
    description:
      "กดแท็บนี้เพื่อไปหน้าสั่งอาหาร\nเลือกร้าน → เลือกเมนู → สั่งซื้อ\n\nอาหารที่สั่งจะเชื่อมกับระบบแคลอรี่\nเลือกทาน → AI แนะนำ → บันทึกอัตโนมัติ!",
    position: "top",
    spotlightPadding: 4,
    spotlightRadius: 12,
  },
];

// ===================== Constants =====================

const LOCALSTORAGE_KEY = "goodfood-guide-seen";

// ===================== Component =====================

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuide({ isOpen, onClose }: UserGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [direction, setDirection] = useState(1);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (!step.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-guide="${step.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      });
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  // Re-measure on step change and scroll
  useEffect(() => {
    if (!isOpen) return;
    measureTarget();

    const handleResize = () => measureTarget();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isOpen, currentStep, measureTarget]);

  // Scroll target into view
  useEffect(() => {
    if (!isOpen || !step.target) return;
    const el = document.querySelector(`[data-guide="${step.target}"]`);
    if (el) {
      // Check if element is in viewport
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.top < 0 || rect.bottom > vh - 80) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Re-measure after scroll
        setTimeout(measureTarget, 400);
      }
    }
  }, [isOpen, currentStep, step.target, measureTarget]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDirection(1);
    }
  }, [isOpen]);

  const handleNext = useCallback(() => {
    setDirection(1);
    if (isLast) {
      localStorage.setItem(LOCALSTORAGE_KEY, "true");
      onClose();
    } else {
      setCurrentStep((p) => p + 1);
    }
  }, [isLast, onClose]);

  const handlePrev = useCallback(() => {
    if (isFirst) return;
    setDirection(-1);
    setCurrentStep((p) => p - 1);
  }, [isFirst]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(LOCALSTORAGE_KEY, "true");
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // ---- Spotlight dimensions ----
  const pad = step.spotlightPadding ?? 8;
  const radius = step.spotlightRadius ?? 12;
  const hasTarget = !!step.target && !!targetRect;

  const spotlightStyle = hasTarget
    ? {
        top: targetRect!.top - pad,
        left: targetRect!.left - pad,
        width: targetRect!.width + pad * 2,
        height: targetRect!.height + pad * 2,
        borderRadius: radius,
      }
    : null;

  // ---- Tooltip position ----
  const getTooltipPosition = (): "top" | "bottom" => {
    if (!hasTarget) return "bottom";
    if (step.position && step.position !== "auto") return step.position;
    const vh = window.innerHeight;
    return targetRect!.top > vh / 2 ? "top" : "bottom";
  };

  const tooltipPos = getTooltipPosition();

  const tooltipStyle = hasTarget
    ? {
        position: "fixed" as const,
        left: 16,
        right: 16,
        ...(tooltipPos === "bottom"
          ? { top: targetRect!.bottom + pad + 12 }
          : { bottom: window.innerHeight - targetRect!.top + pad + 12 }),
      }
    : {
        position: "fixed" as const,
        left: 16,
        right: 16,
        top: "50%",
        transform: "translateY(-50%)",
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70]">
          {/* Dark overlay with spotlight hole */}
          {hasTarget && spotlightStyle ? (
            <>
              {/* Clickable backdrop behind spotlight */}
              <div className="fixed inset-0" onClick={handleNext} />
              {/* Spotlight: transparent box with huge box-shadow = dark overlay with hole */}
              <motion.div
                className="fixed pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  top: spotlightStyle.top,
                  left: spotlightStyle.left,
                  width: spotlightStyle.width,
                  height: spotlightStyle.height,
                  borderRadius: spotlightStyle.borderRadius,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 15px 2px rgba(0, 0, 0, 0.3)",
                }}
              />
              {/* Spotlight border ring */}
              <motion.div
                className="fixed pointer-events-none border-2 border-white/30"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  top: spotlightStyle.top,
                  left: spotlightStyle.left,
                  width: spotlightStyle.width,
                  height: spotlightStyle.height,
                  borderRadius: spotlightStyle.borderRadius,
                }}
              />
            </>
          ) : (
            <motion.div
              className="fixed inset-0 bg-black/65"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleNext}
            />
          )}

          {/* Tooltip card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              ref={tooltipRef}
              className="bg-white rounded-2xl shadow-2xl p-4 max-w-sm mx-auto pointer-events-auto"
              style={tooltipStyle}
              initial={{ opacity: 0, y: direction * 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: direction * -15 }}
              transition={{ duration: 0.25 }}
            >
              {/* Arrow pointing to target */}
              {hasTarget && (
                <div
                  className="absolute w-3 h-3 bg-white rotate-45"
                  style={{
                    ...(tooltipPos === "bottom"
                      ? { top: -6 }
                      : { bottom: -6 }),
                    left: Math.min(
                      Math.max(
                        targetRect!.left + targetRect!.width / 2 - 16 - 6,
                        8
                      ),
                      window.innerWidth - 48
                    ),
                  }}
                />
              )}

              {/* Skip button */}
              <button
                onClick={handleSkip}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>

              {/* Content */}
              <div className="pr-8">
                {/* Icon for welcome step */}
                {step.icon && (
                  <div className="mb-2">{step.icon}</div>
                )}

                {/* Title */}
                <h3 className="text-base font-bold text-gray-900 mb-1.5">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {step.description}
                </p>

                {/* Extra content */}
                {step.extra}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                {/* Prev / Step indicator */}
                <div className="flex items-center gap-2">
                  {!isFirst ? (
                    <button
                      onClick={handlePrev}
                      className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      ย้อน
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">
                      {currentStep + 1} / {STEPS.length}
                    </span>
                  )}
                </div>

                {/* Step dots */}
                <div className="flex gap-1">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentStep
                          ? "w-4 bg-emerald-500"
                          : i < currentStep
                          ? "w-1.5 bg-emerald-300"
                          : "w-1.5 bg-gray-200"
                      }`}
                    />
                  ))}
                </div>

                {/* Next / Done */}
                <button
                  onClick={handleNext}
                  className={`flex items-center gap-0.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    isLast
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {isLast ? "เริ่มใช้งาน!" : "ถัดไป"}
                  {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}

export { LOCALSTORAGE_KEY };
