"use client";

import { Header } from "@/components/backoffice/Header";
import { TipTapEditor } from "@/components/backoffice/TipTapEditor";
import { GenerateCoverModal } from "@/components/backoffice/GenerateCoverModal";
import { useAdmin } from "@/components/backoffice/AdminContext";
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
  Sparkles,
  TrendingUp,
  BookOpen,
  Loader2,
  Upload,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  Utensils,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";

type ArticleStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

interface ArticleCategory {
  id: string;
  name: string;
  slug?: string;
  color: string;
  icon?: string;
  _count?: { articles: number };
}

interface StaffOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface RecipeData {
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  ingredients?: string[];
  instructions?: string[];
  nutrition?: {
    calories?: string;
    proteinContent?: string;
    carbohydrateContent?: string;
    fatContent?: string;
  };
  rating?: { value?: number; count?: number };
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  ogImage?: string;
  categoryId?: string;
  category?: ArticleCategory;
  tags?: string;
  authorId?: string;
  authorStaff?: StaffOption | null;
  isFeatured: boolean;
  status: ArticleStatus;
  publishedAt?: string;
  scheduledFor?: string;
  views: number;
  readTime: number;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  recipeData?: RecipeData | null;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_RECIPE: RecipeData = {
  prepTime: "",
  cookTime: "",
  totalTime: "",
  recipeYield: "",
  recipeCategory: "",
  recipeCuisine: "",
  ingredients: [],
  instructions: [],
  nutrition: {
    calories: "",
    proteinContent: "",
    carbohydrateContent: "",
    fatContent: "",
  },
  rating: { value: undefined, count: undefined },
};

function statusLabel(s: ArticleStatus) {
  return s === "DRAFT"
    ? "แบบร่าง"
    : s === "SCHEDULED"
    ? "ตั้งเวลา"
    : s === "PUBLISHED"
    ? "เผยแพร่"
    : "เก็บถาวร";
}

function statusBadgeClass(s: ArticleStatus) {
  switch (s) {
    case "PUBLISHED":
      return "bg-emerald-100 text-emerald-700";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-700";
    case "ARCHIVED":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function calcSeoScore(opts: {
  title: string;
  metaDescription: string;
  focusKeyword: string;
  content: string;
  coverImage: string | null;
}): { score: number; checks: { label: string; ok: boolean }[] } {
  const checks: { label: string; ok: boolean }[] = [];
  const titleLen = opts.title.length;
  checks.push({ label: `Title ${titleLen} ตัวอักษร (เป้า 50-60)`, ok: titleLen >= 30 && titleLen <= 65 });

  const metaLen = opts.metaDescription.length;
  checks.push({
    label: `Meta description ${metaLen} ตัวอักษร (เป้า 140-160)`,
    ok: metaLen >= 120 && metaLen <= 165,
  });

  const fk = opts.focusKeyword.trim().toLowerCase();
  checks.push({ label: "ระบุ Focus keyword", ok: fk.length > 0 });
  if (fk) {
    checks.push({
      label: "Focus keyword อยู่ใน Title",
      ok: opts.title.toLowerCase().includes(fk),
    });
    checks.push({
      label: "Focus keyword อยู่ใน Meta description",
      ok: opts.metaDescription.toLowerCase().includes(fk),
    });
    const plain = opts.content.replace(/<[^>]+>/g, " ").toLowerCase();
    checks.push({ label: "Focus keyword อยู่ในเนื้อหา", ok: plain.includes(fk) });
  }

  const wordCount = opts.content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  checks.push({ label: `เนื้อหา ${wordCount} คำ (เป้า ≥ 300)`, ok: wordCount >= 300 });

  checks.push({ label: "มีภาพปก (Cover image)", ok: !!opts.coverImage });

  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, checks };
}

export default function ArticlesPage() {
  const { admin } = useAdmin();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [seoOpen, setSeoOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    categoryId: "",
    tags: "",
    authorId: "",
    isFeatured: false,
    status: "DRAFT" as ArticleStatus,
    scheduledFor: "",
    readTime: "5",
    metaDescription: "",
    focusKeyword: "",
    canonicalUrl: "",
    isRecipe: false,
    recipe: EMPTY_RECIPE,
  });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [ogPreview, setOgPreview] = useState<string | null>(null);
  const [genCoverOpen, setGenCoverOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const ogInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [articlesRes, categoriesRes, staffRes] = await Promise.all([
          fetch("/api/articles"),
          fetch("/api/article-categories"),
          fetch("/api/staff").catch(() => null),
        ]);

        if (articlesRes.ok) setArticles(await articlesRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
        if (staffRes && staffRes.ok) {
          const list = await staffRes.json();
          setStaffList(
            Array.isArray(list)
              ? list.map((s: any) => ({ id: s.id, name: s.name, avatarUrl: s.avatarUrl }))
              : []
          );
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = articles.filter((article) => {
    const matchSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || article.status === statusFilter;
    const matchCategory = !categoryFilter || article.categoryId === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const featuredArticles = articles.filter((a) => a.isFeatured && a.status === "PUBLISHED");
  const publishedCount = articles.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = articles.filter((a) => a.status === "DRAFT").length;
  const scheduledCount = articles.filter((a) => a.status === "SCHEDULED").length;
  const totalViews = articles.reduce((sum, a) => sum + a.views, 0);

  const seo = useMemo(
    () =>
      calcSeoScore({
        title: formData.title,
        metaDescription: formData.metaDescription || formData.excerpt,
        focusKeyword: formData.focusKeyword,
        content: formData.content,
        coverImage: coverPreview,
      }),
    [formData.title, formData.metaDescription, formData.excerpt, formData.focusKeyword, formData.content, coverPreview]
  );

  const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/article-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories((prev) => [...prev, newCat]);
        setFormData((prev) => ({ ...prev, categoryId: newCat.id }));
        setShowCategoryModal(false);
        setNewCategoryName("");
      }
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  const resetForm = (article?: Article) => {
    setFormData({
      title: article?.title || "",
      excerpt: article?.excerpt || "",
      content: article?.content || "",
      categoryId: article?.categoryId || "",
      tags: article?.tags || "",
      authorId: article?.authorId || article?.authorStaff?.id || "",
      isFeatured: article?.isFeatured || false,
      status: article?.status || "DRAFT",
      scheduledFor: article?.scheduledFor ? article.scheduledFor.slice(0, 16) : "",
      readTime: article?.readTime?.toString() || "5",
      metaDescription: article?.metaDescription || "",
      focusKeyword: article?.focusKeyword || "",
      canonicalUrl: article?.canonicalUrl || "",
      isRecipe: !!article?.recipeData,
      recipe: article?.recipeData
        ? { ...EMPTY_RECIPE, ...article.recipeData }
        : EMPTY_RECIPE,
    });
    setCoverPreview(article?.coverImage || null);
    setOgPreview(article?.ogImage || null);
    setSeoOpen(false);
    setRecipeOpen(!!article?.recipeData);
  };

  const openCreateModal = () => {
    setEditingArticle(null);
    resetForm();
    if (admin?.id) {
      setFormData((prev) => ({ ...prev, authorId: admin.id }));
    }
    setShowModal(true);
  };

  const openEditModal = (article: Article) => {
    setEditingArticle(article);
    resetForm(article);
    setShowModal(true);
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: "cover" | "og"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (slot === "cover") setCoverPreview(result);
        else setOgPreview(result);
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

      const payload: Record<string, unknown> = {
        title: formData.title,
        excerpt: formData.excerpt || null,
        content: formData.content || null,
        categoryId: formData.categoryId || null,
        tags: formData.tags || null,
        authorId: formData.authorId || null,
        isFeatured: formData.isFeatured,
        status: formData.status,
        scheduledFor:
          formData.status === "SCHEDULED" && formData.scheduledFor
            ? new Date(formData.scheduledFor).toISOString()
            : null,
        readTime: parseInt(formData.readTime) || 5,
        metaDescription: formData.metaDescription || null,
        focusKeyword: formData.focusKeyword || null,
        canonicalUrl: formData.canonicalUrl || null,
        recipeData: formData.isRecipe ? formData.recipe : null,
      };

      // Image upload: send only if local data URL (new upload) or explicit clear
      if (coverPreview && coverPreview.startsWith("data:")) {
        payload.imageUrl = coverPreview;
      } else if (coverPreview === null) {
        payload.imageUrl = "";
      }
      if (ogPreview && ogPreview.startsWith("data:")) {
        payload.ogImage = ogPreview;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    const newStatus: ArticleStatus =
      article.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
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

  // Recipe field helpers
  const setRecipe = (patch: Partial<RecipeData>) =>
    setFormData((prev) => ({ ...prev, recipe: { ...prev.recipe, ...patch } }));
  const setNutrition = (patch: Partial<NonNullable<RecipeData["nutrition"]>>) =>
    setFormData((prev) => ({
      ...prev,
      recipe: { ...prev.recipe, nutrition: { ...prev.recipe.nutrition, ...patch } },
    }));

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">ทั้งหมด</p>
                <p className="text-3xl font-bold mt-1">{articles.length}</p>
              </div>
              <BookOpen className="w-6 h-6 opacity-80" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">เผยแพร่</p>
                <p className="text-3xl font-bold mt-1">{publishedCount}</p>
              </div>
              <Globe className="w-6 h-6 opacity-80" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">ตั้งเวลา</p>
                <p className="text-3xl font-bold mt-1">{scheduledCount}</p>
              </div>
              <Calendar className="w-6 h-6 opacity-80" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">แบบร่าง</p>
                <p className="text-3xl font-bold mt-1">{draftCount}</p>
              </div>
              <FileText className="w-6 h-6 opacity-80" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">ยอดวิว</p>
                <p className="text-3xl font-bold mt-1">{totalViews.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 opacity-80" />
            </div>
          </div>
        </div>

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
                    {article.coverImage ? (
                      <img
                        src={article.coverImage}
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
              <option value="PUBLISHED">เผยแพร่</option>
              <option value="SCHEDULED">ตั้งเวลา</option>
              <option value="DRAFT">แบบร่าง</option>
              <option value="ARCHIVED">เก็บถาวร</option>
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
                  article.status !== "PUBLISHED" ? "opacity-80" : ""
                }`}
              >
                <div className="aspect-video relative">
                  {article.coverImage ? (
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openPreview(article)} className="p-2 bg-white rounded-full hover:bg-gray-100">
                      <Eye className="w-4 h-4 text-gray-700" />
                    </button>
                    <button onClick={() => openEditModal(article)} className="p-2 bg-white rounded-full hover:bg-gray-100">
                      <Edit2 className="w-4 h-4 text-gray-700" />
                    </button>
                    <button onClick={() => handleDelete(article)} className="p-2 bg-white rounded-full hover:bg-gray-100">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  <div className="absolute top-2 left-2 flex gap-1">
                    {article.isFeatured && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">⭐ แนะนำ</span>
                    )}
                    {article.recipeData && (
                      <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full flex items-center gap-1">
                        <Utensils className="w-3 h-3" /> สูตร
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadgeClass(article.status)}`}>
                      {statusLabel(article.status)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {article.category && (
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                      style={{ backgroundColor: `${article.category.color}20`, color: article.category.color }}
                    >
                      {article.category.icon} {article.category.name}
                    </span>
                  )}
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{article.title}</h3>
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
                      {article.isFeatured ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
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
                  article.status !== "PUBLISHED" ? "opacity-80" : ""
                }`}
              >
                <div className="flex gap-4">
                  <div className="w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                    {article.coverImage ? (
                      <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {article.category && (
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${article.category.color}20`, color: article.category.color }}
                            >
                              {article.category.icon} {article.category.name}
                            </span>
                          )}
                          {article.isFeatured && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">⭐ แนะนำ</span>
                          )}
                          {article.recipeData && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                              <Utensils className="w-3 h-3" /> สูตร
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadgeClass(article.status)}`}>
                            {statusLabel(article.status)}
                          </span>
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
                          {article.isFeatured ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleToggleStatus(article)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                        >
                          {article.status === "PUBLISHED" ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
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
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                      {article.authorStaff && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {article.authorStaff.name}
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
                        {article.status === "SCHEDULED" && article.scheduledFor
                          ? `ตั้งเวลา: ${new Date(article.scheduledFor).toLocaleDateString("th-TH")}`
                          : new Date(article.createdAt).toLocaleDateString("th-TH")}
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
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-xl font-bold">
                {editingArticle ? "แก้ไขบทความ" : "เขียนบทความใหม่"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Cover image */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ภาพปก (Cover) <span className="text-xs text-gray-400">1200×800</span>
                  </label>
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-[#4CAF50] transition-colors aspect-[3/2]"
                  >
                    {coverPreview ? (
                      <>
                        <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCoverPreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        <Upload className="w-10 h-10 mb-2" />
                        <p className="text-sm">อัปโหลดภาพปก</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, "cover")}
                    className="hidden"
                  />
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-xs text-gray-500">
                      ระบบจะสร้าง OG image (1200×630) ให้อัตโนมัติ
                    </p>
                    <button
                      type="button"
                      onClick={() => setGenCoverOpen(true)}
                      disabled={!formData.title.trim()}
                      title={formData.title.trim() ? "สร้างภาพด้วย AI" : "ใส่ชื่อบทความก่อน"}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      สร้างด้วย AI
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OG image override <span className="text-xs text-gray-400">1200×630 (optional)</span>
                  </label>
                  <div
                    onClick={() => ogInputRef.current?.click()}
                    className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-[#4CAF50] transition-colors aspect-[1.91/1]"
                  >
                    {ogPreview ? (
                      <>
                        <img src={ogPreview} alt="OG" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOgPreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        <Upload className="w-10 h-10 mb-2" />
                        <p className="text-sm">ปล่อยว่างให้ใช้ Cover</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={ogInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, "og")}
                    className="hidden"
                  />
                </div>
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
                <p className="text-xs text-gray-500 mt-1">{formData.title.length} ตัวอักษร (แนะนำ 50-60)</p>
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความสั้น (Excerpt)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">เนื้อหาบทความ</label>
                <TipTapEditor
                  content={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  placeholder="เริ่มเขียนเนื้อหาบทความ..."
                />
              </div>

              {/* Category & Author */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Tag className="w-4 h-4 inline mr-1" />
                    หมวดหมู่
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                    >
                      <option value="">ไม่มีหมวดหมู่</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                      title="เพิ่มหมวดหมู่ใหม่"
                    >
                      <FolderPlus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    ผู้เขียน
                  </label>
                  <select
                    value={formData.authorId}
                    onChange={(e) => setFormData({ ...formData, authorId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  >
                    <option value="">ไม่ระบุผู้เขียน</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แท็ก</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  placeholder="สุขภาพ, โภชนาการ, อาหาร (คั่นด้วย comma)"
                />
              </div>

              {/* Read Time, Status, Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as ArticleStatus })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                  >
                    <option value="DRAFT">แบบร่าง</option>
                    <option value="SCHEDULED">ตั้งเวลา</option>
                    <option value="PUBLISHED">เผยแพร่ทันที</option>
                    <option value="ARCHIVED">เก็บถาวร</option>
                  </select>
                </div>
                {formData.status === "SCHEDULED" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      วันที่/เวลาเผยแพร่
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.scheduledFor}
                      onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                    />
                  </div>
                )}
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

              {/* SEO Panel */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSeoOpen((v) => !v)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-800">SEO Optimization</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        seo.score >= 80
                          ? "bg-emerald-100 text-emerald-700"
                          : seo.score >= 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {seo.score}/100
                    </span>
                  </div>
                  {seoOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {seoOpen && (
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Meta Description
                      </label>
                      <textarea
                        value={formData.metaDescription}
                        onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                        rows={2}
                        maxLength={180}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                        placeholder="คำอธิบายที่จะแสดงบน Google search result (140-160 ตัวอักษร)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.metaDescription.length} / 160 ตัวอักษร
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Focus Keyword</label>
                        <input
                          type="text"
                          value={formData.focusKeyword}
                          onChange={(e) => setFormData({ ...formData, focusKeyword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                          placeholder="คำหลักที่ต้องการให้ติด Google"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Canonical URL (optional)
                        </label>
                        <input
                          type="text"
                          value={formData.canonicalUrl}
                          onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                          placeholder="https://goodfood.in.th/..."
                        />
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-medium text-gray-700 mb-2">ตรวจสอบ SEO:</p>
                      {seo.checks.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {c.ok ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className={c.ok ? "text-gray-700" : "text-gray-500"}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recipe Panel */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setRecipeOpen((v) => !v);
                    if (!recipeOpen) setFormData((prev) => ({ ...prev, isRecipe: true }));
                  }}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Utensils className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-gray-800">บทความสูตรอาหาร (Recipe)</span>
                    {formData.isRecipe && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">เปิดใช้</span>
                    )}
                  </div>
                  {recipeOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {recipeOpen && (
                  <div className="p-4 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isRecipe}
                        onChange={(e) => setFormData({ ...formData, isRecipe: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium">
                        บทความนี้เป็นสูตรอาหาร (เปิดใช้ Recipe rich snippet ใน Google)
                      </span>
                    </label>

                    {formData.isRecipe && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">เวลาเตรียม (PT)</label>
                            <input
                              type="text"
                              value={formData.recipe.prepTime || ""}
                              onChange={(e) => setRecipe({ prepTime: e.target.value })}
                              placeholder="PT15M"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">เวลาปรุง</label>
                            <input
                              type="text"
                              value={formData.recipe.cookTime || ""}
                              onChange={(e) => setRecipe({ cookTime: e.target.value })}
                              placeholder="PT30M"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">เวลารวม</label>
                            <input
                              type="text"
                              value={formData.recipe.totalTime || ""}
                              onChange={(e) => setRecipe({ totalTime: e.target.value })}
                              placeholder="PT45M"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">จำนวนเสิร์ฟ</label>
                            <input
                              type="text"
                              value={formData.recipe.recipeYield || ""}
                              onChange={(e) => setRecipe({ recipeYield: e.target.value })}
                              placeholder="4 ที่"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            วัตถุดิบ (1 บรรทัด/อย่าง)
                          </label>
                          <textarea
                            value={(formData.recipe.ingredients || []).join("\n")}
                            onChange={(e) =>
                              setRecipe({
                                ingredients: e.target.value.split("\n").filter((s) => s.trim()),
                              })
                            }
                            rows={6}
                            placeholder={`เนื้อไก่ 300 กรัม\nกระเทียม 5 กลีบ\nน้ำมันมะกอก 2 ช้อนโต๊ะ`}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            วิธีทำ (1 บรรทัด/ขั้นตอน)
                          </label>
                          <textarea
                            value={(formData.recipe.instructions || []).join("\n")}
                            onChange={(e) =>
                              setRecipe({
                                instructions: e.target.value.split("\n").filter((s) => s.trim()),
                              })
                            }
                            rows={6}
                            placeholder={`หั่นไก่เป็นชิ้นพอดีคำ\nผัดกระเทียมในน้ำมัน...\n...`}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">แคลอรี่</label>
                            <input
                              type="text"
                              value={formData.recipe.nutrition?.calories || ""}
                              onChange={(e) => setNutrition({ calories: e.target.value })}
                              placeholder="350 kcal"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">โปรตีน</label>
                            <input
                              type="text"
                              value={formData.recipe.nutrition?.proteinContent || ""}
                              onChange={(e) => setNutrition({ proteinContent: e.target.value })}
                              placeholder="25 g"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">คาร์บ</label>
                            <input
                              type="text"
                              value={formData.recipe.nutrition?.carbohydrateContent || ""}
                              onChange={(e) => setNutrition({ carbohydrateContent: e.target.value })}
                              placeholder="30 g"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">ไขมัน</label>
                            <input
                              type="text"
                              value={formData.recipe.nutrition?.fatContent || ""}
                              onChange={(e) => setNutrition({ fatContent: e.target.value })}
                              placeholder="12 g"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Rating (1-5)</label>
                            <input
                              type="number"
                              min="0"
                              max="5"
                              step="0.1"
                              value={formData.recipe.rating?.value ?? ""}
                              onChange={(e) =>
                                setRecipe({
                                  rating: {
                                    ...formData.recipe.rating,
                                    value: e.target.value ? parseFloat(e.target.value) : undefined,
                                  },
                                })
                              }
                              placeholder="4.8"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">จำนวนรีวิว</label>
                            <input
                              type="number"
                              min="1"
                              value={formData.recipe.rating?.count ?? ""}
                              onChange={(e) =>
                                setRecipe({
                                  rating: {
                                    ...formData.recipe.rating,
                                    count: e.target.value ? parseInt(e.target.value) : undefined,
                                  },
                                })
                              }
                              placeholder="120"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
      <GenerateCoverModal
        open={genCoverOpen}
        onClose={() => setGenCoverOpen(false)}
        onAccept={(dataUrl) => setCoverPreview(dataUrl)}
        article={{
          title: formData.title,
          excerpt: formData.excerpt || formData.metaDescription || null,
          focusKeyword: formData.focusKeyword || null,
          categorySlug: categories.find((c) => c.id === formData.categoryId)?.slug || null,
        }}
      />

      {showPreview && previewArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">ตัวอย่างบทความ</h2>
              <button onClick={() => setShowPreview(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {previewArticle.coverImage && (
                <div className="aspect-[3/2]">
                  <img
                    src={previewArticle.coverImage}
                    alt={previewArticle.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
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
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadgeClass(previewArticle.status)}`}>
                    {statusLabel(previewArticle.status)}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {previewArticle.readTime} นาที
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {previewArticle.views.toLocaleString()} วิว
                  </span>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-4">{previewArticle.title}</h1>

                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                  {previewArticle.authorStaff && (
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {previewArticle.authorStaff.name}
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

                {previewArticle.content ? (
                  <div className="article-content" dangerouslySetInnerHTML={{ __html: previewArticle.content }} />
                ) : (
                  <p className="text-gray-400 italic">ไม่มีเนื้อหา</p>
                )}

                {previewArticle.tags && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-4 h-4 text-gray-400" />
                      {previewArticle.tags.split(",").map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
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

      {/* Quick Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">เพิ่มหมวดหมู่ใหม่</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="ชื่อหมวดหมู่"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAddCategory();
              }}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName("");
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleQuickAddCategory}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047] disabled:opacity-50"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
