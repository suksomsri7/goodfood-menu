"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiff } from "@/components/providers/LiffProvider";
import {
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  Package,
  XCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type OrderStatus = "pending" | "confirmed" | "preparing" | "shipping" | "ready" | "completed" | "cancelled";

interface FoodInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface OrderItem {
  id: string;
  foodName: string;
  quantity: number;
  calories: number;
  price: number;
  food?: FoodInfo;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: "รอดำเนินการ", color: "text-yellow-600", bgColor: "bg-yellow-50", icon: Clock },
  confirmed: { label: "ยืนยันแล้ว", color: "text-blue-600", bgColor: "bg-blue-50", icon: CheckCircle },
  preparing: { label: "รับชำระเงิน", color: "text-purple-600", bgColor: "bg-purple-50", icon: Package },
  shipping: { label: "กำลังจัดส่ง", color: "text-blue-600", bgColor: "bg-blue-50", icon: Truck },
  ready: { label: "พร้อมรับ", color: "text-green-600", bgColor: "bg-green-50", icon: Truck },
  completed: { label: "จัดส่งเรียบร้อย", color: "text-emerald-600", bgColor: "bg-emerald-50", icon: CheckCircle },
  cancelled: { label: "ยกเลิก", color: "text-red-600", bgColor: "bg-red-50", icon: XCircle },
};

const defaultStatusConfig = { label: "ไม่ทราบสถานะ", color: "text-gray-600", bgColor: "bg-gray-50", icon: Clock };

interface ItemSource {
  id: string;
  quantity: number;
  orderId: string;
  orderNumber: string;
}

interface SelectedFoodItem extends OrderItem {
  orderId: string;
  orderNumber: string;
  sources?: ItemSource[];
}

interface DailyNutrition {
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  target: { calories: number; protein: number; carbs: number; fat: number };
  remaining: { calories: number; protein: number; carbs: number; fat: number };
}

interface MemberGoals {
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
}

