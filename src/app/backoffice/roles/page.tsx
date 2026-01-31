"use client";

import { Header } from "@/components/backoffice/Header";
import { motion } from "framer-motion";
import { Plus, Shield, Edit2, Trash2, Check, Users } from "lucide-react";
import { useState } from "react";

// Mock data
const roles = [
  {
    id: "1",
    name: "Super Admin",
    description: "สิทธิ์เต็ม ทำได้ทุกอย่าง",
    staffCount: 1,
    isSystem: true,
    color: "bg-purple-100 text-purple-700",
    permissions: ["all"],
  },
  {
    id: "2",
    name: "Admin",
    description: "จัดการระบบทั่วไป",
    staffCount: 2,
    isSystem: true,
    color: "bg-blue-100 text-blue-700",
    permissions: ["dashboard", "foods", "members", "orders", "chat", "articles", "youtube"],
  },
  {
    id: "3",
    name: "Staff",
    description: "พนักงานทั่วไป",
    staffCount: 5,
    isSystem: false,
    color: "bg-gray-100 text-gray-700",
    permissions: ["dashboard", "foods.view", "orders", "chat"],
  },
  {
    id: "4",
    name: "Content Creator",
    description: "จัดการเนื้อหา บทความ และวีดีโอ",
    staffCount: 2,
    isSystem: false,
    color: "bg-pink-100 text-pink-700",
    permissions: ["dashboard", "articles", "youtube", "schedule"],
  },
];

const permissionModules = [
  {
    module: "dashboard",
    label: "Dashboard",
    permissions: [
      { code: "dashboard.view", label: "ดู Dashboard" },
    ],
  },
  {
    module: "foods",
    label: "เมนูอาหาร",
    permissions: [
      { code: "foods.view", label: "ดูรายการ" },
      { code: "foods.create", label: "เพิ่ม" },
      { code: "foods.update", label: "แก้ไข" },
      { code: "foods.delete", label: "ลบ" },
    ],
  },
  {
    module: "members",
    label: "สมาชิก",
    permissions: [
      { code: "members.view", label: "ดูรายการ" },
      { code: "members.update", label: "แก้ไข" },
      { code: "members.delete", label: "ลบ" },
    ],
  },
  {
    module: "orders",
    label: "ออเดอร์",
    permissions: [
      { code: "orders.view", label: "ดูรายการ" },
      { code: "orders.update", label: "อัพเดทสถานะ" },
    ],
  },
  {
    module: "chat",
    label: "แชท",
    permissions: [
      { code: "chat.view", label: "ดูแชท" },
      { code: "chat.reply", label: "ตอบแชท" },
    ],
  },
  {
    module: "articles",
    label: "บทความ",
    permissions: [
      { code: "articles.view", label: "ดูรายการ" },
      { code: "articles.create", label: "เพิ่ม" },
      { code: "articles.update", label: "แก้ไข" },
      { code: "articles.delete", label: "ลบ" },
    ],
  },
  {
    module: "staff",
    label: "พนักงาน",
    permissions: [
      { code: "staff.view", label: "ดูรายการ" },
      { code: "staff.create", label: "เพิ่ม" },
      { code: "staff.update", label: "แก้ไข" },
      { code: "staff.delete", label: "ลบ" },
    ],
  },
];

export default function RolesPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<typeof roles[0] | null>(null);

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
          <button
            onClick={() => {
              setSelectedRole(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide"
          >
            <Plus className="w-5 h-5" />
            สร้าง Role ใหม่
          </button>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {roles.map((role, index) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3.5 rounded-xl ${role.color}`}>
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-gray-900 tracking-tight">{role.name}</h3>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full tracking-wide">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 tracking-wide">{role.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5 mb-5">
                <div className="flex items-center gap-2 text-sm text-gray-500 tracking-wide">
                  <Users className="w-4 h-4" />
                  <span>{role.staffCount} คน</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 tracking-wide">
                  <Check className="w-4 h-4" />
                  <span>{role.permissions.length} สิทธิ์</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                {role.permissions.slice(0, 4).map((perm) => (
                  <span
                    key={perm}
                    className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg tracking-wide"
                  >
                    {perm}
                  </span>
                ))}
                {role.permissions.length > 4 && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg tracking-wide">
                    +{role.permissions.length - 4} more
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedRole(role);
                    setShowModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-50 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-100 transition-colors tracking-wide"
                >
                  <Edit2 className="w-4 h-4" />
                  แก้ไข
                </button>
                {!role.isSystem && (
                  <button className="px-5 py-3 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-7 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                {selectedRole ? `แก้ไข Role: ${selectedRole.name}` : "สร้าง Role ใหม่"}
              </h2>
            </div>

            <div className="p-7 overflow-y-auto flex-1">
              <div className="space-y-5 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">ชื่อ Role</label>
                  <input
                    type="text"
                    defaultValue={selectedRole?.name}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                    placeholder="เช่น Admin, Staff"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">คำอธิบาย</label>
                  <input
                    type="text"
                    defaultValue={selectedRole?.description}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                    placeholder="อธิบายหน้าที่ของ Role นี้"
                  />
                </div>
              </div>

              <h3 className="font-bold text-gray-900 mb-5 tracking-tight">กำหนดสิทธิ์</h3>
              <div className="space-y-5">
                {permissionModules.map((module) => (
                  <div key={module.module} className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 tracking-wide">{module.label}</h4>
                      <button className="text-xs text-primary-600 font-semibold hover:underline tracking-wide">เลือกทั้งหมด</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {module.permissions.map((perm) => (
                        <label
                          key={perm.code}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 tracking-wide">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-7 border-t border-gray-100 flex gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors tracking-wide"
              >
                ยกเลิก
              </button>
              <button className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide">
                {selectedRole ? "บันทึก" : "สร้าง Role"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
