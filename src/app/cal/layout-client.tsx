"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";

export function CalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);
  const [guideReady, setGuideReady] = useState(false);

  // Auto-show onboarding guide on first visit only
  useEffect(() => {
    const seen = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!seen) {
      setShowGuide(true);
    }
    setGuideReady(true);
  }, []);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Guide trigger button - top-left → goes to /tip page */}
      {guideReady && (
        <button
          onClick={() => router.push("/tip")}
          className="fixed top-4 left-3 z-[55] w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all"
          aria-label="คู่มือการใช้งาน"
        >
          <HelpCircle className="w-4 h-4 text-gray-400" />
        </button>
      )}

      <OnboardingGuard>{children}</OnboardingGuard>
      <BottomNavBar />

      {/* Onboarding tooltip guide - first visit only */}
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
