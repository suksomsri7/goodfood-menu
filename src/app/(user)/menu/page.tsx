"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { closeWindow } from "@/lib/liff";

interface Food {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  price: number;
  imageUrl: string | null;
  images: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number | null;
  sodium: number | null;
  badge: string | null; // "discount" | "popular" | "bestseller"
  category: {
    id: string;
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  requiredItems: number;
  discountType: string;
  discountValue: number;
  isActive: boolean;
}

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  discountType: string | null;
  discountValue: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface CartItem {
  food: Food;
  quantity: number;
}

export default function MenuPage() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [foods, setFoods] = useState<Food[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal state
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Refs for scrolling
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const lineUserId = profile?.userId;

  // Fetch cart from API
  const fetchCart = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/cart?lineUserId=${lineUserId}`);
      if (res.ok) {
        const data = await res.json();
        // Transform cart items to match local CartItem interface
        const cartItems: CartItem[] = data.items.map((item: any) => ({
          food: item.food,
          quantity: item.quantity,
        }));
        setCart(cartItems);
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    }
  }, [lineUserId]);

  // Set page title
  useEffect(() => {
    document.title = "เมนูอาหาร";
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [foodRes, catRes, pkgRes, promoRes] = await Promise.all([
          fetch("/api/foods"),
          fetch("/api/categories"),
          fetch("/api/packages"),
          fetch("/api/promotions"),
        ]);
        const foodData = await foodRes.json();
        const catData = await catRes.json();
        const pkgData = await pkgRes.json();
        const promoData = await promoRes.json();
        setFoods(Array.isArray(foodData) ? foodData : []);
        setCategories(Array.isArray(catData) ? catData : []);
        setPackages(Array.isArray(pkgData) ? pkgData.filter((p: Package) => p.isActive) : []);
        setPromotions(Array.isArray(promoData) ? promoData.filter((p: Promotion) => p.isActive) : []);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch cart when user is logged in
  useEffect(() => {
    if (isReady && lineUserId) {
      fetchCart();
    }
  }, [isReady, lineUserId, fetchCart]);

  const addToCart = async (food: Food, quantity: number = 1) => {
    // Update local state immediately for responsiveness
    setCart(prev => {
      const existing = prev.find(item => item.food.id === food.id);
      if (existing) {
        return prev.map(item =>
          item.food.id === food.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { food, quantity }];
    });

    // Sync with API if logged in
    if (lineUserId) {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId,
            foodId: food.id,
            quantity,
          }),
        });
      } catch (error) {
        console.error("Failed to add to cart:", error);
      }
    }
  };

  const updateCartQuantity = async (foodId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.food.id !== foodId));
    } else {
      setCart(prev => prev.map(item =>
        item.food.id === foodId ? { ...item, quantity: newQuantity } : item
      ));
    }

    // Sync with API if logged in
    if (lineUserId) {
      try {
        await fetch("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId,
            foodId,
            quantity: newQuantity,
          }),
        });
      } catch (error) {
        console.error("Failed to update cart:", error);
      }
    }
  };

  const removeFromCart = async (foodId: string) => {
    setCart(prev => prev.filter(item => item.food.id !== foodId));

    // Sync with API if logged in
    if (lineUserId) {
      try {
        await fetch("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId,
            foodId,
            quantity: 0,
          }),
        });
      } catch (error) {
        console.error("Failed to remove from cart:", error);
      }
    }
  };

  const clearCart = async () => {
    setCart([]);
    setShowCart(false);

    // Sync with API if logged in
    if (lineUserId) {
      try {
        await fetch(`/api/cart?lineUserId=${lineUserId}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to clear cart:", error);
      }
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsSubmitting(true);
    try {
      // Create order
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          coursePlan: "single",
          totalDays: 1,
          totalPrice,
          items: cart.map(item => ({
            foodId: item.food.id,
            foodName: item.food.name,
            quantity: item.quantity,
            price: item.food.price,
            calories: item.food.calories,
          })),
        }),
      });

      if (res.ok) {
        clearCart();
        setShowCart(false);
        setShowSuccessModal(true);
      } else {
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessOk = () => {
    setShowSuccessModal(false);
    closeWindow();
  };

  const getQuantity = (foodId: string) => {
    return cart.find(item => item.food.id === foodId)?.quantity || 0;
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.food.price * item.quantity, 0);

  // Get all images for a food
  const getAllImages = (food: Food): string[] => {
    const allImages: string[] = [];
    if (food.imageUrl) allImages.push(food.imageUrl);
    if (food.images && food.images.length > 0) {
      food.images.forEach(img => {
        if (img && !allImages.includes(img)) allImages.push(img);
      });
    }
    return allImages;
  };

  // Open food detail modal
  const openFoodDetail = (food: Food) => {
    setSelectedFood(food);
    setModalQuantity(1);
    setCurrentImageIndex(0);
  };

  // Close modal
  const closeModal = () => {
    setSelectedFood(null);
    setModalQuantity(1);
    setCurrentImageIndex(0);
  };

  // Add from modal
  const addFromModal = () => {
    if (selectedFood) {
      addToCart(selectedFood, modalQuantity);
      closeModal();
    }
  };

  // Filter foods by search
  const filteredFoods = searchQuery
    ? foods.filter(food => food.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : foods;

  // Get categories that have products (from filtered foods)
  const categoriesWithProducts = categories.filter(cat =>
    filteredFoods.some(food => food.category?.id === cat.id)
  );

  // Get bestseller foods (from filtered foods so search works)
  const bestsellerFoods = filteredFoods.filter(f => f.badge === "bestseller");

  // Filter packages by search
  const filteredPackages = searchQuery
    ? packages.filter(pkg => pkg.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : packages;

  // Filter promotions by search
  const filteredPromotions = searchQuery
    ? promotions.filter(promo => promo.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : promotions;

  // Build tabs dynamically based on available data (use filtered data)
  const allTabs = [
    // แพ็คเกจ - show only if has packages
    ...(filteredPackages.length > 0 ? [{ id: "package", label: "แพ็คเกจ" }] : []),
    // โปรโมชั่น - show only if has promotions
    ...(filteredPromotions.length > 0 ? [{ id: "promotion", label: "โปรโมชั่น" }] : []),
    // คนสั่งเยอะ - show only if has foods with badge "bestseller"
    ...(bestsellerFoods.length > 0 ? [{ id: "bestseller", label: "คนสั่งเยอะ" }] : []),
    // Categories with products
    ...categoriesWithProducts.map(cat => ({
      id: `cat-${cat.id}`,
      label: cat.name,
    })),
  ];

  // Scroll to section when clicking tab
  const scrollToSection = (tabId: string) => {
    setActiveTab(tabId);
    const ref = sectionRefs.current[tabId];
    if (ref) {
      const headerOffset = 120;
      const elementPosition = ref.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  // Get foods for a category
  const getFoodsForCategory = (categoryId: string) => {
    return filteredFoods.filter(food => food.category?.id === categoryId);
  };

  const selectedFoodImages = selectedFood ? getAllImages(selectedFood) : [];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        {showSearch && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <button 
                onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center px-4 py-3 gap-3">
          {/* Title */}
          <h1 className="text-lg font-semibold text-gray-900 flex-shrink-0">เมนูอาหาร</h1>

          {/* Search Button */}
          <button onClick={() => setShowSearch(!showSearch)} className="flex-shrink-0 p-1 ml-auto">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <div className="flex-1 overflow-x-auto no-scrollbar -mr-4 pr-4">
            <div className="flex gap-5">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`flex-shrink-0 whitespace-nowrap pb-1 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-green-600 border-b-2 border-green-500"
                      : "text-gray-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      {isLoading ? (
        <div className="px-4 py-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="mb-8 animate-pulse">
              <div className="h-6 bg-gray-100 rounded w-32 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                {[...Array(2)].map((_, j) => (
                  <div key={j}>
                    <div className="aspect-square bg-gray-100 rounded-xl mb-3" />
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-1/4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4">
          {/* แพ็คเกจ Section */}
          {filteredPackages.length > 0 && (
            <div
              ref={(el) => { sectionRefs.current["package"] = el; }}
              className="mb-8"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">แพ็คเกจ</h2>
              <div className="space-y-3">
                {filteredPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-white shadow-lg"
                  >
                    <div className="flex gap-4">
                      {pkg.imageUrl ? (
                        <img
                          src={pkg.imageUrl}
                          alt={pkg.name}
                          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-3xl">📦</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg">{pkg.name}</h3>
                        {pkg.description && (
                          <p className="text-white/80 text-sm line-clamp-2">{pkg.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-white/20 px-2 py-1 rounded-lg text-sm">
                            ซื้อ {pkg.requiredItems} ชิ้น
                          </span>
                          <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-sm font-bold">
                            {pkg.discountType === "percent" 
                              ? `ลด ${pkg.discountValue}%` 
                              : `ลด ฿${pkg.discountValue}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* โปรโมชั่น Section */}
          {filteredPromotions.length > 0 && (
            <div
              ref={(el) => { sectionRefs.current["promotion"] = el; }}
              className="mb-8"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">โปรโมชั่น</h2>
              <div className="space-y-3">
                {filteredPromotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-lg"
                  >
                    <div className="flex gap-4">
                      {promo.imageUrl ? (
                        <img
                          src={promo.imageUrl}
                          alt={promo.name}
                          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-3xl">🎉</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg">{promo.name}</h3>
                        {promo.description && (
                          <p className="text-white/80 text-sm line-clamp-2">{promo.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-white/20 px-2 py-1 rounded-lg text-sm capitalize">
                            {promo.type === "discount" ? "ส่วนลด" : promo.type === "bundle" ? "ชุดสุดคุ้ม" : "ของแถม"}
                          </span>
                          {promo.discountValue && (
                            <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-sm font-bold">
                              {promo.discountType === "percent" 
                                ? `ลด ${promo.discountValue}%` 
                                : `ลด ฿${promo.discountValue}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* คนสั่งเยอะ Section - Show foods with badge "bestseller" */}
          {bestsellerFoods.length > 0 && (
            <div
              ref={(el) => { sectionRefs.current["bestseller"] = el; }}
              className="mb-8"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">คนสั่งเยอะ</h2>
              <div className="grid grid-cols-2 gap-4">
                {bestsellerFoods.map((food) => {
                  const quantity = getQuantity(food.id);
                  return (
                    <div key={food.id} className="group">
                      <div 
                        className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => openFoodDetail(food)}
                      >
                        {food.imageUrl ? (
                          <img src={food.imageUrl} alt={food.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                            <span className="text-4xl">🍽️</span>
                          </div>
                        )}
                        {/* Bestseller Badge */}
                        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                          🔥 ขายดี
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-sm font-medium text-gray-900 truncate mb-1">{food.name}</h3>
                          <p className="text-sm font-semibold text-gray-900">฿{food.price}</p>
                        </div>

                        {quantity > 0 ? (
                          <button 
                            onClick={() => openFoodDetail(food)}
                            className="w-10 h-10 rounded-full border-2 border-green-500 text-green-500 flex items-center justify-center text-sm font-semibold"
                          >
                            {quantity}
                          </button>
                        ) : (
                          <button
                            onClick={() => openFoodDetail(food)}
                            className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm hover:bg-green-600 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Sections */}
          {categoriesWithProducts.map((category) => {
            const categoryFoods = getFoodsForCategory(category.id);
            
            return (
              <div
                key={category.id}
                ref={(el) => { sectionRefs.current[`cat-${category.id}`] = el; }}
                className="mb-8"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4">{category.name}</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {categoryFoods.map((food) => {
                    const quantity = getQuantity(food.id);
                    return (
                      <div key={food.id} className="group">
                        <div 
                          className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3 cursor-pointer active:scale-95 transition-transform"
                          onClick={() => openFoodDetail(food)}
                        >
                          {food.imageUrl ? (
                            <img src={food.imageUrl} alt={food.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                              <span className="text-4xl">🍽️</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-end justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-sm font-medium text-gray-900 truncate mb-1">{food.name}</h3>
                            <p className="text-sm font-semibold text-gray-900">฿{food.price}</p>
                          </div>

                          {quantity > 0 ? (
                            <button 
                              onClick={() => openFoodDetail(food)}
                              className="w-10 h-10 rounded-full border-2 border-green-500 text-green-500 flex items-center justify-center text-sm font-semibold"
                            >
                              {quantity}
                            </button>
                          ) : (
                            <button
                              onClick={() => openFoodDetail(food)}
                              className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm hover:bg-green-600 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Empty State - No data at all */}
          {!searchQuery && categoriesWithProducts.length === 0 && filteredPackages.length === 0 && filteredPromotions.length === 0 && bestsellerFoods.length === 0 && (
            <div className="text-center py-20">
              <span className="text-5xl">🍽️</span>
              <p className="text-gray-400 mt-4">ยังไม่มีเมนู</p>
            </div>
          )}

          {/* Empty State - Search no results */}
          {searchQuery && filteredFoods.length === 0 && filteredPackages.length === 0 && filteredPromotions.length === 0 && (
            <div className="text-center py-20">
              <span className="text-5xl">🔍</span>
              <p className="text-gray-500 mt-4">ไม่พบผลลัพธ์สำหรับ</p>
              <p className="text-gray-900 font-semibold">"{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg text-sm"
              >
                ล้างการค้นหา
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Cart Bar */}
      {totalItems > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-0 left-0 right-0 bg-green-500 text-white px-4 py-4 flex items-center justify-between shadow-lg z-40 hover:bg-green-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center text-sm font-semibold">
              {totalItems}
            </span>
            <span className="font-medium">ตะกร้าอาหาร</span>
          </div>
          <span className="text-lg font-bold">฿{totalPrice.toFixed(2)}</span>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-hidden animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">🛒 ตะกร้าอาหาร</h2>
                <p className="text-sm text-gray-500">{totalItems} รายการ</p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <span className="text-gray-500 text-sm">✕</span>
              </button>
            </div>

            {/* Cart Items */}
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-5xl">🛒</span>
                  <p className="text-gray-400 mt-4">ตะกร้าว่างเปล่า</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.food.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                        {item.food.imageUrl ? (
                          <img
                            src={item.food.imageUrl}
                            alt={item.food.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                            <span className="text-2xl">🍽️</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{item.food.name}</h3>
                        <p className="text-sm text-green-600 font-semibold">฿{item.food.price}</p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(item.food.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
                        >
                          {item.quantity === 1 ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          )}
                        </button>
                        <span className="w-6 text-center font-semibold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.food.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-green-300 hover:text-green-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right min-w-[60px]">
                        <p className="font-bold text-gray-900">฿{(item.food.price * item.quantity).toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 p-4 pb-8 bg-white">
                {/* Summary */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">รวมทั้งหมด</span>
                  <span className="text-2xl font-bold text-green-600">฿{totalPrice.toFixed(2)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    ล้างตะกร้า
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    className="flex-[2] py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "กำลังสั่งซื้อ..." : `สั่งซื้อ ฿${totalPrice.toFixed(2)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Food Detail Modal */}
      {selectedFood && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Close Button */}
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center z-10 shadow"
            >
              <span className="text-gray-500 text-sm">✕</span>
            </button>

            {/* Image Gallery */}
            <div className="relative aspect-square max-h-[50vh] bg-gray-100">
              {selectedFoodImages.length > 0 ? (
                <>
                  <img
                    src={selectedFoodImages[currentImageIndex]}
                    alt={selectedFood.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {selectedFoodImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex(i => i === 0 ? selectedFoodImages.length - 1 : i - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
                      >
                        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(i => i === selectedFoodImages.length - 1 ? 0 : i + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
                      >
                        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {selectedFoodImages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              idx === currentImageIndex ? "bg-white" : "bg-white/50"
                            }`}
                          />
                        ))}
                      </div>

                      <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 rounded-full text-white text-xs">
                        {currentImageIndex + 1} / {selectedFoodImages.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                  <span className="text-7xl">🍽️</span>
                </div>
              )}
            </div>

            {/* Nutrition Info */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="grid grid-cols-6 gap-1.5">
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <p className="text-sm font-bold text-orange-500">{selectedFood.calories}</p>
                  <p className="text-[9px] text-gray-500">แคลอรี่</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <p className="text-sm font-bold text-red-500">{selectedFood.protein}g</p>
                  <p className="text-[9px] text-gray-500">โปรตีน</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <p className="text-sm font-bold text-amber-500">{selectedFood.carbs}g</p>
                  <p className="text-[9px] text-gray-500">คาร์บ</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <p className="text-sm font-bold text-blue-500">{selectedFood.fat}g</p>
                  <p className="text-[9px] text-gray-500">ไขมัน</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <p className="text-sm font-bold text-pink-500">{selectedFood.sugar ?? 0}g</p>
                  <p className="text-[9px] text-gray-500">น้ำตาล</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <p className="text-sm font-bold text-purple-500">{selectedFood.sodium ?? 0}</p>
                  <p className="text-[9px] text-gray-500">โซเดียม</p>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">จำนวน</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                  className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-xl font-bold text-gray-900 w-8 text-center">{modalQuantity}</span>
                <button
                  onClick={() => setModalQuantity(modalQuantity + 1)}
                  className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Name & Price */}
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900 flex-1 pr-4">{selectedFood.name}</h2>
                <p className="text-xl font-bold text-green-600">฿{selectedFood.price}</p>
              </div>

              {/* Category */}
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                  {selectedFood.category?.name}
                </span>
              </div>

              {/* Description */}
              {selectedFood.description && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">รายละเอียด</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{selectedFood.description}</p>
                </div>
              )}

              {/* Ingredients */}
              {selectedFood.ingredients && selectedFood.ingredients.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">ส่วนประกอบ</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedFood.ingredients.map((ingredient, idx) => (
                      <span 
                        key={idx} 
                        className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-full"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Button */}
            <div className="sticky bottom-0 p-4 pb-8 bg-white border-t border-gray-100">
              <button
                onClick={addFromModal}
                className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg"
              >
                <span>เพิ่มลงตะกร้า</span>
                <span className="font-bold">฿{(selectedFood.price * modalQuantity).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-in fade-in zoom-in duration-200">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">สั่งซื้อสำเร็จ!</h2>
            <p className="text-gray-500 mb-6">ขอบคุณที่ใช้บริการ Good Food</p>
            <button
              onClick={handleSuccessOk}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
