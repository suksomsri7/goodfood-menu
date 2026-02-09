import { Leaf } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-100 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Good Food
              </span>
            </Link>
            <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
              แอปนับแคลอรี่อัจฉริยะด้วย AI ดูแลสุขภาพครบวงจร
              ตั้งแต่นับแคลอรี่ สั่งอาหาร ไปจนถึง AI โค้ชส่วนตัว
            </p>
          </div>

          {/* Menu Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">เมนู</h4>
            <ul className="space-y-3">
              {[
                { label: "หน้าแรก", href: "/", external: false },
                { label: "คุณสมบัติ", href: "/#features", external: false },
                { label: "บทความ", href: "/articles", external: false },
                { label: "เริ่มใช้งาน", href: "https://line.me/R/ti/p/@goodfood.menu", external: true },
              ].map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Feature Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">
              ฟีเจอร์
            </h4>
            <ul className="space-y-3">
              {[
                { label: "นับแคลอรี่", href: "/#features" },
                { label: "AI วิเคราะห์อาหาร", href: "/#ai" },
                { label: "สั่งอาหารเพื่อสุขภาพ", href: "/menu" },
                { label: "สแกนบาร์โค้ด", href: "/#features" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Good Food. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <span>Powered by GoodFood Company Limited</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
