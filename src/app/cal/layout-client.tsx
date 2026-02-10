"use client";

import { useState, useEffect } from "react";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";
import { CalHelpContext } from "./help-context";

export function CalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const handleHelpClick = () => {
    setShowGuide(true);
  };

  return (
    <CalHelpContext.Provider value={{ onHelpClick: guideReady ? handleHelpClick : undefined }}>
      <div className="min-h-screen bg-white pb-20">
        <OnboardingGuard>{children}</OnboardingGuard>
        <BottomNavBar />

        {/* Onboarding tooltip guide */}
        <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      </div>
    </CalHelpContext.Provider>
  );
}
