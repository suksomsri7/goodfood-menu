"use client";

import { useState } from "react";
import { BottomNavBar } from "@/components/user/BottomNavBar";
import { OnboardingProvider, useOnboarding } from "@/components/providers/OnboardingContext";
import { OnboardingGuard } from "@/components/providers/OnboardingGuard";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isOnboarded, showOnboarding } = useOnboarding();
  const [isLoading, setIsLoading] = useState(true);

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