export default function OrdersPage() {
  const router = useRouter();
  const { profile, isReady, isLoggedIn } = useLiff();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("completed");
  const [selectedItem, setSelectedItem] = useState<SelectedFoodItem | null>(null);
  const [selectQuantity, setSelectQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // AI Recommendation states
  const [aiRecommendation, setAiRecommendation] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition | null>(null);
  const [memberGoals, setMemberGoals] = useState<MemberGoals | null>(null);

  const lineUserId = profile?.userId;

  const fetchOrders = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/orders?lineUserId=${lineUserId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, [lineUserId]);

  // Fetch member goals
  const fetchMemberGoals = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMemberGoals({
          dailyCalories: data.dailyCalories || 2000,
          dailyProtein: data.dailyProtein || 150,
          dailyCarbs: data.dailyCarbs || 250,
          dailyFat: data.dailyFat || 65,
        });
      }
    } catch (error) {
      console.error("Failed to fetch member goals:", error);
    }
  }, [lineUserId]);

  // Fetch today's meals to calculate daily nutrition
  const fetchDailyNutrition = useCallback(async () => {
    if (!lineUserId || !memberGoals) return;

    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const tzOffset = today.getTimezoneOffset();
      
      const res = await fetch(`/api/meals?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`);
      if (res.ok) {
        const meals = await res.json();
        const consumed = meals.reduce(
          (acc: { calories: number; protein: number; carbs: number; fat: number }, meal: { calories: number; protein: number; carbs: number; fat: number }) => ({
            calories: acc.calories + meal.calories,
            protein: acc.protein + meal.protein,
            carbs: acc.carbs + meal.carbs,
            fat: acc.fat + meal.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        setDailyNutrition({
          consumed,
          target: {
            calories: memberGoals.dailyCalories || 2000,
            protein: memberGoals.dailyProtein || 150,
            carbs: memberGoals.dailyCarbs || 250,
            fat: memberGoals.dailyFat || 65,
          },
          remaining: {
            calories: (memberGoals.dailyCalories || 2000) - consumed.calories,
            protein: (memberGoals.dailyProtein || 150) - consumed.protein,
            carbs: (memberGoals.dailyCarbs || 250) - consumed.carbs,
            fat: (memberGoals.dailyFat || 65) - consumed.fat,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch daily nutrition:", error);
    }
  }, [lineUserId, memberGoals]);

  // Fetch AI recommendation
  const fetchAiRecommendation = useCallback(async (item: SelectedFoodItem, quantity: number) => {
    if (!dailyNutrition) return;

    setIsLoadingAi(true);
    setAiRecommendation("");

    try {
      const food = item.food;
      const requestBody = {
        selectedFood: {
          name: item.foodName,
          calories: (food?.calories || item.calories || 0) * quantity,
          protein: (food?.protein || 0) * quantity,
          carbs: (food?.carbs || 0) * quantity,
          fat: (food?.fat || 0) * quantity,
        },
        dailyNutrition,
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

  useEffect(() => {
    document.title = "รายการอาหาร";
  }, []);

  useEffect(() => {
    if (isReady && lineUserId) {
      setIsLoading(true);
      Promise.all([fetchOrders(), fetchMemberGoals()]).finally(() => setIsLoading(false));
    } else if (isReady && !isLoggedIn) {
      setIsLoading(false);
    }
  }, [isReady, lineUserId, isLoggedIn, fetchOrders, fetchMemberGoals]);

  // Fetch daily nutrition when member goals are loaded
  useEffect(() => {
    if (memberGoals && lineUserId) {
      fetchDailyNutrition();
    }
  }, [memberGoals, lineUserId, fetchDailyNutrition]);

  // Update AI recommendation when quantity changes
  useEffect(() => {
    if (selectedItem && selectQuantity > 0 && dailyNutrition) {
      const debounce = setTimeout(() => {
        fetchAiRecommendation(selectedItem, selectQuantity);
      }, 500);
      return () => clearTimeout(debounce);
    }
  }, [selectQuantity, selectedItem, dailyNutrition, fetchAiRecommendation]);

  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  );

  // Calculate unique food count (merged by name)
  const uniqueFoodCount = useMemo(() => {
    const rawItems = completedOrders.flatMap((order) =>
      order.items.filter(item => item.quantity > 0).map((item) => item.foodName)
    );
    const uniqueNames = new Set(rawItems);
    return uniqueNames.size;
  }, [completedOrders]);

  const displayOrders = activeTab === "active" ? activeOrders : completedOrders;

  const handleSelectClick = async (item: SelectedFoodItem) => {
    setSelectedItem(item);
    setSelectQuantity(1);
    setAiRecommendation("");
    
    // If dailyNutrition is not loaded yet, fetch it first
    if (!dailyNutrition && memberGoals && lineUserId) {
      // Fetch daily nutrition first
      try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const tzOffset = today.getTimezoneOffset();
        
        const res = await fetch(`/api/meals?lineUserId=${lineUserId}&date=${dateStr}&tzOffset=${tzOffset}`);
        if (res.ok) {
          const meals = await res.json();
          const consumed = meals.reduce(
            (acc: { calories: number; protein: number; carbs: number; fat: number }, meal: { calories: number; protein: number; carbs: number; fat: number }) => ({
              calories: acc.calories + meal.calories,
              protein: acc.protein + meal.protein,
              carbs: acc.carbs + meal.carbs,
              fat: acc.fat + meal.fat,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          const nutrition = {
            consumed,
            target: {
              calories: memberGoals.dailyCalories || 2000,
              protein: memberGoals.dailyProtein || 150,
              carbs: memberGoals.dailyCarbs || 250,
              fat: memberGoals.dailyFat || 65,
            },
            remaining: {
              calories: (memberGoals.dailyCalories || 2000) - consumed.calories,
              protein: (memberGoals.dailyProtein || 150) - consumed.protein,
              carbs: (memberGoals.dailyCarbs || 250) - consumed.carbs,
              fat: (memberGoals.dailyFat || 65) - consumed.fat,
            },
          };
          
          setDailyNutrition(nutrition);
          
          // Now fetch AI recommendation with the fresh data
          setIsLoadingAi(true);
          const food = item.food;
          const aiRes = await fetch("/api/stock-recommendation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedFood: {
                name: item.foodName,
                calories: (food?.calories || item.calories || 0),
                protein: (food?.protein || 0),
                carbs: (food?.carbs || 0),
                fat: (food?.fat || 0),
              },
              dailyNutrition: nutrition,
            }),
          });
          if (aiRes.ok) {
            const data = await aiRes.json();
            setAiRecommendation(data.recommendation || "");
          }
          setIsLoadingAi(false);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setIsLoadingAi(false);
      }
    } else if (dailyNutrition) {
      // Daily nutrition already available, fetch AI recommendation
      fetchAiRecommendation(item, 1);
    }
  };

  const handleConfirmEat = async () => {
    if (!selectedItem || !lineUserId) return;

    setIsSaving(true);
    try {
      const food = selectedItem.food;
      const multiplier = selectQuantity;

      // บันทึกเป็น meal
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          name: selectedItem.foodName,
          calories: (food?.calories || selectedItem.calories || 0) * multiplier,
          protein: (food?.protein || 0) * multiplier,
          carbs: (food?.carbs || 0) * multiplier,
          fat: (food?.fat || 0) * multiplier,
          sodium: 0,
          sugar: 0,
          multiplier,
          date: new Date().toISOString(),
        }),
      });

      // Reduce quantity from source items (for merged items)
      let remainingToReduce = multiplier;
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

      setSelectedItem(null);
      
      // Redirect to /cal
      router.push("/cal");
    } catch (error) {
      console.error("Failed to save meal:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const orderDate = date.toDateString();

    if (orderDate === today) {
      return `วันนี้ ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (orderDate === yesterday) {
      return `เมื่อวาน ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading state
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!isLoggedIn || !lineUserId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            กรุณาเข้าสู่ระบบ
          </h2>
          <p className="text-gray-500 text-sm">
            เปิดผ่าน LINE เพื่อดูรายการอาหารของคุณ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Tabs */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "completed"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            อาหารของคุณ ({uniqueFoodCount})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "active"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            รายการสั่งซื้อ ({activeOrders.length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 pt-4 space-y-3">
        {activeTab === "completed" ? (
          // อาหารของคุณ - แสดงเป็น flat list อาหารพร้อมสารอาหาร + ปุ่มเลือกทาน (merged duplicates)
          (() => {
            const rawFoodItems = completedOrders.flatMap((order) =>
              order.items.map((item) => ({
                ...item,
                orderId: order.id,
                orderNumber: order.orderNumber,
              }))
            );

            // Merge duplicate items by foodName
            const mergedMap = new Map<string, SelectedFoodItem>();
            rawFoodItems.forEach((item) => {
              const existing = mergedMap.get(item.foodName);
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
                mergedMap.set(item.foodName, {
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

            const allFoodItems = Array.from(mergedMap.values()).filter(item => item.quantity > 0);

            if (allFoodItems.length === 0) {
              return (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">ยังไม่มีอาหารของคุณ</p>
                  <Link
                    href="/menu"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    สั่งอาหาร
                  </Link>
                </div>
              );
            }

            return allFoodItems.map((item, index) => {
              const food = item.food;
              return (
                <motion.div
                  key={`${item.orderId}-${item.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white rounded-2xl p-4 border border-slate-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{item.foodName}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {food?.calories || item.calories || 0} kcal • P {food?.protein || 0}g • C {food?.carbs || 0}g • F {food?.fat || 0}g
                      </p>
                    </div>
                    <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                      ×{item.quantity}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelectClick(item)}
                    className="mt-3 w-full py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    เลือกทาน
                  </button>
                </motion.div>
              );
            });
          })()
        ) : (
          // รายการสั่งซื้อ - ไม่แสดงยอดเงิน
          activeOrders.length > 0 ? (
            activeOrders.map((order, index) => {
              const config = statusConfig[order.status] || defaultStatusConfig;
              const StatusIcon = config.icon;
              const totalCalories = order.items?.reduce(
                (sum, item) => sum + (item.calories || 0) * item.quantity,
                0
              ) || 0;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-5 border border-slate-200"
                >
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        #{order.orderNumber}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2">
                    {(order.items || []).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{item.foodName}</span>
                          <span className="text-slate-400">×{item.quantity}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {item.food?.calories || item.calories || 0} kcal
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer - แค่ calories ไม่แสดงราคา */}
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      รวม {totalCalories} kcal
                    </span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="py-16 text-center">
              <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">ไม่มีรายการสั่งซื้อ</p>
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                สั่งอาหาร
              </Link>
            </div>
          )
        )}
      </div>

      {/* Quantity Selection Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
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
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

              <h3 className="text-lg font-semibold text-center mb-2">
                {selectedItem.foodName}
              </h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                คงเหลือ ×{selectedItem.quantity}
              </p>

              {/* Quantity Selector */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <button
                  onClick={() => setSelectQuantity(Math.max(1, selectQuantity - 1))}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                  disabled={selectQuantity <= 1}
                >
                  <Minus className="w-5 h-5" />
                </button>

                <span className="text-3xl font-semibold text-slate-800 min-w-[60px] text-center">
                  {selectQuantity}
                </span>

                <button
                  onClick={() => setSelectQuantity(Math.min(selectedItem.quantity, selectQuantity + 1))}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                  disabled={selectQuantity >= selectedItem.quantity}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Nutrition Preview */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-500 mb-2">สารอาหารที่จะได้รับ</p>
                <p className="text-sm text-slate-700">
                  {(selectedItem.food?.calories || selectedItem.calories || 0) * selectQuantity} kcal •
                  P {(selectedItem.food?.protein || 0) * selectQuantity}g •
                  C {(selectedItem.food?.carbs || 0) * selectQuantity}g •
                  F {(selectedItem.food?.fat || 0) * selectQuantity}g
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
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmEat}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {isSaving ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
