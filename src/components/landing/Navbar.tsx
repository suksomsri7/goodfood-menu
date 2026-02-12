"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

interface NavLink {
  label: string;
  href: string;
  type: "scroll" | "page";
}

const navLinks: NavLink[] = [
  { label: "คุณสมบัติ", href: "#features", type: "scroll" },
  { label: "วิธีใช้งาน", href: "#how-it-works", type: "scroll" },
  { label: "AI", href: "#ai", type: "scroll" },
  { label: "บทความ", href: "/articles", type: "page" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (link: NavLink) => {
    setIsMobileOpen(false);

    if (link.type === "page") {
      router.push(link.href);
      return;
    }

    // Scroll link: if on landing page, scroll directly
    if (pathname === "/") {
      const el = document.querySelector(link.href);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Navigate to landing page with hash
      router.push("/" + link.href);
    }
  };

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100"
            : "bg-transparent"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-wide">
              GOOD <span className="text-red-500">FOOD</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link)}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://line.me/R/ti/p/@goodfood.menu"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              เริ่มต้นใช้งาน
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {isMobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-white pt-20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex flex-col items-center gap-6 py-8">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link)}
                  className="text-lg text-gray-700 hover:text-gray-900"
                >
                  {link.label}
                </button>
              ))}
              <a
                href="https://line.me/R/ti/p/@goodfood.menu"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 px-8 py-3 bg-gray-900 text-white text-base font-medium rounded-full"
                onClick={() => setIsMobileOpen(false)}
              >
                เริ่มต้นใช้งาน
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
