"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Store, Package, Utensils, ToggleLeft, ToggleRight, GripVertical, X, Image as ImageIcon, Crop, Check, RotateCw } from "lucide-react";
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
import Cropper, { Area, Point } from "react-easy-crop";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

// Helper function to create cropped image
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return imageSrc;
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box of the rotated image
  const sin = Math.abs(Math.sin(rotRad));
  const cos = Math.abs(Math.cos(rotRad));
  const newWidth = image.width * cos + image.height * sin;
  const newHeight = image.width * sin + image.height * cos;

  // Set canvas size to fit the rotated crop
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // Draw the image offset by the crop position
  ctx.drawImage(
    image,
    pixelCrop.x - (newWidth - image.width) / 2,
    pixelCrop.y - (newHeight - image.height) / 2,
    image.width,
    image.height,
    0,
    0,
    image.width,
    image.height
  );

  // Reset transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Re-draw just the cropped area
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) return imageSrc;

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return imageSrc;

  // Set temp canvas to new dimensions
  const maxDim = Math.max(newWidth, newHeight);
  tempCanvas.width = maxDim;
  tempCanvas.height = maxDim;

  // Move origin to center
  tempCtx.translate(maxDim / 2, maxDim / 2);
  tempCtx.rotate(rotRad);
  tempCtx.translate(-image.width / 2, -image.height / 2);
  tempCtx.drawImage(image, 0, 0);

  // Calculate the offset for center cropping
  const offsetX = (maxDim - newWidth) / 2;
  const offsetY = (maxDim - newHeight) / 2;

  croppedCtx.drawImage(
    tempCanvas,
    offsetX + pixelCrop.x,
    offsetY + pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return croppedCanvas.toDataURL("image/jpeg", 0.9);
}

// Sortable Card Component
function SortableRestaurantCard({
  restaurant,
  getSellTypeLabel,
  toggleActive,
  openModal,
  handleDelete,
}: {
  restaurant: Restaurant;
  getSellTypeLabel: (type: string) => string;
  toggleActive: (restaurant: Restaurant) => void;
  openModal: (restaurant: Restaurant) => void;
  handleDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: restaurant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
        !restaurant.isActive ? "opacity-60" : ""
      } ${isDragging ? "ring-2 ring-green-400 shadow-lg" : ""}`}
    >
      <div className="flex">
        {/* Drag Handle */}
        <div 
          className="flex items-center justify-center px-3 bg-gray-50 border-r cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Cover */}
        <div className="w-28 h-28 bg-gray-100 flex-shrink-0 relative">
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
  );
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
    sellType: "both",
    deliveryFee: 0,
    deliveryPerMeal: 0,
    minOrder: 0,
  });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = restaurants.findIndex((r) => r.id === active.id);
      const newIndex = restaurants.findIndex((r) => r.id === over.id);

      const newRestaurants = arrayMove(restaurants, oldIndex, newIndex);
      setRestaurants(newRestaurants);

      // Update order in backend
      try {
        const items = newRestaurants.map((r, index) => ({
          id: r.id,
          order: index,
        }));

        await fetch("/api/restaurants/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
      } catch (err) {
        console.error("Error saving order:", err);
        // Revert on error
        setRestaurants(restaurants);
      }
    }
  };

  // Handle image upload - opens cropper
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setShowCropper(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels, rotation);
        setCoverPreview(croppedImage);
        setShowCropper(false);
        setImageToCrop(null);
      } catch (e) {
        console.error("Error cropping image:", e);
      }
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const removeCover = () => {
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
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
        body: JSON.stringify({
          ...formData,
          coverUrl: coverPreview,
        }),
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
        sellType: restaurant.sellType,
        deliveryFee: restaurant.deliveryFee,
        deliveryPerMeal: restaurant.deliveryPerMeal,
        minOrder: restaurant.minOrder,
      });
      setCoverPreview(restaurant.coverUrl || null);
    } else {
      setEditingRestaurant(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        sellType: "both",
        deliveryFee: 0,
        deliveryPerMeal: 0,
        minOrder: 0,
      });
      setCoverPreview(null);
    }
    setShowCropper(false);
    setImageToCrop(null);
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
          <p className="text-gray-500 mt-1">จัดการร้านอาหารในระบบ • ลากเพื่อจัดลำดับ</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          เพิ่มร้านอาหาร
        </button>
      </div>

      {/* Restaurant Cards with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={restaurants.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-4">
            {restaurants.map((restaurant) => (
              <SortableRestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                getSellTypeLabel={getSellTypeLabel}
                toggleActive={toggleActive}
                openModal={openModal}
                handleDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

      {restaurants.length > 1 && (
        <p className="text-xs text-gray-400">
          💡 ลากและวางเพื่อจัดลำดับร้านอาหาร
        </p>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingRestaurant ? "แก้ไขร้านอาหาร" : "เพิ่มร้านอาหาร"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
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

              {/* รูปภาพ Cover */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รูปภาพ Cover
                </label>
                {coverPreview ? (
                  <div className="relative">
                    <img
                      src={coverPreview}
                      alt="Cover Preview"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                        title="เปลี่ยนรูป"
                      >
                        <Crop className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={removeCover}
                        className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                        title="ลบรูป"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-green-500 hover:bg-green-50 transition-colors"
                  >
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-500">คลิกเพื่ออัพโหลด Cover</span>
                    <span className="text-xs text-gray-400">แนะนำขนาด 1200x600 px (2:1)</span>
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
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

      {/* Image Cropper Modal */}
      {showCropper && imageToCrop && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="bg-white rounded-2xl w-full max-w-2xl m-4 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">ปรับขนาดรูปภาพ</h3>
              <button
                type="button"
                onClick={handleCropCancel}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative h-[400px] bg-gray-900">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={2 / 1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-4 space-y-4 bg-gray-50">
              {/* Zoom Control */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-16">ซูม:</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <span className="text-sm text-gray-500 w-12">{zoom.toFixed(1)}x</span>
              </div>

              {/* Rotation Control */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-16">หมุน:</span>
                <input
                  type="range"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                  title="หมุน 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500 w-12">{rotation}°</span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCropCancel}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleCropConfirm}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  ใช้รูปนี้
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
