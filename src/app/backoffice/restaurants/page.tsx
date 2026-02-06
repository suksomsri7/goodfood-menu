"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Store, Package, Utensils, ToggleLeft, ToggleRight, GripVertical } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  sellType: string;
  deliveryFee: number;
  deliveryPerMeal: number;
  minOrder: number;
  isActive: boolean;
  order: number;
  _count: {
    foods: number;
    packages: number;
    categories: number;
  };
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    logoUrl: "",
    coverUrl: "",
    sellType: "both",
    deliveryFee: 0,
    deliveryPerMeal: 0,
    minOrder: 0,
  });

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch("/api/restaurants");
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data);
      }
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRestaurant
        ? `/api/restaurants/${editingRestaurant.id}`
        : "/api/restaurants";
      const method = editingRestaurant ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        fetchRestaurants();
        closeModal();
      }
    } catch (error) {
      console.error("Error saving restaurant:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบร้านอาหารนี้?")) return;

    try {
      const res = await fetch(`/api/restaurants/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchRestaurants();
      }
    } catch (error) {
      console.error("Error deleting restaurant:", error);
    }
  };

  const toggleActive = async (restaurant: Restaurant) => {
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...restaurant, isActive: !restaurant.isActive }),
      });
      if (res.ok) {
        fetchRestaurants();
      }
    } catch (error) {
      console.error("Error toggling restaurant:", error);
    }
  };

  const openModal = (restaurant?: Restaurant) => {
    if (restaurant) {
      setEditingRestaurant(restaurant);
      setFormData({
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description || "",
        logoUrl: restaurant.logoUrl || "",
        coverUrl: restaurant.coverUrl || "",
        sellType: restaurant.sellType,
        deliveryFee: restaurant.deliveryFee,
        deliveryPerMeal: restaurant.deliveryPerMeal,
        minOrder: restaurant.minOrder,
      });
    } else {
      setEditingRestaurant(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        logoUrl: "",
        coverUrl: "",
        sellType: "both",
        deliveryFee: 0,
        deliveryPerMeal: 0,
        minOrder: 0,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRestaurant(null);
  };

  const getSellTypeLabel = (type: string) => {
    switch (type) {
      case "package": return "แพ็คเกจ";
      case "per_meal": return "รายมื้อ";
      case "both": return "ทั้งหมด";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ร้านอาหาร</h1>
          <p className="text-gray-500 mt-1">จัดการร้านอาหารในระบบ</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          เพิ่มร้านอาหาร
        </button>
      </div>

      {/* Restaurant Cards */}
      <div className="grid gap-4">
        {restaurants.map((restaurant) => (
          <div
            key={restaurant.id}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
              !restaurant.isActive ? "opacity-60" : ""
            }`}
          >
            <div className="flex">
              {/* Cover/Logo */}
              <div className="w-32 h-32 bg-gray-100 flex-shrink-0 relative">
                {restaurant.coverUrl ? (
                  <img
                    src={restaurant.coverUrl}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Store className="w-10 h-10 text-gray-300" />
                  </div>
                )}
                {restaurant.logoUrl && (
                  <img
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    className="absolute bottom-2 left-2 w-12 h-12 rounded-lg border-2 border-white shadow object-cover"
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{restaurant.name}</h3>
                    <p className="text-sm text-gray-500">{restaurant.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(restaurant)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title={restaurant.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    >
                      {restaurant.isActive ? (
                        <ToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => openModal(restaurant)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(restaurant.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {restaurant.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">{restaurant.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">
                    {getSellTypeLabel(restaurant.sellType)}
                  </span>
                  <span className="flex items-center gap-1 text-gray-600">
                    <Utensils className="w-4 h-4" />
                    {restaurant._count.foods} เมนู
                  </span>
                  <span className="flex items-center gap-1 text-gray-600">
                    <Package className="w-4 h-4" />
                    {restaurant._count.packages} แพ็คเกจ
                  </span>
                  <span className="text-gray-600">
                    ค่าส่ง: ฿{restaurant.deliveryFee}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {restaurants.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ยังไม่มีร้านอาหาร</p>
            <button
              onClick={() => openModal()}
              className="mt-3 text-green-600 hover:underline"
            >
              + เพิ่มร้านอาหารแรก
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingRestaurant ? "แก้ไขร้านอาหาร" : "เพิ่มร้านอาหาร"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อร้าน *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug (URL)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="auto-generated-from-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Logo URL
                  </label>
                  <input
                    type="text"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cover URL
                  </label>
                  <input
                    type="text"
                    value={formData.coverUrl}
                    onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทการขาย
                </label>
                <select
                  value={formData.sellType}
                  onChange={(e) => setFormData({ ...formData, sellType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="both">ทั้งหมด (แพ็คเกจ + รายมื้อ)</option>
                  <option value="package">แพ็คเกจเท่านั้น</option>
                  <option value="per_meal">รายมื้อเท่านั้น</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค่าส่ง (แพ็คเกจ)
                  </label>
                  <input
                    type="number"
                    value={formData.deliveryFee}
                    onChange={(e) => setFormData({ ...formData, deliveryFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค่าส่ง (ต่อมื้อ)
                  </label>
                  <input
                    type="number"
                    value={formData.deliveryPerMeal}
                    onChange={(e) => setFormData({ ...formData, deliveryPerMeal: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สั่งขั้นต่ำ
                  </label>
                  <input
                    type="number"
                    value={formData.minOrder}
                    onChange={(e) => setFormData({ ...formData, minOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  {editingRestaurant ? "บันทึก" : "เพิ่ม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
