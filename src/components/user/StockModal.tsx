"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Package, Sparkles } from "lucide-react";

interface StockItemSource {
  id: string;
  quantity: number;
  orderId: string;
  orderNumber: string;
}

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  orderId: string;
  orderNumber: string;
  // For merged items - track all source items
  sources?: StockItemSource[];
}

interface DailyNutrition {
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  target: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineUserId?: string;
  dailyNutrition?: DailyNutrition;
  onSelectItem?: (item: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    multiplier: number;
  }) => void;
}

export function StockModal({ isOpen, onClose, lineUserId, dailyNutrition, onSelectItem }: StockModalProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [selectQuantity, setSelectQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Fetch completed orders to get stock items
  const fetchStockItems = useCallback(async () => {
    if (!lineUserId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?lineUserId=${lineUserId}&limit=50`);
      if (res.ok) {
        const orders = await res.json();
        
        // Filter completed orders and flatten items
        const completedOrders = orders.filter(
          (o: any) => o.status === "completed"
        );
        
        const rawItems = completedOrders.flatMap((order: any) =>
          order.items.map((item: any) => ({
            id: item.id,
            name: item.foodName,
            quantity: item.quantity,
            calories: item.food?.calories || item.calories || 0,
            protein: item.food?.protein || 0,
            carbs: item.food?.carbs || 0,
            fat: item.food?.fat || 0,
            orderId: order.id,
            orderNumber: order.orderNumber,
          }))
        );
        
        // Merge duplicate items by name
        const mergedMap = new Map<string, StockItem>();
        rawItems.forEach((item: StockItem) => {
          const existing = mergedMap.get(item.name);
          if (existing) {
            existing.quantity += item.quantity;
            existing.sources = existing.sources || [];
            existing.sources.push({
              id: item.id,
              quantity: item.quantity,
              orderId: item.orderId,
              orderNumber: item.orderNumber,
            });
          } else {
            mergedMap.set(item.name, {
              ...item,
              sources: [{
                id: item.id,
                quantity: item.quantity,
                orderId: item.orderId,
                orderNumber: item.orderNumber,
              }],
            });
          }
        });
        
        setStockItems(Array.from(mergedMap.values()));
      }
    } catch (error) {
      console.error("Failed to fetch stock items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [lineUserId]);

  // Fetch when modal opens
  useEffect(() => {
    if (isOpen && lineUserId) {
      fetchStockItems();
    }
  }, [isOpen, lineUserId, fetchStockItems]);

  const availableItems = stockItems.filter((item) => item.quantity > 0);

  // Fetch AI recommendation when item is selected
  const fetchAiRecommendation = useCallback(async (item: StockItem, quantity: number) => {
    if (!dailyNutrition) return;
    
    setIsLoadingAi(true);
    setAiRecommendation("");
    
    try {
      const requestBody = {
        selectedFood: {
          name: item.name,
          calories: item.calories * quantity,
          protein: item.protein * quantity,
          carbs: item.carbs * quantity,
          fat: item.fat * quantity,
        },
        dailyNutrition: {
          consumed: dailyNutrition.consumed,
          target: dailyNutrition.target,
          remaining: dailyNutrition.remaining,
        },
      };
      const res = await fetch("/api/stock-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      if (res.ok) {
        const data = await res.json();
        setAiRecommendation(data.recommendation || "");
      }
    } catch (error) {
      console.error("Failed to fetch AI recommendation:", error);
    } finally {
      setIsLoadingAi(false);
    }
  }, [dailyNutrition]);

  const handleSelectClick = (item: StockItem) => {
    setSelectedItem(item);
    setSelectQuantity(1);
    setAiRecommendation("");
    // Fetch AI recommendation
    fetchAiRecommendation(item, 1);
  };
  
  // Update recommendation when quantity changes
  useEffect(() => {
    if (selectedItem && selectQuantity > 0) {
      const debounce = setTimeout(() => {
        fetchAiRecommendation(selectedItem, selectQuantity);
      }, 500);
      return () => clearTimeout(debounce);
    }
  }, [selectQuantity, selectedItem, fetchAiRecommendation]);

  const handleConfirmSelect = async () => {
    if (!selectedItem || selectQuantity <= 0 || !lineUserId) return;

    setIsSaving(true);
    try {
      // Add to meal log
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          name: selectedItem.name,
          calories: selectedItem.calories * selectQuantity,
          protein: selectedItem.protein * selectQuantity,
          carbs: selectedItem.carbs * selectQuantity,
          fat: selectedItem.fat * selectQuantity,
          sodium: 0,
          sugar: 0,
          multiplier: selectQuantity,
          date: new Date().toISOString(),
        }),
      });

      // Reduce quantity from source items (for merged items)
      let remainingToReduce = selectQuantity;
      const sources = selectedItem.sources || [{
        id: selectedItem.id,
        quantity: selectedItem.quantity,
        orderId: selectedItem.orderId,
        orderNumber: selectedItem.orderNumber,
      }];

      for (const source of sources) {
        if (remainingToReduce <= 0) break;
        
        const reduceFromThis = Math.min(source.quantity, remainingToReduce);
        const newQuantity = source.quantity - reduceFromThis;
        
        await fetch(`/api/order-items/${source.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: newQuantity,
          }),
        });
        
        remainingToReduce -= reduceFromThis;
      }

      // Update local state to reflect the change
      const newTotalQuantity = selectedItem.quantity - selectQuantity;
      setStockItems(prevItems => 
        prevItems.map(item => 
          item.name === selectedItem.name 
            ? { ...item, quantity: newTotalQuantity }
            : item
        ).filter(item => item.quantity > 0)
      );

      // Call callback if provided
      onSelectItem?.({
        name: selectedItem.name,
        calories: selectedItem.calories * selectQuantity,
        protein: selectedItem.protein * selectQuantity,
        carbs: selectedItem.carbs * selectQuantity,
        fat: selectedItem.fat * selectQuantity,
        multiplier: selectQuantity,
      });

      setSelectedItem(null);
      onClose();
    } catch (error) {
      console.error("Failed to save meal:", error);
    } finally {
      setIsSaving(false);
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


          {/* Stock List */}
          <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">กำลังโหลด...</p>
              </div>
            ) : availableItems.length > 0 ? (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  มี {availableItems.length} รายการใน Stock
                </p>

                <div className="space-y-3">
                  {availableItems.map((item) => (
                    <div
                      key={`${item.orderId}-${item.id}`}
                      className="p-4 rounded-2xl border bg-white border-gray-200 hover:border-gray-300 transition-all"
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
                            ×{item.quantity}
                          </span>
                        </div>
                      </div>

                      {/* Select Button */}
                      <button
                        onClick={() => handleSelectClick(item)}
                        className="mt-3 w-full py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        เลือกทาน
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
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
                    คงเหลือ ×{selectedItem.quantity}
                  </p>

                  {/* Quantity Selector */}
                  <div className="flex items-center justify-center gap-6 mb-6">
                    <button
                      onClick={() => setSelectQuantity(Math.max(1, selectQuantity - 1))}
                      className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                      disabled={selectQuantity <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    
                    <span className="text-3xl font-semibold text-gray-800 min-w-[60px] text-center">
                      {selectQuantity}
                    </span>
                    
                    <button
                      onClick={() => setSelectQuantity(Math.min(selectedItem.quantity, selectQuantity + 1))}
                      className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                      disabled={selectQuantity >= selectedItem.quantity}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Nutrition Preview */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-xs text-gray-500 mb-2">สารอาหารที่จะได้รับ</p>
                    <p className="text-sm text-gray-700">
                      {selectedItem.calories * selectQuantity} Kcal • 
                      P {selectedItem.protein * selectQuantity}g • 
                      C {selectedItem.carbs * selectQuantity}g • 
                      F {selectedItem.fat * selectQuantity}g
                    </p>
                  </div>
                  
                  {/* AI Recommendation */}
                  {dailyNutrition && (
                    <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-100">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-amber-700 mb-1">AI คำแนะนำ</p>
                          {isLoadingAi ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                              <span className="text-sm text-amber-600">กำลังวิเคราะห์...</span>
                            </div>
                          ) : aiRecommendation ? (
                            <p className="text-sm text-amber-800">{aiRecommendation}</p>
                          ) : (
                            <p className="text-sm text-amber-600">ไม่สามารถโหลดคำแนะนำได้</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
                      disabled={isSaving}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium disabled:opacity-50"
                    >
                      {isSaving ? "กำลังบันทึก..." : "ยืนยัน"}
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
