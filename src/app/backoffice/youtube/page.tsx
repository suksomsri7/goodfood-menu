"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, Play, ExternalLink, Clock, Eye, ThumbsUp } from "lucide-react";
import { useState } from "react";

interface Video {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnail: string;
  category: string;
  duration: string;
  views: number;
  likes: number;
  status: "active" | "inactive";
  createdAt: string;
}

const videos: Video[] = [
  {
    id: "1",
    title: "3 สูตรอาหารคลีนทำง่ายๆ ใน 15 นาที",
    description: "มาดูวิธีทำอาหารคลีนง่ายๆ 3 สูตรที่ทำได้ภายใน 15 นาที เหมาะสำหรับคนยุ่ง",
    youtubeId: "dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=320&h=180&fit=crop",
    category: "สูตรอาหาร",
    duration: "12:34",
    views: 15600,
    likes: 890,
    status: "active",
    createdAt: "2026-01-28",
  },
  {
    id: "2",
    title: "เคล็ดลับลดน้ำหนักด้วยอาหาร",
    description: "เคล็ดลับการเลือกอาหารที่ช่วยให้ลดน้ำหนักได้อย่างยั่งยืน",
    youtubeId: "dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=320&h=180&fit=crop",
    category: "ลดน้ำหนัก",
    duration: "18:22",
    views: 28900,
    likes: 2100,
    status: "active",
    createdAt: "2026-01-25",
  },
  {
    id: "3",
    title: "วิธีคำนวณแคลอรี่อย่างถูกต้อง",
    description: "สอนวิธีคำนวณแคลอรี่และโภชนาการอย่างละเอียด",
    youtubeId: "dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=320&h=180&fit=crop",
    category: "โภชนาการ",
    duration: "22:15",
    views: 12300,
    likes: 780,
    status: "active",
    createdAt: "2026-01-20",
  },
  {
    id: "4",
    title: "Meal Prep สำหรับ 1 สัปดาห์",
    description: "วางแผนเตรียมอาหารล่วงหน้าสำหรับ 1 สัปดาห์",
    youtubeId: "dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=320&h=180&fit=crop",
    category: "สูตรอาหาร",
    duration: "25:48",
    views: 8700,
    likes: 520,
    status: "inactive",
    createdAt: "2026-01-15",
  },
];

const categoryColors: Record<string, string> = {
  "สูตรอาหาร": "bg-orange-100 text-orange-700",
  "ลดน้ำหนัก": "bg-pink-100 text-pink-700",
  "โภชนาการ": "bg-blue-100 text-blue-700",
  "ออกกำลังกาย": "bg-purple-100 text-purple-700",
};

export default function YoutubePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");

  const filtered = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.likes, 0);

  return (
    <div>
      <Header title="วีดีโอ" subtitle="จัดการวีดีโอจาก YouTube" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">วีดีโอทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{videos.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-[#4CAF50] mt-1">
              {videos.filter((v) => v.status === "active").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ยอดวิวรวม</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {totalViews.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ยอดไลค์รวม</p>
            <p className="text-2xl font-bold text-red-500 mt-1">
              {totalLikes.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาวีดีโอ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FF0000] text-white rounded-lg text-sm font-medium hover:bg-red-600"
          >
            <Plus className="w-4 h-4" />
            เพิ่มวีดีโอ
          </button>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow group"
            >
              {/* Thumbnail */}
              <div className="relative">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="w-14 h-14 rounded-full bg-[#FF0000] text-white flex items-center justify-center">
                    <Play className="w-6 h-6 ml-1" fill="currentColor" />
                  </button>
                </div>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded">
                  {video.duration}
                </span>
                {video.status === "inactive" && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">
                    ปิดใช้งาน
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-medium text-gray-900 line-clamp-2 min-h-[48px]">
                  {video.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                  {video.description}
                </p>

                <div className="flex items-center gap-3 mt-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      categoryColors[video.category] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {video.category}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{video.views.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{video.likes.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`https://youtube.com/watch?v=${video.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#FF0000]"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>ไม่พบวีดีโอที่ค้นหา</p>
          </div>
        )}
      </div>

      {/* Add Video Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              เพิ่มวีดีโอจาก YouTube
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL
                </label>
                <input
                  type="url"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมวดหมู่
                </label>
                <select className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm">
                  <option>สูตรอาหาร</option>
                  <option>ลดน้ำหนัก</option>
                  <option>โภชนาการ</option>
                  <option>ออกกำลังกาย</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  // TODO: Implement video import
                  setIsAddModalOpen(false);
                  setNewVideoUrl("");
                }}
                className="flex-1 px-4 py-2.5 bg-[#FF0000] text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                เพิ่มวีดีโอ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
