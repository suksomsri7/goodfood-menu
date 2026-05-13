"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/backoffice/Header";
import {
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SecretItem {
  key: string;
  label: string;
  description: string;
  group: "AI" | "LINE" | "Other";
  href?: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  masked: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

const GROUP_ORDER: SecretItem["group"][] = ["AI", "LINE", "Other"];
const GROUP_LABEL: Record<SecretItem["group"], string> = {
  AI: "AI Services",
  LINE: "LINE",
  Other: "อื่นๆ",
};

export default function ApiKeysPage() {
  const [items, setItems] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SecretItem | null>(null);
  const [newValue, setNewValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/backoffice/api-keys");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `โหลดไม่สำเร็จ (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(item: SecretItem) {
    setEditing(item);
    setNewValue("");
    setShowValue(false);
    setError(null);
  }

  function closeEdit() {
    setEditing(null);
    setNewValue("");
    setShowValue(false);
  }

  async function save() {
    if (!editing) return;
    if (!newValue.trim()) {
      setError("กรอกค่าให้เรียบร้อย");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editing.key, value: newValue.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `save failed (${res.status})`);
      }
      setFlash(`บันทึก ${editing.label} เรียบร้อย`);
      closeEdit();
      await fetchItems();
      setTimeout(() => setFlash(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: SecretItem) {
    if (item.source !== "db") return;
    if (!confirm(`ลบ ${item.label} ออกจากฐานข้อมูล? (ถ้า .env ยังมีค่า ระบบจะกลับไปใช้ค่าจาก .env)`)) {
      return;
    }
    try {
      const res = await fetch(`/api/backoffice/api-keys/${encodeURIComponent(item.key)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `delete failed (${res.status})`);
      }
      setFlash(`ลบ ${item.label} เรียบร้อย`);
      await fetchItems();
      setTimeout(() => setFlash(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: items.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Header
        title="API Keys"
        subtitle="จัดการ API key ของบริการภายนอก เก็บแบบ encrypted ใน DB ไม่ต้อง rebuild"
      />
      <div className="p-6 max-w-5xl mx-auto">

        {flash && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800"
          >
            <CheckCircle2 className="w-4 h-4" />
            {flash}
          </motion.div>
        )}

        {error && !editing && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ group, items: groupItems }) => (
              <section key={group} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">{GROUP_LABEL[group]}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {groupItems.map((item) => (
                    <div key={item.key} className="px-5 py-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{item.label}</span>
                          <code className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                            {item.key}
                          </code>
                          <SourceBadge source={item.source} />
                          {item.href && (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              dashboard <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                        <div className="mt-2 font-mono text-sm text-gray-700">
                          {item.hasValue ? item.masked : <span className="text-gray-400">— ยังไม่ตั้งค่า —</span>}
                        </div>
                        {item.updatedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            อัพเดตล่าสุด {new Date(item.updatedAt).toLocaleString("th-TH")}
                            {item.updatedBy && ` · โดย ${item.updatedBy}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openEdit(item)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {item.hasValue ? "เปลี่ยน" : "ตั้งค่า"}
                        </button>
                        {item.source === "db" && (
                          <button
                            onClick={() => remove(item)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            title="ลบจาก DB"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={closeEdit}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{editing.label}</h3>
                <button onClick={closeEdit} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{editing.description}</p>
              {editing.href && (
                <a
                  href={editing.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mb-3"
                >
                  ไปที่ provider dashboard <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ค่า API key
              </label>
              <div className="relative">
                <input
                  type={showValue ? "text" : "password"}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="วางค่าจาก provider ที่นี่"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowValue((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                >
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={closeEdit}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={save}
                  disabled={saving || !newValue.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึก
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceBadge({ source }: { source: SecretItem["source"] }) {
  if (source === "db") {
    return (
      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">DB</span>
    );
  }
  if (source === "env") {
    return (
      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded" title="ใช้ค่าจาก .env.production">
        .env
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">ยังไม่ตั้ง</span>
  );
}
