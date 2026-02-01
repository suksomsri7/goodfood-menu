"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, Eye, Clock, Calendar } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  status: "draft" | "published";
  views: number;
  createdAt: string;
  imageUrl: string;
}

const articles: Article[] = [
  {
    id: "1",
    title: "5 เคล็ดลับการกินอาหารเพื่อสุขภาพที่ดี",
    excerpt: "การรับประทานอาหารที่ดีเป็นพื้นฐานสำคัญของสุขภาพ มาดูกันว่ามีเคล็ดลับอะไรบ้าง...",
    category: "สุขภาพ",
    status: "published",
    views: 1250,
    createdAt: "2026-01-28",
    imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=120&fit=crop",
  },
  {
    id: "2",
    title: "คาร์โบไฮเดรตดี vs คาร์โบไฮเดรตเลว",
    excerpt: "หลายคนเข้าใจผิดว่าคาร์โบไฮเดรตทั้งหมดไม่ดี แต่จริงๆแล้วมีคาร์โบไฮเดรตที่ดีต่อร่างกาย...",
    category: "โภชนาการ",
    status: "published",
    views: 890,
    createdAt: "2026-01-25",
    imageUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=200&h=120&fit=crop",
  },
  {
    id: "3",
    title: "วิธีนับแคลอรี่ที่ถูกต้อง",
    excerpt: "การนับแคลอรี่เป็นเทคนิคที่ช่วยให้คุณควบคุมน้ำหนักได้อย่างมีประสิทธิภาพ...",
    category: "ลดน้ำหนัก",
    status: "draft",
    views: 0,
    createdAt: "2026-01-30",
    imageUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=200&h=120&fit=crop",
  },
  {
    id: "4",
    title: "อาหารที่ควรกินก่อนออกกำลังกาย",
    excerpt: "การเลือกอาหารก่อนออกกำลังกายมีผลต่อประสิทธิภาพในการเผาผลาญ...",
    category: "ออกกำลังกาย",
    status: "published",
    views: 2100,
    createdAt: "2026-01-20",
    imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&h=120&fit=crop",
  },
];

const categoryColors: Record<string, string> = {
  "สุขภาพ": "bg-green-100 text-green-700",
  "โภชนาการ": "bg-blue-100 text-blue-700",
  "ลดน้ำหนัก": "bg-orange-100 text-orange-700",
  "ออกกำลังกาย": "bg-purple-100 text-purple-700",
};

export default function ArticlesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = articles.filter((article) => {
    const matchSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || article.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <Header title="บทความ" subtitle="จัดการบทความและเนื้อหาทั้งหมด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">บทความทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{articles.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เผยแพร่แล้ว</p>
            <p className="text-2xl font-bold text-[#4CAF50] mt-1">
              {articles.filter((a) => a.status === "published").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ยอดวิวรวม</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {articles.reduce((sum, a) => sum + a.views, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาบทความ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={statusFilter || ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="">ทุกสถานะ</option>
            <option value="published">เผยแพร่แล้ว</option>
            <option value="draft">แบบร่าง</option>
          </select>
          <Link
            href="/backoffice/articles/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            เขียนบทความ
          </Link>
        </div>

        {/* Article List */}
        <div className="space-y-4">
          {filtered.map((article) => (
            <div
              key={article.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-32 h-20 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900 line-clamp-1">
                        {article.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                        {article.excerpt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        categoryColors[article.category] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {article.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        article.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {article.status === "published" ? "เผยแพร่" : "แบบร่าง"}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{article.views.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{article.createdAt}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>ไม่พบบทความที่ค้นหา</p>
          </div>
        )}
      </div>
    </div>
  );
}
