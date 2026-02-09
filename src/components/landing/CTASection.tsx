"use client";

import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

export function CTASection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="relative bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-12 md:p-20 text-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                พร้อมเริ่มต้นดูแลสุขภาพ
                <br />
                แล้วหรือยัง?
              </h2>
              <p className="text-primary-100 text-lg max-w-lg mx-auto mb-10">
                เริ่มต้นใช้งานฟรี ไม่มีค่าใช้จ่าย
                เพียงเปิดผ่าน LINE ก็พร้อมใช้งานได้ทันที
              </p>
              <a
                href="https://line.me/R/ti/p/@goodfood.menu"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-700 font-semibold rounded-full hover:bg-gray-50 transition-all hover:shadow-lg"
              >
                เริ่มต้นใช้งานเลย
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
