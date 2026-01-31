"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, MapPin } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const foods = [
  { id: "1", name: "ข้าวผัดกุ้ง", category: "lunch", calories: 450, protein: 25, carbs: 55, fat: 15, price: 120, imageUrl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=80&h=80&fit=crop" },
  { id: "2", name: "สลัดอกไก่", category: "lunch", calories: 280, protein: 35, carbs: 15, fat: 10, price: 150, imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=80&h=80&fit=crop" },
  { id: "3", name: "โอ๊ตมีลผลไม้", category: "breakfast", calories: 320, protein: 12, carbs: 55, fat: 8, price: 89, imageUrl: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=80&h=80&fit=crop" },
  { id: "4", name: "สมูทตี้เบอร์รี่", category: "beverage", calories: 180, protein: 5, carbs: 35, fat: 2, price: 75, imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=80&h=80&fit=crop" },
  { id: "5", name: "แซลมอนย่าง", category: "dinner", calories: 380, protein: 40, carbs: 5, fat: 22, price: 280, imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=80&h=80&fit=crop" },
];

const categories: Record<string, { label: string; color: string }> = {
  breakfast: { label: "เช้า", color: "bg-orange-100 text-orange-700" },
  lunch: { label: "กลางวัน", color: "bg-yellow-100 text-yellow-700" },
  dinner: { label: "เย็น", color: "bg-indigo-100 text-indigo-700" },
  beverage: { label: "เครื่องดื่ม", color: "bg-blue-100 text-blue-700" },
};

export default function FoodsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = foods.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = !selectedCategory || f.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <Header title="เมนูอาหาร" subtitle="จัดการเมนูอาหารทั้งหมด" />

      <div className="p-6">
        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาเมนู..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="">ทุกหมวด</option>
            {Object.entries(categories).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Link
            href="/backoffice/foods/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            เพิ่มเมนู
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">เมนู</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">หมวด</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">แคล</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">P</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">C</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">F</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">ราคา</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((food) => (
                <tr key={food.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img src={food.imageUrl} alt={food.name} className="w-10 h-10 rounded-lg object-cover" />
                      <span className="font-medium text-gray-900">{food.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${categories[food.category]?.color}`}>
                      {categories[food.category]?.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-sm">{food.calories}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-500">{food.protein}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-500">{food.carbs}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-500">{food.fat}</td>
                  <td className="py-3 px-4 text-right font-medium">฿{food.price}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                        <MapPin className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
