"use client";

import { useEffect, useCallback, ReactNode, useState } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { useOnboarding } from "@/components/providers/OnboardingContext";
import { OnboardingModal } from "@/components/user/OnboardingModal";

const JUST_COMPLETED_KEY = "goodfood_just_completed_onboarding";

interface OnboardingGuardProps {
  children: ReactNode;
  setIsLoading?: (loading: boolean) => void;
}

export function OnboardingGuard({ children, setIsLoading: setParentLoading }: OnboardingGuardProps) {
  const { profile, isReady, isLoggedIn } = useLiff();
  const { isOnboarded, setIsOnboarded, showOnboarding, setShowOnboarding } = useOnboarding();
  const [debugReason, setDebugReason] = useState<string>("");

  const checkOnboardingStatus = useCallback(async (retryCount = 0) => {
    if (!profile?.userId) {
      setDebugReason("no_userId");
      setParentLoading?.(false);
      return;
    }

    // Always check API - don't use cache (cache caused issues with deleted users)
    try {
      const res = await fetch(`/api/members/me?lineUserId=${profile.userId}`);
      if (res.ok) {
        const data = await res.json();
        const onboarded = data.isOnboarded === true;
        setDebugReason(onboarded ? `ok_onboarded` : `ok_NOT_onboarded(${data.isOnboarded})`);
        setIsOnboarded(onboarded);
        setShowOnboarding(!onboarded);
        setParentLoading?.(false);
      } else if (res.status === 404) {
        setDebugReason("404_new_user");
        // New user - needs onboarding
        setIsOnboarded(false);
        setShowOnboarding(true);
        setParentLoading?.(false);
      } else {
        // Other error status - retry
        throw new Error(`API returned ${res.status}`);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      
      // Retry up to 3 times with delay
      if (retryCount < 3) {
        setDebugReason(`retry_${retryCount + 1}`);
        setTimeout(() => {
          checkOnboardingStatus(retryCount + 1);
        }, 1000 * (retryCount + 1)); // 1s, 2s, 3s delay
        return; // Don't set loading false yet
      }
      
      // After 3 retries, assume user is onboarded (don't block existing users)
      setDebugReason(`error_fallback_onboarded: ${String(error).substring(0, 50)}`);
      setIsOnboarded(true);
      setShowOnboarding(false);
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
    // Set flags in multiple places for redundancy
    try {
      localStorage.setItem(JUST_COMPLETED_KEY, JSON.stringify({ timestamp: Date.now() }));
      sessionStorage.setItem('gf_just_onboarded', 'true');
    } catch {}
    
    setShowOnboarding(false);
    setIsOnboarded(true);
    
    // Navigate with query parameter as most reliable method in LIFF
    window.location.href = '/cal?onboarded=1';
  };

  // Not logged in - show children (page will handle its own auth state)
  if (!isLoggedIn || !profile?.userId) {
    return <>{children}</>;
  }

  // Show onboarding modal for new users
  if (showOnboarding) {
    return (
      <>
        {/* Debug banner */}
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white text-xs p-1 text-center">
          DEBUG: {debugReason} | path={typeof window !== 'undefined' ? window.location.pathname : ''}
        </div>
        <OnboardingModal
          isOpen={true}
          lineUserId={profile.userId}
          displayName={profile.displayName}
          onComplete={handleOnboardingComplete}
        />
      </>
    );
  }

  // User is onboarded - show the page
  return <>{children}</>;
}
