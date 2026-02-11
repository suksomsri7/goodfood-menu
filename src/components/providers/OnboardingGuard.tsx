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

// Debug info for troubleshooting
interface DebugInfo {
  profileUserId?: string;
  apiStatus?: number;
  apiIsOnboarded?: boolean;
  reason?: string;
}

export function OnboardingGuard({ children, setIsLoading: setParentLoading }: OnboardingGuardProps) {
  const { profile, isReady, isLoggedIn } = useLiff();
  const { isOnboarded, setIsOnboarded, showOnboarding, setShowOnboarding } = useOnboarding();
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});

  const checkOnboardingStatus = useCallback(async () => {
    if (!profile?.userId) {
      setDebugInfo({ reason: 'no_profile_userId' });
      setParentLoading?.(false);
      return;
    }

    // Always check API - don't use cache (cache caused issues with deleted users)
    try {
      const res = await fetch(`/api/members/me?lineUserId=${profile.userId}`);
      if (res.ok) {
        const data = await res.json();
        const onboarded = data.isOnboarded === true;
        setDebugInfo({
          profileUserId: profile.userId?.substring(0, 10) + '...',
          apiStatus: res.status,
          apiIsOnboarded: data.isOnboarded,
          reason: onboarded ? 'api_ok_onboarded' : 'api_ok_not_onboarded'
        });
        setIsOnboarded(onboarded);
        setShowOnboarding(!onboarded);
      } else if (res.status === 404) {
        setDebugInfo({
          profileUserId: profile.userId?.substring(0, 10) + '...',
          apiStatus: 404,
          reason: 'member_not_found'
        });
        // New user - needs onboarding
        setIsOnboarded(false);
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setDebugInfo({
        profileUserId: profile.userId?.substring(0, 10) + '...',
        reason: 'api_error: ' + String(error)
      });
      // On error, assume not onboarded to be safe
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
        {/* Debug banner - temporary for troubleshooting */}
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white text-xs p-1 text-center">
          DEBUG: {debugInfo.reason} | status={debugInfo.apiStatus} | isOnboarded={String(debugInfo.apiIsOnboarded)} | uid={debugInfo.profileUserId}
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
