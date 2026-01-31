"use client";

import { Header } from "@/components/backoffice/Header";
import { motion } from "framer-motion";
import { Plus, Search, Edit2, Shield, MoreVertical } from "lucide-react";
import { useState } from "react";

// Mock data
const staffMembers = [
  {
    id: "1",
    name: "อรุณ ศรีสว่าง",
    email: "arun@goodfood.menu",
    role: "Super Admin",
    roleColor: "bg-purple-100 text-purple-700",
    status: "active",
    lastLogin: "วันนี้ 10:30",
    avatar: "อ",
  },
  {
    id: "2",
    name: "สมหญิง รักดี",
    email: "somying@goodfood.menu",
    role: "Admin",
    roleColor: "bg-blue-100 text-blue-700",
    status: "active",
    lastLogin: "เมื่อวาน 15:45",
    avatar: "ส",
  },
  {
    id: "3",
    name: "ประยุทธ์ ทำงาน",
    email: "prayut@goodfood.menu",
    role: "Staff",
    roleColor: "bg-gray-100 text-gray-700",
    status: "active",
    lastLogin: "3 วันที่แล้ว",
    avatar: "ป",
  },
  {
    id: "4",
    name: "กานดา เขียนดี",
    email: "kanda@goodfood.menu",
    role: "Content Creator",
    roleColor: "bg-pink-100 text-pink-700",
    status: "inactive",
    lastLogin: "1 สัปดาห์ที่แล้ว",
    avatar: "ก",
  },
];

const roles = ["Super Admin", "Admin", "Staff", "Content Creator"];

export default function StaffPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredStaff = staffMembers.filter((staff) =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header title="จัดการพนักงาน" subtitle="เพิ่ม แก้ไข และกำหนดสิทธิ์พนักงาน" />

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

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide"
          >
            <Plus className="w-5 h-5" />
            <span>เพิ่มพนักงาน</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{staffMembers.length}</p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">พนักงานทั้งหมด</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-green-600 tabular-nums">
              {staffMembers.filter((s) => s.status === "active").length}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">ใช้งานอยู่</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-purple-600 tabular-nums">
              {staffMembers.filter((s) => s.role === "Admin" || s.role === "Super Admin").length}
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
              {staffMembers.filter((s) => s.status === "inactive").length}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">ไม่ได้ใช้งาน</p>
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
                    {staff.avatar}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 tracking-wide">{staff.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 tracking-wide">{staff.email}</p>
                  </div>
                </div>
                <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex items-center justify-between mb-5">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${staff.roleColor}`}>
                  {staff.role}
                </span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium tracking-wide ${
                    staff.status === "active" ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      staff.status === "active" ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  {staff.status === "active" ? "ใช้งานอยู่" : "ไม่ได้ใช้งาน"}
                </span>
              </div>

              <div className="text-xs text-gray-400 mb-5 tracking-wide">
                เข้าใช้งานล่าสุด: {staff.lastLogin}
              </div>

              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors tracking-wide">
                  <Shield className="w-4 h-4" />
                  สิทธิ์
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-50 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-100 transition-colors tracking-wide">
                  <Edit2 className="w-4 h-4" />
                  แก้ไข
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-8"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-8 tracking-tight">เพิ่มพนักงานใหม่</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">อีเมล</label>
                <input
                  type="email"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                  placeholder="email@goodfood.menu"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">รหัสผ่าน</label>
                <input
                  type="password"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-wide">Role</label>
                <select className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-[15px] tracking-wide">
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors tracking-wide"
              >
                ยกเลิก
              </button>
              <button className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors tracking-wide">
                เพิ่มพนักงาน
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
