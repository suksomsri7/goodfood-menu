"use client";

import { Sidebar } from "@/components/backoffice/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/backoffice/SidebarContext";
import { cn } from "@/lib/utils";

function BackofficeContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main className={cn("transition-all duration-300", collapsed ? "ml-16" : "ml-60")}>
      {children}
    </main>
  );
}

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#F8F9FA]">
        <Sidebar />
        <BackofficeContent>{children}</BackofficeContent>
      </div>
    </SidebarProvider>
  );
}
