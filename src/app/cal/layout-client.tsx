"use client";

import { useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";

export function CalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showGuide, setShowGuide] = useState(false);
  const [guideReady, setGuideReady] = useState(false);

  // Auto-show guide on first visit
  useEffect(() => {
    const seen = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!seen) {
      setShowGuide(true);
    }
    setGuideReady(true);
  }, []);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Guide trigger button - top-left */}
      {guideReady && (
        <button
          onClick={() => setShowGuide(true)}
          className="fixed top-3 left-3 z-50 w-9 h-9 rounded-full bg-white/90 shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          aria-label="คู่มือการใช้งาน"
        >
          <HelpCircle className="w-5 h-5 text-gray-500" />
        </button>
      )}

      <OnboardingGuard>{children}</OnboardingGuard>
      <BottomNavBar />

      {/* User Guide */}
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
