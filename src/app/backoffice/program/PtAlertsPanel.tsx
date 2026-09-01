"use client";

/**
 * แถบ "เรื่องที่ต้องดู" ของสาย PT (WO-PT-ENGINE §7.4)
 *
 * ทำไมอยู่บนสุดของหน้าคนในโปรแกรม: เรื่องพวกนี้ (นิ่งยาว / ความพร้อมตกติดกัน / เจ็บใหม่)
 * ถ้าไม่โผล่มาเอง จะไม่มีใครไปไล่เปิดดูรายคน — คนที่กำลังจะเลิกเล่นก็เงียบหายไปเฉย ๆ
 *
 * 🔴 ไม่มีเรื่องค้าง = ไม่แสดงอะไรเลย (แถบว่างที่ขึ้นทุกวันจะถูกมองข้ามไปพร้อมกับตอนที่มีของจริง)
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

interface AlertItem {
  id: string; memberId: string; memberName: string | null;
  kind: string; kindLabel: string; subject: string; message: string;
  createdAt: string; notified: boolean; resolvedAt: string | null; resolvedBy: string | null;
}

export function PtAlertsPanel({ onOpenMember }: { onOpenMember: (m: { id: string; name: string }) => void }) {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backoffice/pt/alerts", { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      // เงียบไว้ — แถบนี้เป็นของเสริม ไม่ควรทำให้ทั้งหน้าพัง
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function resolve(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/backoffice/pt/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, resolved: true }),
      });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังตรวจเรื่องค้างของสายเทรน...
      </div>
    );
  }
  if (!items.length) return null;

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <p className="font-bold text-amber-900 flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5" /> เรื่องที่ต้องดู — สายเทรน ({items.length})
      </p>
      <div className="space-y-1.5">
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-sm text-amber-900">
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[11px] shrink-0 mt-0.5">{a.kindLabel}</span>
            <button
              onClick={() => onOpenMember({ id: a.memberId, name: a.memberName ?? "ลูกค้า" })}
              className="flex-1 text-left hover:underline"
            >
              {a.message}
            </button>
            <button
              onClick={() => resolve(a.id)}
              disabled={busy === a.id}
              title="รับเรื่องแล้ว"
              className="shrink-0 px-2 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1 text-xs"
            >
              <Check className="w-3.5 h-3.5" /> รับเรื่อง
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
