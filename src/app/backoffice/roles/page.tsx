"use client";

import { Header } from "@/components/backoffice/Header";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Shield,
  Edit2,
  Trash2,
  Check,
  Users,
  X,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStaff } from "@/components/backoffice/StaffContext";
import { PERMISSION_MODULES, getRoleColor } from "@/lib/permissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: string;
  _count?: {
    staff: number;
  };
}

function RolesContent() {
  const searchParams = useSearchParams();
  const highlightRoleId = searchParams.get("highlight");
  const { canCreate, canUpdate, canDelete } = useStaff();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Scroll to highlighted role
  useEffect(() => {
    if (highlightRoleId && !isLoading) {
      const element = document.getElementById(`role-${highlightRoleId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-primary-500");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-primary-500");
        }, 2000);
      }
    }
  }, [highlightRoleId, isLoading]);

  // Open add modal
  const openAddModal = () => {
    setEditingRole(null);
    setFormData({
      name: "",
      description: "",
      permissions: [],
    });
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
    });
    setShowModal(true);
  };

  // Toggle permission
  const togglePermission = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter((p) => p !== code)
        : [...prev.permissions, code],
    }));
  };

  // Toggle all permissions in a module
  const toggleModule = (moduleId: string) => {
    const module = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!module) return;

    const moduleCodes = module.permissions.map((p) => p.code);
    const allSelected = moduleCodes.every((code) =>
      formData.permissions.includes(code)
    );

    if (allSelected) {
      // Remove all
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter(
          (p) => !moduleCodes.includes(p)
        ),
      }));
    } else {
      // Add all
      setFormData((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...moduleCodes])],
      }));
    }
  };

  // Toggle "all" permission (super admin)
  const toggleSuperAdmin = () => {
    if (formData.permissions.includes("all")) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => p !== "all"),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: ["all"],
      }));
    }
  };

  // Check if module is fully selected
  const isModuleSelected = (moduleId: string): boolean => {
    const module = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!module) return false;
    return module.permissions.every((p) =>
      formData.permissions.includes(p.code)
    );
  };

  // Check if module is partially selected
  const isModulePartial = (moduleId: string): boolean => {
    const module = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!module) return false;
    const selected = module.permissions.filter((p) =>
      formData.permissions.includes(p.code)
    );
    return selected.length > 0 && selected.length < module.permissions.length;
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.name) {
      alert("กรุณากรอกชื่อ Role");
      return;
    }

    setIsSaving(true);

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          permissions: formData.permissions,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error saving role:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });

      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // Count permissions
  const countPermissions = (permissions: string[]): number => {
    if (permissions.includes("all")) return PERMISSION_MODULES.flatMap((m) => m.permissions).length;
    return permissions.length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <Header title="สิทธิ์การใช้งาน" subtitle="จัดการ Role และ Permission" />

      <div className="p-8">
        {/* Actions */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-gray-600 leading-relaxed tracking-wide">
              กำหนดสิทธิ์การเข้าถึงระบบให้กับพนักงานแต่ละกลุ่ม
            </p>
          </div>
          {canCreate("roles") && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-6 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide"
            >
              <Plus className="w-5 h-5" />
              สร้าง Role ใหม่
            </button>
          )}
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {roles.map((role, index) => {
            const permissions = Array.isArray(role.permissions)
              ? role.permissions
              : [];
            const isSuperAdmin = permissions.includes("all");

            return (
              <motion.div
                key={role.id}
                id={`role-${role.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3.5 rounded-xl ${getRoleColor(role.name)}`}
                    >
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-bold text-gray-900 tracking-tight">
                          {role.name}
                        </h3>
                        {isSuperAdmin && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full tracking-wide">
                            Super Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 tracking-wide">
                        {role.description || "ไม่มีคำอธิบาย"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500 tracking-wide">
                    <Users className="w-4 h-4" />
                    <span>{role._count?.staff || 0} คน</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 tracking-wide">
                    <Check className="w-4 h-4" />
                    <span>
                      {isSuperAdmin
                        ? "สิทธิ์ทั้งหมด"
                        : `${countPermissions(permissions)} สิทธิ์`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {isSuperAdmin ? (
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg tracking-wide">
                      เข้าถึงทุกเมนู
                    </span>
                  ) : (
                    <>
                      {permissions.slice(0, 4).map((perm) => (
                        <span
                          key={perm}
                          className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg tracking-wide"
                        >
                          {perm}
                        </span>
                      ))}
                      {permissions.length > 4 && (
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg tracking-wide">
                          +{permissions.length - 4} more
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  {canUpdate("roles") && (
                    <button
                      onClick={() => openEditModal(role)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-50 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-100 transition-colors tracking-wide"
                    >
                      <Edit2 className="w-4 h-4" />
                      แก้ไข
                    </button>
                  )}
                  {canDelete("roles") && (role._count?.staff || 0) === 0 && (
                    <button
                      onClick={() => setShowDeleteConfirm(role.id)}
                      className="px-5 py-3 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {roles.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <p className="text-gray-500 tracking-wide">ยังไม่มี Role</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-7 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  {editingRole ? `แก้ไข Role: ${editingRole.name}` : "สร้าง Role ใหม่"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-7 overflow-y-auto flex-1">
                <div className="space-y-5 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                      ชื่อ Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                      placeholder="เช่น Admin, Staff"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                      คำอธิบาย
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                      placeholder="อธิบายหน้าที่ของ Role นี้"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 mb-4 tracking-tight">
                    กำหนดสิทธิ์
                  </h3>

                  {/* Super Admin Toggle */}
                  <div className="p-4 bg-purple-50 rounded-xl mb-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes("all")}
                        onChange={toggleSuperAdmin}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-semibold text-purple-900">
                          Super Admin
                        </span>
                        <p className="text-sm text-purple-700">
                          สิทธิ์เต็ม ทำได้ทุกอย่าง (เข้าถึงทุกเมนู)
                        </p>
                      </div>
                    </label>
                  </div>

                  {!formData.permissions.includes("all") && (
                    <div className="space-y-4">
                      {PERMISSION_MODULES.map((module) => (
                        <div
                          key={module.id}
                          className="border border-gray-200 rounded-xl p-5"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleModule(module.id)}
                                className="text-gray-400 hover:text-primary-600"
                              >
                                {isModuleSelected(module.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary-600" />
                                ) : isModulePartial(module.id) ? (
                                  <div className="w-5 h-5 border-2 border-primary-600 rounded flex items-center justify-center">
                                    <div className="w-2 h-2 bg-primary-600 rounded-sm" />
                                  </div>
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                              <h4 className="font-semibold text-gray-900 tracking-wide">
                                {module.label}
                              </h4>
                            </div>
                            <button
                              onClick={() => toggleModule(module.id)}
                              className="text-xs text-primary-600 font-semibold hover:underline tracking-wide"
                            >
                              {isModuleSelected(module.id)
                                ? "ยกเลิกทั้งหมด"
                                : "เลือกทั้งหมด"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {module.permissions.map((perm) => (
                              <label
                                key={perm.code}
                                className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.includes(
                                    perm.code
                                  )}
                                  onChange={() => togglePermission(perm.code)}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700 tracking-wide">
                                  {perm.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-7 border-t border-gray-100 flex gap-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors tracking-wide"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingRole ? "บันทึก" : "สร้าง Role"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-sm p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                ยืนยันการลบ
              </h3>
              <p className="text-gray-500 mb-8">
                คุณต้องการลบ Role นี้ใช่หรือไม่?
                การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                >
                  ลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <RolesContent />
    </Suspense>
  );
}
