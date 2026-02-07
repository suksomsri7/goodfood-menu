"use client";

import { Header } from "@/components/backoffice/Header";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Eye,
  MessageSquare,
  X,
  User,
  Target,
  Utensils,
  ShoppingBag,
  Loader2,
  Calendar,
  Scale,
  Flame,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { th } from "date-fns/locale";
import Link from "next/link";

interface MemberType {
  id: string;
  name: string;
  color: string;
}

interface Member {
  id: string;
  lineUserId: string;
  displayName: string | null;
  name: string | null;
  pictureUrl: string | null;
  email: string | null;
  phone: string | null;
  goalType: string | null;
  dailyCalories: number | null;
  weight: number | null;
  goalWeight: number | null;
  isOnboarded: boolean;
  isActive: boolean;
  memberType: MemberType | null;
  orderCount: number;
  mealLogCount: number;
  createdAt: string;
  updatedAt: string;
}

interface MemberDetail {
  id: string;
  lineUserId: string;
  displayName: string | null;
  name: string | null;
  pictureUrl: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthDate: string | null;
  height: number | null;
  weight: number | null;
  goalWeight: number | null;
  goalType: string | null;
  activityLevel: string | null;
  dietType: string | null;
  targetMonths: number | null;
  bmr: number | null;
  tdee: number | null;
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  isOnboarded: boolean;
  memberType: MemberType | null;
  weightLogs: { id: string; weight: number; date: string }[];
  createdAt: string;
  updatedAt: string;
}

interface MealLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl: string | null;
  date: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalPrice: number;
  finalPrice: number | null;
  discount: number;
  itemCount: number;
  items: {
    id: string;
    foodName: string;
    foodImage: string | null;
    quantity: number;
    price: number;
    calories: number | null;
  }[];
  restaurant: { id: string; name: string; logoUrl: string | null } | null;
  createdAt: string;
}

interface Stats {
  total: number;
  activeToday: number;
  newToday: number;
  totalOrders: number;
}

