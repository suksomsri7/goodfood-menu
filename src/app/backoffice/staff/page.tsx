"use client";

import { Header } from "@/components/backoffice/Header";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Edit2,
  Shield,
  MoreVertical,
  Trash2,
  X,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useStaff } from "@/components/backoffice/StaffContext";
import { getRoleColor } from "@/lib/permissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role: Role;
}

export default function StaffPage() {
  const { canCreate, canUpdate, canDelete } = useStaff();

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    roleId: "",
    isActive: true,
  });

  // Fetch staff and roles
  const fetchData = useCallback(async () => {
    try {
      const [staffRes, rolesRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/roles"),
      ]);

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffMembers(staffData);
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter staff by search
  const filteredStaff = staffMembers.filter(
    (staff) =>
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const activeCount = staffMembers.filter((s) => s.isActive).length;
  const inactiveCount = staffMembers.filter((s) => !s.isActive).length;
  const adminCount = staffMembers.filter((s) =>
    ["Super Admin", "Admin"].includes(s.role?.name)
  ).length;

  // Open add modal
  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      phone: "",
      roleId: roles[0]?.id || "",
      isActive: true,
    });
    setShowPassword(false);
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: "",
      phone: staff.phone || "",
      roleId: staff.roleId,
      isActive: staff.isActive,
    });
    setShowPassword(false);
    setShowModal(true);
    setActionMenuId(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.roleId) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (!editingStaff && !formData.password) {
      alert("กรุณากรอกรหัสผ่าน");
      return;
    }

    setIsSaving(true);

    try {
      const url = editingStaff
        ? `/api/staff/${editingStaff.id}`
        : "/api/staff";
      const method = editingStaff ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        roleId: formData.roleId,
        isActive: formData.isActive,
      };

      if (formData.password) {
        body.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error saving staff:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });

      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error deleting staff:", error);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // Toggle staff active status
  const toggleStaffStatus = async (staff: StaffMember) => {
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !staff.isActive }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    }
    setActionMenuId(null);
  };

  // Get avatar initial
  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "วันนี้";
    if (days === 1) return "เมื่อวาน";
    if (days < 7) return `${days} วันที่แล้ว`;
    if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`;
    return date.toLocaleDateString("th-TH");
  };

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="จัดการพนักงาน"
        subtitle="เพิ่ม แก้ไข และกำหนดสิทธิ์พนักงาน"
      />

      <div className="p-8">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาพนักงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-[15px] tracking-wide"
            />
          </div>

          {canCreate("staff") && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-6 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide"
            >
              <Plus className="w-5 h-5" />
              <span>เพิ่มพนักงาน</span>
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {staffMembers.length}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">
              พนักงานทั้งหมด
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-green-600 tabular-nums">
              {activeCount}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">
              ใช้งานอยู่
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-purple-600 tabular-nums">
              {adminCount}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">Admin</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-400 tabular-nums">
              {inactiveCount}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">
              ไม่ได้ใช้งาน
            </p>
          </motion.div>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((staff, index) => (
            <motion.div
              key={staff.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">
                    {staff.avatarUrl ? (
                      <img
                        src={staff.avatarUrl}
                        alt={staff.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      getInitial(staff.name)
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 tracking-wide">
                      {staff.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5 tracking-wide">
                      {staff.email}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() =>
                      setActionMenuId(
                        actionMenuId === staff.id ? null : staff.id
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>

                  {/* Action Menu */}
                  <AnimatePresence>
                    {actionMenuId === staff.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-10"
                      >
                        {canUpdate("staff") && (
                          <>
                            <button
                              onClick={() => openEditModal(staff)}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <Edit2 className="w-4 h-4" />
                              แก้ไข
                            </button>
                            <button
                              onClick={() => toggleStaffStatus(staff)}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              {staff.isActive ? (
                                <>
                                  <EyeOff className="w-4 h-4" />
                                  ปิดการใช้งาน
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4" />
                                  เปิดการใช้งาน
                                </>
                              )}
                            </button>
                          </>
                        )}
                        {canDelete("staff") && (
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(staff.id);
                              setActionMenuId(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                          >
                            <Trash2 className="w-4 h-4" />
                            ลบ
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center justify-between mb-5">
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${getRoleColor(
                    staff.role?.name || ""
                  )}`}
                >
                  {staff.role?.name || "No Role"}
                </span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium tracking-wide ${
                    staff.isActive ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      staff.isActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  {staff.isActive ? "ใช้งานอยู่" : "ไม่ได้ใช้งาน"}
                </span>
              </div>

              <div className="text-xs text-gray-400 mb-5 tracking-wide">
                สร้างเมื่อ: {formatDate(staff.createdAt)}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    (window.location.href = `/backoffice/roles?highlight=${staff.roleId}`)
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors tracking-wide"
                >
                  <Shield className="w-4 h-4" />
                  สิทธิ์
                </button>
                {canUpdate("staff") && (
                  <button
                    onClick={() => openEditModal(staff)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-50 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-100 transition-colors tracking-wide"
                  >
                    <Edit2 className="w-4 h-4" />
                    แก้ไข
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {filteredStaff.length === 0 && !isDataLoading && (
          <div className="text-center py-16">
            <p className="text-gray-500 tracking-wide">ไม่พบพนักงาน</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  {editingStaff ? "แก้ไขพนักงาน" : "เพิ่มพนักงานใหม่"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                    placeholder="กรอกชื่อ-นามสกุล"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                    อีเมล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                    placeholder="email@goodfood.menu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                    รหัสผ่าน{" "}
                    {!editingStaff && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide pr-12"
                      placeholder={
                        editingStaff
                          ? "ว่างไว้ถ้าไม่ต้องการเปลี่ยน"
                          : "••••••••"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                    เบอร์โทร
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                    placeholder="0812345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) =>
                      setFormData({ ...formData, roleId: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                  >
                    <option value="">เลือก Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-medium text-gray-700"
                  >
                    เปิดใช้งาน
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
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
                  {editingStaff ? "บันทึก" : "เพิ่มพนักงาน"}
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
                คุณต้องการลบพนักงานคนนี้ใช่หรือไม่?
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
