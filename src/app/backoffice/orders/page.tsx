"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/backoffice/Header";
import { User, Phone, Mail, MessageCircle, Package, Truck, Trash2, Store, MapPin, Calendar, Clock, Edit3, Save, X, FileText, Plus, Minus, Search, Bell, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  phone: string | null;
  email: string | null;
}

interface OrderItem {
  id: string;
  foodId: string;
  foodName: string;
  quantity: number;
  dayNumber: number;
  mealType: string;
  price: number;
}

interface Restaurant {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Food {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  calories: number;
}

interface Order {
  id: string;
  orderNumber: string;
  memberId: string | null;
  member: Member | null;
  restaurantId: string | null;
  restaurant: Restaurant | null;
  coursePlan: string;
  totalDays: number;
  totalPrice: number;
  deliveryFee: number;
  discount: number;
  discountType: string | null;
  discountValue: number | null;
  packageName: string | null;
  finalPrice: number | null;
  status: string;
  note: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: "รอดำเนินการ", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: "⏳" },
  confirmed: { label: "ยืนยันคำสั่งซื้อ", color: "text-green-700", bgColor: "bg-green-50 border-green-200", icon: "✅" },
  preparing: { label: "รับชำระเงิน", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200", icon: "💰" },
  shipping: { label: "กำลังจัดส่ง", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", icon: "🚚" },
  completed: { label: "จัดส่งเรียบร้อย", color: "text-teal-700", bgColor: "bg-teal-50 border-teal-200", icon: "✅" },
  cancelled: { label: "ยกเลิก", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: "❌" },
};

const carrierOptions = [
  "Kerry Express",
  "Flash Express",
  "J&T Express",
  "Thailand Post",
  "Ninja Van",
  "Best Express",
  "DHL",
  "Grab Express",
  "Lalamove",
  "อื่นๆ",
];

const planLabels: Record<string, string> = {
  "7_DAYS": "7 วัน",
  "15_DAYS": "15 วัน",
  "30_DAYS": "30 วัน",
  "CUSTOM": "กำหนดเอง",
  "single": "สั่งทีละรายการ",
};

const mealLabels: Record<string, string> = {
  breakfast: "🌅 เช้า",
  lunch: "☀️ กลางวัน",
  dinner: "🌙 เย็น",
  snack: "🍎 ว่าง",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Tracking modal state
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Edit price state
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editDeliveryFee, setEditDeliveryFee] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editItemPrices, setEditItemPrices] = useState<Record<string, number>>({});
  const [editItemQuantities, setEditItemQuantities] = useState<Record<string, number>>({});
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<{ foodId: string; foodName: string; price: number; quantity: number; dayNumber: number; mealType: string }[]>([]);
  const [savingPrice, setSavingPrice] = useState(false);
  
  // Add item modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [restaurantFoods, setRestaurantFoods] = useState<Food[]>([]);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [loadingFoods, setLoadingFoods] = useState(false);

  // Real-time notification state
  const [newOrderToast, setNewOrderToast] = useState<{ show: boolean; count: number; orders: Order[] }>({ show: false, count: 0, orders: [] });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousOrdersRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstLoadRef = useRef(true);

