// Permission definitions that map to Sidebar menus
// Format: "module.action" where action is: view, create, update, delete

export interface PermissionModule {
  id: string;
  label: string;
  description?: string;
  permissions: {
    code: string;
    label: string;
  }[];
}

// All available permission modules - maps to Sidebar menus
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    permissions: [{ code: "dashboard.view", label: "ดู Dashboard" }],
  },
  {
    id: "members",
    label: "สมาชิก",
    permissions: [
      { code: "members.view", label: "ดูรายการ" },
      { code: "members.update", label: "แก้ไข" },
    ],
  },
  {
    id: "orders",
    label: "ออเดอร์",
    permissions: [
      { code: "orders.view", label: "ดูรายการ" },
      { code: "orders.update", label: "อัพเดทสถานะ" },
      { code: "orders.delete", label: "ลบ" },
    ],
  },
  {
    id: "chat",
    label: "แชท",
    permissions: [
      { code: "chat.view", label: "ดูแชท" },
      { code: "chat.reply", label: "ตอบแชท" },
    ],
  },
  {
    id: "restaurants",
    label: "ร้านอาหาร",
    permissions: [
      { code: "restaurants.view", label: "ดูรายการ" },
      { code: "restaurants.create", label: "เพิ่ม" },
      { code: "restaurants.update", label: "แก้ไข" },
      { code: "restaurants.delete", label: "ลบ" },
    ],
  },
  {
    id: "foods",
    label: "เมนูอาหาร",
    permissions: [
      { code: "foods.view", label: "ดูรายการ" },
      { code: "foods.create", label: "เพิ่ม" },
      { code: "foods.update", label: "แก้ไข" },
      { code: "foods.delete", label: "ลบ" },
    ],
  },
  {
    id: "packages",
    label: "แพ็คเกจอาหาร",
    permissions: [
      { code: "packages.view", label: "ดูรายการ" },
      { code: "packages.create", label: "เพิ่ม" },
      { code: "packages.update", label: "แก้ไข" },
      { code: "packages.delete", label: "ลบ" },
    ],
  },
  {
    id: "promotions",
    label: "โปรโมชั่น",
    permissions: [
      { code: "promotions.view", label: "ดูรายการ" },
      { code: "promotions.create", label: "เพิ่ม" },
      { code: "promotions.update", label: "แก้ไข" },
      { code: "promotions.delete", label: "ลบ" },
    ],
  },
  {
    id: "barcode",
    label: "ข้อมูลจาก Scan Barcode",
    permissions: [
      { code: "barcode.view", label: "ดูรายการ" },
      { code: "barcode.create", label: "เพิ่ม" },
      { code: "barcode.update", label: "แก้ไข" },
      { code: "barcode.delete", label: "ลบ" },
    ],
  },
  {
    id: "articles",
    label: "บทความ",
    permissions: [
      { code: "articles.view", label: "ดูรายการ" },
      { code: "articles.create", label: "เพิ่ม" },
      { code: "articles.update", label: "แก้ไข" },
      { code: "articles.delete", label: "ลบ" },
    ],
  },
  {
    id: "article-categories",
    label: "หมวดบทความ",
    permissions: [
      { code: "article-categories.view", label: "ดูรายการ" },
      { code: "article-categories.create", label: "เพิ่ม" },
      { code: "article-categories.update", label: "แก้ไข" },
      { code: "article-categories.delete", label: "ลบ" },
    ],
  },
  {
    id: "youtube",
    label: "วีดีโอ",
    permissions: [
      { code: "youtube.view", label: "ดูรายการ" },
      { code: "youtube.create", label: "เพิ่ม" },
      { code: "youtube.update", label: "แก้ไข" },
      { code: "youtube.delete", label: "ลบ" },
    ],
  },
  {
    id: "categories",
    label: "หมวดอาหาร",
    permissions: [
      { code: "categories.view", label: "ดูรายการ" },
      { code: "categories.create", label: "เพิ่ม" },
      { code: "categories.update", label: "แก้ไข" },
      { code: "categories.delete", label: "ลบ" },
    ],
  },
  {
    id: "settings",
    label: "บัญชีรับชำระเงิน",
    permissions: [
      { code: "settings.view", label: "ดูรายการ" },
      { code: "settings.create", label: "เพิ่ม" },
      { code: "settings.update", label: "แก้ไข" },
      { code: "settings.delete", label: "ลบ" },
    ],
  },
  {
    id: "member-types",
    label: "ประเภทสมาชิก",
    permissions: [
      { code: "member-types.view", label: "ดูรายการ" },
      { code: "member-types.create", label: "เพิ่ม" },
      { code: "member-types.update", label: "แก้ไข" },
      { code: "member-types.delete", label: "ลบ" },
    ],
  },
  {
    id: "staff",
    label: "พนักงาน",
    permissions: [
      { code: "staff.view", label: "ดูรายการ" },
      { code: "staff.create", label: "เพิ่ม" },
      { code: "staff.update", label: "แก้ไข" },
      { code: "staff.delete", label: "ลบ" },
    ],
  },
  {
    id: "roles",
    label: "สิทธิ์",
    permissions: [
      { code: "roles.view", label: "ดูรายการ" },
      { code: "roles.create", label: "เพิ่ม" },
      { code: "roles.update", label: "แก้ไข" },
      { code: "roles.delete", label: "ลบ" },
    ],
  },
];

