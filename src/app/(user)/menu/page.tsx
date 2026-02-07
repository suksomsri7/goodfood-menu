"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { closeWindow } from "@/lib/liff";

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
  _count: {
    foods: number;
    packages: number;
  };
}

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
  foods?: Food[];
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  days: number;
  mealsPerDay: number;
  requiredItems: number;
  price: number;
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

interface Address {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  address: string;
  subDistrict: string | null;
  district: string | null;
  province: string;
  postalCode: string;
  note: string | null;
  isDefault: boolean;
}

export default function MenuPage() {
  const { profile, isReady, isLoggedIn } = useLiff();
  
  // Restaurant state
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  
  const [foods, setFoods] = useState<Food[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restaurantsLoaded, setRestaurantsLoaded] = useState(false);
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
  
  // Package modal state
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isAiSelecting, setIsAiSelecting] = useState(false);
  const [aiSelectedFoods, setAiSelectedFoods] = useState<(Food & { quantity: number })[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [showAiResult, setShowAiResult] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: "",
    name: "",
    phone: "",
    address: "",
    subDistrict: "",
    district: "",
    province: "",
    postalCode: "",
    note: "",
    isDefault: false,
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Refs for scrolling
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const lineUserId = profile?.userId;

  // Fetch cart from API (for specific restaurant)
  const fetchCart = useCallback(async (restaurantId?: string) => {
    if (!lineUserId) return;

    try {
      const url = restaurantId 
        ? `/api/cart?lineUserId=${lineUserId}&restaurantId=${restaurantId}`
        : `/api/cart?lineUserId=${lineUserId}`;
      const res = await fetch(url);
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

  // Fetch addresses from API
  const fetchAddresses = useCallback(async () => {
    if (!lineUserId) return;

    try {
      const res = await fetch(`/api/addresses?lineUserId=${lineUserId}`);
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
        // Auto-select default address
        const defaultAddr = data.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr);
        } else if (data.length > 0) {
          setSelectedAddress(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch addresses:", error);
    }
  }, [lineUserId]);

  // Set page title
  useEffect(() => {
    document.title = selectedRestaurant ? selectedRestaurant.name : "เลือกร้านอาหาร";
  }, [selectedRestaurant]);

  // Fetch restaurants list
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'menu/page.tsx:useEffect',message:'fetchRestaurants START',data:{isLoading,restaurantsLoaded,restaurantsLen:restaurants.length},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
    // #endregion
    const fetchRestaurants = async () => {
      try {
        const res = await fetch("/api/restaurants?active=true");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'menu/page.tsx:fetchRestaurants',message:'API response received',data:{status:res.status,ok:res.ok},timestamp:Date.now(),hypothesisId:'H2-H3'})}).catch(()=>{});
        // #endregion
        const data = await res.json();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'menu/page.tsx:fetchRestaurants',message:'API data parsed',data:{isArray:Array.isArray(data),dataLength:Array.isArray(data)?data.length:'N/A',dataKeys:typeof data==='object'&&data?Object.keys(data):null,firstItem:Array.isArray(data)&&data[0]?{id:data[0].id,name:data[0].name}:null},timestamp:Date.now(),hypothesisId:'H2-H3'})}).catch(()=>{});
        // #endregion
        setRestaurants(Array.isArray(data) ? data : []);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'menu/page.tsx:fetchRestaurants',message:'CATCH error',data:{error:String(error)},timestamp:Date.now(),hypothesisId:'H2-H3'})}).catch(()=>{});
        // #endregion
        console.error("Error:", error);
      } finally {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'menu/page.tsx:fetchRestaurants',message:'FINALLY - setting restaurantsLoaded=true',data:{},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
        // #endregion
        setIsLoading(false);
        setRestaurantsLoaded(true);
      }
    };
    fetchRestaurants();
  }, []);

  // Fetch restaurant data when selected
  const fetchRestaurantData = async (restaurantId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}`);
      const data = await res.json();
      
      // Extract foods from categories
      const allFoods: Food[] = [];
      if (data.categories) {
        data.categories.forEach((cat: Category) => {
          if (cat.foods) {
            cat.foods.forEach((food: Food) => {
              allFoods.push({ ...food, category: { id: cat.id, name: cat.name } });
            });
          }
        });
      }
      
      setCategories(data.categories || []);
      setFoods(allFoods);
      setPackages(data.packages || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Select restaurant handler
  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setCart([]); // Clear local cart first
    fetchRestaurantData(restaurant.id);
    // Fetch cart for this restaurant
    if (lineUserId) {
      fetchCart(restaurant.id);
    }
  };

  // Back to restaurant list
  const handleBackToRestaurants = () => {
    setSelectedRestaurant(null);
    setCart([]);
    setFoods([]);
    setCategories([]);
    setPackages([]);
    setActiveTab("");
  };

  // Fetch cart when user is logged in and restaurant is selected
  useEffect(() => {
    if (isReady && lineUserId && selectedRestaurant) {
      fetchCart(selectedRestaurant.id);
    }
  }, [isReady, lineUserId, selectedRestaurant, fetchCart]);

  // Fetch addresses when user is logged in
  useEffect(() => {
    if (isReady && lineUserId) {
      fetchAddresses();
    }
  }, [isReady, lineUserId, fetchAddresses]);

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
    if (lineUserId && selectedRestaurant) {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId,
            foodId: food.id,
            quantity,
            restaurantId: selectedRestaurant.id,
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
    if (lineUserId && selectedRestaurant) {
      try {
        await fetch(`/api/cart?lineUserId=${lineUserId}&restaurantId=${selectedRestaurant.id}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to clear cart:", error);
      }
    }
  };

  // Open address selection modal (before checkout)
  const handleProceedToCheckout = () => {
    if (cart.length === 0 || !selectedRestaurant) return;
    setShowCart(false);
    setShowAddressModal(true);
  };

  // Save address
  const handleSaveAddress = async () => {
    if (!addressForm.name || !addressForm.phone || !addressForm.address || !addressForm.province || !addressForm.postalCode) {
      alert("กรุณากรอกข้อมูลที่จำเป็น");
      return;
    }

    setIsSavingAddress(true);
    try {
      const method = editingAddress ? "PATCH" : "POST";
      const body = {
        lineUserId,
        ...(editingAddress ? { id: editingAddress.id } : {}),
        ...addressForm,
      };

      const res = await fetch("/api/addresses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const savedAddress = await res.json();
        await fetchAddresses();
        setSelectedAddress(savedAddress);
        setShowAddressForm(false);
        setEditingAddress(null);
        resetAddressForm();
      } else {
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } catch (error) {
      console.error("Failed to save address:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Delete address
  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("ต้องการลบที่อยู่นี้หรือไม่?")) return;

    try {
      const res = await fetch(`/api/addresses?id=${addressId}&lineUserId=${lineUserId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchAddresses();
        if (selectedAddress?.id === addressId) {
          setSelectedAddress(addresses.find(a => a.id !== addressId) || null);
        }
      }
    } catch (error) {
      console.error("Failed to delete address:", error);
    }
  };

  // Edit address
  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label || "",
      name: address.name,
      phone: address.phone,
      address: address.address,
      subDistrict: address.subDistrict || "",
      district: address.district || "",
      province: address.province,
      postalCode: address.postalCode,
      note: address.note || "",
      isDefault: address.isDefault,
    });
    setShowAddressForm(true);
  };

  // Reset address form
  const resetAddressForm = () => {
    setAddressForm({
      label: "",
      name: "",
      phone: "",
      address: "",
      subDistrict: "",
      district: "",
      province: "",
      postalCode: "",
      note: "",
      isDefault: false,
    });
    setEditingAddress(null);
  };

  // Open add new address form
  const handleAddNewAddress = () => {
    resetAddressForm();
    // Pre-fill name and phone from profile if available
    if (profile?.displayName) {
      setAddressForm(prev => ({ ...prev, name: profile.displayName || "" }));
    }
    setShowAddressForm(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedRestaurant || !selectedAddress) return;

    setIsSubmitting(true);
    try {
      const deliveryFee = selectedRestaurant.deliveryFee || 0;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          restaurantId: selectedRestaurant.id,
          addressId: selectedAddress.id,
          coursePlan: "single",
          totalDays: 1,
          totalPrice,
          deliveryFee,
          discount: packageDiscount,
          discountType: activePackage?.discountType || null,
          discountValue: activePackage?.discountValue || null,
          packageName: activePackage?.name || null,
          finalPrice: finalPrice + deliveryFee,
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
        setShowAddressModal(false);
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
  
  // Find the best applicable package based on cart quantity
  const bestApplicablePackage = (() => {
    // Get all packages where totalItems >= requiredItems
    const eligiblePackages = packages.filter(pkg => totalItems >= pkg.requiredItems);
    
    if (eligiblePackages.length === 0) return null;
    
    // Sort by discount value (highest first) and requiredItems (highest first for same discount)
    // This ensures we get the best deal
    return eligiblePackages.sort((a, b) => {
      // Calculate actual discount amount for comparison
      const discountA = a.discountType === "percent" 
        ? totalPrice * (a.discountValue / 100) 
        : a.discountValue;
      const discountB = b.discountType === "percent" 
        ? totalPrice * (b.discountValue / 100) 
        : b.discountValue;
      return discountB - discountA;
    })[0];
  })();
  
  // Find the next package to unlock (for showing "add X more" message)
  const nextPackageToUnlock = (() => {
    const lockedPackages = packages.filter(pkg => totalItems < pkg.requiredItems);
    if (lockedPackages.length === 0) return null;
    // Get the one with lowest requiredItems (closest to unlock)
    return lockedPackages.sort((a, b) => a.requiredItems - b.requiredItems)[0];
  })();
  
  // Calculate package discount
  const activePackage = bestApplicablePackage;
  const packageDiscount = (() => {
    if (!activePackage) return 0;
    
    if (activePackage.discountType === "percent") {
      return Math.round(totalPrice * (activePackage.discountValue / 100));
    } else {
      return activePackage.discountValue;
    }
  })();
  
  const finalPrice = totalPrice - packageDiscount;
  const isPackageEligible = activePackage !== null;

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

  // Open package detail modal
  const openPackageDetail = (pkg: Package) => {
    setSelectedPackage(pkg);
    setAiSelectedFoods([]);
    setAiRecommendation("");
    setShowAiResult(false);
  };

  // Close package modal
  const closePackageModal = () => {
    setSelectedPackage(null);
    setAiSelectedFoods([]);
    setAiRecommendation("");
    setShowAiResult(false);
  };

  // Handle AI select foods
  const handleAiSelectFoods = async () => {
    if (!selectedPackage) return;

    setIsAiSelecting(true);
    try {
      // Get user goals if logged in
      let userGoals = null;
      if (lineUserId) {
        const memberRes = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          userGoals = {
            dailyCalories: memberData.dailyCalories,
            dailyProtein: memberData.dailyProtein,
            dailyCarbs: memberData.dailyCarbs,
            dailyFat: memberData.dailyFat,
          };
        }
      }

      const res = await fetch("/api/ai-select-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foods: foods.map(f => ({
            id: f.id,
            name: f.name,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            price: f.price,
          })),
          requiredItems: selectedPackage.requiredItems,
          packageName: selectedPackage.name,
          userGoals,
          lineUserId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Map back to full Food objects
        const selectedWithFullData = data.selectedFoods.map((sf: { id: string; quantity: number }) => {
          const fullFood = foods.find(f => f.id === sf.id);
          return fullFood ? { ...fullFood, quantity: sf.quantity } : null;
        }).filter(Boolean);
        
        setAiSelectedFoods(selectedWithFullData);
        setAiRecommendation(data.recommendation || "");
        setShowAiResult(true);
      }
    } catch (error) {
      console.error("AI selection failed:", error);
    } finally {
      setIsAiSelecting(false);
    }
  };

  // Add AI selected foods to cart
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addingProgress, setAddingProgress] = useState({ current: 0, total: 0, currentFood: "" });
  
  const addAiSelectedToCart = async () => {
    if (isAddingToCart) return;
    
    setIsAddingToCart(true);
    const total = aiSelectedFoods.length;
    
    for (let i = 0; i < aiSelectedFoods.length; i++) {
      const food = aiSelectedFoods[i];
      setAddingProgress({ current: i + 1, total, currentFood: food.name });
      await addToCart(food, food.quantity);
    }
    
    closePackageModal();
    setIsAddingToCart(false);
    setAddingProgress({ current: 0, total: 0, currentFood: "" });
  };

  // Handle manual selection - close package modal and let user browse
  const handleManualSelection = () => {
    closePackageModal();
    // Scroll to first category
    if (categoriesWithProducts.length > 0) {
      scrollToSection(`cat-${categoriesWithProducts[0].id}`);
    }
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

  // ==================== Restaurant Selection View ====================
  if (!selectedRestaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
        {/* #region agent log */}
        <div className="bg-yellow-100 p-2 text-xs font-mono border-b border-yellow-300">
          v3 | loaded={String(restaurantsLoaded)} | count={restaurants.length} | loading={String(isLoading)}
        </div>
        {/* #endregion */}
        {/* Restaurant List */}
        <div className="p-4 pt-6">
          {!restaurantsLoaded ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-5xl">🏪</span>
              <p className="text-gray-500 mt-4">ยังไม่มีร้านอาหาร</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {restaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => handleSelectRestaurant(restaurant)}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform"
                >
                  {/* Cover */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-400 to-green-500 relative">
                    {restaurant.coverUrl ? (
                      <img src={restaurant.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl opacity-50">🍽️</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Name */}
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{restaurant.name}</h3>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== Menu View (after selecting restaurant) ====================
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
          {/* Back Button */}
          <button onClick={handleBackToRestaurants} className="flex-shrink-0 p-1">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Restaurant Name */}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{selectedRestaurant.name}</h2>
          </div>

          {/* Search Button */}
          <button onClick={() => setShowSearch(!showSearch)} className="flex-shrink-0 p-1">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-4 pb-2 gap-3 overflow-x-auto no-scrollbar">
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
                    onClick={() => openPackageDetail(pkg)}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-white shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
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
          className="fixed bottom-16 left-0 right-0 bg-green-500 text-white px-4 py-4 flex items-center justify-between shadow-lg z-40 hover:bg-green-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center text-sm font-semibold">
              {totalItems}
            </span>
            <span className="font-medium">ตะกร้าอาหาร</span>
            {isPackageEligible && packageDiscount > 0 && (
              <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                -{activePackage?.discountType === "percent" ? `${activePackage?.discountValue}%` : `฿${packageDiscount}`}
              </span>
            )}
          </div>
          <div className="text-right">
            {isPackageEligible && packageDiscount > 0 && (
              <span className="text-xs text-green-200 line-through mr-1">฿{totalPrice.toFixed(0)}</span>
            )}
            <span className="text-lg font-bold">฿{finalPrice.toFixed(2)}</span>
          </div>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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
            <div className="overflow-y-auto flex-1 min-h-0 p-4">
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
              <div className="border-t border-gray-100 p-4 pb-8 bg-white flex-shrink-0 max-h-[45vh] overflow-y-auto">
                {/* Package Discount Info */}
                {(activePackage || nextPackageToUnlock) && (
                  <div className="mb-4 space-y-2">
                    {/* Current active package discount */}
                    {activePackage && (
                      <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">🎉</span>
                          <span className="font-semibold text-green-700">
                            {activePackage.name}
                          </span>
                        </div>
                        <p className="text-sm text-green-600">
                          ✓ ได้รับส่วนลด {activePackage.discountType === "percent" ? `${activePackage.discountValue}%` : `฿${activePackage.discountValue}`}
                        </p>
                      </div>
                    )}
                    
                    {/* Next package to unlock */}
                    {nextPackageToUnlock && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">🎁</span>
                          <span className="font-semibold text-amber-700">
                            {nextPackageToUnlock.name}
                          </span>
                        </div>
                        <p className="text-sm text-amber-600">
                          เพิ่มอีก {nextPackageToUnlock.requiredItems - totalItems} ชิ้น เพื่อรับส่วนลด {nextPackageToUnlock.discountType === "percent" ? `${nextPackageToUnlock.discountValue}%` : `฿${nextPackageToUnlock.discountValue}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">ราคาสินค้า ({totalItems} ชิ้น)</span>
                    <span className="text-gray-700">฿{totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {isPackageEligible && packageDiscount > 0 && (
                    <div className="flex items-center justify-between text-green-600">
                      <span>ส่วนลดแพ็คเกจ</span>
                      <span>-฿{packageDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {selectedRestaurant && selectedRestaurant.deliveryFee > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">ค่าจัดส่ง</span>
                      <span className="text-gray-700">฿{selectedRestaurant.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="font-semibold text-gray-900">รวมทั้งหมด</span>
                    <div className="text-right">
                      {isPackageEligible && packageDiscount > 0 && (
                        <span className="text-sm text-gray-400 line-through mr-2">฿{totalPrice.toFixed(2)}</span>
                      )}
                      <span className="text-2xl font-bold text-green-600">฿{(finalPrice + (selectedRestaurant?.deliveryFee || 0)).toFixed(2)}</span>
                    </div>
                  </div>
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
                    onClick={handleProceedToCheckout}
                    className="flex-[2] py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors"
                  >
                    ดำเนินการสั่งซื้อ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Food Detail Modal */}
      {selectedFood && (
        <div className="fixed inset-0 z-[60]">
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

      {/* Address Selection Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" onClick={() => !showAddressForm && setShowAddressModal(false)} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {!showAddressForm ? (
              <>
                {/* Header */}
                <div className="px-4 pb-3 border-b border-gray-100 flex-shrink-0">
                  <h2 className="text-lg font-bold text-gray-900">📍 เลือกที่อยู่จัดส่ง</h2>
                </div>

                {/* Address List */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {addresses.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-5xl">📍</span>
                      <p className="text-gray-500 mt-4">ยังไม่มีที่อยู่จัดส่ง</p>
                      <button
                        onClick={handleAddNewAddress}
                        className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg font-medium"
                      >
                        เพิ่มที่อยู่ใหม่
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddress(addr)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            selectedAddress?.id === addr.id
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedAddress?.id === addr.id
                                  ? "border-green-500 bg-green-500"
                                  : "border-gray-300"
                              }`}>
                                {selectedAddress?.id === addr.id && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <span className="font-semibold text-gray-900">
                                {addr.label || "ที่อยู่"}
                                {addr.isDefault && (
                                  <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                    ค่าเริ่มต้น
                                  </span>
                                )}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAddress(addr);
                              }}
                              className="text-sm text-green-600 hover:text-green-700"
                            >
                              แก้ไข
                            </button>
                          </div>
                          
                          <div className="mt-2 pl-7">
                            <p className="text-gray-900">{addr.name}</p>
                            <p className="text-sm text-gray-500">📞 {addr.phone}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {addr.address}
                              {addr.subDistrict && ` แขวง/ตำบล ${addr.subDistrict}`}
                              {addr.district && ` เขต/อำเภอ ${addr.district}`}
                              {` ${addr.province} ${addr.postalCode}`}
                            </p>
                            {addr.note && (
                              <p className="text-xs text-gray-400 mt-1">📝 {addr.note}</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add new address button */}
                      <button
                        onClick={handleAddNewAddress}
                        className="w-full p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="text-xl">➕</span>
                        <span>เพิ่มที่อยู่ใหม่</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {addresses.length > 0 && (
                  <div className="border-t border-gray-100 p-4 bg-white flex-shrink-0">
                    {/* Summary */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">ราคาสินค้า ({totalItems} ชิ้น)</span>
                        <span>฿{totalPrice.toFixed(2)}</span>
                      </div>
                      {packageDiscount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>ส่วนลดแพ็คเกจ</span>
                          <span>-฿{packageDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedRestaurant && selectedRestaurant.deliveryFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">ค่าจัดส่ง</span>
                          <span>฿{selectedRestaurant.deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">รวมทั้งหมด</span>
                        <span className="text-xl font-bold text-green-600">
                          ฿{(finalPrice + (selectedRestaurant?.deliveryFee || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowAddressModal(false);
                          setShowCart(true);
                        }}
                        className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium"
                      >
                        ย้อนกลับ
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={!selectedAddress || isSubmitting}
                        className="flex-[2] py-3 bg-green-500 text-white rounded-xl font-semibold disabled:opacity-50"
                      >
                        {isSubmitting ? "กำลังสั่งซื้อ..." : "ยืนยันสั่งซื้อ"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Address Form */
              <>
                {/* Header */}
                <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingAddress ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddressForm(false);
                      resetAddressForm();
                    }}
                    className="text-gray-500"
                  >
                    ✕
                  </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อผู้รับ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addressForm.name}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="ชื่อ-นามสกุล"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="08X-XXX-XXXX"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                      />
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ที่อยู่ (บ้านเลขที่ ซอย ถนน) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={addressForm.address}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="123/45 ซ.สุขุมวิท 55 ถ.สุขุมวิท"
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 resize-none"
                      />
                    </div>

                    {/* Sub-district & District */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          แขวง/ตำบล
                        </label>
                        <input
                          type="text"
                          value={addressForm.subDistrict}
                          onChange={(e) => setAddressForm(prev => ({ ...prev, subDistrict: e.target.value }))}
                          placeholder="คลองตัน"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เขต/อำเภอ
                        </label>
                        <input
                          type="text"
                          value={addressForm.district}
                          onChange={(e) => setAddressForm(prev => ({ ...prev, district: e.target.value }))}
                          placeholder="วัฒนา"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                        />
                      </div>
                    </div>

                    {/* Province & Postal Code */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          จังหวัด <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={addressForm.province}
                          onChange={(e) => setAddressForm(prev => ({ ...prev, province: e.target.value }))}
                          placeholder="กรุงเทพฯ"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          รหัสไปรษณีย์ <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={addressForm.postalCode}
                          onChange={(e) => setAddressForm(prev => ({ ...prev, postalCode: e.target.value }))}
                          placeholder="10110"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                        />
                      </div>
                    </div>

                    {/* Label */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อที่อยู่ (ไม่บังคับ)
                      </label>
                      <input
                        type="text"
                        value={addressForm.label}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                        placeholder="เช่น บ้าน, ที่ทำงาน, คอนโด"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">💡 ช่วยให้เลือกที่อยู่ได้ง่ายขึ้น</p>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ/จุดสังเกต
                      </label>
                      <input
                        type="text"
                        value={addressForm.note}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, note: e.target.value }))}
                        placeholder="เช่น ตึกสีฟ้า, ตรงข้าม 7-11"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                      />
                    </div>

                    {/* Set as default */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressForm.isDefault}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                        className="w-5 h-5 text-green-500 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-gray-700">ตั้งเป็นที่อยู่หลัก</span>
                    </label>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4 bg-white flex-shrink-0">
                  <div className="flex gap-3">
                    {editingAddress && (
                      <button
                        onClick={() => handleDeleteAddress(editingAddress.id)}
                        className="px-4 py-3 text-red-500 border border-red-200 rounded-xl font-medium"
                      >
                        🗑️
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAddressForm(false);
                        resetAddressForm();
                      }}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSaveAddress}
                      disabled={isSavingAddress}
                      className="flex-[2] py-3 bg-green-500 text-white rounded-xl font-semibold disabled:opacity-50"
                    >
                      {isSavingAddress ? "กำลังบันทึก..." : "บันทึกที่อยู่"}
                    </button>
                  </div>
                </div>
              </>
            )}
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

      {/* Package Detail Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" onClick={closePackageModal} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Close Button */}
            <button 
              onClick={closePackageModal}
              className="absolute top-4 right-4 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center z-10 shadow"
            >
              <span className="text-gray-500 text-sm">✕</span>
            </button>

            {/* Package Header */}
            <div className="px-4 pb-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 text-white">
                <div className="flex gap-4">
                  {selectedPackage.imageUrl ? (
                    <img
                      src={selectedPackage.imageUrl}
                      alt={selectedPackage.name}
                      className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-4xl">📦</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-xl mb-1">{selectedPackage.name}</h2>
                    {selectedPackage.description && (
                      <p className="text-white/80 text-sm mb-2">{selectedPackage.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="bg-white/20 px-3 py-1 rounded-lg text-sm">
                        เลือก {selectedPackage.requiredItems} เมนู
                      </span>
                      <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-lg text-sm font-bold">
                        {selectedPackage.discountType === "percent" 
                          ? `ลด ${selectedPackage.discountValue}%` 
                          : `ลด ฿${selectedPackage.discountValue}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            {!showAiResult ? (
              // Selection Options
              <div className="px-4 pb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">เลือกวิธีการสั่งซื้อ</h3>
                
                <div className="space-y-3">
                  {/* Manual Selection Button */}
                  <button
                    onClick={handleManualSelection}
                    className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-left hover:border-green-500 hover:bg-green-50 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gray-200 group-hover:bg-green-100 flex items-center justify-center text-3xl transition-colors">
                        🛒
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">เลือกเมนูอาหารเอง</h4>
                        <p className="text-sm text-gray-500">เลือก {selectedPackage.requiredItems} เมนูตามใจชอบ</p>
                      </div>
                    </div>
                  </button>

                  {/* AI Selection Button */}
                  <button
                    onClick={handleAiSelectFoods}
                    disabled={isAiSelecting}
                    className="w-full p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 text-left hover:border-amber-400 hover:from-amber-100 hover:to-orange-100 transition-all group disabled:opacity-70"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-amber-200 group-hover:bg-amber-300 flex items-center justify-center text-3xl transition-colors">
                        {isAiSelecting ? (
                          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          "✨"
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {isAiSelecting ? "กำลังวิเคราะห์..." : "AI ช่วยเลือกให้"}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {isAiSelecting 
                            ? "กรุณารอสักครู่" 
                            : "AI จะเลือกเมนูที่เหมาะกับคุณ"}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              // AI Result
              <div className="px-4 pb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">✨ AI เลือกให้แล้ว!</h3>

                {/* AI Recommendation */}
                {aiRecommendation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-amber-800">💡 {aiRecommendation}</p>
                  </div>
                )}

                {/* Selected Foods List */}
                <div className="space-y-2 mb-4">
                  {aiSelectedFoods.map((food, index) => (
                    <div key={food.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-semibold">
                        {index + 1}
                      </span>
                      {food.imageUrl ? (
                        <img src={food.imageUrl} alt={food.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                          🍽️
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{food.name}</h4>
                        <p className="text-xs text-gray-500">
                          {food.calories} kcal • P {food.protein}g • C {food.carbs}g • F {food.fat}g
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-green-600">฿{food.price}</p>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-gray-100 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">สรุปสารอาหาร</h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div>
                      <p className="font-bold text-orange-500">
                        {aiSelectedFoods.reduce((sum, f) => sum + f.calories, 0)}
                      </p>
                      <p className="text-xs text-gray-500">แคลอรี่</p>
                    </div>
                    <div>
                      <p className="font-bold text-red-500">
                        {aiSelectedFoods.reduce((sum, f) => sum + f.protein, 0)}g
                      </p>
                      <p className="text-xs text-gray-500">โปรตีน</p>
                    </div>
                    <div>
                      <p className="font-bold text-amber-500">
                        {aiSelectedFoods.reduce((sum, f) => sum + f.carbs, 0)}g
                      </p>
                      <p className="text-xs text-gray-500">คาร์บ</p>
                    </div>
                    <div>
                      <p className="font-bold text-blue-500">
                        {aiSelectedFoods.reduce((sum, f) => sum + f.fat, 0)}g
                      </p>
                      <p className="text-xs text-gray-500">ไขมัน</p>
                    </div>
                  </div>
                </div>

                {/* Adding Progress */}
                {isAddingToCart && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium text-green-700">
                        กำลังเพิ่มลงตะกร้า ({addingProgress.current}/{addingProgress.total})
                      </span>
                    </div>
                    <p className="text-sm text-green-600 truncate">
                      🛒 {addingProgress.currentFood}
                    </p>
                    {/* Progress Bar */}
                    <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${(addingProgress.current / addingProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAiResult(false)}
                    disabled={isAddingToCart}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    เลือกใหม่
                  </button>
                  <button
                    onClick={addAiSelectedToCart}
                    disabled={isAddingToCart}
                    className="flex-[2] py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {isAddingToCart ? `กำลังเพิ่ม ${addingProgress.current}/${addingProgress.total}` : `เพิ่มลงตะกร้า ฿${aiSelectedFoods.reduce((sum, f) => sum + f.price, 0)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
