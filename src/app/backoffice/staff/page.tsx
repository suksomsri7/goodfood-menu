"use client";

import { useState } from "react";
import { Plus, Search, MoreVertical, Shield, Mail, Phone, Pencil, Trash2, UserCheck, UserX } from "lucide-react";

// Mock data
const staffMembers = [
  { 
    id: "1", 
    name: "สมชาย Admin", 
    email: "admin@goodfood.menu", 
    phone: "081-234-5678",
    role: "Super Admin", 
    status: "active",
    lastLogin: "2026-01-31 14:30"
  },
  { 
    id: "2", 
    name: "สมหญิง Manager", 
    email: "manager@goodfood.menu",
    phone: "089-876-5432", 
    role: "Admin", 
    status: "active",
    lastLogin: "2026-01-31 10:15"
  },
  { 
    id: "3", 
    name: "วิชัย Staff", 
    email: "staff1@goodfood.menu",
    phone: "086-555-1234", 
    role: "Staff", 
    status: "active",
    lastLogin: "2026-01-30 16:45"
  },
  { 
    id: "4", 
    name: "นภา Content", 
    email: "content@goodfood.menu",
    phone: "082-111-2222", 
    role: "Content Creator", 
    status: "inactive",
    lastLogin: "2026-01-25 09:00"
  },
];

const roleColors: Record<string, string> = {
  "Super Admin": "bg-purple-100 text-purple-700",
  "Admin": "bg-blue-100 text-blue-700",
  "Staff": "bg-green-100 text-green-700",
  "Content Creator": "bg-orange-100 text-orange-700",
};

export default function StaffPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredStaff = staffMembers.filter(
    (staff) =>
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการพนักงาน</h1>
          <p className="text-gray-500">เพิ่ม แก้ไข และกำหนดสิทธิ์การเข้าถึงของพนักงาน</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          เพิ่มพนักงาน
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">พนักงานทั้งหมด</p>
          <p className="text-2xl font-bold text-gray-800">{staffMembers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">ใช้งานอยู่</p>
          <p className="text-2xl font-bold text-green-600">
            {staffMembers.filter((s) => s.status === "active").length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">ไม่ได้ใช้งาน</p>
          <p className="text-2xl font-bold text-red-600">
            {staffMembers.filter((s) => s.status === "inactive").length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Role ทั้งหมด</p>
          <p className="text-2xl font-bold text-gray-800">4</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาพนักงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((staff) => (
          <div
            key={staff.id}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-700">
                    {staff.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{staff.name}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[staff.role]}`}>
                    {staff.role}
                  </span>
                </div>
              </div>
              <div className="relative group">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4" />
                <span>{staff.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{staff.phone}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                {staff.status === "active" ? (
                  <>
                    <UserCheck className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">ใช้งานอยู่</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">ไม่ได้ใช้งาน</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4 text-gray-500" />
                </button>
                <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              เข้าใช้งานล่าสุด: {staff.lastLogin}
            </p>
          </div>
        ))}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6">เพิ่มพนักงานใหม่</h2>
            
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="email@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0xx-xxx-xxxx"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">เลือก Role</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="content">Content Creator</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสผ่าน
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="กรอกรหัสผ่าน"
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
                  เพิ่มพนักงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