const goalLabels: Record<string, { label: string; color: string }> = {
  lose: { label: "ลดน้ำหนัก", color: "bg-red-100 text-red-700" },
  maintain: { label: "รักษาน้ำหนัก", color: "bg-blue-100 text-blue-700" },
  gain: { label: "เพิ่มน้ำหนัก", color: "bg-green-100 text-green-700" },
  muscle: { label: "เพิ่มกล้ามเนื้อ", color: "bg-purple-100 text-purple-700" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "รอยืนยัน", color: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "ยืนยันแล้ว", color: "bg-blue-100 text-blue-700" },
  paid: { label: "ชำระแล้ว", color: "bg-indigo-100 text-indigo-700" },
  preparing: { label: "กำลังเตรียม", color: "bg-orange-100 text-orange-700" },
  shipped: { label: "จัดส่งแล้ว", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "ส่งถึงแล้ว", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700" },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatTimeAgo(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: th });
  } catch {
    return "";
  }
}

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Detail modal state
  const [activeTab, setActiveTab] = useState<"profile" | "meals" | "orders">("profile");
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, totalSpent: 0 });
  const [mealStats, setMealStats] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    mealCount: 0,
  });
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch members
  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [searchQuery]);

  // Fetch member details
  const fetchMemberDetail = async (memberId: string) => {
    setDetailLoading(true);
    try {
      const [detailRes, mealsRes, ordersRes] = await Promise.all([
        fetch(`/api/members/${memberId}`),
        fetch(`/api/members/${memberId}/meals?limit=20`),
        fetch(`/api/members/${memberId}/orders?limit=20`),
      ]);

      if (detailRes.ok) {
        const detail = await detailRes.json();
        setMemberDetail(detail);
      }

      if (mealsRes.ok) {
        const mealsData = await mealsRes.json();
        setMeals(mealsData.meals);
        setMealStats(mealsData.todayStats);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders);
        setOrderStats(ordersData.stats);
      }
    } catch (error) {
      console.error("Failed to fetch member detail:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openMemberDetail = (member: Member) => {
    setSelectedMember(member);
    setShowDetail(true);
    setActiveTab("profile");
    fetchMemberDetail(member.id);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedMember(null);
    setMemberDetail(null);
    setMeals([]);
    setOrders([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
      </div>
    );
  }

  return (
    <div>
      <Header title="สมาชิก" subtitle="จัดการข้อมูลสมาชิกทั้งหมด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-5 border border-gray-100"
          >
            <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            <p className="text-sm text-gray-500 mt-1">สมาชิกทั้งหมด</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-5 border border-gray-100"
          >
            <p className="text-2xl font-bold text-green-600">{stats?.activeToday || 0}</p>
            <p className="text-sm text-gray-500 mt-1">ใช้งานวันนี้</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-5 border border-gray-100"
          >
            <p className="text-2xl font-bold text-blue-600">{stats?.newToday || 0}</p>
            <p className="text-sm text-gray-500 mt-1">สมาชิกใหม่วันนี้</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-5 border border-gray-100"
          >
            <p className="text-2xl font-bold text-purple-600">{stats?.totalOrders || 0}</p>
            <p className="text-sm text-gray-500 mt-1">ออเดอร์รวม</p>
          </motion.div>
        </div>

        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาสมาชิก (ชื่อ, อีเมล, เบอร์โทร)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Members Table */}
        {members.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <User className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">ไม่พบสมาชิก</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      สมาชิก
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      เป้าหมาย
                    </th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      แคลอรี่/วัน
                    </th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      ออเดอร์
                    </th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      บันทึกอาหาร
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      เข้าใช้ล่าสุด
                    </th>
                    <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                      การจัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map((member, index) => (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {member.pictureUrl ? (
                            <img
                              src={member.pictureUrl}
                              alt={member.displayName || ""}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] flex items-center justify-center text-white font-semibold">
                              {(member.displayName || member.name || "?").charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.displayName || member.name || "ไม่ระบุชื่อ"}
                            </p>
                            <p className="text-xs text-gray-400">
                              เข้าร่วม {format(new Date(member.createdAt), "d MMM yyyy", { locale: th })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {member.goalType && goalLabels[member.goalType] ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${goalLabels[member.goalType].color}`}
                          >
                            {goalLabels[member.goalType].label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center font-medium text-gray-900">
                        {member.dailyCalories?.toLocaleString() || "-"}
                      </td>
                      <td className="py-4 px-6 text-center font-medium text-gray-600">
                        {member.orderCount}
                      </td>
                      <td className="py-4 px-6 text-center font-medium text-gray-600">
                        {member.mealLogCount}
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-500">{formatTimeAgo(member.updatedAt)}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openMemberDetail(member)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-[#4CAF50]"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/backoffice/chat?userId=${member.lineUserId}`}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600"
                            title="ส่งข้อความ"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Member Detail Modal */}
      <AnimatePresence>
        {showDetail && selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {selectedMember.pictureUrl ? (
                    <img
                      src={selectedMember.pictureUrl}
                      alt={selectedMember.displayName || ""}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] flex items-center justify-center text-white text-xl font-semibold">
                      {(selectedMember.displayName || selectedMember.name || "?").charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedMember.displayName || selectedMember.name || "ไม่ระบุชื่อ"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      เข้าร่วม {format(new Date(selectedMember.createdAt), "d MMMM yyyy", { locale: th })}
                    </p>
                    {selectedMember.goalType && goalLabels[selectedMember.goalType] && (
                      <span
                        className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium ${goalLabels[selectedMember.goalType].color}`}
                      >
                        {goalLabels[selectedMember.goalType].label}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeDetail}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-100">
                <div className="flex gap-1 px-6">
                  {[
                    { id: "profile", label: "ข้อมูลทั่วไป", icon: User },
                    { id: "meals", label: "บันทึกอาหาร", icon: Utensils },
                    { id: "orders", label: "ประวัติออเดอร์", icon: ShoppingBag },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? "border-[#4CAF50] text-[#4CAF50]"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
                  </div>
                ) : (
                  <>
                    {/* Profile Tab */}
                    {activeTab === "profile" && memberDetail && (
                      <div className="space-y-6">
                        {/* Goal Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-orange-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-orange-600 mb-1">
                              <Flame className="w-4 h-4" />
                              <span className="text-sm font-medium">แคลอรี่/วัน</span>
                            </div>
                            <p className="text-2xl font-bold text-orange-700">
                              {memberDetail.dailyCalories?.toLocaleString() || "-"}
                            </p>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-blue-600 mb-1">
                              <Scale className="w-4 h-4" />
                              <span className="text-sm font-medium">น้ำหนักปัจจุบัน</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-700">
                              {memberDetail.weight ? `${memberDetail.weight} kg` : "-"}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-green-600 mb-1">
                              <Target className="w-4 h-4" />
                              <span className="text-sm font-medium">น้ำหนักเป้าหมาย</span>
                            </div>
                            <p className="text-2xl font-bold text-green-700">
                              {memberDetail.goalWeight ? `${memberDetail.goalWeight} kg` : "-"}
                            </p>
                          </div>
                          <div className="bg-purple-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-purple-600 mb-1">
                              <Calendar className="w-4 h-4" />
                              <span className="text-sm font-medium">ระยะเวลา</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-700">
                              {memberDetail.targetMonths ? `${memberDetail.targetMonths} เดือน` : "-"}
                            </p>
                          </div>
                        </div>

                        {/* Personal Info */}
                        <div className="bg-gray-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4">ข้อมูลส่วนตัว</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">อีเมล:</span>
                              <span className="ml-2 text-gray-900">{memberDetail.email || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">โทรศัพท์:</span>
                              <span className="ml-2 text-gray-900">{memberDetail.phone || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">เพศ:</span>
                              <span className="ml-2 text-gray-900">
                                {memberDetail.gender === "male" ? "ชาย" : memberDetail.gender === "female" ? "หญิง" : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">ส่วนสูง:</span>
                              <span className="ml-2 text-gray-900">
                                {memberDetail.height ? `${memberDetail.height} cm` : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">กิจกรรม:</span>
                              <span className="ml-2 text-gray-900">{memberDetail.activityLevel || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">รูปแบบอาหาร:</span>
                              <span className="ml-2 text-gray-900">{memberDetail.dietType || "-"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Nutrition Goals */}
                        <div className="bg-gray-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4">เป้าหมายสารอาหาร</h3>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {memberDetail.dailyProtein?.toFixed(0) || "-"}
                              </p>
                              <p className="text-sm text-gray-500">โปรตีน (g)</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {memberDetail.dailyCarbs?.toFixed(0) || "-"}
                              </p>
                              <p className="text-sm text-gray-500">คาร์บ (g)</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {memberDetail.dailyFat?.toFixed(0) || "-"}
                              </p>
                              <p className="text-sm text-gray-500">ไขมัน (g)</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {memberDetail.tdee?.toFixed(0) || "-"}
                              </p>
                              <p className="text-sm text-gray-500">TDEE</p>
                            </div>
                          </div>
                        </div>

                        {/* Weight History */}
                        {memberDetail.weightLogs && memberDetail.weightLogs.length > 0 && (
                          <div className="bg-gray-50 rounded-xl p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">ประวัติน้ำหนัก</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {memberDetail.weightLogs.slice(0, 10).map((log, i) => {
                                const prev = memberDetail.weightLogs[i + 1];
                                const diff = prev ? log.weight - prev.weight : 0;
                                return (
                                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <span className="text-sm text-gray-500">
                                      {format(new Date(log.date), "d MMM yyyy", { locale: th })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{log.weight} kg</span>
                                      {diff !== 0 && (
                                        <span className={`flex items-center text-xs ${diff > 0 ? "text-red-500" : "text-green-500"}`}>
                                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                          {Math.abs(diff).toFixed(1)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meals Tab */}
                    {activeTab === "meals" && (
                      <div className="space-y-6">
                        {/* Today Stats */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="bg-orange-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-orange-700">{mealStats.totalCalories.toFixed(0)}</p>
                            <p className="text-sm text-orange-600">แคลอรี่วันนี้</p>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-700">{mealStats.totalProtein.toFixed(0)}g</p>
                            <p className="text-sm text-blue-600">โปรตีน</p>
                          </div>
                          <div className="bg-yellow-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-yellow-700">{mealStats.totalCarbs.toFixed(0)}g</p>
                            <p className="text-sm text-yellow-600">คาร์บ</p>
                          </div>
                          <div className="bg-pink-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-pink-700">{mealStats.totalFat.toFixed(0)}g</p>
                            <p className="text-sm text-pink-600">ไขมัน</p>
                          </div>
                        </div>

                        {/* Meal List */}
                        {meals.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <Utensils className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                            <p>ยังไม่มีบันทึกอาหาร</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {meals.map((meal) => (
                              <div
                                key={meal.id}
                                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                              >
                                {meal.imageUrl ? (
                                  <img
                                    src={meal.imageUrl}
                                    alt={meal.name}
                                    className="w-16 h-16 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Utensils className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{meal.name}</p>
                                  <p className="text-sm text-gray-500">
                                    {format(new Date(meal.date), "d MMM yyyy HH:mm", { locale: th })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-orange-600">{meal.calories.toFixed(0)} kcal</p>
                                  <p className="text-xs text-gray-400">
                                    P: {meal.protein.toFixed(0)}g | C: {meal.carbs.toFixed(0)}g | F: {meal.fat.toFixed(0)}g
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Orders Tab */}
                    {activeTab === "orders" && (
                      <div className="space-y-6">
                        {/* Order Stats */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-700">{orderStats.totalOrders}</p>
                            <p className="text-sm text-blue-600">ออเดอร์ทั้งหมด</p>
                          </div>
                          <div className="bg-green-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-green-700">{formatCurrency(orderStats.totalSpent)}</p>
                            <p className="text-sm text-green-600">ยอดสั่งซื้อรวม</p>
                          </div>
                        </div>

                        {/* Order List */}
                        {orders.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                            <p>ยังไม่มีประวัติออเดอร์</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {orders.map((order) => (
                              <div key={order.id} className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          statusLabels[order.status]?.color || "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {statusLabels[order.status]?.label || order.status}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {format(new Date(order.createdAt), "d MMM yyyy HH:mm", { locale: th })}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-gray-900">
                                      {formatCurrency(order.finalPrice || order.totalPrice)}
                                    </p>
                                    <p className="text-xs text-gray-500">{order.itemCount} รายการ</p>
                                  </div>
                                </div>
                                {/* Items preview */}
                                <div className="flex flex-wrap gap-2">
                                  {order.items.slice(0, 3).map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg text-sm"
                                    >
                                      {item.foodImage ? (
                                        <img
                                          src={item.foodImage}
                                          alt={item.foodName}
                                          className="w-6 h-6 rounded object-cover"
                                        />
                                      ) : (
                                        <Package className="w-4 h-4 text-gray-400" />
                                      )}
                                      <span className="text-gray-700">
                                        {item.foodName} x{item.quantity}
                                      </span>
                                    </div>
                                  ))}
                                  {order.items.length > 3 && (
                                    <span className="px-2 py-1 bg-white rounded-lg text-sm text-gray-500">
                                      +{order.items.length - 3} รายการ
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
