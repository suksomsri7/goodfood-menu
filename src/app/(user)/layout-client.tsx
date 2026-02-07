"use client";

import { BottomNavBar } from "@/components/user/BottomNavBar";

export function UserLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white pb-20">
      {children}
      <BottomNavBar />
    </div>
  );
}
