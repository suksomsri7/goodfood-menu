"use client";

import { useState } from "react";
import { Plus, Search, Filter, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";

// Mock data
const foods = [
  { id: "1", name: "ข้าวผัดกะเพราหมู", category: "อาหารจานเดียว", calories: 450, protein: 25, price: 60, available: true },
  { id: "2", name: "ต้มยำกุ้ง", category: "อาหารจานเดียว", calories: 280, protein: 30, price: 150, available: true },
  { id: "3", name: "ส้มตำไทย", category: "อาหารจานเดียว", calories: 120, protein: 5, price: 50, available: true },
  { id: "4", name: "แกงเขียวหวานไก่", category: "อาหารจานเดียว", calories: 380, protein: 28, price: 70, available: false },
  { id: "5", name: "ผัดไทยกุ้งสด", category: "อาหารจานเดียว", calories: 520, protein: 22, price: 80, available: true },
  { id: "6", name: "ข้าวมันไก่", category: "อาหารจานเดียว", calories: 580, protein: 35, price: 55, available: true },
];

export default function FoodsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFoods = foods.filter((food) =>
    food.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการเมนูอาหาร</h1>
          <p className="text-gray-500">เพิ่ม แก้ไข ลบเมนูอาหารในระบบ</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
          <Plus className="w-5 h-5" />
          เพิ่มเมนูใหม่
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาเมนูอาหาร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-4 h-4" />
          กรอง
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-500">
              <th className="p-4 font-medium">เมนู</th>
              <th className="p-4 font-medium">หมวดหมู่</th>
              <th className="p-4 font-medium">แคลอรี่</th>
              <th className="p-4 font-medium">โปรตีน</th>
              <th className="p-4 font-medium">ราคา</th>
              <th className="p-4 font-medium">สถานะ</th>
              <th className="p-4 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredFoods.map((food) => (
              <tr key={food.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                      🍽️
                    </div>
                    <span className="font-medium text-gray-800">{food.name}</span>
                  </div>
                </td>
                <td className="p-4 text-gray-600">{food.category}</td>
                <td className="p-4 text-gray-600">{food.calories} kcal</td>
                <td className="p-4 text-gray-600">{food.protein}g</td>
                <td className="p-4 font-medium text-gray-800">฿{food.price}</td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      food.available
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {food.available ? "พร้อมขาย" : "หมด"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            แสดง 1-{filteredFoods.length} จาก {foods.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              ก่อนหน้า
            </button>
            <button className="px-3 py-1 bg-primary-500 text-white rounded-lg text-sm">
              1
            </button>
            <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              2
            </button>
            <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
