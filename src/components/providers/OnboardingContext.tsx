"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface OnboardingContextType {
  isOnboarded: boolean | null;
  setIsOnboarded: (value: boolean | null) => void;
  showOnboarding: boolean;
  setShowOnboarding: (value: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  isOnboarded: null,
  setIsOnboarded: () => {},
  showOnboarding: false,
  setShowOnboarding: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboarded,
        setIsOnboarded,
        showOnboarding,
        setShowOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
