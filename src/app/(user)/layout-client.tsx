"use client";

import { useState, useEffect } from "react";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";
import { OnboardingProvider, useOnboarding } from "@/components/providers/OnboardingContext";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { LogoLoader } from "@/components/user/LogoLoader";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isOnboarded, showOnboarding } = useOnboarding();
  const [isLoading, setIsLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // Show guide after onboarding completes (if not seen before)
  useEffect(() => {
    if (!isLoading && isOnboarded === true && !showOnboarding) {
      const seen = localStorage.getItem(LOCALSTORAGE_KEY);
      
      // Check for justCompleted flag (valid for 60 seconds after onboarding)
      let justCompleted = false;
      try {
        const justCompletedData = localStorage.getItem('goodfood_just_completed_onboarding');
        if (justCompletedData) {
          const { timestamp } = JSON.parse(justCompletedData);
          justCompleted = Date.now() - timestamp < 60 * 1000;
        }
      } catch {
        // Ignore parse errors
      }
      
      // Show guide if: just completed onboarding OR hasn't seen guide before
      if (justCompleted || !seen) {
        localStorage.removeItem('goodfood_just_completed_onboarding');
        setShowGuide(true);
      }
    }
  }, [isLoading, isOnboarded, showOnboarding]);

  // Hide bottom nav during loading, onboarding, or when not yet onboarded
  const showBottomNav = !isLoading && isOnboarded === true && !showOnboarding;

  return (
    <div className={`min-h-screen bg-white ${showBottomNav ? 'pb-20' : ''}`}>
      {isLoading && <LogoLoader />}
      <OnboardingGuard setIsLoading={setIsLoading}>
        {children}
      </OnboardingGuard>
      {showBottomNav && <BottomNavBar />}
      
      {/* User Guide - shows after onboarding for new users */}
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}

export function UserLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <LayoutContent>{children}</LayoutContent>
    </OnboardingProvider>
  );
}
