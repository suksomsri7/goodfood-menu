"use client";

import { useState, useEffect } from "react";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { OnboardingProvider, useOnboarding } from "@/components/providers/OnboardingContext";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";
import { CalHelpContext } from "./help-context";

function CalLayoutContent({ children }: { children: React.ReactNode }) {
  const { isOnboarded, showOnboarding } = useOnboarding();
  const [isLoading, setIsLoading] = useState(true);
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

  // Hide bottom nav during loading, onboarding, or when not yet onboarded
  const showBottomNav = !isLoading && isOnboarded === true && !showOnboarding;

  return (
    <CalHelpContext.Provider value={{ onHelpClick: guideReady ? handleHelpClick : undefined }}>
      <div className={`min-h-screen bg-white ${showBottomNav ? 'pb-20' : ''}`}>
        {isLoading && (
          <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">กำลังโหลด...</p>
            </div>
          </div>
        )}
        <OnboardingGuard setIsLoading={setIsLoading}>
          {children}
        </OnboardingGuard>
        {showBottomNav && <BottomNavBar />}

        {/* Onboarding tooltip guide */}
        <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      </div>
    </CalHelpContext.Provider>
  );
}

export function CalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <CalLayoutContent>{children}</CalLayoutContent>
    </OnboardingProvider>
  );
}
