"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hasPermission, canViewModule, canPerformAction } from "@/lib/permissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface StaffUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  isActive: boolean;
  role: Role;
}

interface StaffContextType {
  staff: StaffUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  permissions: string[];
  hasPermission: (permissionCode: string) => boolean;
  canViewModule: (moduleId: string) => boolean;
  canCreate: (moduleId: string) => boolean;
  canUpdate: (moduleId: string) => boolean;
  canDelete: (moduleId: string) => boolean;
  login: (staffData: StaffUser) => void;
  logout: () => void;
  refreshStaff: () => Promise<void>;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

// Key for localStorage
const STAFF_STORAGE_KEY = "goodfood_staff";

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get permissions from current staff's role
  const permissions = staff?.role?.permissions || [];

  // Load staff from localStorage on mount
  useEffect(() => {
    const loadStaff = () => {
      try {
        const storedStaff = localStorage.getItem(STAFF_STORAGE_KEY);
        if (storedStaff) {
          const parsedStaff = JSON.parse(storedStaff);
          setStaff(parsedStaff);
        }
      } catch (error) {
        console.error("Error loading staff from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStaff();
  }, []);

  // Refresh staff data from API
  const refreshStaff = useCallback(async () => {
    if (!staff?.id) return;

    try {
      const res = await fetch(`/api/staff/${staff.id}`);
      if (res.ok) {
        const updatedStaff = await res.json();
        setStaff(updatedStaff);
        localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updatedStaff));
      }
    } catch (error) {
      console.error("Error refreshing staff:", error);
    }
  }, [staff?.id]);

  // Login function
  const login = useCallback((staffData: StaffUser) => {
    setStaff(staffData);
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffData));
  }, []);

  // Logout function
  const logout = useCallback(() => {
    setStaff(null);
    localStorage.removeItem(STAFF_STORAGE_KEY);
    router.push("/backoffice/login");
  }, [router]);

  // Permission check helpers
  const checkPermission = useCallback(
    (permissionCode: string) => hasPermission(permissions, permissionCode),
    [permissions]
  );

  const checkCanViewModule = useCallback(
    (moduleId: string) => {
      // If not authenticated, allow viewing all modules (for initial setup)
      return !staff ? true : canViewModule(permissions, moduleId);
    },
    [permissions, staff]
  );

  const checkCanCreate = useCallback(
    (moduleId: string) => {
      // If not authenticated, allow all actions (for initial setup)
      return !staff ? true : canPerformAction(permissions, moduleId, "create");
    },
    [permissions, staff]
  );

  const checkCanUpdate = useCallback(
    (moduleId: string) => {
      // If not authenticated, allow all actions (for initial setup)
      return !staff ? true : canPerformAction(permissions, moduleId, "update");
    },
    [permissions, staff]
  );

  const checkCanDelete = useCallback(
    (moduleId: string) => {
      // If not authenticated, allow all actions (for initial setup)
      return !staff ? true : canPerformAction(permissions, moduleId, "delete");
    },
    [permissions, staff]
  );

  const value: StaffContextType = {
    staff,
    isLoading,
    isAuthenticated: !!staff,
    permissions,
    hasPermission: checkPermission,
    canViewModule: checkCanViewModule,
    canCreate: checkCanCreate,
    canUpdate: checkCanUpdate,
    canDelete: checkCanDelete,
    login,
    logout,
    refreshStaff,
  };

  return (
    <StaffContext.Provider value={value}>{children}</StaffContext.Provider>
  );
}

export function useStaff() {
  const context = useContext(StaffContext);
  if (context === undefined) {
    throw new Error("useStaff must be used within a StaffProvider");
  }
  return context;
}

// Hook for checking if user can access a route
export function useCanAccess(moduleId: string) {
  const { canViewModule, isLoading, isAuthenticated } = useStaff();
  
  return {
    canAccess: canViewModule(moduleId),
    isLoading,
    isAuthenticated,
  };
}
