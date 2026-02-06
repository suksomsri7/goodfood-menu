"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Loader2, Package, X, Upload, Percent, DollarSign, GripVertical } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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

interface FoodPackage {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  requiredItems: number;
  discountType: "percent" | "fixed";
  discountValue: number;
  isActive: boolean;
  order: number;
  restaurantId?: string;
  restaurant?: { id: string; name: string };
}

interface Restaurant {
  id: string;
  name: string;
  isActive: boolean;
}

// Sortable row component
function SortableRow({
  pkg,
  formatDiscount,
  handleToggleStatus,
  openEditModal,
  handleDelete,
}: {
  pkg: FoodPackage;
  formatDiscount: (pkg: FoodPackage) => string;
  handleToggleStatus: (id: string, currentStatus: boolean) => void;
  openEditModal: (pkg: FoodPackage) => void;
  handleDelete: (id: string, name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pkg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 ${!pkg.isActive ? "opacity-50" : ""} ${isDragging ? "bg-gray-100" : ""}`}
    >
      <td className="py-3 px-2 w-10">
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
          {pkg.imageUrl ? (
            <img src={pkg.imageUrl} alt={pkg.name} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500">
              <Package className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{pkg.name}</p>
            {pkg.description && (
              <p className="text-xs text-gray-500 truncate max-w-xs">{pkg.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        {pkg.restaurant ? (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
            {pkg.restaurant.name}
          </span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="py-3 px-4 text-center text-sm">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
          ซื้อครบ {pkg.requiredItems} รายการ
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
          {pkg.discountType === "percent" ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
          ลด {formatDiscount(pkg)}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${pkg.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {pkg.isActive ? "เปิด" : "ปิด"}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handleToggleStatus(pkg.id, pkg.isActive)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
            title={pkg.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
          >
            {pkg.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => openEditModal(pkg)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(pkg.id, pkg.name)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<FoodPackage[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<FoodPackage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    requiredItems: "1",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    restaurantId: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // โหลดข้อมูล
  useEffect(() => {
    async function fetchData() {
      try {
        const [packagesRes, restaurantsRes] = await Promise.all([
          fetch("/api/packages"),
          fetch("/api/restaurants?active=true"),
        ]);
        
        if (packagesRes.ok) {
          const data = await packagesRes.json();
          setPackages(data);
        }
        
        if (restaurantsRes.ok) {
          const restaurantsData = await restaurantsRes.json();
          setRestaurants(restaurantsData.filter((r: Restaurant) => r.isActive));
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // กรองข้อมูล
  const filtered = packages.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRestaurant = !selectedRestaurant || p.restaurant?.id === selectedRestaurant;
    return matchSearch && matchRestaurant;
  });

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = packages.findIndex((p) => p.id === active.id);
      const newIndex = packages.findIndex((p) => p.id === over.id);

      const newPackages = arrayMove(packages, oldIndex, newIndex);
      setPackages(newPackages);

      // Update order in backend
      try {
        const items = newPackages.map((p, index) => ({
          id: p.id,
          order: index,
        }));

        await fetch("/api/packages/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
      } catch (err) {
        console.error("Error saving order:", err);
        // Revert on error
        setPackages(packages);
      }
    }
  };

  // จัดการรูปภาพ
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

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // เปิด modal สร้างใหม่
  const openCreateModal = () => {
    setEditingPackage(null);
    setFormData({
      name: "",
      description: "",
      requiredItems: "1",
      discountType: "percent",
      discountValue: "",
      restaurantId: "",
    });
    setImagePreview(null);
    setShowModal(true);
  };

  // เปิด modal แก้ไข
  const openEditModal = (pkg: FoodPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      requiredItems: pkg.requiredItems.toString(),
      discountType: pkg.discountType,
      discountValue: pkg.discountValue.toString(),
      restaurantId: pkg.restaurantId || "",
    });
    setImagePreview(pkg.imageUrl || null);
    setShowModal(true);
  };

  // ปิด modal
  const closeModal = () => {
    setShowModal(false);
    setEditingPackage(null);
  };

  // บันทึก
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingPackage ? `/api/packages/${editingPackage.id}` : "/api/packages";
      const method = editingPackage ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          requiredItems: parseInt(formData.requiredItems) || 1,
          discountType: formData.discountType,
          discountValue: parseFloat(formData.discountValue) || 0,
          imageUrl: imagePreview,
          restaurantId: formData.restaurantId || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save package");

      const savedPackage = await res.json();

      if (editingPackage) {
        setPackages((prev) =>
          prev.map((p) => (p.id === savedPackage.id ? savedPackage : p))
        );
      } else {
        setPackages((prev) => [savedPackage, ...prev]);
      }

      closeModal();
    } catch (err) {
      console.error("Error saving package:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle สถานะ
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setPackages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p))
      );
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  // ลบ
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบแพ็คเกจ "${name}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete package");
      setPackages((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error deleting package:", err);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  // แสดงส่วนลด
  const formatDiscount = (pkg: FoodPackage) => {
    if (pkg.discountType === "percent") {
      return `${pkg.discountValue}%`;
    }
    return `฿${pkg.discountValue.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div>
        <Header title="แพ็คเกจอาหาร" subtitle="จัดการแพ็คเกจส่วนลดทั้งหมด" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="แพ็คเกจอาหาร" subtitle="จัดการแพ็คเกจส่วนลดทั้งหมด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">แพ็คเกจทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{packages.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-[#4CAF50]">
              {packages.filter((p) => p.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ปิดใช้งาน</p>
            <p className="text-2xl font-bold text-gray-400">
              {packages.filter((p) => !p.isActive).length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาแพ็คเกจ..."
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
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            เพิ่มแพ็คเกจ
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {packages.length === 0 ? (
                <div>
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="mb-4">ยังไม่มีแพ็คเกจอาหาร</p>
                  <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    สร้างแพ็คเกจแรก
                  </button>
                </div>
              ) : (
                "ไม่พบแพ็คเกจที่ค้นหา"
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
                    <th className="w-10"></th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">แพ็คเกจ</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">ร้าน</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จำนวนรายการ</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">ส่วนลด</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <SortableContext
                  items={filtered.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((pkg) => (
                      <SortableRow
                        key={pkg.id}
                        pkg={pkg}
                        formatDiscount={formatDiscount}
                        handleToggleStatus={handleToggleStatus}
                        openEditModal={openEditModal}
                        handleDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          💡 ลากและวางเพื่อจัดลำดับแพ็คเกจ
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">
                {editingPackage ? "แก้ไขแพ็คเกจ" : "สร้างแพ็คเกจใหม่"}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ร้านอาหาร */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ร้านอาหาร
                </label>
                <select
                  value={formData.restaurantId}
                  onChange={(e) => setFormData({ ...formData, restaurantId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                >
                  <option value="">ทุกร้าน</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* รูปภาพ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รูปภาพแพ็คเกจ
                </label>
                <div className="relative">
                  {imagePreview ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-video border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-[#4CAF50] hover:bg-green-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">คลิกเพื่ออัพโหลดรูปภาพ</p>
                      <p className="text-xs text-gray-400">PNG, JPG สูงสุด 5MB</p>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อแพ็คเกจ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                  placeholder="เช่น ซื้อ 3 ลด 10%"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                  placeholder="อธิบายเงื่อนไขแพ็คเกจ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนรายการสินค้าที่ต้องซื้อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.requiredItems}
                  onChange={(e) => setFormData({ ...formData, requiredItems: e.target.value })}
                  required
                  min="1"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                  placeholder="เช่น 3"
                />
                <p className="text-xs text-gray-400 mt-1">
                  ลูกค้าต้องซื้อสินค้าครบตามจำนวนนี้ถึงจะได้รับส่วนลด
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทส่วนลด <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: "percent" })}
                    className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors ${
                      formData.discountType === "percent"
                        ? "border-[#4CAF50] bg-green-50 text-[#4CAF50]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Percent className="w-5 h-5" />
                    <span className="font-medium">เปอร์เซ็นต์</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: "fixed" })}
                    className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors ${
                      formData.discountType === "fixed"
                        ? "border-[#4CAF50] bg-green-50 text-[#4CAF50]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    <span className="font-medium">จำนวนเงิน</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.discountType === "percent" ? "ส่วนลด (%)" : "ส่วนลด (บาท)"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    required
                    min="0"
                    max={formData.discountType === "percent" ? "100" : undefined}
                    step="any"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                    placeholder={formData.discountType === "percent" ? "เช่น 10" : "เช่น 50"}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {formData.discountType === "percent" ? "%" : "฿"}
                  </span>
                </div>
              </div>

              {/* Preview */}
              {formData.requiredItems && formData.discountValue && (
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <p className="text-sm text-orange-800 font-medium">
                    📦 ตัวอย่าง: ลูกค้าซื้อสินค้าครบ {formData.requiredItems} รายการ
                    {formData.discountType === "percent" 
                      ? ` จะได้รับส่วนลด ${formData.discountValue}%` 
                      : ` จะได้รับส่วนลด ฿${parseFloat(formData.discountValue || "0").toLocaleString()}`
                    }
                  </p>
                </div>
              )}
            </form>

            <div className="flex gap-3 justify-end p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name || !formData.discountValue}
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
