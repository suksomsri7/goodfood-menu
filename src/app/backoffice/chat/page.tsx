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
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

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

// LINE Official Sticker packages
const STICKER_PACKS = [
  { packageId: "11537", name: "Brown & Cony", stickers: ["52002734", "52002735", "52002736", "52002737", "52002738", "52002739", "52002740", "52002741"] },
  { packageId: "11538", name: "Brown & Friends", stickers: ["51626494", "51626495", "51626496", "51626497", "51626498", "51626499", "51626500", "51626501"] },
  { packageId: "11539", name: "CHOCO & Friends", stickers: ["52114110", "52114111", "52114112", "52114113", "52114114", "52114115", "52114116", "52114117"] },
];

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

  // Filtered conversations
  const filteredConversations = conversations.filter((conv) =>
    conv.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header title="แชท LINE" subtitle="ตอบข้อความจาก LINE Official Account" />

      <div className="h-[calc(100vh-72px)] flex">
        {/* Conversation List */}
        <div className="w-[360px] border-r border-gray-100 bg-white flex flex-col">
          {/* Search & Refresh */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาแชท..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all"
                />
              </div>
              <button
                onClick={fetchConversations}
                className="p-3 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                title="รีเฟรช"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <MessageCircle className="w-12 h-12 mb-2" />
                <p>ยังไม่มีข้อความ</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    selectedConversation?.id === conv.id
                      ? "bg-green-50 border-l-4 border-l-green-500"
                      : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {conv.pictureUrl ? (
                      <img
                        src={conv.pictureUrl}
                        alt={conv.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-green-500/20">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 truncate">
                        {conv.displayName}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {conv.lastMessage?.direction === "outgoing" && (
                        <span className="text-green-600 mr-1">คุณ:</span>
                      )}
                      {getMessagePreview(conv.lastMessage)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col bg-[#FAFBFC]">
            {/* Chat Header */}
            <div className="px-8 py-5 bg-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedConversation.pictureUrl ? (
                  <img
                    src={selectedConversation.pictureUrl}
                    alt={selectedConversation.displayName}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-green-500/20">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedConversation.displayName}
                  </h3>
                  {selectedConversation.statusMessage && (
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">
                      {selectedConversation.statusMessage}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchMessages(selectedConversation.id)}
                  className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                  title="รีเฟรช"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                      className={`max-w-md ${
                        message.direction === "outgoing"
                          ? "bg-green-500 text-white rounded-2xl rounded-br-md"
                          : "bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100"
                      } ${message.type === "image" ? "p-1" : "px-5 py-3"}`}
                    >
                      {/* Text Message */}
                      {message.type === "text" && (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
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
                            className="w-24 h-24 object-contain"
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
                        className={`flex items-center gap-1 mt-1.5 text-xs ${
                          message.direction === "outgoing"
                            ? "text-white/70 justify-end"
                            : "text-gray-400"
                        }`}
                      >
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {message.direction === "outgoing" && (
                          message.isRead ? (
                            <CheckCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
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
            <div className="px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar">
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                👋 สวัสดีค่ะ
              </button>
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                📋 ส่งเมนูแนะนำ
              </button>
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                🎁 ส่งโปรโมชั่น
              </button>
              <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                ✅ ขอบคุณค่ะ
              </button>
            </div>

            {/* Input */}
            <div className="p-5 bg-white border-t border-gray-100">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                  title="ส่งรูปภาพ"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className={`p-2.5 rounded-xl transition-colors ${
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
                    className="w-full px-5 py-3 bg-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all text-[15px]"
                    disabled={sending}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                  className="p-3.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="mt-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">
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
                      <div key={pack.packageId} className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">{pack.name}</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {pack.stickers.map((stickerId) => (
                            <button
                              key={stickerId}
                              onClick={() =>
                                handleSendSticker(pack.packageId, stickerId)
                              }
                              className="flex-shrink-0 w-16 h-16 rounded-lg hover:bg-white transition-colors p-1"
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
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center bg-[#FAFBFC] text-gray-400">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              เลือกแชทเพื่อเริ่มสนทนา
            </h3>
            <p className="text-sm">
              เลือกรายชื่อทางด้านซ้ายเพื่อดูข้อความ
            </p>
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