  // Initialize audio for notification
  useEffect(() => {
    // Create audio element for notification sound
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVIYAHWo3NjPl24rABJ5t+HOtI5mSAAbiK7X4dSugWkcAABwntrn4cGRd2Q4AABNmdzr5dmig3lhPgAAQ5Tb7Orik4ZxY00AADuS2e/t6a+Rfm9dVwAAM4vV8fDwuJuHd21hXgAAK4PR8vL2wqKOgHZqZV4AACh9zfP1+s2qloiAc2phXwAAJHjI8/j/1bOelYqEeW5lYAAAIXXC8vr/3LukmJCKgXZsZWEAAB5wvfH6/+LCqp2WjoZ9c2tlYgAAG2y38Pr/58qyo5qUi4J6cGtlYwAAGWix7/r/7NW4p56YkIV+d3BtZmMAF2Wr7vn/8Ny9q6Kbl4uDfHVwbWdkABVhqOz4//XjwrCmoJiRhoF6dXBuaGQAE12j6vf/+OnItrOqpJuUioN+eXRwbmlmABFZn+n2//zt0L27sq2nn5iRioWAe3Zwb2tnABBVmufy/v/x2Nm/t7Ospp+Zk42Hgnx4c3BtaWcADlGW5PD+//Ta3cW+ubSuraCblpGLhn92c29saWYADU6R4e3+//fc4crDvbexq6aglJCLhYB7dHJvbGlnAAxKjN3q/f/54ePPx8K8trCrpZ+YkouGgXx3c3Bta2kAC0eJ2ub8//vl5dTMxsC6tbCqpKCZk46JhIF9eHVycG1rAApDhNXi+///6Ofa0czGwLq2sKqkoZqUj4qFgX15dXJwbm0ACkB/0N33//7r6t/X0szGwbu2sq2no5yXko2JhYJ+enZ0cXBvAAo9esvY9P//7e3k3NbRzMfBvLe0r6qkn5qVkIyIhIF9enh2dHJxAAk5dMbS8P//8PDo4NvW0cvGwby4tLCsqKOenJiUkI2KhoN/fHl3dnRzAAk1b8DM6/7/8vLr5eDb1tHMyMPAu7e0sK2ppKKenZmWko+MiYaEgn99e3l3dgAJMmq6xub8//X17+nm4dza1tLOy8jFwb66trOvrKmlop+dnJmWlJGPjYqIhoSBf316eXgACTBmtL/g+P/39/Lu6ufj4NzZ1tPS0M3KyMXDwL67ubazsa+tq6mnpaOhn52bmJaUkpCOjIqIhgAINWGvueP5//r58/Dt6+jl4t/c2dbT0c7MysfEwr+9u7m3tbOxr66sq6mpqKaloqCfnZuamJaUko+NiwAINVusseD4//z79PPw7ero5eLg3drY1dPR0M7My8nIxsXDwb++vby6ubi3trWzsrGwr66trKuqqqmpqKemoQAIM1amq9z2//789PTx7+zq6Obj4d/d29nX1dPS0M/OzMvKyMfGxMPCwb+/vrq3trW0s7KxsK+vrq2sq6uqqqmpqKcABy1Pn6XV8v/+/fv49fPw7uzp5+Xj4N7c2tjW1NPR0M7NzMrJyMbFxMPCwL+9vLu6ubm3trW0s7Kxr66trKurqqqpqKcAByVGl53N7P//+/n49fPw7uvp5+Tg3drX1dPS0M/Ny8rIx8XEwsHAv727urm4t7a0s7KxsK+urKyqqamoqKenp6YABiBBkJfF5f/+/Pr49fPw7uvp5uTh397c2dfV09LQzs3Ly8nIxsTDwr+/vby6ubm3tbSzsrGxr66trKuqqamoqKenp6YABRs6iZC92////fv49fLv7ezo5uPh3tzZ19XT0tDOzMvJyMbFw8LAwL++vby6urm3trW0s7Kwr62sq6qpqaioqKenpgAEFjOCirW5/f/++/n28/Dv7ero5eLg3tvZ1tTT0c/OzMvJyMfFxMPBwL++vbu6ubm3trW0s7Kwr66trKuqqampqKinpgAEETJ6grC0+f/+/Pr39PLw7ezq6OXj4d7c2tjW1NPRz87My8nIxsTDwcC/vr28u7q5t7a1tLOysK+uraysq6qpqKenpwADDi1zgqy36v/+/fv49vTx7+3r6Obl4uDe3NrY1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKenAQMIDyl1f6mz7////fz6+Pb08/Dv7evp5+Xj4N7c2tjW1NPRz87My8nIxsTDwcC/vr28u7q5t7a1tLOysK+uraysq6qpqKenAQMGDCh0f6ay6v/+/fz6+fb18/Hw7uzq6Obl4uDe3NrY1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKcBAwQJJnR+o6/p/f7+/fz6+fb08/Hw7uzq6Obl4+He3NrY1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKcBAgMHInR+o67m+/7+/fz6+fb08/Hw7uzq6Obl4+He3NrY1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKcBAgQGIHN9oazk+v7+/Pz7+fb08/Dv7uzq6Obl4+He3NrY1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKcAAQMFHXJ8n6ri+P79/Pz6+fb08vDv7uzq6Obl4+He3NrY1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKcAAQMEG3F7naji9/79/Pv6+PX08vDv7uzq6OXj4d/d29nX1tTT0c/OzMvJyMbFw8HAwL++vby6ubm3trW0s7Kwr66trKuqqamoqKc=");
    audioRef.current.volume = 0.5;
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, [soundEnabled]);

  // Fetch orders with polling
  const fetchOrdersWithCheck = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      const newOrders = Array.isArray(data) ? data : [];
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'orders/page.tsx:fetchOrdersWithCheck',message:'Polling executed',data:{isFirstLoad:isFirstLoadRef.current,previousCount:previousOrdersRef.current.length,newCount:newOrders.length},timestamp:Date.now(),hypothesisId:'H1-polling'})}).catch(()=>{});
      // #endregion
      
      // Check for new orders (only after first load)
      if (!isFirstLoadRef.current) {
        const currentOrderIds = newOrders.map((o: Order) => o.id);
        const newOrderIds = currentOrderIds.filter((id: string) => !previousOrdersRef.current.includes(id));
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'orders/page.tsx:checkNewOrders',message:'Checking for new orders',data:{currentCount:currentOrderIds.length,previousCount:previousOrdersRef.current.length,newOrdersFound:newOrderIds.length},timestamp:Date.now(),hypothesisId:'H2-neworders'})}).catch(()=>{});
        // #endregion
        
        if (newOrderIds.length > 0) {
          const newOrdersList = newOrders.filter((o: Order) => newOrderIds.includes(o.id));
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'orders/page.tsx:showToast',message:'Showing new order toast',data:{count:newOrderIds.length,orderNumbers:newOrdersList.map((o: Order) => o.orderNumber)},timestamp:Date.now(),hypothesisId:'H3-toast'})}).catch(()=>{});
          // #endregion
          
          setNewOrderToast({ show: true, count: newOrderIds.length, orders: newOrdersList });
          playNotificationSound();
          
          // Auto-hide toast after 10 seconds
          setTimeout(() => {
            setNewOrderToast(prev => ({ ...prev, show: false }));
          }, 10000);
        }
      }
      
      // Update previous orders reference
      previousOrdersRef.current = newOrders.map((o: Order) => o.id);
      isFirstLoadRef.current = false;
      
      setOrders(newOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [playNotificationSound]);

  // Initial load and polling
  useEffect(() => {
    fetchOrdersWithCheck();
    
    // Poll every 15 seconds for new orders
    const interval = setInterval(fetchOrdersWithCheck, 15000);
    return () => clearInterval(interval);
  }, [fetchOrdersWithCheck]);

  // Alias for compatibility with existing code
  const fetchOrders = fetchOrdersWithCheck;

  const updateOrderStatus = async (orderId: string, newStatus: string, extraData?: { trackingNumber?: string; carrier?: string }) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          ...extraData
        }),
      });
      
      if (res.ok) {
        const updatedOrder = await res.json();
        fetchOrders();
        // Update selected order
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updatedOrder);
        }
        setShowTrackingModal(false);
        setTrackingNumber("");
        setCarrier("");
      }
    } catch (error) {
      console.error("Error updating order:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusClick = (orderId: string, newStatus: string) => {
    if (newStatus === "shipping") {
      // Show tracking modal for shipping status
      setShowTrackingModal(true);
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  const handleShippingSubmit = () => {
    if (!selectedOrder) return;
    updateOrderStatus(selectedOrder.id, "shipping", {
      trackingNumber: trackingNumber || undefined,
      carrier: carrier || undefined,
    });
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`ต้องการลบออเดอร์ #${orderNumber} หรือไม่?\n\nการลบจะไม่สามารถกู้คืนได้`)) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "เกิดข้อผิดพลาดในการลบ");
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // Start editing prices
  const startEditingPrice = () => {
    if (!selectedOrder) return;
    setEditDeliveryFee(selectedOrder.deliveryFee || 0);
    setEditDiscount(selectedOrder.discount || 0);
    const itemPrices: Record<string, number> = {};
    const itemQuantities: Record<string, number> = {};
    selectedOrder.items.forEach(item => {
      itemPrices[item.id] = item.price;
      itemQuantities[item.id] = item.quantity;
    });
    setEditItemPrices(itemPrices);
    setEditItemQuantities(itemQuantities);
    setItemsToDelete([]);
    setNewItems([]);
    setIsEditingPrice(true);
  };

  // Cancel editing
  const cancelEditingPrice = () => {
    setIsEditingPrice(false);
    setEditItemPrices({});
    setEditItemQuantities({});
    setItemsToDelete([]);
    setNewItems([]);
  };

  // Mark item for deletion
  const markItemForDeletion = (itemId: string) => {
    setItemsToDelete([...itemsToDelete, itemId]);
  };

  // Restore item from deletion
  const restoreItem = (itemId: string) => {
    setItemsToDelete(itemsToDelete.filter(id => id !== itemId));
  };

  // Fetch foods from restaurant
  const fetchRestaurantFoods = async (restaurantId: string) => {
    setLoadingFoods(true);
    try {
      const res = await fetch(`/api/foods?restaurantId=${restaurantId}&isActive=true`);
      if (res.ok) {
        const data = await res.json();
        setRestaurantFoods(data);
      }
    } catch (error) {
      console.error("Error fetching foods:", error);
    } finally {
      setLoadingFoods(false);
    }
  };

  // Open add item modal
  const openAddItemModal = () => {
    if (!selectedOrder?.restaurantId) {
      alert("ออเดอร์นี้ไม่มีร้านค้า");
      return;
    }
    fetchRestaurantFoods(selectedOrder.restaurantId);
    setFoodSearchQuery("");
    setShowAddItemModal(true);
  };

  // Add new item to order
  const addNewItem = (food: Food) => {
    // Check if already added
    const existingNew = newItems.find(i => i.foodId === food.id);
    if (existingNew) {
      setNewItems(newItems.map(i => 
        i.foodId === food.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setNewItems([...newItems, {
        foodId: food.id,
        foodName: food.name,
        price: food.price,
        quantity: 1,
        dayNumber: 1,
        mealType: "lunch",
      }]);
    }
    setShowAddItemModal(false);
  };

  // Remove new item
  const removeNewItem = (foodId: string) => {
    setNewItems(newItems.filter(i => i.foodId !== foodId));
  };

  // Update new item quantity
  const updateNewItemQuantity = (foodId: string, quantity: number) => {
    if (quantity <= 0) {
      removeNewItem(foodId);
      return;
    }
    setNewItems(newItems.map(i => 
      i.foodId === foodId ? { ...i, quantity } : i
    ));
  };

  // Save price changes
  const savePriceChanges = async () => {
    if (!selectedOrder) return;
    setSavingPrice(true);

    try {
      // Calculate new total from existing items (excluding deleted)
      const existingItemsTotal = selectedOrder.items
        .filter(item => !itemsToDelete.includes(item.id))
        .reduce((sum, item) => {
          const newPrice = editItemPrices[item.id] ?? item.price;
          const newQty = editItemQuantities[item.id] ?? item.quantity;
          return sum + (newPrice * newQty);
        }, 0);
      
      // Add new items total
      const newItemsTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const newTotalPrice = existingItemsTotal + newItemsTotal;
      const newFinalPrice = newTotalPrice + editDeliveryFee - editDiscount;

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryFee: editDeliveryFee,
          discount: editDiscount,
          totalPrice: newTotalPrice,
          finalPrice: newFinalPrice,
          items: Object.entries(editItemPrices)
            .filter(([itemId]) => !itemsToDelete.includes(itemId))
            .map(([itemId, price]) => ({
              id: itemId,
              price,
              quantity: editItemQuantities[itemId],
            })),
          deleteItems: itemsToDelete,
          newItems: newItems,
          sendNotification: false,
        }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setSelectedOrder(updatedOrder);
        fetchOrders();
        setIsEditingPrice(false);
        setItemsToDelete([]);
        setNewItems([]);
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      console.error("Error saving prices:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setSavingPrice(false);
    }
  };

  // Calculate totals for edit mode
  const calculateEditTotals = () => {
    if (!selectedOrder) return { itemsTotal: 0, finalPrice: 0 };
    // Existing items (excluding deleted)
    const existingItemsTotal = selectedOrder.items
      .filter(item => !itemsToDelete.includes(item.id))
      .reduce((sum, item) => {
        const newPrice = editItemPrices[item.id] ?? item.price;
        const newQty = editItemQuantities[item.id] ?? item.quantity;
        return sum + (newPrice * newQty);
      }, 0);
    // New items
    const newItemsTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemsTotal = existingItemsTotal + newItemsTotal;
    const finalPrice = itemsTotal + editDeliveryFee - editDiscount;
    return { itemsTotal, finalPrice };
  };

  const filteredOrders = orders.filter(
    order => filterStatus === "all" || order.status === filterStatus
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group items by day
  const groupItemsByDay = (items: OrderItem[]) => {
    return items.reduce((acc, item) => {
      const day = item.dayNumber || 1;
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    }, {} as Record<number, OrderItem[]>);
  };

  return (
    <div>
      <Header title="ออเดอร์" subtitle="จัดการรายการสั่งซื้อจากลูกค้า" actions={
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-lg transition-colors ${soundEnabled ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
          title={soundEnabled ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      } />
      
      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {[
            { status: "all", label: "ทั้งหมด", icon: "📋", count: orders.length },
            { status: "pending", label: "รอดำเนินการ", icon: "⏳", count: orders.filter(o => o.status === "pending").length },
            { status: "confirmed", label: "ยืนยันคำสั่งซื้อ", icon: "✅", count: orders.filter(o => o.status === "confirmed").length },
            { status: "preparing", label: "รับชำระเงิน", icon: "💰", count: orders.filter(o => o.status === "preparing").length },
            { status: "shipping", label: "กำลังจัดส่ง", icon: "🚚", count: orders.filter(o => o.status === "shipping").length },
            { status: "completed", label: "จัดส่งเรียบร้อย", icon: "✅", count: orders.filter(o => o.status === "completed").length },
          ].map((stat) => (
            <button
              key={stat.status}
              onClick={() => setFilterStatus(stat.status)}
              className={`p-4 rounded-xl border transition-all ${
                filterStatus === stat.status
                  ? "border-green-500 bg-green-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-green-200"
              }`}
            >
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stat.count}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-4">กำลังโหลด...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-5xl">📭</span>
              <p className="text-gray-500 mt-4">ยังไม่มีออเดอร์</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ลูกค้า</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">เลขออเดอร์</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ร้านค้า</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">คอร์ส</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">จำนวนเมนู</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">ราคารวม</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">สถานะ</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">วันที่สั่ง</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {order.member?.pictureUrl ? (
                            <img 
                              src={order.member.pictureUrl} 
                              alt={order.member.displayName || "User"}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">
                              {order.member?.displayName || "ไม่ระบุชื่อ"}
                            </p>
                            {order.member?.phone && (
                              <p className="text-xs text-gray-500">{order.member.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-green-600">{order.orderNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        {order.restaurant ? (
                          <span className="text-gray-800">{order.restaurant.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-800">{planLabels[order.coursePlan] || order.coursePlan}</span>
                        {order.totalDays > 1 && (
                          <span className="text-gray-400 text-sm ml-1">({order.totalDays} วัน)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-800">{order.items.length} รายการ</span>
                      </td>
                      <td className="px-6 py-4">
                        {order.discount > 0 ? (
                          <div>
                            <span className="font-semibold text-green-600">฿{(order.finalPrice || order.totalPrice).toLocaleString()}</span>
                            <div className="text-xs text-gray-400 line-through">฿{order.totalPrice.toLocaleString()}</div>
                            <div className="text-xs text-green-500">-฿{order.discount.toLocaleString()}</div>
                          </div>
                        ) : (
                          <span className="font-semibold text-gray-800">฿{order.totalPrice.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color}`}>
                          {statusConfig[order.status]?.icon} {statusConfig[order.status]?.label || order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                          >
                            ดูรายละเอียด
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบออเดอร์"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setSelectedOrder(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">รายละเอียดออเดอร์</h2>
                  <p className="text-sm text-green-600 font-mono">{selectedOrder.orderNumber}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Order Info: Date & Restaurant */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Date/Time */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      วันที่สั่งซื้อ
                    </h3>
                    <p className="text-lg font-semibold text-gray-800">
                      {new Date(selectedOrder.createdAt).toLocaleDateString("th-TH", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4" />
                      {new Date(selectedOrder.createdAt).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} น.
                    </p>
                  </div>

                  {/* Restaurant */}
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Store className="w-4 h-4 text-orange-600" />
                      ร้านค้า
                    </h3>
                    {selectedOrder.restaurant ? (
                      <div className="flex items-center gap-3">
                        {selectedOrder.restaurant.logoUrl ? (
                          <img
                            src={selectedOrder.restaurant.logoUrl}
                            alt={selectedOrder.restaurant.name}
                            className="w-12 h-12 rounded-lg object-cover border border-orange-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Store className="w-6 h-6 text-orange-400" />
                          </div>
                        )}
                        <p className="font-semibold text-gray-800">{selectedOrder.restaurant.name}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500">ไม่ระบุร้านค้า</p>
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    ข้อมูลลูกค้า
                  </h3>
                  <div className="flex items-start gap-4">
                    {selectedOrder.member?.pictureUrl ? (
                      <img 
                        src={selectedOrder.member.pictureUrl} 
                        alt={selectedOrder.member.displayName || "User"}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white shadow-md">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-lg">
                        {selectedOrder.member?.displayName || "ไม่ระบุชื่อ"}
                      </p>
                      {selectedOrder.member?.phone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Phone className="w-4 h-4" />
                          {selectedOrder.member.phone}
                        </p>
                      )}
                      {selectedOrder.member?.email && (
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Mail className="w-4 h-4" />
                          {selectedOrder.member.email}
                        </p>
                      )}
                      {selectedOrder.member?.lineUserId && (
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-2">
                          <MessageCircle className="w-3 h-3" />
                          LINE ID: {selectedOrder.member.lineUserId.slice(0, 10)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                {(selectedOrder.deliveryName || selectedOrder.deliveryAddress) && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      ที่อยู่จัดส่ง
                    </h3>
                    <div className="space-y-2">
                      {selectedOrder.deliveryName && (
                        <p className="font-semibold text-gray-800">{selectedOrder.deliveryName}</p>
                      )}
                      {selectedOrder.deliveryPhone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {selectedOrder.deliveryPhone}
                        </p>
                      )}
                      {selectedOrder.deliveryAddress && (
                        <p className="text-sm text-gray-600">{selectedOrder.deliveryAddress}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tracking Info (if shipping or completed) */}
                {(selectedOrder.status === "shipping" || selectedOrder.status === "completed") && (selectedOrder.trackingNumber || selectedOrder.carrier) && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      ข้อมูลการจัดส่ง
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedOrder.trackingNumber && (
                        <div>
                          <p className="text-xs text-gray-500">เลขพัสดุ</p>
                          <p className="font-mono font-semibold text-blue-600">{selectedOrder.trackingNumber}</p>
                        </div>
                      )}
                      {selectedOrder.carrier && (
                        <div>
                          <p className="text-xs text-gray-500">ขนส่ง</p>
                          <p className="font-semibold text-gray-800">{selectedOrder.carrier}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Info */}
                <div className="mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl mb-4">
                    <p className="text-xs text-gray-500 mb-1">คอร์ส</p>
                    <p className="font-semibold">{planLabels[selectedOrder.coursePlan] || selectedOrder.coursePlan} {selectedOrder.totalDays > 1 && `(${selectedOrder.totalDays} วัน)`}</p>
                  </div>

                  {/* Note */}
                  {selectedOrder.note && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
                      <p className="text-xs text-amber-600 font-medium mb-1">📝 หมายเหตุ</p>
                      <p className="text-gray-700">{selectedOrder.note}</p>
                    </div>
                  )}

                  {/* Items by Day */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">🍽️ รายการเมนู</h3>
                    {!isEditingPrice ? (
                      <button
                        onClick={startEditingPrice}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        แก้ไข
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={openAddItemModal}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          เพิ่มเมนู
                        </button>
                        <button
                          onClick={cancelEditingPrice}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          ยกเลิก
                        </button>
                        <button
                          onClick={savePriceChanges}
                          disabled={savingPrice}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {savingPrice ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                      </div>
                    )}
                  </div>
                  {Object.entries(groupItemsByDay(selectedOrder.items))
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([day, items]) => (
                      <div key={day} className="mb-4">
                        {selectedOrder.totalDays > 1 && (
                          <p className="text-sm font-medium text-green-600 mb-2">📅 วันที่ {day}</p>
                        )}
                        <div className="space-y-2">
                          {items.map((item) => {
                            const isDeleted = itemsToDelete.includes(item.id);
                            const itemQty = isEditingPrice ? (editItemQuantities[item.id] ?? item.quantity) : item.quantity;
                            const itemPrice = isEditingPrice ? (editItemPrices[item.id] ?? item.price) : item.price;
                            const totalItemPrice = itemPrice * itemQty;
                            
                            if (isDeleted) {
                              return (
                                <div key={item.id} className="p-3 bg-red-50 rounded-lg border border-red-200 opacity-60">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium text-red-400 line-through">{item.foodName}</p>
                                    <button
                                      onClick={() => restoreItem(item.id)}
                                      className="text-xs px-2 py-1 bg-white text-red-600 rounded hover:bg-red-100"
                                    >
                                      เรียกคืน
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            
                            return (
                              <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-gray-800">{item.foodName}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-500">{mealLabels[item.mealType] || item.mealType}</p>
                                    {isEditingPrice && (
                                      <button
                                        onClick={() => markItemForDeletion(item.id)}
                                        className="p-1 text-red-500 hover:bg-red-100 rounded"
                                        title="ลบรายการ"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  {isEditingPrice ? (
                                    <div className="flex items-center gap-2">
                                      {/* Quantity Controls */}
                                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
                                        <button
                                          onClick={() => {
                                            const newQty = Math.max(1, itemQty - 1);
                                            setEditItemQuantities({ ...editItemQuantities, [item.id]: newQty });
                                          }}
                                          className="p-1 hover:bg-gray-100 rounded-l-lg"
                                        >
                                          <Minus className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <input
                                          type="number"
                                          value={itemQty}
                                          onChange={(e) => setEditItemQuantities({
                                            ...editItemQuantities,
                                            [item.id]: Math.max(1, parseInt(e.target.value) || 1)
                                          })}
                                          className="w-12 text-center border-0 focus:ring-0"
                                          min="1"
                                        />
                                        <button
                                          onClick={() => setEditItemQuantities({ ...editItemQuantities, [item.id]: itemQty + 1 })}
                                          className="p-1 hover:bg-gray-100 rounded-r-lg"
                                        >
                                          <Plus className="w-4 h-4 text-gray-500" />
                                        </button>
                                      </div>
                                      <span className="text-gray-400">x</span>
                                      <input
                                        type="number"
                                        value={editItemPrices[item.id] ?? item.price}
                                        onChange={(e) => setEditItemPrices({
                                          ...editItemPrices,
                                          [item.id]: parseFloat(e.target.value) || 0
                                        })}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-right font-mono"
                                        min="0"
                                      />
                                      <span className="text-gray-400">฿</span>
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">
                                      {item.quantity} x ฿{item.price.toLocaleString()}
                                    </p>
                                  )}
                                  <p className="font-semibold text-gray-700">= ฿{totalItemPrice.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  
                  {/* New Items (in edit mode) */}
                  {isEditingPrice && newItems.length > 0 && (
                    <div className="mb-4 border-t border-dashed border-green-300 pt-4">
                      <p className="text-sm font-medium text-green-600 mb-2">✨ รายการใหม่</p>
                      <div className="space-y-2">
                        {newItems.map((item) => {
                          const totalItemPrice = item.price * item.quantity;
                          return (
                            <div key={item.foodId} className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-800">{item.foodName}</p>
                                <button
                                  onClick={() => removeNewItem(item.foodId)}
                                  className="p-1 text-red-500 hover:bg-red-100 rounded"
                                  title="ลบรายการ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  {/* Quantity Controls */}
                                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
                                    <button
                                      onClick={() => updateNewItemQuantity(item.foodId, item.quantity - 1)}
                                      className="p-1 hover:bg-gray-100 rounded-l-lg"
                                    >
                                      <Minus className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateNewItemQuantity(item.foodId, Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-12 text-center border-0 focus:ring-0"
                                      min="1"
                                    />
                                    <button
                                      onClick={() => updateNewItemQuantity(item.foodId, item.quantity + 1)}
                                      className="p-1 hover:bg-gray-100 rounded-r-lg"
                                    >
                                      <Plus className="w-4 h-4 text-gray-500" />
                                    </button>
                                  </div>
                                  <span className="text-gray-400">x ฿{item.price.toLocaleString()}</span>
                                </div>
                                <p className="font-semibold text-green-700">= ฿{totalItemPrice.toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price Summary */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 mt-4">
                    {/* ยอดรวมก่อนส่วนลด */}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">ยอดรวมอาหาร</span>
                      <span className="font-semibold text-gray-800">
                        ฿{isEditingPrice ? calculateEditTotals().itemsTotal.toLocaleString() : selectedOrder.totalPrice.toLocaleString()}
                      </span>
                    </div>

                    {/* ค่าจัดส่ง */}
                    <div className="flex items-center justify-between py-2 border-t border-green-200">
                      <span className="text-gray-600">ค่าจัดส่ง</span>
                      {isEditingPrice ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editDeliveryFee}
                            onChange={(e) => setEditDeliveryFee(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right font-mono"
                            min="0"
                          />
                          <span className="text-gray-400">฿</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-800">฿{(selectedOrder.deliveryFee || 0).toLocaleString()}</span>
                      )}
                    </div>

                    {/* ส่วนลด */}
                    <div className="flex items-center justify-between py-2 border-t border-green-200">
                      <div>
                        <span className="text-green-600">ส่วนลด</span>
                        {!isEditingPrice && selectedOrder.packageName && (
                          <p className="text-xs text-green-500">🎉 {selectedOrder.packageName}</p>
                        )}
                      </div>
                      {isEditingPrice ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-500">-</span>
                          <input
                            type="number"
                            value={editDiscount}
                            onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right font-mono"
                            min="0"
                          />
                          <span className="text-gray-400">฿</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-green-600">-฿{(selectedOrder.discount || 0).toLocaleString()}</span>
                      )}
                    </div>

                    {/* ที่ต้องชำระ */}
                    <div className="flex items-center justify-between py-3 border-t-2 border-green-300 mt-2">
                      <span className="font-bold text-gray-800 text-lg">ที่ต้องชำระ</span>
                      <span className="font-bold text-green-600 text-2xl">
                        ฿{isEditingPrice 
                          ? calculateEditTotals().finalPrice.toLocaleString() 
                          : (selectedOrder.finalPrice || selectedOrder.totalPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Quotation Link */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">ใบเสนอราคา</span>
                      </div>
                      <a
                        href={`/quotation/${selectedOrder.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        ดูใบเสนอราคา
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer - Status Actions */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">เปลี่ยนสถานะ (จะแจ้งลูกค้าทาง LINE อัตโนมัติ)</p>
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id, selectedOrder.orderNumber)}
                    className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    ลบออเดอร์
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => handleStatusClick(selectedOrder.id, status)}
                      disabled={selectedOrder.status === status || updatingStatus}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                        selectedOrder.status === status
                          ? `${config.bgColor} ${config.color} cursor-not-allowed`
                          : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                      } disabled:opacity-50`}
                    >
                      {config.icon} {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tracking Number Modal */}
      <AnimatePresence>
        {showTrackingModal && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowTrackingModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  ข้อมูลการจัดส่ง
                </h3>
                <p className="text-sm text-gray-500">กรอกเลขพัสดุและขนส่งก่อนเปลี่ยนสถานะ</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ขนส่ง
                  </label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">เลือกขนส่ง</option>
                    {carrierOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขพัสดุ
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="เช่น TH12345678901"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowTrackingModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleShippingSubmit}
                  disabled={updatingStatus}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      กำลังจัดส่ง
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddItemModal && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowAddItemModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl max-w-lg w-full max-h-[80vh] shadow-2xl flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-green-600" />
                      เพิ่มเมนู
                    </h3>
                    {selectedOrder.restaurant && (
                      <p className="text-sm text-gray-500">ร้าน {selectedOrder.restaurant.name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddItemModal(false)}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Search */}
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={foodSearchQuery}
                    onChange={(e) => setFoodSearchQuery(e.target.value)}
                    placeholder="ค้นหาเมนู..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loadingFoods ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : restaurantFoods.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>ไม่พบเมนูจากร้านนี้</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {restaurantFoods
                      .filter(food => 
                        foodSearchQuery === "" || 
                        food.name.toLowerCase().includes(foodSearchQuery.toLowerCase())
                      )
                      .map((food) => {
                        // Check if already in order or newItems
                        const existingInOrder = selectedOrder.items.find(i => i.foodId === food.id && !itemsToDelete.includes(i.id));
                        const existingInNew = newItems.find(i => i.foodId === food.id);
                        
                        return (
                          <button
                            key={food.id}
                            onClick={() => addNewItem(food)}
                            className="p-4 bg-gray-50 hover:bg-green-50 rounded-xl border border-gray-100 hover:border-green-200 transition-all text-left flex items-center gap-4"
                          >
                            {food.imageUrl ? (
                              <img 
                                src={food.imageUrl} 
                                alt={food.name}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-2xl">
                                🍽️
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{food.name}</p>
                              <p className="text-sm text-gray-500">{food.calories} kcal</p>
                              <p className="text-green-600 font-semibold">฿{food.price.toLocaleString()}</p>
                            </div>
                            {(existingInOrder || existingInNew) && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                อยู่ในออเดอร์
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Order Toast Notification */}
      <AnimatePresence>
        {newOrderToast.show && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -100, x: "-50%" }}
            className="fixed top-20 left-1/2 z-[100] bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl max-w-md"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">🎉 ออเดอร์ใหม่!</h3>
                <p className="text-sm opacity-90 mt-1">
                  มี {newOrderToast.count} ออเดอร์ใหม่เข้ามา
                </p>
                {newOrderToast.orders.slice(0, 2).map((order) => (
                  <div key={order.id} className="mt-2 p-2 bg-white/10 rounded-lg text-sm">
                    <span className="font-mono font-bold">{order.orderNumber}</span>
                    <span className="mx-2">•</span>
                    <span>{order.member?.displayName || "ลูกค้า"}</span>
                    <span className="mx-2">•</span>
                    <span className="font-semibold">฿{(order.finalPrice || order.totalPrice).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setNewOrderToast(prev => ({ ...prev, show: false }))}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
