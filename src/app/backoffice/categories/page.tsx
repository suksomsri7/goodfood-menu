"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, GripVertical, Check, X, Loader2 } from "lucide-react";
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

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  foodCount: number;
  isActive: boolean;
  order: number;
}

// Sortable Row Component
function SortableRow({
  category,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  category: Category;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
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
    backgroundColor: isDragging ? "#f0fdf4" : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 group">
      <td className="py-3 px-4">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: category.color }}
          >
            {category.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-gray-900">{category.name}</p>
            <p className="text-xs text-gray-500">{category.description || "-"}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <code className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
          {category.slug}
        </code>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm font-medium text-gray-900">{category.foodCount}</span>
        <span className="text-xs text-gray-500 ml-1">เมนู</span>
      </td>
      <td className="py-3 px-4 text-center">
        <button
          onClick={() => onToggleActive(category.id, category.isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            category.isActive ? "bg-[#4CAF50]" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              category.isActive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    slug: "",
    description: "",
    color: "#4CAF50",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // โหลดข้อมูลหมวดอาหาร
  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        // Sort by order field
        const sorted = data.sort((a: Category, b: Category) => a.order - b.order);
        setCategories(sorted);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filtered = searchQuery
    ? categories.filter((cat) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((cat) => cat.id === active.id);
      const newIndex = categories.findIndex((cat) => cat.id === over.id);

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);

      // Save new order to API
      setIsSavingOrder(true);
      try {
        const orderData = newCategories.map((cat, index) => ({
          id: cat.id,
          order: index,
        }));

        await fetch("/api/categories/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: orderData }),
        });
      } catch (error) {
        console.error("Error saving order:", error);
        // Revert on error
        fetchCategories();
      } finally {
        setIsSavingOrder(false);
      }
    }
  };

  // Toggle สถานะ Active
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === id ? { ...cat, isActive: !currentStatus } : cat
          )
        );
      }
    } catch (error) {
      console.error("Error toggling category:", error);
    }
  };

  // ลบหมวดอาหาร
  const handleDelete = async (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    if (category.foodCount > 0) {
      alert(`ไม่สามารถลบหมวดหมู่นี้ได้ เนื่องจากมี ${category.foodCount} เมนูอยู่`);
      return;
    }

    if (!confirm("คุณต้องการลบหมวดหมู่นี้หรือไม่?")) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCategories((prev) => prev.filter((cat) => cat.id !== id));
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // เพิ่มหมวดอาหาร
  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCategory,
          order: categories.length, // Add at the end
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setCategories((prev) => [...prev, { ...created, foodCount: 0 }]);
        setNewCategory({ name: "", slug: "", description: "", color: "#4CAF50" });
        setIsAddModalOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error adding category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // แก้ไขหมวดอาหาร
  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCategory.name,
          slug: editingCategory.slug,
          description: editingCategory.description,
          color: editingCategory.color,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === updated.id ? { ...cat, ...updated } : cat
          )
        );
        setIsEditModalOpen(false);
        setEditingCategory(null);
      } else {
        const error = await res.json();
        alert(error.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error editing category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory({ ...category });
    setIsEditModalOpen(true);
  };

  const colorOptions = [
    "#4CAF50", "#2196F3", "#FF9800", "#E91E63",
    "#673AB7", "#009688", "#FFC107", "#795548",
    "#607D8B", "#F44336", "#3F51B5", "#00BCD4",
  ];

  if (isLoading) {
    return (
      <div>
        <Header title="หมวดอาหาร" subtitle="จัดการหมวดหมู่อาหารทั้งหมด" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="หมวดอาหาร" subtitle="จัดการหมวดหมู่อาหารทั้งหมด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">หมวดหมู่ทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{categories.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-[#4CAF50] mt-1">
              {categories.filter((c) => c.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เมนูอาหารรวม</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {categories.reduce((sum, c) => sum + c.foodCount, 0)}
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
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047]"
          >
            <Plus className="w-4 h-4" />
            เพิ่มหมวดหมู่
          </button>
        </div>

        {/* Saving Order Indicator */}
        {isSavingOrder && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            กำลังบันทึกลำดับ...
          </div>
        )}

        {/* Category List */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="w-10 py-3 px-4"></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">หมวดหมู่</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จำนวนเมนู</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <SortableContext
                  items={filtered.map((cat) => cat.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filtered.map((category) => (
                    <SortableRow
                      key={category.id}
                      category={category}
                      onToggleActive={handleToggleActive}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>{categories.length === 0 ? "ยังไม่มีหมวดหมู่ กดปุ่ม \"เพิ่มหมวดหมู่\" เพื่อเริ่มต้น" : "ไม่พบหมวดหมู่ที่ค้นหา"}</p>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          💡 ลากแถวเพื่อจัดเรียงลำดับหมวดหมู่
        </p>
      </div>

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              เพิ่มหมวดหมู่ใหม่
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อหมวดหมู่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="เช่น อาหารคลีน"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={newCategory.slug}
                  onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                  placeholder="เช่น clean-food"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">ถ้าไม่กรอกจะสร้างจากชื่อหมวดหมู่อัตโนมัติ</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="อธิบายหมวดหมู่สั้นๆ..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สีหมวดหมู่
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${
                        newCategory.color === color ? "scale-110 ring-2 ring-offset-2 ring-gray-400" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {newCategory.color === color && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewCategory({ name: "", slug: "", description: "", color: "#4CAF50" });
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategory.name.trim() || isSubmitting}
                className="flex-1 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                เพิ่มหมวดหมู่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {isEditModalOpen && editingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              แก้ไขหมวดหมู่
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อหมวดหมู่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={editingCategory.slug}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={editingCategory.description || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สีหมวดหมู่
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingCategory({ ...editingCategory, color })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${
                        editingCategory.color === color ? "scale-110 ring-2 ring-offset-2 ring-gray-400" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {editingCategory.color === color && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCategory(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleEditCategory}
                disabled={!editingCategory.name.trim() || isSubmitting}
                className="flex-1 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
