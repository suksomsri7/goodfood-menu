"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, AlertCircle, Loader2, GripVertical } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
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
  color: string;
}

interface Restaurant {
  id: string;
  name: string;
  isActive: boolean;
}

interface Food {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  price: number;
  discountPrice?: number;
  badge?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isActive: boolean;
  order: number;
  category: Category;
  restaurant?: { id: string; name: string } | null;
}

const badgeLabels: Record<string, { label: string; color: string }> = {
  discount: { label: "ลดราคา", color: "bg-red-100 text-red-700" },
  bestseller: { label: "คนสั่งเยอะ", color: "bg-blue-100 text-blue-700" },
};

// Sortable Row Component
function SortableFoodRow({
  food,
  onToggleStatus,
  onDelete,
  togglingId,
  deletingId,
}: {
  food: Food;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string, name: string) => void;
  togglingId: string | null;
  deletingId: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: food.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "#f0fdf4" : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 group ${!food.isActive ? "opacity-50" : ""}`}
    >
      <td className="py-3 px-2">
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
          {food.imageUrl ? (
            <img
              src={food.imageUrl}
              alt={food.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
              No img
            </div>
          )}
          <div>
            <span className="font-medium text-gray-900">{food.name}</span>
            {food.badge && badgeLabels[food.badge] && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${badgeLabels[food.badge].color}`}>
                {badgeLabels[food.badge].label}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        {food.restaurant ? (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
            {food.restaurant.name}
          </span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${food.category.color}20`,
            color: food.category.color,
          }}
        >
          {food.category.name}
        </span>
      </td>
      <td className="py-3 px-4 text-center text-sm">{food.calories}</td>
      <td className="py-3 px-4 text-center text-sm text-gray-500">{food.protein}g</td>
      <td className="py-3 px-4 text-center text-sm text-gray-500">{food.carbs}g</td>
      <td className="py-3 px-4 text-center text-sm text-gray-500">{food.fat}g</td>
      <td className="py-3 px-4 text-right">
        {food.discountPrice ? (
          <div>
            <span className="text-gray-400 line-through text-sm">฿{food.price}</span>
            <span className="font-medium text-red-600 ml-1">฿{food.discountPrice}</span>
          </div>
        ) : (
          <span className="font-medium">฿{food.price}</span>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${food.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {food.isActive ? "เปิด" : "ปิด"}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onToggleStatus(food.id, food.isActive)}
            disabled={togglingId === food.id}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 disabled:opacity-50"
            title={food.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
          >
            {togglingId === food.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : food.isActive ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          <Link
            href={`/backoffice/foods/${food.id}/edit`}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]"
          >
            <Edit2 className="w-4 h-4" />
          </Link>
          <button
            onClick={() => onDelete(food.id, food.name)}
            disabled={deletingId === food.id}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            {deletingId === food.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function FoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

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

  // โหลดข้อมูลเมนูและหมวดอาหาร
  const fetchData = async () => {
    try {
      const [foodsRes, categoriesRes, restaurantsRes] = await Promise.all([
        fetch("/api/foods"),
        fetch("/api/categories"),
        fetch("/api/restaurants"),
      ]);
      
      if (!foodsRes.ok || !categoriesRes.ok) {
        throw new Error("Failed to fetch data");
      }
      
      const [foodsData, categoriesData] = await Promise.all([
        foodsRes.json(),
        categoriesRes.json(),
      ]);
      
      if (restaurantsRes.ok) {
        const restaurantsData = await restaurantsRes.json();
        setRestaurants(restaurantsData);
      }
      
      // Sort by order field
      const sortedFoods = foodsData.sort((a: Food, b: Food) => (a.order || 0) - (b.order || 0));
      setFoods(sortedFoods);
      setCategories(categoriesData);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // กรองข้อมูล
  const filtered = foods.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = !selectedCategory || f.category.id === selectedCategory;
    const matchRestaurant = !selectedRestaurant || f.restaurant?.id === selectedRestaurant;
    return matchSearch && matchCat && matchRestaurant;
  });

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = foods.findIndex((f) => f.id === active.id);
      const newIndex = foods.findIndex((f) => f.id === over.id);

      const newFoods = arrayMove(foods, oldIndex, newIndex);
      setFoods(newFoods);

      // Save new order to API
      setIsSavingOrder(true);
      try {
        const orderData = newFoods.map((f, index) => ({
          id: f.id,
          order: index,
        }));

        await fetch("/api/foods/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: orderData }),
        });
      } catch (error) {
        console.error("Error saving order:", error);
        // Revert on error
        fetchData();
      } finally {
        setIsSavingOrder(false);
      }
    }
  };

  // Toggle สถานะ
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/foods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      
      if (!res.ok) throw new Error("Failed to update status");
      
      setFoods((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isActive: !currentStatus } : f))
      );
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    } finally {
      setTogglingId(null);
    }
  };

  // ลบเมนู
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบเมนู "${name}" หรือไม่?`)) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/foods/${id}`, { method: "DELETE" });
      
      if (!res.ok) throw new Error("Failed to delete food");
      
      setFoods((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Error deleting food:", err);
      alert("เกิดข้อผิดพลาดในการลบเมนู");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="เมนูอาหาร" subtitle="จัดการเมนูอาหารทั้งหมด" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header title="เมนูอาหาร" subtitle="จัดการเมนูอาหารทั้งหมด" />
        <div className="p-6">
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="เมนูอาหาร" subtitle="จัดการเมนูอาหารทั้งหมด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เมนูทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{foods.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-[#4CAF50]">
              {foods.filter((f) => f.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ปิดใช้งาน</p>
            <p className="text-2xl font-bold text-gray-400">
              {foods.filter((f) => !f.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">หมวดอาหาร</p>
            <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
          </div>
        </div>

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
            value={selectedRestaurant || ""}
            onChange={(e) => setSelectedRestaurant(e.target.value || null)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm min-w-[140px]"
          >
            <option value="">ทุกร้าน</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm min-w-[140px]"
          >
            <option value="">ทุกหมวด</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <Link
            href="/backoffice/foods/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            เพิ่มเมนู
          </Link>
        </div>

        {/* Saving Order Indicator */}
        {isSavingOrder && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            กำลังบันทึกลำดับ...
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {foods.length === 0 ? (
                <div>
                  <p className="mb-4">ยังไม่มีเมนูอาหาร</p>
                  <Link
                    href="/backoffice/foods/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มเมนูแรก
                  </Link>
                </div>
              ) : (
                "ไม่พบเมนูที่ค้นหา"
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
                    <th className="w-10 py-3 px-2"></th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">เมนู</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">ร้าน</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">หมวด</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">แคล</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">P</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">C</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">F</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">ราคา</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <SortableContext
                    items={filtered.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filtered.map((food) => (
                      <SortableFoodRow
                        key={food.id}
                        food={food}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        togglingId={togglingId}
                        deletingId={deletingId}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          💡 ลากแถวเพื่อจัดเรียงลำดับเมนูอาหาร
        </p>
      </div>
    </div>
  );
}
