"use client";

import { Header } from "@/components/backoffice/Header";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  Clock,
  Star,
  StarOff,
  LayoutGrid,
  List,
  FileText,
  Tag,
  User,
  Globe,
  EyeOff,
  X,
  ChevronRight,
  Sparkles,
  TrendingUp,
  BookOpen,
  Loader2,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ArticleCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  _count?: { articles: number };
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  categoryId?: string;
  category?: ArticleCategory;
  tags?: string;
  author?: string;
  isFeatured: boolean;
  status: "draft" | "published" | "scheduled";
  publishedAt?: string;
  views: number;
  readTime: number;
  createdAt: string;
  updatedAt: string;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    categoryId: "",
    tags: "",
    author: "",
    isFeatured: false,
    status: "draft",
    readTime: "5",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    async function fetchData() {
      try {
        const [articlesRes, categoriesRes] = await Promise.all([
          fetch("/api/articles"),
          fetch("/api/article-categories"),
        ]);

        if (articlesRes.ok) {
          setArticles(await articlesRes.json());
        }
        if (categoriesRes.ok) {
          setCategories(await categoriesRes.json());
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter articles
  const filtered = articles.filter((article) => {
    const matchSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || article.status === statusFilter;
    const matchCategory = !categoryFilter || article.categoryId === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const featuredArticles = articles.filter((a) => a.isFeatured && a.status === "published");
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const draftCount = articles.filter((a) => a.status === "draft").length;
  const totalViews = articles.reduce((sum, a) => sum + a.views, 0);

  // Handlers
  const openCreateModal = () => {
    setEditingArticle(null);
    setFormData({
      title: "",
      excerpt: "",
      content: "",
      categoryId: "",
      tags: "",
      author: "",
      isFeatured: false,
      status: "draft",
      readTime: "5",
    });
    setImagePreview(null);
    setShowModal(true);
  };

  const openEditModal = (article: Article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      excerpt: article.excerpt || "",
      content: article.content || "",
      categoryId: article.categoryId || "",
      tags: article.tags || "",
      author: article.author || "",
      isFeatured: article.isFeatured,
      status: article.status,
      readTime: article.readTime.toString(),
    });
    setImagePreview(article.imageUrl || null);
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingArticle ? `/api/articles/${editingArticle.id}` : "/api/articles";
      const method = editingArticle ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          readTime: parseInt(formData.readTime) || 5,
          imageUrl: imagePreview,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const saved = await res.json();
      if (editingArticle) {
        setArticles((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
      } else {
        setArticles((prev) => [saved, ...prev]);
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error saving article:", error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFeatured = async (article: Article) => {
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: !article.isFeatured }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, isFeatured: !a.isFeatured } : a))
      );
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleToggleStatus = async (article: Article) => {
    const newStatus = article.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update");

      const updated = await res.json();
      setArticles((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDelete = async (article: Article) => {
    if (!confirm(`ต้องการลบบทความ "${article.title}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/articles/${article.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  const openPreview = (article: Article) => {
    setPreviewArticle(article);
    setShowPreview(true);
  };

  if (isLoading) {
    return (
      <div>
        <Header title="บทความ" subtitle="จัดการบทความและเนื้อหาทั้งหมด" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title="บทความ" subtitle="จัดการบทความและเนื้อหาทั้งหมด" />

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">บทความทั้งหมด</p>
                <p className="text-3xl font-bold mt-1">{articles.length}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">เผยแพร่แล้ว</p>
                <p className="text-3xl font-bold mt-1">{publishedCount}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">แบบร่าง</p>
                <p className="text-3xl font-bold mt-1">{draftCount}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">ยอดวิวรวม</p>
                <p className="text-3xl font-bold mt-1">{totalViews.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Featured Articles */}
        {featuredArticles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-800">บทความแนะนำ</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredArticles.slice(0, 3).map((article) => (
                <div
                  key={article.id}
                  className="relative group overflow-hidden rounded-2xl bg-white border border-gray-100 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => openPreview(article)}
                >
                  <div className="aspect-video relative">
                    {article.imageUrl ? (
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        แนะนำ
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-semibold text-white line-clamp-2">{article.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-white/80 text-xs">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {article.views.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {article.readTime} นาที
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters & Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาบทความ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20"
            >
              <option value="">ทุกสถานะ</option>
              <option value="published">เผยแพร่แล้ว</option>
              <option value="draft">แบบร่าง</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid" ? "bg-white shadow-sm text-[#4CAF50]" : "text-gray-500"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list" ? "bg-white shadow-sm text-[#4CAF50]" : "text-gray-500"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#4CAF50] text-white rounded-xl text-sm font-medium hover:bg-[#43A047] transition-colors"
            >
              <Plus className="w-4 h-4" />
              เขียนบทความ
            </button>
          </div>
        </div>

        {/* Articles List/Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500 mb-4">
              {articles.length === 0 ? "ยังไม่มีบทความ" : "ไม่พบบทความที่ค้นหา"}
            </p>
            {articles.length === 0 && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                เขียนบทความแรก
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((article) => (
              <div
                key={article.id}
                className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group ${
                  article.status === "draft" ? "opacity-70" : ""
                }`}
              >
                <div className="aspect-video relative">
                  {article.imageUrl ? (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => openPreview(article)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                    >
                      <Eye className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      onClick={() => openEditModal(article)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                    >
                      <Edit2 className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      onClick={() => handleDelete(article)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  {/* Status Badge */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {article.isFeatured && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                        ⭐ แนะนำ
                      </span>
                    )}
                    {article.status === "draft" && (
                      <span className="px-2 py-0.5 bg-gray-800 text-white text-xs rounded-full">
                        แบบร่าง
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {article.category && (
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                      style={{
                        backgroundColor: `${article.category.color}20`,
                        color: article.category.color,
                      }}
                    >
                      {article.category.icon} {article.category.name}
                    </span>
                  )}
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{article.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {article.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {article.readTime} นาที
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleFeatured(article)}
                      className={`p-1 rounded ${
                        article.isFeatured ? "text-amber-500" : "text-gray-300 hover:text-amber-500"
                      }`}
                    >
                      {article.isFeatured ? (
                        <Star className="w-4 h-4 fill-current" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((article) => (
              <div
                key={article.id}
                className={`bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow ${
                  article.status === "draft" ? "opacity-70" : ""
                }`}
              >
                <div className="flex gap-4">
                  <div className="w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                    {article.imageUrl ? (
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {article.category && (
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${article.category.color}20`,
                                color: article.category.color,
                              }}
                            >
                              {article.category.icon} {article.category.name}
                            </span>
                          )}
                          {article.isFeatured && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              ⭐ แนะนำ
                            </span>
                          )}
                          {article.status === "draft" && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              แบบร่าง
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 line-clamp-1">{article.title}</h3>
                        {article.excerpt && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{article.excerpt}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleFeatured(article)}
                          className={`p-1.5 rounded hover:bg-gray-100 ${
                            article.isFeatured ? "text-amber-500" : "text-gray-400"
                          }`}
                        >
                          {article.isFeatured ? (
                            <Star className="w-4 h-4 fill-current" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleStatus(article)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                        >
                          {article.status === "published" ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openPreview(article)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(article)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(article)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      {article.author && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {article.author}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {article.views.toLocaleString()} วิว
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {article.readTime} นาที
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(article.createdAt).toLocaleDateString("th-TH")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-xl font-bold">
                {editingArticle ? "แก้ไขบทความ" : "เขียนบทความใหม่"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ภาพปก
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-[#4CAF50] transition-colors"
                >
                  {imagePreview ? (
                    <div className="aspect-video relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePreview(null);
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="aspect-video flex flex-col items-center justify-center text-gray-400">
                      <Upload className="w-10 h-10 mb-2" />
                      <p className="text-sm">คลิกเพื่ออัปโหลดภาพปก</p>
                      <p className="text-xs mt-1">แนะนำ 1200 x 630 px</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หัวข้อบทความ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  placeholder="ใส่หัวข้อบทความที่น่าสนใจ..."
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อความสั้น (Excerpt)
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  placeholder="สรุปสั้นๆ เกี่ยวกับบทความ..."
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เนื้อหาบทความ
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50] font-mono"
                  placeholder="เขียนเนื้อหาบทความ... (รองรับ Markdown)"
                />
              </div>

              {/* Category & Author */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Tag className="w-4 h-4 inline mr-1" />
                    หมวดหมู่
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  >
                    <option value="">ไม่มีหมวดหมู่</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    ผู้เขียน
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                    placeholder="ชื่อผู้เขียน"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  แท็ก
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  placeholder="สุขภาพ, โภชนาการ, อาหาร (คั่นด้วย comma)"
                />
              </div>

              {/* Read Time & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    เวลาอ่าน (นาที)
                  </label>
                  <input
                    type="number"
                    value={formData.readTime}
                    onChange={(e) => setFormData({ ...formData, readTime: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานะ
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  >
                    <option value="draft">แบบร่าง</option>
                    <option value="published">เผยแพร่</option>
                  </select>
                </div>
              </div>

              {/* Featured Toggle */}
              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isFeatured" className="text-sm font-medium text-amber-800">
                  <Star className="w-4 h-4 inline mr-1" />
                  บทความแนะนำ (Featured)
                </label>
              </div>
            </form>

            <div className="flex gap-3 justify-end p-5 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.title}
                className="px-5 py-2.5 bg-[#4CAF50] text-white rounded-xl text-sm font-medium hover:bg-[#43A047] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </span>
                ) : (
                  "บันทึก"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">ตัวอย่างบทความ</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Cover Image */}
              {previewArticle.imageUrl && (
                <div className="aspect-video">
                  <img
                    src={previewArticle.imageUrl}
                    alt={previewArticle.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-6">
                {/* Category & Meta */}
                <div className="flex items-center gap-3 mb-4">
                  {previewArticle.category && (
                    <span
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: `${previewArticle.category.color}20`,
                        color: previewArticle.category.color,
                      }}
                    >
                      {previewArticle.category.icon} {previewArticle.category.name}
                    </span>
                  )}
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {previewArticle.readTime} นาที
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {previewArticle.views.toLocaleString()} วิว
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                  {previewArticle.title}
                </h1>

                {/* Author & Date */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                  {previewArticle.author && (
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {previewArticle.author}
                    </span>
                  )}
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(previewArticle.createdAt).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Content */}
                <div className="prose max-w-none">
                  {previewArticle.content ? (
                    <div className="whitespace-pre-wrap">{previewArticle.content}</div>
                  ) : (
                    <p className="text-gray-400 italic">ไม่มีเนื้อหา</p>
                  )}
                </div>

                {/* Tags */}
                {previewArticle.tags && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-4 h-4 text-gray-400" />
                      {previewArticle.tags.split(",").map((tag, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                        >
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowPreview(false);
                  openEditModal(previewArticle);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Edit2 className="w-4 h-4" />
                แก้ไข
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047]"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
