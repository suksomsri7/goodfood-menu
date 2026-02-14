"use client";

import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import Image from "next/image";

// LINE OA Link
const LINE_OA_URL = "https://lin.ee/CPSTFxN";

export function CTASection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="relative bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-12 md:p-20 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16">
              {/* Text Content */}
              <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  พร้อมเริ่มต้นดูแลสุขภาพ
                  <br />
                  แล้วหรือยัง?
                </h2>
                <p className="text-primary-100 text-lg max-w-lg mb-8">
                  เริ่มต้นใช้งานฟรี ไม่มีค่าใช้จ่าย
                  เพียงเปิดผ่าน LINE ก็พร้อมใช้งานได้ทันที
                </p>
                <a
                  href={LINE_OA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[#06C755] text-white font-semibold rounded-full hover:bg-[#05b04c] transition-all hover:shadow-lg"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  เพิ่มเพื่อน LINE
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* QR Code */}
              <div className="flex-shrink-0">
                <a
                  href={LINE_OA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white p-4 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow"
                >
                  <Image
                    src="/line-qr.png"
                    alt="LINE QR Code - เพิ่มเพื่อน Good Food"
                    width={180}
                    height={180}
                    className="rounded-lg"
                  />
                  <p className="text-center text-sm text-gray-600 mt-3 font-medium">
                    สแกน QR Code
                  </p>
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
