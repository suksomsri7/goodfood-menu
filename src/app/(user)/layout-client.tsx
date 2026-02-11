"use client";

import { useState, useEffect } from "react";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { UserGuide, LOCALSTORAGE_KEY } from "@/components/user/UserGuide";
import { OnboardingProvider, useOnboarding } from "@/components/providers/OnboardingContext";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isOnboarded, showOnboarding } = useOnboarding();
  const [isLoading, setIsLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // Show guide after onboarding completes (if not seen before)
  useEffect(() => {
    // #region agent log
    console.log('[Guide Debug] useEffect triggered:', { isLoading, isOnboarded, showOnboarding });
    // #endregion
    if (!isLoading && isOnboarded === true && !showOnboarding) {
      const seen = localStorage.getItem(LOCALSTORAGE_KEY);
      
      // Check for justCompleted flag (valid for 60 seconds after onboarding)
      let justCompleted = false;
      try {
        const justCompletedData = localStorage.getItem('goodfood_just_completed_onboarding');
        if (justCompletedData) {
          const { timestamp } = JSON.parse(justCompletedData);
          // Valid for 60 seconds
          justCompleted = Date.now() - timestamp < 60 * 1000;
          // #region agent log
          console.log('[Guide Debug] justCompleted flag:', { justCompletedData, age: Date.now() - timestamp, justCompleted });
          // #endregion
        }
      } catch {
        // Ignore parse errors
      }
      
      // #region agent log
      console.log('[Guide Debug] Inside condition:', { seen, justCompleted });
      // #endregion
      
      // Show guide if: just completed onboarding OR hasn't seen guide before
      if (justCompleted || !seen) {
        // #region agent log
        console.log('[Guide Debug] Will show guide!');
        // #endregion
        // Clear the flag
        localStorage.removeItem('goodfood_just_completed_onboarding');
        setShowGuide(true);
      } else {
        // #region agent log
        console.log('[Guide Debug] NOT showing guide - seen:', seen, 'justCompleted:', justCompleted);
        // #endregion
      }
    }
  }, [isLoading, isOnboarded, showOnboarding]);

  // Hide bottom nav during loading, onboarding, or when not yet onboarded
  const showBottomNav = !isLoading && isOnboarded === true && !showOnboarding;

  return (
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
