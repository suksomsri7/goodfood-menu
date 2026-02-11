"use client";

import { useState, useEffect } from "react";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { OnboardingProvider, useOnboarding } from "@/components/providers/OnboardingContext";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";
import { CalHelpContext } from "./help-context";

const JUST_COMPLETED_KEY = "goodfood_just_completed_onboarding";

function CalLayoutContent({ children }: { children: React.ReactNode }) {
  const { isOnboarded, showOnboarding } = useOnboarding();
  const [isLoading, setIsLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [guideReady, setGuideReady] = useState(false);

  // Show guide after onboarding completes or on first visit
  useEffect(() => {
    if (!isLoading && isOnboarded === true && !showOnboarding) {
      const seen = localStorage.getItem(LOCALSTORAGE_KEY);
      
      // Check for justCompleted flag from multiple sources
      let justCompleted = false;
      try {
        // Check URL query parameter first (most reliable in LIFF)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('onboarded') === '1') {
          justCompleted = true;
          // Clean up URL without reload
          window.history.replaceState({}, '', '/cal');
        }
        // Check localStorage
        if (!justCompleted) {
          const justCompletedData = localStorage.getItem(JUST_COMPLETED_KEY);
          if (justCompletedData) {
            const { timestamp } = JSON.parse(justCompletedData);
            justCompleted = Date.now() - timestamp < 60 * 1000;
          }
        }
        // Check sessionStorage as backup
        if (!justCompleted) {
          const sessionFlag = sessionStorage.getItem('gf_just_onboarded');
          if (sessionFlag === 'true') {
            justCompleted = true;
          }
        }
      } catch {
        // Ignore parse errors
      }
      
      // Show guide if: just completed onboarding OR hasn't seen guide before
      if (justCompleted || !seen) {
        // Clear flags
        localStorage.removeItem(JUST_COMPLETED_KEY);
        try { sessionStorage.removeItem('gf_just_onboarded'); } catch {}
        setShowGuide(true);
      }
    }
    setGuideReady(true);
  }, [isLoading, isOnboarded, showOnboarding]);

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
