"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface AdminContextType {
  admin: AdminUser | null;
  setAdmin: (admin: AdminUser | null) => void;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Default admin for now (will be replaced with real auth later)
const DEFAULT_ADMIN: AdminUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@goodfood.menu",
  role: "Super Admin",
};

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdminState] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to load admin from localStorage
    const savedAdmin = localStorage.getItem("backoffice_admin");
    if (savedAdmin) {
      try {
        setAdminState(JSON.parse(savedAdmin));
      } catch {
        setAdminState(DEFAULT_ADMIN);
      }
    } else {
      // Use default admin for now
      setAdminState(DEFAULT_ADMIN);
      localStorage.setItem("backoffice_admin", JSON.stringify(DEFAULT_ADMIN));
    }
    setIsLoading(false);
  }, []);

  const setAdmin = (newAdmin: AdminUser | null) => {
    setAdminState(newAdmin);
    if (newAdmin) {
      localStorage.setItem("backoffice_admin", JSON.stringify(newAdmin));
    } else {
      localStorage.removeItem("backoffice_admin");
    }
  };

  return (
    <AdminContext.Provider value={{ admin, setAdmin, isLoading }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
