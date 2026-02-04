"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Loader2,
  Check,
  RotateCcw,
  Plus,
  Minus,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  servingSize?: number;
  servingUnit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
  fiber?: number;
  source?: string;
  confidence?: number;
}

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meal: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
    sugar: number;
    weight?: number;
    multiplier: number;
    ingredients?: string;
    imageUrl?: string;
  }) => void;
}

type ModalState =
  | "scanner"
  | "searching"
  | "found"
  | "not_found"
  | "photo_capture"
  | "analyzing"
  | "confirm";

export function BarcodeModal({ isOpen, onClose, onSave }: BarcodeModalProps) {
  const [state, setState] = useState<ModalState>("scanner");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");

  // Editable form data
  const [formData, setFormData] = useState<BarcodeProduct>({
    barcode: "",
    name: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sodium: 0,
    sugar: 0,
  });

  // Start camera for barcode scanning
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("ไม่สามารถเข้าถึงกล้องได้");
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Search barcode
  const searchBarcode = async (code: string) => {
    // Trim whitespace from barcode
    const trimmedCode = code.trim();
    
    if (!trimmedCode || trimmedCode.length < 8) return;
    
    setBarcode(trimmedCode);
    setState("searching");
    setError("");
    stopCamera();

    try {
      const response = await fetch(`/api/barcode/${trimmedCode}`);
      const result = await response.json();

      // API returns { source: "database"|"openfoodfacts"|"not_found", success: true|false, data: ... }
      if (result.success && result.data) {
        setProduct(result.data);
        setFormData({
          ...result.data,
          sodium: result.data.sodium || 0,
          sugar: result.data.sugar || 0,
        });
        setQuantity(1);
        setState("found");
      } else {
        setState("not_found");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("เกิดข้อผิดพลาดในการค้นหา");
      setState("not_found");
    }
  };

  // Capture photo for AI analysis
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg");
        setCapturedImage(imageData);
        stopCamera();
        setState("photo_capture");
      }
    }
  };

  // Analyze with AI
  const analyzeWithAI = async () => {
    if (!capturedImage) return;
    
    setState("analyzing");
    setError("");

    try {
      const response = await fetch("/api/barcode/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedImage,
          barcode,
        }),
      });

      const result = await response.json();

      if (result.data) {
        setFormData({
          barcode,
          name: result.data.name || "ไม่ทราบชื่อ",
          brand: result.data.brand,
          servingSize: result.data.servingSize,
          servingUnit: result.data.servingUnit,
          calories: result.data.calories || 0,
          protein: result.data.protein || 0,
          carbs: result.data.carbs || 0,
          fat: result.data.fat || 0,
          sodium: result.data.sodium || 0,
          sugar: result.data.sugar || 0,
          fiber: result.data.fiber,
          source: "ai_analysis",
          confidence: result.data.confidence,
        });
        setQuantity(1);
        setState("confirm");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("ไม่สามารถวิเคราะห์ได้ กรุณาลองใหม่");
      setState("photo_capture");
    }
  };

  // Save and add to meal
  const handleSave = async () => {
    // Save to database if new
    if (barcode && formData.source !== "database") {
      try {
        await fetch(`/api/barcode/${barcode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } catch (err) {
        console.error("Save error:", err);
      }
    }

    // Add to meal log
    onSave({
      name: formData.name,
      calories: Math.round(formData.calories * quantity),
      protein: Math.round(formData.protein * quantity),
      carbs: Math.round(formData.carbs * quantity),
      fat: Math.round(formData.fat * quantity),
      sodium: Math.round((formData.sodium || 0) * quantity),
      sugar: Math.round((formData.sugar || 0) * quantity),
      weight: formData.servingSize ? formData.servingSize * quantity : undefined,
      multiplier: quantity,
      ingredients: formData.brand ? `ยี่ห้อ: ${formData.brand}` : undefined,
      imageUrl: formData.imageUrl || capturedImage || undefined,
    });

    handleClose();
  };

  // Reset and close
  const handleClose = () => {
    stopCamera();
    setState("scanner");
    setBarcode("");
    setManualBarcode("");
    setProduct(null);
    setQuantity(1);
    setError("");
    setCapturedImage(null);
    setFormData({
      barcode: "",
      name: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sodium: 0,
      sugar: 0,
    });
    onClose();
  };

  // Go back to scanner
  const goToScanner = () => {
    setState("scanner");
    setCapturedImage(null);
    setError("");
    startCamera();
  };

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && state === "scanner") {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, state, startCamera, stopCamera]);


  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 rounded-full text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Scanner State */}
        {state === "scanner" && (
          <>
            {/* Camera view */}
            <div className="absolute inset-0">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-xl" />
                </div>
              </div>
            </div>

            {/* Bottom sheet */}
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
              
              {/* Manual input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="พิมพ์รหัส barcode..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-gray-800 placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualBarcode.length >= 8) {
                      searchBarcode(manualBarcode);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (manualBarcode.length >= 8) {
                      searchBarcode(manualBarcode);
                    }
                  }}
                  disabled={manualBarcode.length < 8}
                  className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium disabled:bg-gray-300 disabled:text-gray-500"
                >
                  ค้นหา
                </button>
              </div>
            </div>
          </>
        )}

        {/* Searching State */}
        {state === "searching" && (
          <div className="flex flex-col items-center justify-center h-full bg-white">
            <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-600">กำลังค้นหา {barcode}...</p>
          </div>
        )}

        {/* Found State */}
        {state === "found" && product && (
          <div className="flex flex-col h-full bg-white">
            {/* Product info */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{product.name}</h2>
                {product.brand && (
                  <p className="text-sm text-gray-500">{product.brand}</p>
                )}
              </div>

              {/* Nutrition info */}
              <div className="bg-orange-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-500 mb-1">แคลอรี่ต่อ serving</p>
                <p className="text-3xl font-bold text-gray-800">{product.calories} kcal</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">โปรตีน</p>
                  <p className="text-lg font-semibold">{product.protein}g</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">คาร์บ</p>
                  <p className="text-lg font-semibold">{product.carbs}g</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">ไขมัน</p>
                  <p className="text-lg font-semibold">{product.fat}g</p>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-500 mb-3">จำนวน</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                    className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-3xl font-bold text-gray-800 min-w-[60px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 0.5)}
                    className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="bg-gray-900 text-white rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">รวม</p>
                <p className="text-2xl font-bold">{Math.round(product.calories * quantity)} kcal</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 space-y-3">
              <button
                onClick={handleSave}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold"
              >
                เพิ่ม {quantity > 1 ? `${quantity} ชิ้น` : ""}
              </button>
              <button
                onClick={goToScanner}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                Scan ใหม่
              </button>
            </div>
          </div>
        )}

        {/* Not Found State */}
        {state === "not_found" && (
          <div className="flex flex-col h-full bg-white">
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่พบข้อมูล</h2>
              <p className="text-gray-500 text-center mb-6">
                Barcode: {barcode}<br />
                ไม่พบในระบบ กรุณาถ่ายรูปตารางโภชนาการ
              </p>

              <button
                onClick={() => {
                  setState("scanner");
                  startCamera();
                  setTimeout(() => setState("photo_capture"), 100);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium"
              >
                <Camera className="w-5 h-5" />
                ถ่ายรูปตารางโภชนาการ
              </button>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={goToScanner}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                Scan ใหม่
              </button>
            </div>
          </div>
        )}

        {/* Photo Capture State */}
        {state === "photo_capture" && (
          <>
            <div className="absolute inset-0">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
              
              {!capturedImage ? (
                <>
                  <p className="text-center text-gray-600 mb-4">
                    ถ่ายรูปตารางโภชนาการบนฉลาก
                  </p>
                  <button
                    onClick={capturePhoto}
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    ถ่ายรูป
                  </button>
                </>
              ) : (
                <>
                  <p className="text-center text-gray-600 mb-4">
                    กด "วิเคราะห์" เพื่อให้ AI อ่านค่าโภชนาการ
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={analyzeWithAI}
                      className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      วิเคราะห์ด้วย AI
                    </button>
                    <button
                      onClick={() => {
                        setCapturedImage(null);
                        startCamera();
                      }}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />
                      ถ่ายใหม่
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Analyzing State */}
        {state === "analyzing" && (
          <div className="flex flex-col items-center justify-center h-full bg-white">
            <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-600">AI กำลังวิเคราะห์...</p>
          </div>
        )}

        {/* Confirm State (Edit before save) */}
        {state === "confirm" && (
          <div className="flex flex-col h-full bg-white">
            <div className="flex-1 p-6 overflow-y-auto">
              <h2 className="text-lg font-bold text-center mb-4">ยืนยันข้อมูล</h2>

              {formData.confidence !== undefined && formData.confidence < 70 && (
                <div className="bg-yellow-50 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    ความมั่นใจในข้อมูล {formData.confidence}% กรุณาตรวจสอบและแก้ไขหากจำเป็น
                  </p>
                </div>
              )}

              {/* Editable form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">ชื่อสินค้า</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">ยี่ห้อ</label>
                  <input
                    type="text"
                    value={formData.brand || ""}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Serving Size</label>
                    <input
                      type="number"
                      value={formData.servingSize || ""}
                      onChange={(e) => setFormData({ ...formData, servingSize: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">หน่วย</label>
                    <input
                      type="text"
                      value={formData.servingUnit || "g"}
                      onChange={(e) => setFormData({ ...formData, servingUnit: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">แคลอรี่ (kcal)</label>
                  <input
                    type="number"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-orange-50 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">โปรตีน (g)</label>
                    <input
                      type="number"
                      value={formData.protein}
                      onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-red-50 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">คาร์บ (g)</label>
                    <input
                      type="number"
                      value={formData.carbs}
                      onChange={(e) => setFormData({ ...formData, carbs: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-yellow-50 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">ไขมัน (g)</label>
                    <input
                      type="number"
                      value={formData.fat}
                      onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-blue-50 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">โซเดียม (mg)</label>
                    <input
                      type="number"
                      value={formData.sodium || ""}
                      onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-purple-50 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">น้ำตาล (g)</label>
                    <input
                      type="number"
                      value={formData.sugar || ""}
                      onChange={(e) => setFormData({ ...formData, sugar: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-pink-50 rounded-xl"
                    />
                  </div>
                </div>

                {/* Quantity */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-3">จำนวน</p>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                      className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"
                    >
                      <Minus className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="text-2xl font-bold text-gray-800">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 0.5)}
                      className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Total Preview */}
                <div className="bg-gray-900 text-white rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">รวม</p>
                  <p className="text-2xl font-bold">{Math.round(formData.calories * quantity)} kcal</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 space-y-3">
              <button
                onClick={handleSave}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold"
              >
                ✅ ยืนยันและบันทึก
              </button>
              <button
                onClick={goToScanner}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
