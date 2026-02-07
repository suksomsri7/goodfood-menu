"use client";

import { OnboardingGuard } from "@/components/providers/OnboardingGuard";
import { BottomNavBar } from "@/components/user/BottomNavBar";

export function CalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white pb-20">
      <OnboardingGuard>{children}</OnboardingGuard>
      <BottomNavBar />
    </div>
  );
}
