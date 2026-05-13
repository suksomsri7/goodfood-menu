"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X, RefreshCw, Check } from "lucide-react";

type AspectRatio = "16:9" | "3:2" | "1:1" | "4:5";

interface ModelOption {
  id: string;
  label: string;
  blurb: string;
  price: string;
}

interface GenerateCoverModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: (dataUrl: string) => void;
  article: {
    title: string;
    excerpt?: string | null;
    focusKeyword?: string | null;
    categorySlug?: string | null;
  };
}

export function GenerateCoverModal({ open, onClose, onAccept, article }: GenerateCoverModalProps) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [aspect, setAspect] = useState<AspectRatio>("3:2");
  const [prompt, setPrompt] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "preview-loading" | "ready" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string>("");
  const lastArticleKey = useRef("");

  // Load models on first open
  useEffect(() => {
    if (!open || models.length > 0) return;
    fetch("/api/articles/generate-cover")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) {
          setModels(d.models);
          setModelId(d.defaultModel || d.models[0]?.id || "");
          setAspect(d.defaultAspect || "3:2");
        }
      })
      .catch(() => {});
  }, [open, models.length]);

  // Auto-resolve prompt when article changes or modal opens
  useEffect(() => {
    if (!open) return;
    const key = JSON.stringify(article);
    if (key === lastArticleKey.current && prompt) return;
    lastArticleKey.current = key;
    setPhase("preview-loading");
    fetch("/api/articles/generate-cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...article, previewOnly: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.prompt) {
          setPrompt(d.prompt);
          setPhase("ready");
        } else {
          setError(d.error || "Failed to build prompt");
          setPhase("error");
        }
      })
      .catch((e) => {
        setError(String(e));
        setPhase("error");
      });
  }, [open, article, prompt]);

  // Reset when closed
  useEffect(() => {
    if (open) return;
    setResultUrl(null);
    setError("");
    setPhase("idle");
  }, [open]);

  const handleGenerate = async () => {
    if (!modelId || !prompt) return;
    setPhase("generating");
    setError("");
    try {
      const res = await fetch("/api/articles/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...article,
          model: modelId,
          aspectRatio: aspect,
          prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Failed (${res.status})`);
        setPhase("error");
        return;
      }
      setResultUrl(data.dataUrl);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const handleAccept = () => {
    if (resultUrl) {
      onAccept(resultUrl);
      onClose();
    }
  };

  if (!open) return null;

  const generating = phase === "generating";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">สร้างภาพปกด้วย AI</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" disabled={generating}>
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Preview area */}
          <div className="aspect-[3/2] bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
            {resultUrl ? (
              <img src={resultUrl} alt="generated" className="w-full h-full object-cover" />
            ) : generating ? (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                <p className="text-sm">กำลังสร้างภาพ ~15-30 วินาที...</p>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">กดปุ่ม "✨ สร้างภาพ" เพื่อเริ่ม</div>
            )}
          </div>

          {/* Model picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือก AI Model</label>
            <div className="grid grid-cols-2 gap-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  disabled={generating}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    modelId === m.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{m.label}</span>
                    <span className="text-xs text-gray-500">{m.price}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{m.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">สัดส่วน</label>
            <div className="flex gap-2">
              {(["3:2", "16:9", "1:1", "4:5"] as AspectRatio[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  disabled={generating}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    aspect === a
                      ? "border-amber-500 bg-amber-50 text-amber-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {a}
                </button>
              ))}
              <span className="text-xs text-gray-400 self-center ml-2">
                แนะนำ 3:2 สำหรับ cover (1200×800)
              </span>
            </div>
          </div>

          {/* Prompt — editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt (แก้ได้ — AI สร้างให้แล้วจากชื่อ + คำอธิบาย)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={generating}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={phase === "preview-loading" ? "กำลังสร้าง prompt..." : ""}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            ยกเลิก
          </button>
          <div className="flex items-center gap-2">
            {resultUrl && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-sm text-gray-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> ลองใหม่
              </button>
            )}
            {resultUrl ? (
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> ใช้ภาพนี้
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating || !modelId || !prompt}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                สร้างภาพ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
