"use client";

import { Header } from "@/components/backoffice/Header";
import {
  ScanBarcode,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Database,
  Globe,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";

interface BarcodeProduct {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  servingSize?: number;
  servingUnit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
  fiber?: number;
  source: string;
  verified: boolean;
  scanCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalProducts: number;
  todayScans: number;
  unverifiedCount: number;
}

const sourceLabels: Record<string, { label: string; icon: any; color: string }> = {
  manual: { label: "Manual", icon: Database, color: "bg-gray-100 text-gray-600" },
  openfoodfacts: { label: "OpenFoodFacts", icon: Globe, color: "bg-blue-100 text-blue-600" },
  ai_analysis: { label: "AI Analysis", icon: Sparkles, color: "bg-purple-100 text-purple-600" },
};

export default function BarcodePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<BarcodeProduct[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, todayScans: 0, unverifiedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [editingProduct, setEditingProduct] = useState<BarcodeProduct | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (sourceFilter) params.append("source", sourceFilter);
      if (verifiedFilter) params.append("verified", verifiedFilter);

      const response = await fetch(`/api/backoffice/barcode-products?${params}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, sourceFilter, verifiedFilter]);

  // Toggle verified status
  const toggleVerified = async (product: BarcodeProduct) => {
    try {
      const response = await fetch(`/api/backoffice/barcode-products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, verified: !product.verified }),
      });

      if (response.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  // Delete product
  const deleteProduct = async (id: string) => {
    if (!confirm("ต้องการลบข้อมูลนี้หรือไม่?")) return;

    try {
      const response = await fetch(`/api/backoffice/barcode-products/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // Save edited product
  const saveProduct = async (product: BarcodeProduct) => {
    try {
      const response = await fetch(`/api/backoffice/barcode-products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      if (response.ok) {
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  return (
    <div>
      <Header title="ข้อมูลจาก Scan Barcode" subtitle="จัดการข้อมูลสินค้าจากการสแกนบาร์โค้ด" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">รายการทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">เพิ่มวันนี้</p>
            <p className="text-2xl font-bold text-[#4CAF50]">{stats.todayScans}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">รอตรวจสอบ</p>
            <p className="text-2xl font-bold text-orange-500">{stats.unverifiedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาบาร์โค้ดหรือชื่อสินค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="">ทุกแหล่งข้อมูล</option>
            <option value="manual">Manual</option>
            <option value="openfoodfacts">OpenFoodFacts</option>
            <option value="ai_analysis">AI Analysis</option>
          </select>

          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="">ทุกสถานะ</option>
            <option value="true">ยืนยันแล้ว</option>
            <option value="false">รอตรวจสอบ</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#43A047]"
          >
            <Plus className="w-4 h-4" />
            เพิ่มข้อมูล
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <ScanBarcode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-2">ยังไม่มีข้อมูลจากการสแกนบาร์โค้ด</p>
            <p className="text-sm text-gray-400">
              ข้อมูลสินค้าที่ได้จากการสแกนบาร์โค้ดจะแสดงที่นี่
            </p>
          </div>
        )}

        {/* Products Table */}
        {!loading && products.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Barcode</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สารอาหาร</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">แหล่งข้อมูล</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Scan</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const sourceInfo = sourceLabels[product.source] || sourceLabels.manual;
                  const SourceIcon = sourceInfo.icon;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ScanBarcode className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                            {product.brand && (
                              <p className="text-xs text-gray-500">{product.brand}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{product.barcode}</code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-600">
                          <span className="font-medium text-orange-600">{product.calories} kcal</span>
                          <span className="mx-1">•</span>
                          P {product.protein}g
                          <span className="mx-1">•</span>
                          C {product.carbs}g
                          <span className="mx-1">•</span>
                          F {product.fat}g
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sourceInfo.color}`}>
                          <SourceIcon className="w-3 h-3" />
                          {sourceInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleVerified(product)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            product.verified
                              ? "bg-green-100 text-green-600"
                              : "bg-orange-100 text-orange-600"
                          }`}
                        >
                          {product.verified ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              ยืนยันแล้ว
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              รอตรวจสอบ
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{product.scanCount}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
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
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={saveProduct}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}

// Edit Product Modal
function EditProductModal({
  product,
  onClose,
  onSave,
}: {
  product: BarcodeProduct;
  onClose: () => void;
  onSave: (product: BarcodeProduct) => void;
}) {
  const [formData, setFormData] = useState(product);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">แก้ไขข้อมูลสินค้า</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Barcode</label>
            <input
              type="text"
              value={formData.barcode}
              disabled
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">ชื่อสินค้า</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">ยี่ห้อ</label>
            <input
              type="text"
              value={formData.brand || ""}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Serving Size</label>
              <input
                type="number"
                value={formData.servingSize || ""}
                onChange={(e) => setFormData({ ...formData, servingSize: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">หน่วย</label>
              <input
                type="text"
                value={formData.servingUnit || "g"}
                onChange={(e) => setFormData({ ...formData, servingUnit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">แคลอรี่ (kcal)</label>
            <input
              type="number"
              value={formData.calories}
              onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">โปรตีน (g)</label>
              <input
                type="number"
                value={formData.protein}
                onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">คาร์บ (g)</label>
              <input
                type="number"
                value={formData.carbs}
                onChange={(e) => setFormData({ ...formData, carbs: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ไขมัน (g)</label>
              <input
                type="number"
                value={formData.fat}
                onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">โซเดียม (mg)</label>
              <input
                type="number"
                value={formData.sodium || ""}
                onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">น้ำตาล (g)</label>
              <input
                type="number"
                value={formData.sugar || ""}
                onChange={(e) => setFormData({ ...formData, sugar: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verified"
              checked={formData.verified}
              onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="verified" className="text-sm text-gray-600">ยืนยันข้อมูลแล้ว</label>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-[#4CAF50] text-white rounded-lg font-medium text-sm hover:bg-[#43A047] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Product Modal
function AddProductModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    brand: "",
    servingSize: 100,
    servingUnit: "g",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sodium: 0,
    sugar: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!formData.barcode || !formData.name) {
      setError("กรุณากรอก Barcode และชื่อสินค้า");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/backoffice/barcode-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">เพิ่มข้อมูลสินค้า</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">Barcode *</label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="8850123456789"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">ชื่อสินค้า *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">ยี่ห้อ</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Serving Size</label>
              <input
                type="number"
                value={formData.servingSize}
                onChange={(e) => setFormData({ ...formData, servingSize: parseFloat(e.target.value) || 100 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">หน่วย</label>
              <input
                type="text"
                value={formData.servingUnit}
                onChange={(e) => setFormData({ ...formData, servingUnit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">แคลอรี่ (kcal)</label>
            <input
              type="number"
              value={formData.calories}
              onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">โปรตีน (g)</label>
              <input
                type="number"
                value={formData.protein}
                onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">คาร์บ (g)</label>
              <input
                type="number"
                value={formData.carbs}
                onChange={(e) => setFormData({ ...formData, carbs: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ไขมัน (g)</label>
              <input
                type="number"
                value={formData.fat}
                onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">โซเดียม (mg)</label>
              <input
                type="number"
                value={formData.sodium}
                onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">น้ำตาล (g)</label>
              <input
                type="number"
                value={formData.sugar}
                onChange={(e) => setFormData({ ...formData, sugar: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-[#4CAF50] text-white rounded-lg font-medium text-sm hover:bg-[#43A047] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            เพิ่ม
          </button>
        </div>
      </div>
    </div>
  );
}
