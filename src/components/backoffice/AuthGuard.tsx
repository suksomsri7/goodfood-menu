"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStaff } from "./StaffContext";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { staff, isLoading } = useStaff();
  const [hasAnyStaff, setHasAnyStaff] = useState<boolean | null>(null);
  const [checkingStaff, setCheckingStaff] = useState(true);

  // Check if there are any staff in the database (for initial setup)
  useEffect(() => {
    const checkStaffExists = async () => {
      try {
        const res = await fetch("/api/staff");
        if (res.ok) {
          const data = await res.json();
          setHasAnyStaff(data.length > 0);
        } else {
          setHasAnyStaff(false);
        }
      } catch {
        setHasAnyStaff(false);
      } finally {
        setCheckingStaff(false);
      }
    };

    checkStaffExists();
  }, []);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === "/backoffice/login") {
      return;
    }

    // Wait for loading to complete
    if (isLoading || checkingStaff) {
      return;
    }

    // If no staff in database, allow access (initial setup mode)
    if (hasAnyStaff === false) {
      return;
    }

    // If staff exist but not logged in, redirect to login
    if (!staff && hasAnyStaff === true) {
      router.push("/backoffice/login");
    }
  }, [staff, isLoading, pathname, router, hasAnyStaff, checkingStaff]);

  // Show loading while checking auth
  if (isLoading || checkingStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Login page - always show
  if (pathname === "/backoffice/login") {
    return <>{children}</>;
  }

  // Initial setup mode (no staff yet) - allow access
  if (hasAnyStaff === false) {
    return <>{children}</>;
  }

  // If not logged in and staff exist, show loading (will redirect)
  if (!staff && hasAnyStaff === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return <>{children}</>;
}
