"use client";

import { Header } from "@/components/backoffice/Header";
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, BadgePercent, X, Gift, Percent, ShoppingBag, Calendar, Store, Hash } from "lucide-react";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
}

interface Food {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  restaurantId?: string;
}

interface PromotionItem {
  id: string;
  foodId: string;
  quantity: number;
  food: Food;
}

interface PromotionGift {
  id: string;
  foodId: string;
  quantity: number;
  food: Food;
}

interface Promotion {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: string; // "discount" | "bundle" | "gift" | "threshold"
  discountType?: string; // "percent" | "fixed"
  discountValue?: number;
  minQuantity?: number;
  minAmount?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  restaurantId?: string;
  restaurant?: Restaurant;
  items: PromotionItem[];
  gifts: PromotionGift[];
}

const promotionTypes = [
  { value: "discount", label: "ลดราคา", description: "จับคู่อาหาร แล้วให้ส่วนลด", icon: Percent, color: "text-red-500 bg-red-100" },
  { value: "bundle", label: "ซื้อ X แถม Y", description: "ซื้อสินค้าชิ้นไหน แถมชิ้นไหน", icon: ShoppingBag, color: "text-blue-500 bg-blue-100" },
  { value: "gift", label: "ของแถม", description: "ซื้อสินค้าตามรายการ รับของแถม", icon: Gift, color: "text-purple-500 bg-purple-100" },
  { value: "threshold", label: "ซื้อครบแถม", description: "สินค้าครบ X ชิ้น/บาท แถมอะไร", icon: Hash, color: "text-orange-500 bg-orange-100" },
];

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRestaurant, setFilterRestaurant] = useState("");
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "discount",
    discountType: "percent",
    discountValue: "",
    minQuantity: "1",
    minAmount: "",
    startDate: "",
    endDate: "",
    imageUrl: "",
    restaurantId: "",
  });
  const [selectedItems, setSelectedItems] = useState<{ foodId: string; quantity: number }[]>([]);
  const [selectedGifts, setSelectedGifts] = useState<{ foodId: string; quantity: number }[]>([]);

  // โหลดข้อมูล
  useEffect(() => {
    async function fetchData() {
      try {
        const [promotionsRes, foodsRes, restaurantsRes] = await Promise.all([
          fetch("/api/promotions"),
          fetch("/api/foods"),
          fetch("/api/restaurants"),
        ]);
        
        if (promotionsRes.ok) {
          const promotionsData = await promotionsRes.json();
          setPromotions(promotionsData);
        }
        
        if (foodsRes.ok) {
          const foodsData = await foodsRes.json();
          setFoods(foodsData);
        }

        if (restaurantsRes.ok) {
          const restaurantsData = await restaurantsRes.json();
          setRestaurants(restaurantsData);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError("ไม่สามารถโหลดข้อมูลได้");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // กรองข้อมูล
  const filtered = promotions.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRestaurant = !filterRestaurant || p.restaurantId === filterRestaurant;
    return matchSearch && matchRestaurant;
  });

  // Foods filtered by selected restaurant in form
  const filteredFoods = formData.restaurantId
    ? foods.filter((f) => f.restaurantId === formData.restaurantId)
    : foods;

  // เปิด modal สร้างใหม่
  const openCreateModal = () => {
    setEditingPromotion(null);
    setFormData({
      name: "",
      description: "",
      type: "discount",
      discountType: "percent",
      discountValue: "",
      minQuantity: "1",
      minAmount: "",
      startDate: "",
      endDate: "",
      imageUrl: "",
      restaurantId: "",
    });
    setSelectedItems([]);
    setSelectedGifts([]);
    setShowModal(true);
  };

  // เปิด modal แก้ไข
  const openEditModal = (promo: Promotion) => {
    setEditingPromotion(promo);
    setFormData({
      name: promo.name,
      description: promo.description || "",
      type: promo.type,
      discountType: promo.discountType || "percent",
      discountValue: promo.discountValue?.toString() || "",
      minQuantity: promo.minQuantity?.toString() || "1",
      minAmount: promo.minAmount?.toString() || "",
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : "",
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : "",
      imageUrl: promo.imageUrl || "",
      restaurantId: promo.restaurantId || "",
    });
    setSelectedItems(promo.items.map((item) => ({ foodId: item.foodId, quantity: item.quantity })));
    setSelectedGifts(promo.gifts.map((gift) => ({ foodId: gift.foodId, quantity: gift.quantity })));
    setShowModal(true);
  };

  // ปิด modal
  const closeModal = () => {
    setShowModal(false);
    setEditingPromotion(null);
  };

  // เพิ่มอาหาร
  const addFood = (foodId: string, type: "item" | "gift") => {
    if (type === "item") {
      if (selectedItems.find((f) => f.foodId === foodId)) return;
      setSelectedItems([...selectedItems, { foodId, quantity: 1 }]);
    } else {
      if (selectedGifts.find((f) => f.foodId === foodId)) return;
      setSelectedGifts([...selectedGifts, { foodId, quantity: 1 }]);
    }
  };

  // ลบอาหาร
  const removeFood = (foodId: string, type: "item" | "gift") => {
    if (type === "item") {
      setSelectedItems(selectedItems.filter((f) => f.foodId !== foodId));
    } else {
      setSelectedGifts(selectedGifts.filter((f) => f.foodId !== foodId));
    }
  };

  // อัพเดทจำนวน
  const updateQuantity = (foodId: string, quantity: number, type: "item" | "gift") => {
    if (type === "item") {
      setSelectedItems(
        selectedItems.map((f) => (f.foodId === foodId ? { ...f, quantity } : f))
      );
    } else {
      setSelectedGifts(
        selectedGifts.map((f) => (f.foodId === foodId ? { ...f, quantity } : f))
      );
    }
  };

  // บันทึก
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingPromotion ? `/api/promotions/${editingPromotion.id}` : "/api/promotions";
      const method = editingPromotion ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          discountType: formData.discountType || null,
          discountValue: formData.discountValue ? parseFloat(formData.discountValue) : null,
          minQuantity: formData.minQuantity ? parseInt(formData.minQuantity) : 1,
          minAmount: formData.minAmount ? parseFloat(formData.minAmount) : null,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          imageUrl: formData.imageUrl || null,
          restaurantId: formData.restaurantId || null,
          items: selectedItems,
          gifts: selectedGifts,
        }),
      });

      if (!res.ok) throw new Error("Failed to save promotion");

      const savedPromotion = await res.json();

      if (editingPromotion) {
        setPromotions((prev) =>
          prev.map((p) => (p.id === savedPromotion.id ? savedPromotion : p))
        );
      } else {
        setPromotions((prev) => [savedPromotion, ...prev]);
      }

      closeModal();
    } catch (err) {
      console.error("Error saving promotion:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle สถานะ
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setPromotions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p))
      );
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  // ลบ
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบโปรโมชั่น "${name}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/promotions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete promotion");
      setPromotions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error deleting promotion:", err);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  const getPromoTypeInfo = (type: string) => {
    return promotionTypes.find((t) => t.value === type) || promotionTypes[0];
  };

  if (isLoading) {
    return (
      <div>
        <Header title="โปรโมชั่น" subtitle="จัดการโปรโมชั่นทั้งหมด" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="โปรโมชั่น" subtitle="จัดการโปรโมชั่นทั้งหมด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">โปรโมชั่นทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{promotions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ลดราคา</p>
            <p className="text-2xl font-bold text-red-500">
              {promotions.filter((p) => p.type === "discount").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ซื้อ X แถม Y</p>
            <p className="text-2xl font-bold text-blue-500">
              {promotions.filter((p) => p.type === "bundle").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ของแถม</p>
            <p className="text-2xl font-bold text-purple-500">
              {promotions.filter((p) => p.type === "gift").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">ซื้อครบแถม</p>
            <p className="text-2xl font-bold text-orange-500">
              {promotions.filter((p) => p.type === "threshold").length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาโปรโมชั่น..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterRestaurant}
            onChange={(e) => setFilterRestaurant(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm min-w-[180px]"
          >
            <option value="">ร้านทั้งหมด</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            สร้างโปรโมชั่น
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {promotions.length === 0 ? (
                <div>
                  <BadgePercent className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="mb-4">ยังไม่มีโปรโมชั่น</p>
                  <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    สร้างโปรโมชั่นแรก
                  </button>
                </div>
              ) : (
                "ไม่พบโปรโมชั่นที่ค้นหา"
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">โปรโมชั่น</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">ร้าน</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">เงื่อนไข</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">ระยะเวลา</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((promo) => {
                  const typeInfo = getPromoTypeInfo(promo.type);
                  const TypeIcon = typeInfo.icon;
                  return (
                    <tr key={promo.id} className={`hover:bg-gray-50 ${!promo.isActive ? "opacity-50" : ""}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {promo.imageUrl ? (
                            <img src={promo.imageUrl} alt={promo.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{promo.name}</p>
                            {promo.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">{promo.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {promo.restaurant ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            <Store className="w-3 h-3" />
                            {promo.restaurant.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">ทุกร้าน</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {promo.type === "threshold" ? (
                          <div className="text-xs">
                            {promo.minQuantity && promo.minQuantity > 1 && (
                              <div>ซื้อครบ {promo.minQuantity} ชิ้น</div>
                            )}
                            {promo.minAmount && (
                              <div>ซื้อครบ ฿{promo.minAmount}</div>
                            )}
                            {promo.gifts.length > 0 && (
                              <div className="text-green-600">แถม {promo.gifts.length} รายการ</div>
                            )}
                          </div>
                        ) : promo.discountValue ? (
                          promo.discountType === "percent"
                            ? `ลด ${promo.discountValue}%`
                            : `ลด ฿${promo.discountValue}`
                        ) : promo.gifts.length > 0 ? (
                          <span className="text-green-600">แถม {promo.gifts.length} รายการ</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-500">
                        {promo.startDate || promo.endDate ? (
                          <div>
                            {promo.startDate && <span>{new Date(promo.startDate).toLocaleDateString("th-TH")}</span>}
                            {promo.startDate && promo.endDate && <span> - </span>}
                            {promo.endDate && <span>{new Date(promo.endDate).toLocaleDateString("th-TH")}</span>}
                          </div>
                        ) : (
                          "ไม่จำกัด"
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${promo.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {promo.isActive ? "เปิด" : "ปิด"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleToggleStatus(promo.id, promo.isActive)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                            title={promo.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                          >
                            {promo.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditModal(promo)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#4CAF50]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(promo.id, promo.name)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">
                {editingPromotion ? "แก้ไขโปรโมชั่น" : "สร้างโปรโมชั่นใหม่"}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Restaurant Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Store className="w-4 h-4 inline mr-1" />
                  ร้านอาหาร
                </label>
                <select
                  value={formData.restaurantId}
                  onChange={(e) => {
                    setFormData({ ...formData, restaurantId: e.target.value });
                    // Clear selected items when restaurant changes
                    setSelectedItems([]);
                    setSelectedGifts([]);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">ทุกร้าน (โปรโมชั่นรวม)</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">เลือกร้านเพื่อสร้างโปรโมชั่นเฉพาะร้าน หรือปล่อยว่างสำหรับโปรโมชั่นทุกร้าน</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อโปรโมชั่น <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  placeholder="เช่น ลด 20% เมนูสุขภาพ"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm resize-none"
                  placeholder="อธิบายโปรโมชั่น..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทโปรโมชั่น <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {promotionTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.value })}
                        className={`p-3 border rounded-lg flex items-start gap-3 text-left transition-colors ${
                          formData.type === type.value
                            ? "border-[#4CAF50] bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${type.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium block">{type.label}</span>
                          <span className="text-xs text-gray-500">{type.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ส่วนลด (สำหรับประเภท discount, bundle) */}
              {(formData.type === "discount" || formData.type === "bundle") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ประเภทส่วนลด
                    </label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="percent">เปอร์เซ็นต์ (%)</option>
                      <option value="fixed">จำนวนเงิน (บาท)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.discountType === "percent" ? "ส่วนลด (%)" : "ส่วนลด (บาท)"}
                    </label>
                    <input
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      min="0"
                      max={formData.discountType === "percent" ? "100" : undefined}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* เงื่อนไขขั้นต่ำ (สำหรับประเภท threshold) */}
              {formData.type === "threshold" && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-orange-800">เงื่อนไขการรับโปรโมชั่น</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        จำนวนขั้นต่ำ (ชิ้น)
                      </label>
                      <input
                        type="number"
                        value={formData.minQuantity}
                        onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                        min="1"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                        placeholder="เช่น 3"
                      />
                      <p className="text-xs text-gray-500 mt-1">ซื้อครบกี่ชิ้นถึงจะได้โปรฯ</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ยอดขั้นต่ำ (บาท)
                      </label>
                      <input
                        type="number"
                        value={formData.minAmount}
                        onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                        min="0"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                        placeholder="เช่น 500"
                      />
                      <p className="text-xs text-gray-500 mt-1">หรือซื้อครบกี่บาทถึงจะได้โปรฯ</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ระยะเวลา */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    วันเริ่มต้น
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    วันสิ้นสุด
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* เลือกอาหารในโปรโมชั่น */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.type === "bundle" ? "สินค้าที่ต้องซื้อ" : "เมนูที่ร่วมรายการ"}
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addFood(e.target.value, "item");
                      e.target.value = "";
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">+ เพิ่มเมนูอาหาร</option>
                  {filteredFoods
                    .filter((f) => !selectedItems.find((si) => si.foodId === f.id))
                    .map((food) => (
                      <option key={food.id} value={food.id}>
                        {food.name} - ฿{food.price}
                      </option>
                    ))}
                </select>
              </div>

              {selectedItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">
                          {formData.type === "bundle" ? "สินค้าที่ต้องซื้อ" : "เมนูที่ร่วมรายการ"}
                        </th>
                        <th className="text-center py-2 px-3 font-medium w-24">จำนวน</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedItems.map((item) => {
                        const food = foods.find((f) => f.id === item.foodId);
                        if (!food) return null;
                        return (
                          <tr key={item.foodId}>
                            <td className="py-2 px-3">{food.name}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.foodId, parseInt(e.target.value) || 1, "item")}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-center"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                onClick={() => removeFood(item.foodId, "item")}
                                className="text-red-500 hover:text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ของแถม (สำหรับประเภท gift, bundle, threshold) */}
              {(formData.type === "gift" || formData.type === "bundle" || formData.type === "threshold") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Gift className="w-4 h-4 inline mr-1" />
                      ของแถม / สินค้าที่ได้รับ
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addFood(e.target.value, "gift");
                          e.target.value = "";
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">+ เพิ่มของแถม</option>
                      {filteredFoods
                        .filter((f) => !selectedGifts.find((sg) => sg.foodId === f.id))
                        .map((food) => (
                          <option key={food.id} value={food.id}>
                            {food.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {selectedGifts.length > 0 && (
                    <div className="border border-purple-200 rounded-lg overflow-hidden bg-purple-50">
                      <table className="w-full text-sm">
                        <thead className="bg-purple-100">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium text-purple-700">ของแถม</th>
                            <th className="text-center py-2 px-3 font-medium text-purple-700 w-24">จำนวน</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100">
                          {selectedGifts.map((gift) => {
                            const food = foods.find((f) => f.id === gift.foodId);
                            if (!food) return null;
                            return (
                              <tr key={gift.foodId}>
                                <td className="py-2 px-3">{food.name}</td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min="1"
                                    value={gift.quantity}
                                    onChange={(e) => updateQuantity(gift.foodId, parseInt(e.target.value) || 1, "gift")}
                                    className="w-full px-2 py-1 border border-purple-200 rounded text-center"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <button
                                    type="button"
                                    onClick={() => removeFood(gift.foodId, "gift")}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
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
