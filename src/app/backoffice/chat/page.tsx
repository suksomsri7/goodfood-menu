"use client";

import { Header } from "@/components/backoffice/Header";
import { motion } from "framer-motion";
import { Search, Send, Image, Smile, Paperclip, Video } from "lucide-react";
import { useState } from "react";

// Mock data
const conversations = [
  {
    id: "1",
    name: "สมชาย ใจดี",
    avatar: "ส",
    lastMessage: "สอบถามเรื่องโปรโมชั่นครับ",
    time: "5 นาที",
    unread: 2,
  },
  {
    id: "2",
    name: "สมหญิง รักสุขภาพ",
    avatar: "ส",
    lastMessage: "ขอบคุณค่ะ อาหารอร่อยมาก",
    time: "15 นาที",
    unread: 0,
  },
  {
    id: "3",
    name: "มานะ ตั้งใจ",
    avatar: "ม",
    lastMessage: "อยากสอบถามเรื่องแคลอรี่ครับ",
    time: "1 ชม.",
    unread: 1,
  },
  {
    id: "4",
    name: "วิภา สดใส",
    avatar: "ว",
    lastMessage: "สั่งอาหารได้ตอนไหนคะ",
    time: "2 ชม.",
    unread: 0,
  },
];

const messages = [
  {
    id: "1",
    type: "received",
    content: "สวัสดีครับ มีโปรโมชั่นอะไรบ้างครับ",
    time: "10:30",
  },
  {
    id: "2",
    type: "sent",
    content: "สวัสดีค่ะ ตอนนี้มีโปรโมชั่นสั่งครบ 500 บาท ลด 10% ค่ะ",
    time: "10:32",
  },
  {
    id: "3",
    type: "received",
    content: "แล้วมีเมนูแนะนำไหมครับ สำหรับคนที่ต้องการลดน้ำหนัก",
    time: "10:33",
  },
  {
    id: "4",
    type: "sent",
    content: "แนะนำเมนูสลัดอกไก่ค่ะ แคลอรี่ต่ำ โปรตีนสูง เหมาะกับการลดน้ำหนักเลยค่ะ",
    time: "10:35",
  },
  {
    id: "5",
    type: "received",
    content: "ดีเลยครับ ขอดูรายละเอียดเพิ่มเติมได้ไหมครับ",
    time: "10:36",
  },
];

export default function ChatPage() {
  const [selectedChat, setSelectedChat] = useState(conversations[0]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header title="แชท" subtitle="ตอบข้อความจาก LINE" />

      <div className="h-[calc(100vh-72px)] flex">
        {/* Conversation List */}
        <div className="w-[320px] border-r border-gray-100 bg-white flex flex-col">
          {/* Search */}
          <div className="p-5 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาแชท..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all tracking-wide"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedChat(conv)}
                className={`w-full p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  selectedChat.id === conv.id ? "bg-primary-50" : ""
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-primary-500/20">
                    {conv.avatar}
                  </div>
                  {conv.unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 tracking-wide">{conv.name}</span>
                    <span className="text-xs text-gray-400 tracking-wide">{conv.time}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1 leading-relaxed">{conv.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#FAFBFC]">
          {/* Chat Header */}
          <div className="px-8 py-5 bg-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-primary-500/20">
                {selectedChat.avatar}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 tracking-wide">{selectedChat.name}</h3>
                <p className="text-xs text-green-500 font-medium tracking-wide">ออนไลน์</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
                <Video className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-5">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex ${message.type === "sent" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-md px-5 py-3.5 rounded-2xl ${
                    message.type === "sent"
                      ? "bg-primary-500 text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100"
                  }`}
                >
                  <p className="text-[15px] leading-relaxed">{message.content}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.type === "sent" ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {message.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Replies */}
          <div className="px-8 py-3 flex gap-2.5 overflow-x-auto no-scrollbar">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap tracking-wide">
              📹 ส่งวีดีโอแนะนำ
            </button>
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap tracking-wide">
              📄 ส่งบทความ
            </button>
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap tracking-wide">
              🍽️ แนะนำเมนู
            </button>
          </div>

          {/* Input */}
          <div className="p-5 bg-white border-t border-gray-100">
            <div className="flex items-center gap-4">
              <button className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
                <Image className="w-5 h-5" />
              </button>
              <button className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
                <Paperclip className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="พิมพ์ข้อความ..."
                  className="w-full px-5 py-3.5 bg-gray-100 rounded-xl pr-12 focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-[15px] tracking-wide"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                  <Smile className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <button className="p-3.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
