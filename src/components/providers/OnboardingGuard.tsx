"use client";

import { useEffect, useCallback, ReactNode } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { useOnboarding } from "@/components/providers/OnboardingContext";
import { OnboardingModal } from "@/components/user/OnboardingModal";

const ONBOARDING_CACHE_KEY = "goodfood_onboarding_status";
const JUST_COMPLETED_KEY = "goodfood_just_completed_onboarding";

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

    // Check localStorage cache first for faster navigation
    try {
      const cached = localStorage.getItem(ONBOARDING_CACHE_KEY);
      if (cached) {
        const { userId, isOnboarded: cachedOnboarded, timestamp } = JSON.parse(cached);
        // Cache is valid for 5 minutes and same user
        const isValid = userId === profile.userId && Date.now() - timestamp < 5 * 60 * 1000;
        if (isValid && cachedOnboarded === true) {
          // User is onboarded - use cache immediately
          setIsOnboarded(true);
          setShowOnboarding(false);
          setParentLoading?.(false);
          return;
        }
      }
    } catch {
      // Ignore cache errors
    }

    try {
      const res = await fetch(`/api/members/me?lineUserId=${profile.userId}`);
      if (res.ok) {
        const data = await res.json();
        const onboarded = data.isOnboarded === true;
        setIsOnboarded(onboarded);
        setShowOnboarding(!onboarded);
        // Cache the result
        localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify({
          userId: profile.userId,
          isOnboarded: onboarded,
          timestamp: Date.now()
        }));
      } else if (res.status === 404) {
        // New user - needs onboarding
        setIsOnboarded(false);
        setShowOnboarding(true);
        // Clear cache for new user
        localStorage.removeItem(ONBOARDING_CACHE_KEY);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      // On error, don't show onboarding modal - just show the page
      // This prevents flashing modal on network errors
      setIsOnboarded(true);
      setShowOnboarding(false);
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
    // #region agent log
    console.log('[Onboarding Debug] handleOnboardingComplete called');
    // #endregion
    // Set flag so guide shows after reload (use localStorage with timestamp - sessionStorage may be cleared in LIFF)
    localStorage.setItem(JUST_COMPLETED_KEY, JSON.stringify({
      timestamp: Date.now()
    }));
    // #region agent log
    console.log('[Onboarding Debug] localStorage justCompleted set');
    // #endregion
    // Update cache
    if (profile?.userId) {
      localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify({
        userId: profile.userId,
        isOnboarded: true,
        timestamp: Date.now()
      }));
    }
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
      <>
        <OnboardingModal
          isOpen={true}
          lineUserId={profile.userId}
          displayName={profile.displayName}
          onComplete={handleOnboardingComplete}
        />
        {/* Debug during onboarding */}
        <div className="fixed top-2 left-2 right-2 bg-red-600 text-white text-xs p-2 rounded z-[200] font-mono">
          ONBOARDING MODE
        </div>
      </>
    );
  }

  // User is onboarded - show the page
  return <>{children}</>;
}
