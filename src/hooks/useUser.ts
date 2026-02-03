"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiff } from "@/components/providers/LiffProvider";

interface Member {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  email: string | null;
  weight: number | null;
  goalWeight: number | null;
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  dailySodium: number | null;
  dailySugar: number | null;
  dailyWater: number | null;
}

interface MealLog {
  id: string;
  name: string;
  weight: number | null;
  multiplier: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
  imageUrl: string | null;
  ingredients: string | null;
  date: string;
}

export function useUser() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMember = useCallback(async () => {
    if (!profile?.userId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/members/me?lineUserId=${profile.userId}`);
      if (res.ok) {
        const data = await res.json();
        setMember(data);
      }
    } catch (error) {
      console.error("Failed to fetch member:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.userId]);

  useEffect(() => {
    if (isReady && isLoggedIn) {
      fetchMember();
    } else if (isReady) {
      setIsLoading(false);
    }
  }, [isReady, isLoggedIn, fetchMember]);

  const updateGoals = async (goals: Partial<Member>) => {
    if (!profile?.userId) return;

    try {
      const res = await fetch("/api/members/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId,
          ...goals,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMember(data);
        return data;
      }
    } catch (error) {
      console.error("Failed to update goals:", error);
    }
  };

  return {
    lineUserId: profile?.userId || null,
    displayName: profile?.displayName || null,
    pictureUrl: profile?.pictureUrl || null,
    member,
    isLoading: !isReady || isLoading,
    isLoggedIn,
    updateGoals,
    refetch: fetchMember,
  };
}

export function useMeals(date?: Date) {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateStr = date ? date.toISOString().split("T")[0] : undefined;

  const fetchMeals = useCallback(async () => {
    if (!profile?.userId) {
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({ lineUserId: profile.userId });
      if (dateStr) params.append("date", dateStr);

      const res = await fetch(`/api/meals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMeals(data);
      }
    } catch (error) {
      console.error("Failed to fetch meals:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.userId, dateStr]);

  useEffect(() => {
    if (isReady && isLoggedIn) {
      fetchMeals();
    } else if (isReady) {
      setIsLoading(false);
    }
  }, [isReady, isLoggedIn, fetchMeals]);

  const addMeal = async (meal: Omit<MealLog, "id" | "date">) => {
    if (!profile?.userId) return null;

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId,
          ...meal,
          date: date?.toISOString() || new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const newMeal = await res.json();
        setMeals((prev) => [newMeal, ...prev]);
        return newMeal;
      }
    } catch (error) {
      console.error("Failed to add meal:", error);
    }
    return null;
  };

  const deleteMeal = async (mealId: string) => {
    try {
      const res = await fetch(`/api/meals/${mealId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMeals((prev) => prev.filter((m) => m.id !== mealId));
        return true;
      }
    } catch (error) {
      console.error("Failed to delete meal:", error);
    }
    return false;
  };

  return {
    meals,
    isLoading: !isReady || isLoading,
    addMeal,
    deleteMeal,
    refetch: fetchMeals,
  };
}

export function useWater(date?: Date) {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const dateStr = date ? date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

  const fetchWater = useCallback(async () => {
    if (!profile?.userId) {
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        lineUserId: profile.userId,
        date: dateStr,
      });

      const res = await fetch(`/api/water?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch water:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.userId, dateStr]);

  useEffect(() => {
    if (isReady && isLoggedIn) {
      fetchWater();
    } else if (isReady) {
      setIsLoading(false);
    }
  }, [isReady, isLoggedIn, fetchWater]);

  const addWater = async (amount: number) => {
    if (!profile?.userId) return false;

    try {
      const res = await fetch("/api/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId,
          amount,
          date: date?.toISOString() || new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setTotal((prev) => prev + amount);
        return true;
      }
    } catch (error) {
      console.error("Failed to add water:", error);
    }
    return false;
  };

  return {
    total,
    isLoading: !isReady || isLoading,
    addWater,
    refetch: fetchWater,
  };
}

export function useCart() {
  const { profile, isReady, isLoggedIn } = useLiff();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    if (!profile?.userId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/cart?lineUserId=${profile.userId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.userId]);

  useEffect(() => {
    if (isReady && isLoggedIn) {
      fetchCart();
    } else if (isReady) {
      setIsLoading(false);
    }
  }, [isReady, isLoggedIn, fetchCart]);

  const addToCart = async (foodId: string, quantity = 1) => {
    if (!profile?.userId) return false;

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId,
          foodId,
          quantity,
        }),
      });

      if (res.ok) {
        await fetchCart();
        return true;
      }
    } catch (error) {
      console.error("Failed to add to cart:", error);
    }
    return false;
  };

  const updateQuantity = async (foodId: string, quantity: number) => {
    if (!profile?.userId) return false;

    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId,
          foodId,
          quantity,
        }),
      });

      if (res.ok) {
        await fetchCart();
        return true;
      }
    } catch (error) {
      console.error("Failed to update cart:", error);
    }
    return false;
  };

  const clearCart = async () => {
    if (!profile?.userId) return false;

    try {
      const res = await fetch(`/api/cart?lineUserId=${profile.userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setItems([]);
        setTotal(0);
        return true;
      }
    } catch (error) {
      console.error("Failed to clear cart:", error);
    }
    return false;
  };

  return {
    items,
    total,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    isLoading: !isReady || isLoading,
    addToCart,
    updateQuantity,
    clearCart,
    refetch: fetchCart,
  };
}
