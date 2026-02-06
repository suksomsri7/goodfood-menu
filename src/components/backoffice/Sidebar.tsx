"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  ShoppingCart,
  MessageSquare,
  FileText,
  Youtube,
  Calendar,
  Settings,
  UserCog,
  Shield,
  ChevronLeft,
  LogOut,
  Layers,
  Package,
  BadgePercent,
  Table2,
  ScanBarcode,
  CreditCard,
  Crown,
  Store,
} from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: string; // Key to look up dynamic badge count
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "หลัก",
    items: [
      { href: "/backoffice", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    ],
  },
  {
    title: "ลูกค้า",
    items: [
      { href: "/backoffice/members", label: "สมาชิก", icon: <Users className="w-5 h-5" /> },
      { href: "/backoffice/orders", label: "ออเดอร์", icon: <ShoppingCart className="w-5 h-5" />, badgeKey: "orders" },
      { href: "/backoffice/chat", label: "แชท", icon: <MessageSquare className="w-5 h-5" />, badgeKey: "chat" },
    ],
  },
  {
    title: "จัดการ",
    items: [
      { href: "/backoffice/restaurants", label: "ร้านอาหาร", icon: <Store className="w-5 h-5" /> },
      { href: "/backoffice/foods", label: "เมนูอาหาร", icon: <UtensilsCrossed className="w-5 h-5" /> },
      { href: "/backoffice/packages", label: "แพ็คเกจอาหาร", icon: <Package className="w-5 h-5" /> },
      { href: "/backoffice/promotions", label: "โปรโมชั่น", icon: <BadgePercent className="w-5 h-5" /> },
      { href: "/backoffice/nutrition", label: "ตารางสารอาหาร", icon: <Table2 className="w-5 h-5" /> },
      { href: "/backoffice/barcode", label: "ข้อมูลจาก Scan Barcode", icon: <ScanBarcode className="w-5 h-5" /> },
      { href: "/backoffice/articles", label: "บทความ", icon: <FileText className="w-5 h-5" /> },
      { href: "/backoffice/youtube", label: "วีดีโอ", icon: <Youtube className="w-5 h-5" /> },
    ],
  },
  {
    title: "ตั้งค่า",
    items: [
      { href: "/backoffice/categories", label: "หมวดอาหาร", icon: <Layers className="w-5 h-5" /> },
      { href: "/backoffice/settings", label: "บัญชีรับชำระเงิน", icon: <CreditCard className="w-5 h-5" /> },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { href: "/backoffice/member-types", label: "ประเภทสมาชิก", icon: <Crown className="w-5 h-5" /> },
      { href: "/backoffice/schedule", label: "ตั้งเวลา", icon: <Calendar className="w-5 h-5" /> },
      { href: "/backoffice/staff", label: "พนักงาน", icon: <UserCog className="w-5 h-5" /> },
      { href: "/backoffice/roles", label: "สิทธิ์", icon: <Shield className="w-5 h-5" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const [badges, setBadges] = useState<Record<string, number>>({});

  // Fetch badge counts
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        // Fetch chat unread count
        const chatRes = await fetch("/api/line/unread");
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setBadges((prev) => ({ ...prev, chat: chatData.unreadCount || 0 }));
        }

        // Fetch pending orders count (if API exists)
        // const ordersRes = await fetch("/api/orders/pending-count");
        // if (ordersRes.ok) {
        //   const ordersData = await ordersRes.json();
        //   setBadges((prev) => ({ ...prev, orders: ordersData.count || 0 }));
        // }
      } catch (error) {
        console.error("Error fetching badges:", error);
      }
    };

    fetchBadges();

    // Refresh every 30 seconds
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4CAF50] flex items-center justify-center">
              <span className="text-white font-bold">G</span>
            </div>
            <span className="font-bold text-gray-900">GoodFood</span>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className={cn("w-4 h-4 text-gray-400", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title} className={cn(groupIndex > 0 && "mt-6")}>
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-medium text-gray-400 uppercase">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-[#E8F5E9] text-[#4CAF50]"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <div className="relative">
                      {item.icon}
                      {collapsed && badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-medium bg-red-500 text-white rounded-full flex items-center justify-center">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full min-w-[20px] text-center">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100">
        <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-gray-50", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-sm font-medium">
            A
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Admin</p>
                <p className="text-xs text-gray-500 truncate">admin@goodfood.menu</p>
              </div>
              <button className="p-1 rounded hover:bg-gray-200">
                <LogOut className="w-4 h-4 text-gray-400" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
