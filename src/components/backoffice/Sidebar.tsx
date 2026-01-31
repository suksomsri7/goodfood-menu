"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Utensils,
  Users,
  ShoppingBag,
  MessageSquare,
  FileText,
  Youtube,
  Bell,
  Calendar,
  Settings,
  Menu,
  UserCog,
  Shield,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: "/backoffice", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: "/backoffice/foods", label: "จัดการอาหาร", icon: <Utensils className="w-5 h-5" /> },
  { href: "/backoffice/members", label: "สมาชิก", icon: <Users className="w-5 h-5" /> },
  { href: "/backoffice/orders", label: "รายการสั่งซื้อ", icon: <ShoppingBag className="w-5 h-5" />, badge: 5 },
  { href: "/backoffice/chat", label: "Chat", icon: <MessageSquare className="w-5 h-5" />, badge: 3 },
  { href: "/backoffice/articles", label: "บทความ", icon: <FileText className="w-5 h-5" /> },
  { href: "/backoffice/youtube", label: "วีดีโอ YouTube", icon: <Youtube className="w-5 h-5" /> },
  { href: "/backoffice/schedule", label: "ตั้งเวลาส่ง", icon: <Calendar className="w-5 h-5" /> },
  { href: "/backoffice/notifications", label: "Notifications", icon: <Bell className="w-5 h-5" /> },
];

const adminItems: NavItem[] = [
  { href: "/backoffice/staff", label: "พนักงาน", icon: <UserCog className="w-5 h-5" /> },
  { href: "/backoffice/roles", label: "สิทธิ์การใช้งาน", icon: <Shield className="w-5 h-5" /> },
  { href: "/backoffice/settings", label: "ตั้งค่า", icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300 z-50",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
        {!collapsed && (
          <Link href="/backoffice" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">GoodFood</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {collapsed ? (
            <Menu className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive
                  ? "bg-primary-500 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              {item.icon}
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="my-4 border-t border-slate-700" />

        {/* Admin Section */}
        {!collapsed && (
          <p className="px-3 text-xs text-slate-500 uppercase tracking-wider mb-2">
            Admin
          </p>
        )}
        
        {adminItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive
                  ? "bg-primary-500 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-sm font-medium">AD</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-xs text-slate-400 truncate">admin@goodfood.menu</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
