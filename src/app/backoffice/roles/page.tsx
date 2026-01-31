"use client";

import { useState } from "react";
import { Plus, Shield, Users, Check, X, Pencil, Trash2 } from "lucide-react";

// Mock data
const roles = [
  {
    id: "1",
    name: "Super Admin",
    description: "สิทธิ์เต็ม ทำได้ทุกอย่าง",
    staffCount: 1,
    isSystem: true,
    permissions: ["all"],
  },
  {
    id: "2",
    name: "Admin",
    description: "จัดการระบบทั่วไป ยกเว้นการจัดการ Role",
    staffCount: 2,
    isSystem: true,
    permissions: ["foods", "members", "orders", "chat", "articles", "youtube", "schedule", "richmenu"],
  },
  {
    id: "3",
    name: "Staff",
    description: "พนักงานทั่วไป ดูข้อมูลและอัพเดทออเดอร์",
    staffCount: 5,
    isSystem: false,
    permissions: ["foods.view", "members.view", "orders", "chat"],
  },
  {
    id: "4",
    name: "Content Creator",
    description: "จัดการเนื้อหา บทความ และวีดีโอ",
    staffCount: 2,
    isSystem: false,
    permissions: ["articles", "youtube", "schedule"],
  },
];

const permissionModules = [
  {
    module: "Dashboard",
    key: "dashboard",
    permissions: [
      { key: "dashboard.view", label: "ดู Dashboard" },
    ],
  },
  {
    module: "อาหาร",
    key: "foods",
    permissions: [
      { key: "foods.view", label: "ดูรายการ" },
      { key: "foods.create", label: "เพิ่ม" },
      { key: "foods.update", label: "แก้ไข" },
      { key: "foods.delete", label: "ลบ" },
    ],
  },
  {
    module: "สมาชิก",
    key: "members",
    permissions: [
      { key: "members.view", label: "ดูรายการ" },
      { key: "members.update", label: "แก้ไข" },
      { key: "members.delete", label: "ลบ" },
    ],
  },
  {
    module: "ออเดอร์",
    key: "orders",
    permissions: [
      { key: "orders.view", label: "ดูรายการ" },
      { key: "orders.update", label: "อัพเดทสถานะ" },
    ],
  },
  {
    module: "Chat",
    key: "chat",
    permissions: [
      { key: "chat.view", label: "ดูแชท" },
      { key: "chat.reply", label: "ตอบแชท" },
    ],
  },
  {
    module: "บทความ",
    key: "articles",
    permissions: [
      { key: "articles.view", label: "ดูบทความ" },
      { key: "articles.create", label: "เพิ่ม" },
      { key: "articles.update", label: "แก้ไข" },
      { key: "articles.delete", label: "ลบ" },
    ],
  },
  {
    module: "พนักงาน",
    key: "staff",
    permissions: [
      { key: "staff.view", label: "ดูรายการ" },
      { key: "staff.create", label: "เพิ่ม" },
      { key: "staff.update", label: "แก้ไข" },
      { key: "staff.delete", label: "ลบ" },
    ],
  },
];

export default function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการสิทธิ์การใช้งาน</h1>
          <p className="text-gray-500">กำหนด Role และสิทธิ์ต่างๆ ของพนักงาน</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          สร้าง Role ใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-semibold text-gray-800">Roles ทั้งหมด</h2>
          
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all ${
                selectedRole === role.id
                  ? "border-primary-500"
                  : "border-transparent hover:border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{role.name}</h3>
                      {role.isSystem && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{role.description}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {role.staffCount} คน
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Permissions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          {selectedRole ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-gray-800">
                  สิทธิ์ของ {roles.find((r) => r.id === selectedRole)?.name}
                </h2>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  {!roles.find((r) => r.id === selectedRole)?.isSystem && (
                    <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {permissionModules.map((module) => (
                  <div key={module.key} className="border border-gray-100 rounded-lg p-4">
                    <h3 className="font-medium text-gray-800 mb-3">{module.module}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {module.permissions.map((perm) => {
                        const role = roles.find((r) => r.id === selectedRole);
                        const hasPermission =
                          role?.permissions.includes("all") ||
                          role?.permissions.includes(module.key) ||
                          role?.permissions.includes(perm.key);

                        return (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center ${
                                hasPermission
                                  ? "bg-primary-500 text-white"
                                  : "bg-gray-100 text-gray-300"
                              }`}
                            >
                              {hasPermission && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-sm text-gray-600">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                  บันทึกการเปลี่ยนแปลง
                </button>
                <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Shield className="w-12 h-12 mb-4" />
              <p>เลือก Role เพื่อดูและแก้ไขสิทธิ์</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6">สร้าง Role ใหม่</h2>
            
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ Role
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="เช่น Editor, Viewer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="อธิบายสิทธิ์ของ Role นี้"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  สร้าง Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
