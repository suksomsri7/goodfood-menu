"use client";

import { OnboardingGuard } from "@/components/providers/OnboardingGuard";

export default function CalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <OnboardingGuard>{children}</OnboardingGuard>
    </div>
  );
}
