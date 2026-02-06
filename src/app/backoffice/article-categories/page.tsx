"use client";

import { Header } from "@/components/backoffice/Header";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  GripVertical,
  Tag,
  FileText,
  Eye,
  EyeOff,
  Loader2,
  X,
  Palette,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  order: number;
  isActive: boolean;
  _count?: { articles: number };
}

// Sortable Row Component
function SortableRow({
  category,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: ArticleCategory;
  onEdit: (cat: ArticleCategory) => void;
  onDelete: (cat: ArticleCategory) => void;
  onToggleActive: (cat: ArticleCategory) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 ${!category.isActive ? "opacity-50" : ""}`}
    >
      <td className="py-3 px-4">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            {category.icon || "📁"}
          </div>
          <div>
            <p className="font-medium text-gray-900">{category.name}</p>
            <p className="text-xs text-gray-500">{category.slug}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-gray-600 line-clamp-1">
          {category.description || "-"}
        </p>
      </td>
      <td className="py-3 px-4 text-center">
        <div
          className="w-6 h-6 rounded-full mx-auto border-2 border-white shadow"
          style={{ backgroundColor: category.color }}
        />
      </td>
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm">
          <FileText className="w-3 h-3" />
          {category._count?.articles || 0}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            category.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {category.isActive ? "เปิด" : "ปิด"}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onToggleActive(category)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
            title={category.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
          >
            {category.isActive ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(category)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
            disabled={(category._count?.articles || 0) > 0}
            title={
              (category._count?.articles || 0) > 0
                ? "ไม่สามารถลบได้ เพราะยังมีบทความอยู่"
                : "ลบ"
            }
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Preset colors
const presetColors = [
  "#4CAF50", "#2196F3", "#9C27B0", "#F44336", "#FF9800",
  "#00BCD4", "#E91E63", "#673AB7", "#3F51B5", "#009688",
  "#795548", "#607D8B", "#FF5722", "#CDDC39", "#8BC34A",
];

// Preset icons
const presetIcons = [
  "📚", "💡", "🍎", "🥗", "💪", "🧘", "🏃", "❤️", "🧠", "⭐",
  "🎯", "📖", "✨", "🔥", "🌿", "🥑", "🍳", "🥛", "💊", "🧪",
];

export default function ArticleCategoriesPage() {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ArticleCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#4CAF50",
    icon: "📚",
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load data
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/article-categories");
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter
  const filtered = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      color: "#4CAF50",
      icon: "📚",
    });
    setShowModal(true);
  };

  const openEditModal = (cat: ArticleCategory) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      color: cat.color,
      icon: cat.icon || "📚",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingCategory
        ? `/api/article-categories/${editingCategory.id}`
        : "/api/article-categories";
      const method = editingCategory ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to save");

      const saved = await res.json();
      if (editingCategory) {
        setCategories((prev) =>
          prev.map((c) => (c.id === saved.id ? saved : c))
        );
      } else {
        setCategories((prev) => [...prev, saved]);
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error saving category:", error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (cat: ArticleCategory) => {
    try {
      const res = await fetch(`/api/article-categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
      );
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDelete = async (cat: ArticleCategory) => {
    if ((cat._count?.articles || 0) > 0) {
      alert(`ไม่สามารถลบหมวดหมู่นี้ได้ เพราะยังมีบทความ ${cat._count?.articles} บทความอยู่`);
      return;
    }

    if (!confirm(`ต้องการลบหมวดหมู่ "${cat.name}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/article-categories/${cat.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการลบ";
      console.error("Error:", error);
      alert(message);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);

    const newOrder = arrayMove(categories, oldIndex, newIndex);
    setCategories(newOrder);

    // Update order in backend
    try {
      const updatePromises = newOrder.map((cat, index) =>
        fetch(`/api/article-categories/${cat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: index }),
        })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error updating order:", error);
      fetchCategories(); // Revert on error
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="หมวดบทความ" subtitle="จัดการหมวดหมู่บทความ" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="หมวดบทความ" subtitle="จัดการหมวดหมู่บทความ" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">หมวดหมู่ทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-green-600">
              {categories.filter((c) => c.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">บทความรวม</p>
            <p className="text-2xl font-bold text-blue-600">
              {categories.reduce((sum, c) => sum + (c._count?.articles || 0), 0)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาหมวดหมู่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            เพิ่มหมวดหมู่
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {categories.length === 0 ? (
                <div>
                  <Tag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="mb-4">ยังไม่มีหมวดหมู่</p>
                  <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    สร้างหมวดหมู่แรก
                  </button>
                </div>
              ) : (
                "ไม่พบหมวดหมู่ที่ค้นหา"
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="w-10 py-3 px-4"></th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      หมวดหมู่
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      คำอธิบาย
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      สี
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      บทความ
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      สถานะ
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <SortableContext
                    items={filtered.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filtered.map((category) => (
                      <SortableRow
                        key={category.id}
                        category={category}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">
                {editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Preview */}
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-xl">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                  style={{ backgroundColor: `${formData.color}20`, color: formData.color }}
                >
                  {formData.icon}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อหมวดหมู่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  placeholder="เช่น สุขภาพ, โภชนาการ"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm resize-none"
                  placeholder="อธิบายหมวดหมู่สั้นๆ..."
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ไอคอน
                </label>
                <div className="flex flex-wrap gap-2">
                  {presetIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                        formData.icon === icon
                          ? "bg-[#4CAF50] text-white scale-110"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  สี
                </label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-all border-2 ${
                        formData.color === color
                          ? "border-gray-800 scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                    title="เลือกสีเอง"
                  />
                </div>
              </div>
            </form>

            <div className="flex gap-3 justify-end p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name}
                className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047] disabled:opacity-50"
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
