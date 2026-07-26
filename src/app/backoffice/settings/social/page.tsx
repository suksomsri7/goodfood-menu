"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/backoffice/Header";
import { Share2, Loader2, CheckCircle2, AlertCircle, Save, ExternalLink } from "lucide-react";

type Channel = {
  id: string;
  platform: string;
  name: string;
  pageId?: string | null;
  igUserId?: string | null;
  picture?: string | null;
};

type Secret = {
  key: string;
  hasValue: boolean;
  masked: string;
  source: "db" | "env" | "none";
};

const SECRET_KEYS = ["SHARK_URL", "SHARK_BRAND_ID", "SHARK_API_KEY", "SHARK_CHANNEL_IDS"] as const;

export default function SocialSettingsPage() {
  const [secrets, setSecrets] = useState<Record<string, Secret>>({});
  const [draft, setDraft] = useState({
    SHARK_URL: "https://shark.guide",
    SHARK_BRAND_ID: "",
    SHARK_API_KEY: "",
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    loadSecrets();
  }, []);

  async function loadSecrets() {
    setLoading(true);
    try {
      const res = await fetch("/api/backoffice/api-keys");
      const data = await res.json();
      const map: Record<string, Secret> = {};
      for (const item of (data.items || []) as Secret[]) {
        if ((SECRET_KEYS as readonly string[]).includes(item.key)) map[item.key] = item;
      }
      setSecrets(map);

      const next = { ...draft };
      if (map.SHARK_URL?.hasValue) next.SHARK_URL = map.SHARK_URL.masked;
      if (map.SHARK_BRAND_ID?.hasValue) next.SHARK_BRAND_ID = map.SHARK_BRAND_ID.masked;
      setDraft(next);

      // Channel IDs are not secrets — fetch raw values via dedicated endpoint
      // so the right checkboxes pre-check on reload.
      try {
        const sel = await fetch("/api/backoffice/social/channel-selection");
        if (sel.ok) {
          const { ids } = await sel.json();
          setSelectedIds(new Set(ids));
          setSavedIds(new Set(ids));
        }
      } catch {}

      // If connection looks complete, auto-load channels
      if (map.SHARK_URL?.hasValue && map.SHARK_BRAND_ID?.hasValue && map.SHARK_API_KEY?.hasValue) {
        await loadChannels();
      }
    } catch (e: any) {
      setError(e?.message || "load failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveSecret(key: string, value: string) {
    const res = await fetch("/api/backoffice/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `save ${key} failed`);
    }
  }

  async function handleConnect() {
    setError(null); setTesting(true);
    try {
      // Save provided values first (only if user typed something fresh — masked values may be placeholders)
      if (draft.SHARK_URL && !draft.SHARK_URL.includes("•")) await saveSecret("SHARK_URL", draft.SHARK_URL.trim());
      if (draft.SHARK_BRAND_ID && !draft.SHARK_BRAND_ID.includes("•")) await saveSecret("SHARK_BRAND_ID", draft.SHARK_BRAND_ID.trim());
      if (draft.SHARK_API_KEY && draft.SHARK_API_KEY.startsWith("sk_brnd_")) await saveSecret("SHARK_API_KEY", draft.SHARK_API_KEY.trim());

      const res = await fetch("/api/backoffice/social/ping");
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ping failed");
        return;
      }
      await loadChannels();
      setFlash(`เชื่อมต่อสำเร็จ พบ ${data.channelCount} channels`);
      setTimeout(() => setFlash(null), 3000);
    } catch (e: any) {
      setError(e?.message || "connect failed");
    } finally {
      setTesting(false);
    }
  }

  async function loadChannels() {
    const res = await fetch("/api/backoffice/social/channels");
    const data = await res.json();
    if (res.ok) setChannels(data.channels || []);
    else throw new Error(data.error || "load channels failed");
  }

  function toggleChannel(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function saveChannelSelection() {
    setSaving(true); setError(null);
    try {
      const csv = Array.from(selectedIds).join(",");
      await saveSecret("SHARK_CHANNEL_IDS", csv);
      setSavedIds(new Set(selectedIds));
      setFlash(`บันทึก ${selectedIds.size} channels แล้ว — บทความใหม่จะโพสต์ที่ channel เหล่านี้`);
      setTimeout(() => setFlash(null), 5000);
    } catch (e: any) {
      setError(e?.message || "save failed");
    } finally {
      setSaving(false);
    }
  }

  const isDirty = (() => {
    if (selectedIds.size !== savedIds.size) return true;
    for (const id of selectedIds) if (!savedIds.has(id)) return true;
    return false;
  })();

  const connected = secrets.SHARK_API_KEY?.hasValue && secrets.SHARK_BRAND_ID?.hasValue;

  return (
    <div>
      <Header title="เชื่อมต่อ FB/IG ผ่าน SHARK" subtitle="โพสต์บทความขึ้น Facebook / Instagram อัตโนมัติเมื่อ AI เขียนเสร็จ" />

      <div className="p-6 space-y-6 max-w-3xl">
        {flash && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4" /> {flash}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Connection */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">เชื่อมต่อ SHARK</h2>
              <p className="text-sm text-gray-500">
                ใส่ API Key ที่สร้างใน SHARK app (Settings → API Keys)
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SHARK URL</label>
              <input
                type="text"
                value={draft.SHARK_URL}
                onChange={(e) => setDraft((p) => ({ ...p, SHARK_URL: e.target.value }))}
                placeholder="https://shark.guide"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand ID</label>
              <input
                type="text"
                value={draft.SHARK_BRAND_ID}
                onChange={(e) => setDraft((p) => ({ ...p, SHARK_BRAND_ID: e.target.value }))}
                placeholder="ดูใน SHARK app — Settings → Workspace"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key {secrets.SHARK_API_KEY?.hasValue && (
                  <span className="ml-2 text-xs text-green-600">(บันทึกแล้ว — กรอกใหม่เพื่อแทนที่)</span>
                )}
              </label>
              <input
                type="password"
                value={draft.SHARK_API_KEY}
                onChange={(e) => setDraft((p) => ({ ...p, SHARK_API_KEY: e.target.value }))}
                placeholder="sk_brnd_..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={testing || (!draft.SHARK_API_KEY && !connected)}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              ทดสอบเชื่อมต่อ
            </button>
          </div>
        </div>

        {/* Channel selection */}
        {connected && channels.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">เลือก Channel ที่จะโพสต์</h2>
              <p className="text-sm text-gray-500">บทความใหม่จะถูกโพสต์ไปยัง channel ที่เลือก</p>
            </div>

            <div className="p-6 space-y-3">
              {channels.map((c) => {
                const checked = selectedIds.has(c.id);
                const isSaved = savedIds.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChannel(c.id)}
                      className="w-5 h-5"
                    />
                    {c.picture ? (
                      <img src={c.picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-800">{c.name}</div>
                        {isSaved && (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            ใช้งานอยู่
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{c.platform}</div>
                    </div>
                  </label>
                );
              })}

              <button
                onClick={saveChannelSelection}
                disabled={saving || !isDirty}
                className={`w-full px-5 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                  isDirty
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-100 text-gray-500 cursor-default"
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isDirty ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
                {saving
                  ? "กำลังบันทึก..."
                  : isDirty
                  ? `บันทึก ${selectedIds.size} channels`
                  : `บันทึกแล้ว ${savedIds.size} channels ✓`}
              </button>
            </div>
          </div>
        )}

        {!connected && !loading && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-800">วิธีสร้าง API Key:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>เปิดแอป SHARK (mobile)</li>
              <li>ไปที่ Settings → API Keys</li>
              <li>ตั้งชื่อ key เช่น &quot;GoodFood&quot; → กด Create</li>
              <li>คัดลอก key ที่ขึ้นต้น <code className="bg-white px-1 py-0.5 rounded">sk_brnd_</code></li>
              <li>วางในช่อง API Key ด้านบน แล้วกดทดสอบเชื่อมต่อ</li>
            </ol>
            <a
              href="https://shark.guide"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-2"
            >
              เปิด SHARK <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
