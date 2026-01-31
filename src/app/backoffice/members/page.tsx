"use client";

import { Header } from "@/components/backoffice/Header";
import { motion } from "framer-motion";
import { Search, Filter, Eye, MessageSquare, MoreVertical } from "lucide-react";
import { useState } from "react";

// Mock data
const members = [
  {
    id: "1",
    name: "สมชาย ใจดี",
    lineId: "U1234567890",
    targetCalories: 2000,
    goal: "ลดน้ำหนัก",
    goalColor: "bg-red-100 text-red-700",
    joinedDate: "15 ม.ค. 2026",
    lastActive: "วันนี้",
    totalOrders: 12,
    avatar: "ส",
  },
  {
    id: "2",
    name: "สมหญิง รักสุขภาพ",
    lineId: "U0987654321",
    targetCalories: 1800,
    goal: "รักษาน้ำหนัก",
    goalColor: "bg-blue-100 text-blue-700",
    joinedDate: "20 ม.ค. 2026",
    lastActive: "เมื่อวาน",
    totalOrders: 8,
    avatar: "ส",
  },
  {
    id: "3",
    name: "มานะ ตั้งใจ",
    lineId: "U1122334455",
    targetCalories: 2500,
    goal: "เพิ่มกล้ามเนื้อ",
    goalColor: "bg-green-100 text-green-700",
    joinedDate: "25 ม.ค. 2026",
    lastActive: "3 วันที่แล้ว",
    totalOrders: 25,
    avatar: "ม",
  },
  {
    id: "4",
    name: "วิภา สดใส",
    lineId: "U5544332211",
    targetCalories: 1600,
    goal: "ลดน้ำหนัก",
    goalColor: "bg-red-100 text-red-700",
    joinedDate: "28 ม.ค. 2026",
    lastActive: "วันนี้",
    totalOrders: 5,
    avatar: "ว",
  },
];

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header title="สมาชิก" subtitle="จัดการข้อมูลสมาชิกทั้งหมด" />

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{members.length}</p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">สมาชิกทั้งหมด</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-green-600 tabular-nums">
              {members.filter((m) => m.lastActive === "วันนี้").length}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">ใช้งานวันนี้</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-blue-600 tabular-nums">2</p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">สมาชิกใหม่วันนี้</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <p className="text-2xl font-bold text-purple-600 tabular-nums">
              {members.reduce((sum, m) => sum + m.totalOrders, 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1 tracking-wide">ออเดอร์รวม</p>
          </motion.div>
        </div>

        {/* Search */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาสมาชิก..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-[15px] tracking-wide"
            />
          </div>
          <button className="flex items-center gap-2.5 px-5 py-3.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors tracking-wide">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-gray-700 font-medium">ตัวกรอง</span>
          </button>
        </div>

        {/* Members Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">สมาชิก</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">เป้าหมาย</th>
                  <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">แคลอรี่/วัน</th>
                  <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">ออเดอร์</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">เข้าใช้ล่าสุด</th>
                  <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMembers.map((member, index) => (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-primary-500/20">
                          {member.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 tracking-wide">{member.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 tracking-wide">เข้าร่วม {member.joinedDate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${member.goalColor}`}>
                        {member.goal}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center font-semibold text-gray-900 tabular-nums">
                      {member.targetCalories.toLocaleString()}
                    </td>
                    <td className="py-5 px-6 text-center font-semibold text-gray-600 tabular-nums">
                      {member.totalOrders}
                    </td>
                    <td className="py-5 px-6">
                      <span className={`text-sm font-medium tracking-wide ${
                        member.lastActive === "วันนี้" ? "text-green-600" : "text-gray-500"
                      }`}>
                        {member.lastActive}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-primary-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
