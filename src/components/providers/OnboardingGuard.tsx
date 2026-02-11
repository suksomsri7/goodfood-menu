"use client";

import { useEffect, useCallback, ReactNode } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { useOnboarding } from "@/components/providers/OnboardingContext";
import { OnboardingModal } from "@/components/user/OnboardingModal";

interface OnboardingGuardProps {
  children: ReactNode;
  setIsLoading?: (loading: boolean) => void;
}

export function OnboardingGuard({ children, setIsLoading: setParentLoading }: OnboardingGuardProps) {
  const { profile, isReady, isLoggedIn } = useLiff();
  const { isOnboarded, setIsOnboarded, showOnboarding, setShowOnboarding } = useOnboarding();

  const checkOnboardingStatus = useCallback(async () => {
    if (!profile?.userId) {
      setParentLoading?.(false);
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
      setParentLoading?.(false);
    }
  }, [profile?.userId, setIsOnboarded, setShowOnboarding, setParentLoading]);

  useEffect(() => {
    if (!isReady) return;
    
    if (isLoggedIn && profile?.userId) {
      checkOnboardingStatus();
    } else {
      // Not logged in or no profile - stop loading
      setParentLoading?.(false);
    }
  }, [isReady, isLoggedIn, profile?.userId, checkOnboardingStatus, setParentLoading]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setIsOnboarded(true);
    // Refresh the page to load new data
    window.location.reload();
  };

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
