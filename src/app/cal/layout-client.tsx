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
          className="fixed top-4 left-3 z-[55] w-8 h-8 rounded-full bg-green-500 shadow-md flex items-center justify-center hover:bg-green-600 active:scale-95 transition-all"
          aria-label="คู่มือการใช้งาน"
        >
          <HelpCircle className="w-4 h-4 text-white" />
        </button>
      )}

      <OnboardingGuard>{children}</OnboardingGuard>
      <BottomNavBar />

      {/* User Guide */}
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