// Map menu paths to permission modules
export const MENU_PERMISSION_MAP: Record<string, string> = {
  "/backoffice": "dashboard",
  "/backoffice/members": "members",
  "/backoffice/orders": "orders",
  "/backoffice/chat": "chat",
  "/backoffice/restaurants": "restaurants",
  "/backoffice/foods": "foods",
  "/backoffice/foods/new": "foods",
  "/backoffice/packages": "packages",
  "/backoffice/promotions": "promotions",
  "/backoffice/barcode": "barcode",
  "/backoffice/articles": "articles",
  "/backoffice/article-categories": "article-categories",
  "/backoffice/youtube": "youtube",
  "/backoffice/categories": "categories",
  "/backoffice/settings": "settings",
  "/backoffice/member-types": "member-types",
  "/backoffice/staff": "staff",
  "/backoffice/roles": "roles",
};

// Get all permission codes as a flat array
export function getAllPermissionCodes(): string[] {
  return PERMISSION_MODULES.flatMap((module) =>
    module.permissions.map((p) => p.code)
  );
}

// Check if user has specific permission
export function hasPermission(
  userPermissions: string[],
  permissionCode: string
): boolean {
  // "all" means super admin with full access
  if (userPermissions.includes("all")) {
    return true;
  }
  return userPermissions.includes(permissionCode);
}

// Check if user can view a module
export function canViewModule(
  userPermissions: string[],
  moduleId: string
): boolean {
  if (userPermissions.includes("all")) {
    return true;
  }
  return userPermissions.includes(`${moduleId}.view`);
}

// Check if user can perform action on module
export function canPerformAction(
  userPermissions: string[],
  moduleId: string,
  action: "create" | "update" | "delete"
): boolean {
  if (userPermissions.includes("all")) {
    return true;
  }
  return userPermissions.includes(`${moduleId}.${action}`);
}

// Get module permissions for a specific module
export function getModulePermissions(moduleId: string) {
  return PERMISSION_MODULES.find((m) => m.id === moduleId);
}

// Role colors for display
export const ROLE_COLORS: Record<string, string> = {
  "Super Admin": "bg-purple-100 text-purple-700",
  Admin: "bg-blue-100 text-blue-700",
  Staff: "bg-gray-100 text-gray-700",
  "Content Creator": "bg-pink-100 text-pink-700",
  default: "bg-green-100 text-green-700",
};

export function getRoleColor(roleName: string): string {
  return ROLE_COLORS[roleName] || ROLE_COLORS.default;
}
