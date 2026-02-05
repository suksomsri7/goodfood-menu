"use client";

import { Header } from "@/components/backoffice/Header";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  Image as ImageIcon,
  Smile,
  RefreshCw,
  MessageCircle,
  User,
  Clock,
  Check,
  CheckCheck,
  X,
  Calendar,
  Target,
  ShoppingBag,
  Utensils,
  Droplet,
  Activity,
  Scale,
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Users,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, MouseEvent as ReactMouseEvent } from "react";

interface Conversation {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
  lastMessage: Message | null;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  type: string;
  direction: string;
  content: string | null;
  stickerPackageId: string | null;
  stickerId: string | null;
  previewUrl: string | null;
  fileName: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Member {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  goalWeight: number | null;
  goalType: string | null;
  activityLevel: string | null;
  bmr: number | null;
  tdee: number | null;
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  dailyWater: number | null;
  isOnboarded: boolean;
  _count?: {
    mealLogs: number;
    orders: number;
  };
}

interface MealLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  imageUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  items: { foodName: string; quantity: number; price: number }[];
}

type UserViewTab = "cal" | "goal" | "orders";

// LINE Official Sticker packages
const STICKER_PACKS = [
  { packageId: "11537", name: "Brown & Cony", stickers: ["52002734", "52002735", "52002736", "52002737", "52002738", "52002739", "52002740", "52002741"] },
  { packageId: "11538", name: "Brown & Friends", stickers: ["51626494", "51626495", "51626496", "51626497", "51626498", "51626499", "51626500", "51626501"] },
  { packageId: "11539", name: "CHOCO & Friends", stickers: ["52114110", "52114111", "52114112", "52114113", "52114114", "52114115", "52114116", "52114117"] },
];

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: "รอดำเนินการ", color: "text-amber-700", bgColor: "bg-amber-50", icon: Clock },
  confirmed: { label: "ยืนยันแล้ว", color: "text-green-700", bgColor: "bg-green-50", icon: CheckCircle },
  preparing: { label: "รับชำระเงิน", color: "text-purple-700", bgColor: "bg-purple-50", icon: Package },
  shipping: { label: "กำลังจัดส่ง", color: "text-blue-700", bgColor: "bg-blue-50", icon: Truck },
  completed: { label: "จัดส่งเรียบร้อย", color: "text-teal-700", bgColor: "bg-teal-50", icon: CheckCircle },
  cancelled: { label: "ยกเลิก", color: "text-red-700", bgColor: "bg-red-50", icon: XCircle },
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Third column states
  const [activeUserView, setActiveUserView] = useState<UserViewTab>("cal");
  const [userData, setUserData] = useState<Member | null>(null);
  const [userMeals, setUserMeals] = useState<MealLog[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);

  // Column collapse states
  const [col1Collapsed, setCol1Collapsed] = useState(false);
  const [col3Collapsed, setCol3Collapsed] = useState(false);

  // Column resize states
  const [col1Width, setCol1Width] = useState(320);
  const [col3Width, setCol3Width] = useState(340);
  const [isResizingCol1, setIsResizingCol1] = useState(false);
  const [isResizingCol3, setIsResizingCol3] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Min/Max widths
  const COL1_MIN = 200;
  const COL1_MAX = 450;
  const COL3_MIN = 250;
  const COL3_MAX = 500;

  // Handle resize for Column 1
  const handleCol1ResizeStart = (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizingCol1(true);
  };

  // Handle resize for Column 3
  const handleCol3ResizeStart = (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizingCol3(true);
  };

  // Global mouse move and up handlers for resizing
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      
      if (isResizingCol1) {
        const newWidth = e.clientX - containerRect.left;
        setCol1Width(Math.min(COL1_MAX, Math.max(COL1_MIN, newWidth)));
        if (newWidth < 100) {
          setCol1Collapsed(true);
        } else if (col1Collapsed && newWidth > 150) {
          setCol1Collapsed(false);
        }
      }
      
      if (isResizingCol3) {
        const newWidth = containerRect.right - e.clientX;
        setCol3Width(Math.min(COL3_MAX, Math.max(COL3_MIN, newWidth)));
        if (newWidth < 100) {
          setCol3Collapsed(true);
        } else if (col3Collapsed && newWidth > 150) {
          setCol3Collapsed(false);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingCol1(false);
      setIsResizingCol3(false);
    };

    if (isResizingCol1 || isResizingCol3) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingCol1, isResizingCol3, col1Collapsed, col3Collapsed]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/line/conversations?search=${searchQuery}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/line/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        // Update unread count in local state
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, []);

  // Fetch user data for third column
  const fetchUserData = useCallback(async (lineUserId: string) => {
    setLoadingUserData(true);
    try {
      // Fetch member data
      const memberRes = await fetch(`/api/members/me?lineUserId=${lineUserId}`);
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        setUserData(memberData);
      } else {
        setUserData(null);
      }

      // Fetch today's meals
      const today = new Date().toISOString().split("T")[0];
      const tzOffset = new Date().getTimezoneOffset();
      const mealsRes = await fetch(
        `/api/meals?lineUserId=${lineUserId}&date=${today}&tzOffset=${tzOffset}`
      );
      if (mealsRes.ok) {
        const mealsData = await mealsRes.json();
        setUserMeals(mealsData);
      } else {
        setUserMeals([]);
      }

      // Fetch orders
      const ordersRes = await fetch(`/api/orders?lineUserId=${lineUserId}&limit=10`);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setUserOrders(ordersData);
      } else {
        setUserOrders([]);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoadingUserData(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-refresh conversations every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConversation) {
        fetchMessages(selectedConversation.id);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Select conversation
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    await fetchMessages(conv.id);
    await fetchUserData(conv.lineUserId);
  };

  // Send text message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/line/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", content: messageText }),
        }
      );

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        setMessageText("");
      } else {
        alert("ส่งข้อความไม่สำเร็จ");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setSending(false);
    }
  };

  // Send sticker
  const handleSendSticker = async (packageId: string, stickerId: string) => {
    if (!selectedConversation || sending) return;

    setSending(true);
    setShowStickerPicker(false);
    try {
      const res = await fetch(
        `/api/line/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "sticker", packageId, stickerId }),
        }
      );

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
      }
    } catch (error) {
      console.error("Error sending sticker:", error);
    } finally {
      setSending(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setShowImageUpload(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Send image
  const handleSendImage = async () => {
    if (!selectedImage || !selectedConversation || sending) return;

    setSending(true);
    setShowImageUpload(false);
    try {
      const res = await fetch(
        `/api/line/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "image", imageUrl: selectedImage }),
        }
      );

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        setSelectedImage(null);
      }
    } catch (error) {
      console.error("Error sending image:", error);
    } finally {
      setSending(false);
    }
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "เมื่อกี้";
    if (diffMins < 60) return `${diffMins} นาที`;
    if (diffHours < 24) return `${diffHours} ชม.`;
    if (diffDays < 7) return `${diffDays} วัน`;
    return date.toLocaleDateString("th-TH");
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get last message preview
  const getMessagePreview = (msg: Message | null) => {
    if (!msg) return "ยังไม่มีข้อความ";
    switch (msg.type) {
      case "text":
        return msg.content || "";
      case "image":
        return "📷 รูปภาพ";
      case "sticker":
        return "😊 สติกเกอร์";
      case "video":
        return "🎬 วีดีโอ";
      case "audio":
        return "🎵 เสียง";
      case "file":
        return `📎 ${msg.fileName || "ไฟล์"}`;
      default:
        return `[${msg.type}]`;
    }
  };

  // Calculate totals for calories
  const calculateTodayTotals = () => {
    return userMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  // Filtered conversations
  const filteredConversations = conversations.filter((conv) =>
    conv.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render third column content
  const renderUserViewContent = () => {
    if (loadingUserData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    switch (activeUserView) {
      case "cal":
        return renderCalView();
      case "goal":
        return renderGoalView();
      case "orders":
        return renderOrdersView();
      default:
        return null;
    }
  };

  // Render Cal View (Today's meals)
  const renderCalView = () => {
    const totals = calculateTodayTotals();
    const dailyCalories = userData?.dailyCalories || 2000;
    const caloriePercent = Math.min(100, Math.round((totals.calories / dailyCalories) * 100));

    return (
      <div className="space-y-4">
        {/* Today's Summary */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-90 mb-2">แคลอรี่วันนี้</p>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold">{Math.round(totals.calories)}</span>
              <span className="text-sm opacity-75 ml-1">/ {dailyCalories} kcal</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-semibold">{caloriePercent}%</span>
            </div>
          </div>
          <div className="mt-3 bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-500"
              style={{ width: `${caloriePercent}%` }}
            />
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-600 mb-1">โปรตีน</p>
            <p className="text-lg font-bold text-blue-700">{Math.round(totals.protein)}g</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-600 mb-1">คาร์บ</p>
            <p className="text-lg font-bold text-amber-700">{Math.round(totals.carbs)}g</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-600 mb-1">ไขมัน</p>
            <p className="text-lg font-bold text-rose-700">{Math.round(totals.fat)}g</p>
          </div>
        </div>

        {/* Today's Meals */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Utensils className="w-4 h-4" />
            มื้ออาหารวันนี้ ({userMeals.length})
          </h4>
          {userMeals.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Utensils className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">ยังไม่มีรายการอาหาร</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {userMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3"
                >
                  {meal.imageUrl ? (
                    <img
                      src={meal.imageUrl}
                      alt={meal.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Utensils className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{meal.name}</p>
                    <p className="text-xs text-gray-500">
                      P {Math.round(meal.protein)}g • C {Math.round(meal.carbs)}g • F {Math.round(meal.fat)}g
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{Math.round(meal.calories)}</p>
                    <p className="text-xs text-gray-400">kcal</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Goal View
  const renderGoalView = () => {
    if (!userData) {
      return (
        <div className="text-center py-8 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>ไม่พบข้อมูลผู้ใช้</p>
        </div>
      );
    }

    const goalTypeLabels: Record<string, string> = {
      lose: "ลดน้ำหนัก",
      gain: "เพิ่มน้ำหนัก",
      maintain: "รักษาน้ำหนัก",
    };

    const activityLabels: Record<string, string> = {
      sedentary: "นั่งทำงาน",
      light: "ออกกำลังเบา",
      moderate: "ออกกำลังปานกลาง",
      active: "ออกกำลังหนัก",
      very_active: "ออกกำลังหนักมาก",
    };

    return (
      <div className="space-y-4">
        {/* Profile Summary */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            {userData.pictureUrl ? (
              <img
                src={userData.pictureUrl}
                alt={userData.displayName || ""}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-7 h-7 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800">{userData.displayName || "ไม่ระบุชื่อ"}</p>
              <p className="text-sm text-gray-500">{userData.email || userData.phone || "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {userData.gender && (
              <div className="flex items-center gap-2 text-gray-600">
                <span>เพศ:</span>
                <span className="font-medium">{userData.gender === "male" ? "ชาย" : "หญิง"}</span>
              </div>
            )}
            {userData.height && (
              <div className="flex items-center gap-2 text-gray-600">
                <span>ส่วนสูง:</span>
                <span className="font-medium">{userData.height} cm</span>
              </div>
            )}
          </div>
        </div>

        {/* Weight Goal */}
        {userData.weight && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                <span className="font-medium">เป้าหมายน้ำหนัก</span>
              </div>
              {userData.goalType && (
                <span className="px-2 py-1 bg-white/20 rounded-full text-xs">
                  {goalTypeLabels[userData.goalType] || userData.goalType}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-75">ปัจจุบัน</p>
                <p className="text-2xl font-bold">{userData.weight} kg</p>
              </div>
              <div className="flex items-center gap-2">
                {userData.goalType === "lose" ? (
                  <TrendingDown className="w-6 h-6" />
                ) : userData.goalType === "gain" ? (
                  <TrendingUp className="w-6 h-6" />
                ) : (
                  <Activity className="w-6 h-6" />
                )}
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75">เป้าหมาย</p>
                <p className="text-2xl font-bold">{userData.goalWeight || "-"} kg</p>
              </div>
            </div>
          </div>
        )}

        {/* Daily Goals */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-green-600" />
            เป้าหมายรายวัน
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-600">แคลอรี่</span>
              <span className="font-semibold text-green-600">{userData.dailyCalories || "-"} kcal</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-600">โปรตีน</span>
              <span className="font-semibold text-blue-600">{userData.dailyProtein || "-"} g</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-600">คาร์โบไฮเดรต</span>
              <span className="font-semibold text-amber-600">{userData.dailyCarbs || "-"} g</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-600">ไขมัน</span>
              <span className="font-semibold text-rose-600">{userData.dailyFat || "-"} g</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 flex items-center gap-1">
                <Droplet className="w-4 h-4" />
                น้ำ
              </span>
              <span className="font-semibold text-cyan-600">{userData.dailyWater || "-"} ml</span>
            </div>
          </div>
        </div>

        {/* Activity & TDEE */}
        {(userData.activityLevel || userData.tdee) && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-700 mb-2">ข้อมูลเพิ่มเติม</h4>
            {userData.activityLevel && (
              <p className="text-sm text-gray-600">
                กิจกรรม: <span className="font-medium">{activityLabels[userData.activityLevel] || userData.activityLevel}</span>
              </p>
            )}
            {userData.bmr && (
              <p className="text-sm text-gray-600">
                BMR: <span className="font-medium">{Math.round(userData.bmr)} kcal</span>
              </p>
            )}
            {userData.tdee && (
              <p className="text-sm text-gray-600">
                TDEE: <span className="font-medium">{Math.round(userData.tdee)} kcal</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Orders View
  const renderOrdersView = () => {
    if (userOrders.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>ยังไม่มีรายการสั่งซื้อ</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {userOrders.map((order) => {
          const config = statusConfig[order.status] || statusConfig.pending;
          const StatusIcon = config.icon;

          return (
            <div
              key={order.id}
              className="bg-white rounded-xl p-4 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-semibold text-green-600 text-sm">
                  #{order.orderNumber}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.bgColor} ${config.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {order.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1">
                      {item.foodName} x{item.quantity}
                    </span>
                    <span className="text-gray-800 ml-2">฿{item.price}</span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-gray-400">
                    +{order.items.length - 3} รายการเพิ่มเติม
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
                <span className="font-semibold text-green-600">฿{order.totalPrice.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <Header title="แชท LINE" subtitle="ตอบข้อความจาก LINE Official Account" />

      <div ref={containerRef} className="h-[calc(100vh-72px)] flex relative">
        {/* Column 1: Conversation List */}
        <div 
          className="border-r border-gray-100 bg-white flex flex-col flex-shrink-0"
          style={{ width: col1Collapsed ? 64 : col1Width }}
        >
          {/* Header with collapse button */}
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            {!col1Collapsed && (
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                รายชื่อ
              </span>
            )}
            <button
              onClick={() => setCol1Collapsed(!col1Collapsed)}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 ${col1Collapsed ? 'mx-auto' : ''}`}
              title={col1Collapsed ? "ขยาย" : "ย่อ"}
            >
              {col1Collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>

          {/* Search & Refresh - Hidden when collapsed */}
          {!col1Collapsed && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาแชท..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all"
                  />
                </div>
                <button
                  onClick={fetchConversations}
                  className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                  title="รีเฟรช"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <MessageCircle className={`mb-2 ${col1Collapsed ? 'w-6 h-6' : 'w-12 h-12'}`} />
                {!col1Collapsed && <p>ยังไม่มีข้อความ</p>}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    selectedConversation?.id === conv.id
                      ? "bg-green-50 border-l-4 border-l-green-500"
                      : ""
                  } ${col1Collapsed ? 'p-3 flex justify-center' : 'p-3 flex items-start gap-3'}`}
                  title={col1Collapsed ? conv.displayName : undefined}
                >
                  <div className="relative flex-shrink-0">
                    {conv.pictureUrl ? (
                      <img
                        src={conv.pictureUrl}
                        alt={conv.displayName}
                        className={`rounded-full object-cover ${col1Collapsed ? 'w-9 h-9' : 'w-10 h-10'}`}
                      />
                    ) : (
                      <div className={`rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-green-500/20 ${col1Collapsed ? 'w-9 h-9' : 'w-10 h-10'}`}>
                        <User className={col1Collapsed ? 'w-4 h-4' : 'w-5 h-5'} />
                      </div>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  {!col1Collapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 truncate text-sm">
                          {conv.displayName}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {conv.lastMessage?.direction === "outgoing" && (
                          <span className="text-green-600 mr-1">คุณ:</span>
                        )}
                        {getMessagePreview(conv.lastMessage)}
                      </p>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Resize Handle for Column 1 */}
        {!col1Collapsed && (
          <div
            className="w-1 hover:w-1.5 bg-transparent hover:bg-green-400 cursor-col-resize transition-all flex-shrink-0 group relative"
            onMouseDown={handleCol1ResizeStart}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Column 2: Chat Area */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col bg-[#FAFBFC] min-w-[300px]">
            {/* Chat Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedConversation.pictureUrl ? (
                  <img
                    src={selectedConversation.pictureUrl}
                    alt={selectedConversation.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-green-500/20">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {selectedConversation.displayName}
                  </h3>
                  {selectedConversation.statusMessage && (
                    <p className="text-xs text-gray-500 truncate max-w-[180px]">
                      {selectedConversation.statusMessage}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => fetchMessages(selectedConversation.id)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                title="รีเฟรช"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`flex ${
                      message.direction === "outgoing"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[280px] ${
                        message.direction === "outgoing"
                          ? "bg-green-500 text-white rounded-2xl rounded-br-md"
                          : "bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100"
                      } ${message.type === "image" ? "p-1" : "px-4 py-2.5"}`}
                    >
                      {/* Text Message */}
                      {message.type === "text" && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}

                      {/* Image Message */}
                      {message.type === "image" && message.content && (
                        <img
                          src={message.content}
                          alt="Image"
                          className="max-w-full rounded-xl cursor-pointer hover:opacity-90"
                          onClick={() => window.open(message.content!, "_blank")}
                        />
                      )}

                      {/* Sticker Message */}
                      {message.type === "sticker" && (
                        <div className="p-2">
                          <img
                            src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${message.stickerId}/iPhone/sticker.png`}
                            alt="Sticker"
                            className="w-20 h-20 object-contain"
                          />
                        </div>
                      )}

                      {/* Video/Audio/File Message */}
                      {["video", "audio", "file"].includes(message.type) && (
                        <a
                          href={message.content || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-500 hover:underline"
                        >
                          {message.type === "video" && "🎬 วีดีโอ"}
                          {message.type === "audio" && "🎵 เสียง"}
                          {message.type === "file" &&
                            `📎 ${message.fileName || "ไฟล์"}`}
                        </a>
                      )}

                      {/* Time & Status */}
                      <div
                        className={`flex items-center gap-1 mt-1 text-[10px] ${
                          message.direction === "outgoing"
                            ? "text-white/70 justify-end"
                            : "text-gray-400"
                        }`}
                      >
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {message.direction === "outgoing" && (
                          message.isRead ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
              <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                👋 สวัสดีค่ะ
              </button>
              <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                📋 ส่งเมนูแนะนำ
              </button>
              <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                🎁 ส่งโปรโมชั่น
              </button>
              <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                ✅ ขอบคุณค่ะ
              </button>
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                  title="ส่งรูปภาพ"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className={`p-2 rounded-xl transition-colors ${
                    showStickerPicker
                      ? "bg-green-100 text-green-600"
                      : "hover:bg-gray-100 text-gray-500"
                  }`}
                  title="ส่งสติกเกอร์"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    placeholder="พิมพ์ข้อความ..."
                    className="w-full px-4 py-2.5 bg-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all text-sm"
                    disabled={sending}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                  className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Sticker Picker */}
              <AnimatePresence>
                {showStickerPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-700">
                        สติกเกอร์
                      </span>
                      <button
                        onClick={() => setShowStickerPicker(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {STICKER_PACKS.map((pack) => (
                      <div key={pack.packageId} className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">{pack.name}</p>
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {pack.stickers.map((stickerId) => (
                            <button
                              key={stickerId}
                              onClick={() =>
                                handleSendSticker(pack.packageId, stickerId)
                              }
                              className="flex-shrink-0 w-14 h-14 rounded-lg hover:bg-white transition-colors p-1"
                            >
                              <img
                                src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`}
                                alt="Sticker"
                                className="w-full h-full object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          // Empty State for Chat
          <div className="flex-1 flex flex-col items-center justify-center bg-[#FAFBFC] text-gray-400">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10" />
            </div>
            <h3 className="text-base font-medium text-gray-600 mb-2">
              เลือกแชทเพื่อเริ่มสนทนา
            </h3>
            <p className="text-sm">
              เลือกรายชื่อทางด้านซ้ายเพื่อดูข้อความ
            </p>
          </div>
        )}

        {/* Resize Handle for Column 3 */}
        {selectedConversation && !col3Collapsed && (
          <div
            className="w-1 hover:w-1.5 bg-transparent hover:bg-green-400 cursor-col-resize transition-all flex-shrink-0 group relative"
            onMouseDown={handleCol3ResizeStart}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Column 3: User Data Panel */}
        {selectedConversation && (
          <div 
            className="border-l border-gray-100 bg-white flex flex-col flex-shrink-0"
            style={{ width: col3Collapsed ? 56 : col3Width }}
          >
            {/* Header with collapse button */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setCol3Collapsed(!col3Collapsed)}
                className={`p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 ${col3Collapsed ? 'mx-auto' : ''}`}
                title={col3Collapsed ? "ขยาย" : "ย่อ"}
              >
                {col3Collapsed ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
              </button>
              {!col3Collapsed && (
                <span className="text-sm font-semibold text-gray-700">
                  {userData?.displayName || "ข้อมูลลูกค้า"}
                </span>
              )}
            </div>

            {col3Collapsed ? (
              /* Collapsed: Show vertical icon buttons */
              <div className="flex-1 flex flex-col items-center py-4 gap-2">
                <button
                  onClick={() => { setActiveUserView("cal"); setCol3Collapsed(false); }}
                  className={`p-2.5 rounded-xl transition-all ${
                    activeUserView === "cal"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  title="Cal"
                >
                  <Calendar className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setActiveUserView("goal"); setCol3Collapsed(false); }}
                  className={`p-2.5 rounded-xl transition-all ${
                    activeUserView === "goal"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  title="Goal"
                >
                  <Target className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setActiveUserView("orders"); setCol3Collapsed(false); }}
                  className={`p-2.5 rounded-xl transition-all ${
                    activeUserView === "orders"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  title="Orders"
                >
                  <ShoppingBag className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                {/* Tab Bar */}
                <div className="px-3 py-3 border-b border-gray-100 flex gap-1">
                  <button
                    onClick={() => setActiveUserView("cal")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeUserView === "cal"
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Cal
                  </button>
                  <button
                    onClick={() => setActiveUserView("goal")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeUserView === "goal"
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Target className="w-4 h-4" />
                    Goal
                  </button>
                  <button
                    onClick={() => setActiveUserView("orders")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeUserView === "orders"
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Orders
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {renderUserViewContent()}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImageUpload && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => {
              setShowImageUpload(false);
              setSelectedImage(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">ส่งรูปภาพ</h3>
              <img
                src={selectedImage}
                alt="Preview"
                className="w-full max-h-[400px] object-contain rounded-xl mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImageUpload(false);
                    setSelectedImage(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSendImage}
                  disabled={sending}
                  className="flex-1 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50"
                >
                  {sending ? "กำลังส่ง..." : "ส่งรูปภาพ"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
