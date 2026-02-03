"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { OnboardingModal } from "@/components/user/OnboardingModal";

interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const checkOnboardingStatus = useCallback(async () => {
    if (!profile?.userId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/members/me?lineUserId=${profile.userId}`);
      if (res.ok) {
        const data = await res.json();
        const onboarded = data.isOnboarded === true;
        setIsOnboarded(onboarded);
        setShowOnboarding(!onboarded);
      } else if (res.status === 404) {
        // New user - needs onboarding
        setIsOnboarded(false);
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      // Assume not onboarded on error
      setIsOnboarded(false);
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.userId]);

  useEffect(() => {
    if (isReady && isLoggedIn && profile?.userId) {
      checkOnboardingStatus();
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [isReady, isLoggedIn, profile?.userId, checkOnboardingStatus]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setIsOnboarded(true);
    // Refresh the page to load new data
    window.location.reload();
  };

  // Loading state
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show children (page will handle its own auth state)
  if (!isLoggedIn || !profile?.userId) {
    return <>{children}</>;
  }

  // Show onboarding modal for new users
  if (showOnboarding) {
    return (
      <OnboardingModal
        isOpen={true}
        lineUserId={profile.userId}
        displayName={profile.displayName}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // User is onboarded - show the page
  return <>{children}</>;
}
