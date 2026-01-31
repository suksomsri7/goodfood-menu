"use client";

import { useState } from "react";
import { Plus, Camera, ScanBarcode, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanOption {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  href: string;
}

const options: ScanOption[] = [
  {
    icon: <Camera className="w-6 h-6" />,
    label: "ถ่ายรูปอาหาร",
    description: "AI วิเคราะห์จากรูปภาพ",
    color: "bg-violet-500",
    href: "/scan/camera",
  },
  {
    icon: <ScanBarcode className="w-6 h-6" />,
    label: "Scan Barcode",
    description: "ค้นหาจากบาร์โค้ด",
    color: "bg-blue-500",
    href: "/scan/barcode",
  },
  {
    icon: <PenLine className="w-6 h-6" />,
    label: "กรอกเอง",
    description: "เพิ่มอาหารด้วยตัวเอง",
    color: "bg-emerald-500",
    href: "/calories/add",
  },
];

export function FloatingAddButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 pb-10",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle */}
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">เพิ่มอาหาร</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.href}
              onClick={() => {
                setIsOpen(false);
                // router.push(option.href);
                alert(`Navigate to: ${option.href}`);
              }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className={cn("p-3 rounded-xl text-white", option.color)}>
                {option.icon}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{option.label}</p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg z-50",
          "flex items-center justify-center",
          "bg-gradient-to-r from-gray-800 to-gray-900",
          "hover:from-gray-700 hover:to-gray-800",
          "transition-all duration-300",
          "shadow-gray-900/30",
          isOpen && "rotate-45"
        )}
      >
        <Plus className="w-8 h-8 text-white transition-transform duration-300" />
      </button>
    </>
  );
}
