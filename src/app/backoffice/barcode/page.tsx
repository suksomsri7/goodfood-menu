"use client";

import { Header } from "@/components/backoffice/Header";
import { ScanBarcode, Plus, Search, Edit2, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

export default function BarcodePage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div>
      <Header title="ข้อมูลจาก Scan Barcode" subtitle="จัดการข้อมูลสินค้าจากการสแกนบาร์โค้ด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">รายการทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">สแกนวันนี้</p>
            <p className="text-2xl font-bold text-[#4CAF50]">0</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">รอตรวจสอบ</p>
            <p className="text-2xl font-bold text-orange-500">0</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ดหรือชื่อสินค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047]">
            <Plus className="w-4 h-4" />
            เพิ่มข้อมูล
          </button>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <ScanBarcode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-2">ยังไม่มีข้อมูลจากการสแกนบาร์โค้ด</p>
          <p className="text-sm text-gray-400">
            ข้อมูลสินค้าที่ได้จากการสแกนบาร์โค้ดจะแสดงที่นี่
          </p>
        </div>
      </div>
    </div>
  );
}
