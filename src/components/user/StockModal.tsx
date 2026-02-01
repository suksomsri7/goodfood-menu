"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb, Plus, Minus } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string;
}

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem?: (item: StockItem) => void;
}

// Mock stock data
const mockStockItems: StockItem[] = [
  {
    id: "1",
    name: "ข้าวกล่อง สเต็กไก่",
    quantity: 3,
    unit: "กล่อง",
    calories: 450,
    protein: 35,
    carbs: 48,
    fat: 12,
  },
  {
    id: "2",
    name: "สลัดผัก Caesar",
    quantity: 2,
    unit: "กล่อง",
    calories: 180,
    protein: 8,
    carbs: 12,
    fat: 10,
  },
  {
    id: "3",
    name: "ไข่ต้ม",
    quantity: 6,
    unit: "ฟอง",
    calories: 78,
    protein: 6,
    carbs: 1,
    fat: 5,
  },
  {
    id: "4",
    name: "โยเกิร์ตกรีก",
    quantity: 4,
    unit: "ถ้วย",
    calories: 100,
    protein: 17,
    carbs: 6,
    fat: 1,
  },
  {
    id: "5",
    name: "อกไก่ย่าง",
    quantity: 2,
    unit: "ชิ้น",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 4,
  },
  {
    id: "6",
    name: "ข้าวโอ๊ต",
    quantity: 1,
    unit: "ถุง",
    calories: 150,
    protein: 5,
    carbs: 27,
    fat: 3,
  },
];

// Mock recommendation based on remaining calories
const getRecommendation = (items: StockItem[]) => {
  const lowCalItems = items.filter((item) => item.calories < 200);
  const highProteinItems = items.filter((item) => item.protein > 15);

  if (highProteinItems.length > 0) {
    return `แนะนำ: ${highProteinItems[0].name} โปรตีนสูง ${highProteinItems[0].protein}g เหมาะสำหรับมื้อนี้`;
  }
  if (lowCalItems.length > 0) {
    return `แนะนำ: ${lowCalItems[0].name} แคลอรี่ต่ำเพียง ${lowCalItems[0].calories} Kcal`;
  }
  return "เลือกอาหารที่เหมาะกับเป้าหมายของคุณวันนี้";
};

export function StockModal({ isOpen, onClose, onSelectItem }: StockModalProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>(mockStockItems);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [selectQuantity, setSelectQuantity] = useState(1);

  const availableItems = stockItems.filter((item) => item.quantity > 0);
  const recommendation = getRecommendation(availableItems);

  const handleSelectClick = (item: StockItem) => {
    setSelectedItem(item);
    setSelectQuantity(1);
  };

  const handleConfirmSelect = () => {
    if (selectedItem && selectQuantity > 0) {
      // Update stock
      setStockItems((items) =>
        items.map((item) =>
          item.id === selectedItem.id
            ? { ...item, quantity: Math.max(0, item.quantity - selectQuantity) }
            : item
        )
      );
      
      // Add to meal with multiplied nutrition
      onSelectItem?.({
        ...selectedItem,
        calories: selectedItem.calories * selectQuantity,
        protein: selectedItem.protein * selectQuantity,
        carbs: selectedItem.carbs * selectQuantity,
        fat: selectedItem.fat * selectQuantity,
      });
      
      setSelectedItem(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-hidden"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 px-6 pt-4 pb-3 border-b border-gray-100">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Stock อาหาร</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Recommendation */}
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">คำแนะนำ</p>
                <p className="text-sm text-amber-700 mt-1">{recommendation}</p>
              </div>
            </div>
          </div>

          {/* Stock List */}
          <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
            <p className="text-xs text-gray-400 mb-3">
              มี {availableItems.length} รายการใน Stock
            </p>

            <div className="space-y-3">
              {stockItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    item.quantity > 0
                      ? "bg-white border-gray-200 hover:border-gray-300"
                      : "bg-gray-50 border-gray-100 opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.calories} Kcal • P {item.protein}g • C {item.carbs}g • F {item.fat}g
                      </p>
                    </div>

                    {/* Quantity Display */}
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        x{item.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Select Button */}
                  {item.quantity > 0 && (
                    <button
                      onClick={() => handleSelectClick(item)}
                      className="mt-3 w-full py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      เลือกทาน
                    </button>
                  )}
                </div>
              ))}
            </div>

            {availableItems.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-400">ไม่มีอาหารใน Stock</p>
                <p className="text-sm text-gray-300 mt-1">
                  สั่งซื้ออาหารเพิ่มเติมได้ที่เมนู
                </p>
              </div>
            )}
          </div>

          {/* Quantity Selection Modal */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                className="absolute inset-0 bg-black/50 flex items-end justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedItem(null)}
              >
                <motion.div
                  className="w-full bg-white rounded-t-3xl p-6"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
                  
                  <h3 className="text-lg font-semibold text-center mb-2">
                    {selectedItem.name}
                  </h3>
                  <p className="text-sm text-gray-500 text-center mb-6">
                    คงเหลือ x{selectedItem.quantity} {selectedItem.unit}
                  </p>

                  {/* Quantity Selector */}
                  <div className="flex items-center justify-center gap-6 mb-6">
                    <button
                      onClick={() => setSelectQuantity(Math.max(1, selectQuantity - 1))}
                      className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                      disabled={selectQuantity <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    
                    <span className="text-3xl font-semibold text-gray-800 min-w-[60px] text-center">
                      {selectQuantity}
                    </span>
                    
                    <button
                      onClick={() => setSelectQuantity(Math.min(selectedItem.quantity, selectQuantity + 1))}
                      className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                      disabled={selectQuantity >= selectedItem.quantity}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Nutrition Preview */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-2">สารอาหารที่จะได้รับ</p>
                    <p className="text-sm text-gray-700">
                      {selectedItem.calories * selectQuantity} Kcal • 
                      P {selectedItem.protein * selectQuantity}g • 
                      C {selectedItem.carbs * selectQuantity}g • 
                      F {selectedItem.fat * selectQuantity}g
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleConfirmSelect}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium"
                    >
                      ยืนยัน
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
