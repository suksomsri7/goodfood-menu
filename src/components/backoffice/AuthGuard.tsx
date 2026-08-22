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
        // 🔴 ถามเส้นสาธารณะที่ตอบแค่ boolean — /api/staff ปิดให้เฉพาะพนักงานแล้ว
        //    ถ้ายังถามเส้นเดิม จะได้ 401 แล้วเข้าใจผิดว่า "ยังไม่มีพนักงาน" = เปิดหลังบ้านให้คนนอก
        const res = await fetch("/api/auth/setup-status");
        if (res.ok) {
          const data = await res.json();
          setHasAnyStaff(!!data.hasStaff);
        } else {
          // ถามไม่ได้ = ถือว่ามีพนักงานแล้ว (ต้องล็อกอิน) ปลอดภัยกว่าเดาว่ายังไม่มี
          setHasAnyStaff(true);
        }
      } catch {
        setHasAnyStaff(true);
      } finally {
        setCheckingStaff(false);
      }
    };

    checkStaffExists();
  }, []);

  // 🔴 คุกกี้พนักงานหมดอายุ (12 ชม.) แต่ localStorage ยังจำว่า login อยู่
  //    ถ้าไม่ดัก หน้าหลังบ้านจะขึ้น "โหลดข้อมูลไม่สำเร็จ" เงียบ ๆ ทั้งที่แค่ต้องล็อกอินใหม่
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      try {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
        const isApi = url.includes("/api/");
        if (res.status === 401 && isApi && window.location.pathname.startsWith("/backoffice") && window.location.pathname !== "/backoffice/login") {
          localStorage.removeItem("goodfood_staff");
          window.location.href = "/backoffice/login";
        }
      } catch {
        /* ตรวจ URL ไม่ได้ = ปล่อยผ่าน ไม่ทำให้คำขอเดิมพัง */
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
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
