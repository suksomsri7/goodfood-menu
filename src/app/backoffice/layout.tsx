"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/backoffice/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/backoffice/SidebarContext";
import { AdminProvider } from "@/components/backoffice/AdminContext";
import { StaffProvider } from "@/components/backoffice/StaffContext";
import { AuthGuard } from "@/components/backoffice/AuthGuard";
import { cn } from "@/lib/utils";

function BackofficeContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const isLoginPage = pathname === "/backoffice/login";

  // Login page doesn't need sidebar
  if (isLoginPage) {
    return <main>{children}</main>;
  }

  return (
    <main className={cn("transition-all duration-300", collapsed ? "ml-16" : "ml-60")}>
      {children}
    </main>
  );
}

function BackofficeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/backoffice/login";

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {!isLoginPage && <Sidebar />}
      <BackofficeContent>{children}</BackofficeContent>
    </div>
  );
}

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StaffProvider>
      <AdminProvider>
        <SidebarProvider>
          <AuthGuard>
            <BackofficeInner>{children}</BackofficeInner>
          </AuthGuard>
        </SidebarProvider>
      </AdminProvider>
    </StaffProvider>
  );
}
