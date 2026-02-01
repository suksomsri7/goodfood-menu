"use client";

import { Header } from "@/components/backoffice/Header";
import { ArrowLeft, Upload, X, Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  isActive: boolean;
}

interface Food {
  id: string;
  name: string;
  description?: string;
  ingredients?: string[];
  imageUrl?: string;
  images?: string[];
  price: number;
  discountPrice?: number;
  badge?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servingSize?: number;
  servingUnit?: string;
  warning?: string;
  categoryId: string;
}

const badgeOptions = [
  { value: "", label: "ไม่มี" },
  { value: "discount", label: "ลดราคา" },
  { value: "bestseller", label: "คนสั่งเยอะ" },
];

export default function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    description: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sugar: "",
    sodium: "",
    price: "",
    discountPrice: "",
    badge: "",
    servingSize: "",
    servingUnit: "กรัม",
    warning: "",
  });
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // โหลดข้อมูลเมนูและหมวดอาหาร
  useEffect(() => {
    async function fetchData() {
      try {
        const [foodRes, categoriesRes] = await Promise.all([
          fetch(`/api/foods/${id}`),
          fetch("/api/categories"),
        ]);
        
        if (!foodRes.ok) throw new Error("Food not found");
        if (!categoriesRes.ok) throw new Error("Failed to fetch categories");
        
        const [food, categoriesData] = await Promise.all([
          foodRes.json(),
          categoriesRes.json(),
        ]);
        
        // Set form data
        setFormData({
          name: food.name || "",
          categoryId: food.categoryId || "",
          description: food.description || "",
          calories: food.calories?.toString() || "",
          protein: food.protein?.toString() || "",
          carbs: food.carbs?.toString() || "",
          fat: food.fat?.toString() || "",
          fiber: food.fiber?.toString() || "",
          sugar: food.sugar?.toString() || "",
          sodium: food.sodium?.toString() || "",
          price: food.price?.toString() || "",
          discountPrice: food.discountPrice?.toString() || "",
          badge: food.badge || "",
          servingSize: food.servingSize?.toString() || "",
          servingUnit: food.servingUnit || "กรัม",
          warning: food.warning || "",
        });
        
        setImagePreview(food.imageUrl || null);
        setAdditionalImages(food.images || []);
        setIngredients(food.ingredients?.length > 0 ? food.ingredients : [""]);
        setCategories(categoriesData.filter((cat: Category) => cat.isActive));
      } catch (err) {
        console.error("Error loading data:", err);
        setError("ไม่สามารถโหลดข้อมูลเมนูได้");
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchData();
  }, [id]);

  // จัดการส่วนประกอบ
  const addIngredient = () => {
    setIngredients([...ingredients, ""]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = value;
    setIngredients(newIngredients);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const handleAdditionalImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAdditionalImages((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
    if (additionalFileInputRef.current) {
      additionalFileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/foods/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          ingredients: ingredients.filter((i) => i.trim() !== ""),
          imageUrl: imagePreview,
          images: additionalImages,
          price: formData.price,
          discountPrice: formData.discountPrice || null,
          badge: formData.badge || null,
          calories: formData.calories,
          protein: formData.protein,
          carbs: formData.carbs,
          fat: formData.fat,
          fiber: formData.fiber || null,
          sugar: formData.sugar || null,
          sodium: formData.sodium || null,
          servingSize: formData.servingSize || null,
          servingUnit: formData.servingUnit,
          warning: formData.warning || null,
          categoryId: formData.categoryId,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update food");
      }
      
      router.push("/backoffice/foods");
    } catch (err: any) {
      console.error("Error updating food:", err);
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div>
        <Header title="แก้ไขเมนูอาหาร" subtitle="กำลังโหลดข้อมูล..." />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#4CAF50]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="แก้ไขเมนูอาหาร" subtitle={`แก้ไข: ${formData.name}`} />

      <div className="p-6">
        <Link
          href="/backoffice/foods"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">กลับไปหน้าเมนูอาหาร</span>
        </Link>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Image Upload */}
            <div className="lg:col-span-1 space-y-6">
              {/* รูปภาพหลัก */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">รูปภาพหลัก</h3>
                
                <div className="relative">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full aspect-square object-cover rounded-lg"
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
                      className="w-full aspect-square border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-[#4CAF50] hover:bg-green-50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">คลิกเพื่ออัพโหลด</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG สูงสุด 5MB</p>
                      </div>
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

              {/* รูปภาพเพิ่มเติม */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">รูปภาพเพิ่มเติม</h3>
                
                <div className="grid grid-cols-3 gap-2">
                  {additionalImages.map((img, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={img}
                        alt={`Additional ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeAdditionalImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {additionalImages.length < 6 && (
                    <button
                      type="button"
                      onClick={() => additionalFileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-[#4CAF50] hover:bg-green-50 transition-colors"
                    >
                      <Plus className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">เพิ่มรูป</span>
                    </button>
                  )}
                </div>
                
                <input
                  ref={additionalFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAdditionalImageChange}
                  className="hidden"
                />
                
                <p className="text-xs text-gray-400 mt-3">
                  <ImageIcon className="w-3 h-3 inline mr-1" />
                  สามารถเพิ่มได้สูงสุด 6 รูป ({additionalImages.length}/6)
                </p>
              </div>
            </div>

            {/* Right Column - Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">ข้อมูลพื้นฐาน</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่อเมนู <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="เช่น ข้าวผัดกุ้ง"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หมวดหมู่ <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="categoryId"
                      value={formData.categoryId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รายละเอียด
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="อธิบายเมนูอาหาร..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent resize-none"
                    />
                  </div>

                  {/* ส่วนประกอบ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ส่วนประกอบ
                    </label>
                    <div className="space-y-2">
                      {ingredients.map((ingredient, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={ingredient}
                            onChange={(e) => updateIngredient(index, e.target.value)}
                            placeholder={`ส่วนประกอบ ${index + 1}`}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeIngredient(index)}
                            disabled={ingredients.length === 1}
                            className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addIngredient}
                      className="mt-2 flex items-center gap-1 text-sm text-[#4CAF50] hover:text-[#43A047]"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มส่วนประกอบ
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ราคา (บาท) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ราคาลด (บาท)
                      </label>
                      <input
                        type="number"
                        name="discountPrice"
                        value={formData.discountPrice}
                        onChange={handleInputChange}
                        placeholder="ราคาหลังลด"
                        min="0"
                        step="any"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ป้ายกำกับ
                      </label>
                      <select
                        name="badge"
                        value={formData.badge}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      >
                        {badgeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ขนาด/หน่วยบริโภค
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          name="servingSize"
                          value={formData.servingSize}
                          onChange={handleInputChange}
                          placeholder="100"
                          min="0"
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                        />
                        <select
                          name="servingUnit"
                          value={formData.servingUnit}
                          onChange={handleInputChange}
                          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                        >
                          <option value="กรัม">กรัม</option>
                          <option value="มล.">มล.</option>
                          <option value="ชิ้น">ชิ้น</option>
                          <option value="จาน">จาน</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutrition Info */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">ข้อมูลโภชนาการ</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      แคลอรี่ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="calories"
                        value={formData.calories}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        kcal
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      โปรตีน <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="protein"
                        value={formData.protein}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        g
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      คาร์โบไฮเดรต <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="carbs"
                        value={formData.carbs}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        g
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ไขมัน <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="fat"
                        value={formData.fat}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        g
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ไฟเบอร์
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="fiber"
                        value={formData.fiber}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        g
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      น้ำตาล
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="sugar"
                        value={formData.sugar}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        g
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      โซเดียม
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="sodium"
                        value={formData.sodium}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="any"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        mg
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* คำเตือน */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">คำเตือน</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ข้อความคำเตือน
                  </label>
                  <textarea
                    name="warning"
                    value={formData.warning}
                    onChange={handleInputChange}
                    placeholder="เช่น มีส่วนผสมของถั่วลิสง, ผู้แพ้อาหารทะเลควรระวัง, มีส่วนผสมของนม"
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    ระบุคำเตือนเกี่ยวกับสารก่อภูมิแพ้หรือข้อควรระวังสำหรับลูกค้า
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end">
                <Link
                  href="/backoffice/foods"
                  className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    "บันทึกการแก้ไข"
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
