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
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";
import { LimitReachedModal } from "./LimitReachedModal";

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
  lineUserId?: string;
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

export function BarcodeModal({ isOpen, onClose, onSave, lineUserId }: BarcodeModalProps) {
  const [state, setState] = useState<ModalState>("scanner");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanningRef = useRef<boolean>(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ limit?: number; used?: number }>({});

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
      // Initialize barcode reader with hints for better detection
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      
      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          // Start continuous barcode scanning after video is playing
          scanningRef.current = true;
          setIsScanning(true);
          setTimeout(scanForBarcode, 500); // Start scanning after 500ms
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("ไม่สามารถเข้าถึงกล้องได้");
    }
  }, []);

  // Continuous barcode scanning function - uses canvas to capture frames
  const scanForBarcode = useCallback(async () => {
    if (!readerRef.current || !videoRef.current || !canvasRef.current || !scanningRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      if (scanningRef.current) {
        setTimeout(scanForBarcode, 100);
      }
      return;
    }
    
    try {
      // Capture frame to canvas
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Try to decode from canvas image
        try {
          const imageUrl = canvas.toDataURL("image/jpeg");
          const img = new Image();
          img.src = imageUrl;
          await new Promise((resolve) => { img.onload = resolve; });
          
          const result = await readerRef.current.decodeFromImageElement(img);
          if (result && result.getText()) {
            const scannedCode = result.getText();
            console.log("Barcode detected:", scannedCode);
            scanningRef.current = false;
            setIsScanning(false);
            searchBarcode(scannedCode);
            return;
          }
        } catch {
          // No barcode found in this frame
        }
      }
    } catch (err) {
      // Error capturing frame, continue
    }
    
    // Continue scanning if still active
    if (scanningRef.current) {
      setTimeout(scanForBarcode, 150); // Scan every 150ms
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    setIsScanning(false);
    
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    
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
      const url = lineUserId 
        ? `/api/barcode/${trimmedCode}?lineUserId=${lineUserId}`
        : `/api/barcode/${trimmedCode}`;
      const response = await fetch(url);
      const result = await response.json();

      // Check for limit reached
      if (result.limitReached) {
        setLimitInfo({ limit: result.limit, used: result.used });
        setShowLimitModal(true);
        setState("scanner");
        return;
      }

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
          lineUserId,
        }),
      });

      const result = await response.json();

      // Check for limit reached
      if (result.limitReached) {
        setLimitInfo({ limit: result.limit, used: result.used });
        setShowLimitModal(true);
        setState("photo_capture");
        return;
      }

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
    setBarcode("");
    setManualBarcode("");
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
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-72 h-48 border-2 border-white rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-red-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-red-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-red-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-red-400 rounded-br-xl" />
                  
                  {/* Scanning line animation */}
                  {isScanning && (
                    <div className="absolute inset-x-2 h-0.5 bg-red-400 animate-pulse" 
                         style={{ 
                           top: '50%',
                           boxShadow: '0 0 8px 2px rgba(74, 222, 128, 0.6)'
                         }} 
                    />
                  )}
                </div>
              </div>
              
              {/* Scanning status */}
              <div className="absolute top-20 left-0 right-0 flex justify-center">
                <div className="bg-black/60 px-4 py-2 rounded-full flex items-center gap-2">
                  {isScanning ? (
                    <>
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                      <span className="text-white text-sm">กำลัง Scan...</span>
                    </>
                  ) : (
                    <span className="text-white text-sm">จับภาพ Barcode</span>
                  )}
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
              <div className="text-center mb-4">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-7 h-7 text-red-500" />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-xl font-bold text-gray-800 text-center bg-transparent border-b border-dashed border-gray-300 focus:border-gray-500 outline-none w-full"
                />
                <input
                  type="text"
                  value={formData.brand || ""}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="ยี่ห้อ (ไม่บังคับ)"
                  className="text-sm text-gray-500 text-center bg-transparent border-b border-dashed border-gray-200 focus:border-gray-400 outline-none w-full mt-1"
                />
              </div>

              {/* Serving info */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 text-center mb-2">ปริมาณต่อ Serving</p>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    value={formData.servingSize || ""}
                    onChange={(e) => setFormData({ ...formData, servingSize: parseFloat(e.target.value) || undefined })}
                    placeholder="ปริมาณ"
                    className="w-20 px-2 py-1 text-center bg-white rounded-lg border border-gray-200 text-sm"
                  />
                  <input
                    type="text"
                    value={formData.servingUnit || "g"}
                    onChange={(e) => setFormData({ ...formData, servingUnit: e.target.value })}
                    className="w-16 px-2 py-1 text-center bg-white rounded-lg border border-gray-200 text-sm"
                  />
                </div>
              </div>

              {/* Calories - editable */}
              <div className="bg-orange-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-500 mb-1">แคลอรี่ต่อ serving</p>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
                    className="text-3xl font-bold text-gray-800 bg-transparent w-24 text-center border-b-2 border-dashed border-orange-300 focus:border-orange-500 outline-none"
                  />
                  <span className="text-xl text-gray-500">kcal</span>
                </div>
              </div>

              {/* Main macros - editable */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">โปรตีน</p>
                  <div className="flex items-center justify-center">
                    <input
                      type="number"
                      value={formData.protein}
                      onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-lg font-semibold bg-transparent text-center border-b border-dashed border-red-300 outline-none"
                    />
                    <span className="text-sm text-gray-500">g</span>
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">คาร์บ</p>
                  <div className="flex items-center justify-center">
                    <input
                      type="number"
                      value={formData.carbs}
                      onChange={(e) => setFormData({ ...formData, carbs: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-lg font-semibold bg-transparent text-center border-b border-dashed border-yellow-300 outline-none"
                    />
                    <span className="text-sm text-gray-500">g</span>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">ไขมัน</p>
                  <div className="flex items-center justify-center">
                    <input
                      type="number"
                      value={formData.fat}
                      onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-lg font-semibold bg-transparent text-center border-b border-dashed border-blue-300 outline-none"
                    />
                    <span className="text-sm text-gray-500">g</span>
                  </div>
                </div>
              </div>

              {/* Sodium & Sugar - editable */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">โซเดียม</p>
                  <div className="flex items-center justify-center">
                    <input
                      type="number"
                      value={formData.sodium || ""}
                      onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-16 text-lg font-semibold bg-transparent text-center border-b border-dashed border-purple-300 outline-none"
                    />
                    <span className="text-sm text-gray-500">mg</span>
                  </div>
                </div>
                <div className="bg-pink-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">น้ำตาล</p>
                  <div className="flex items-center justify-center">
                    <input
                      type="number"
                      value={formData.sugar || ""}
                      onChange={(e) => setFormData({ ...formData, sugar: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-14 text-lg font-semibold bg-transparent text-center border-b border-dashed border-pink-300 outline-none"
                    />
                    <span className="text-sm text-gray-500">g</span>
                  </div>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-500 mb-2 text-center">จำนวน Serving</p>
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
                <p className="text-sm text-gray-400 mb-1">รวม ({quantity} serving)</p>
                <p className="text-2xl font-bold">{Math.round(formData.calories * quantity)} kcal</p>
                <div className="grid grid-cols-5 gap-2 mt-2 text-xs text-gray-400">
                  <div>P: {Math.round(formData.protein * quantity)}g</div>
                  <div>C: {Math.round(formData.carbs * quantity)}g</div>
                  <div>F: {Math.round(formData.fat * quantity)}g</div>
                  <div>Na: {Math.round((formData.sodium || 0) * quantity)}mg</div>
                  <div>Su: {Math.round((formData.sugar || 0) * quantity)}g</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 space-y-3">
              <button
                onClick={handleSave}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold"
              >
                เพิ่ม {quantity > 1 ? `${quantity} serving` : ""}
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
                {/* Product Info */}
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

                {/* Serving Info Header */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-800 text-center mb-3">
                    📦 ข้อมูลต่อ 1 Serving
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-blue-600 mb-1">ปริมาณต่อ Serving</label>
                      <input
                        type="number"
                        value={formData.servingSize || ""}
                        onChange={(e) => setFormData({ ...formData, servingSize: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-white rounded-lg text-center font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-600 mb-1">หน่วย</label>
                      <input
                        type="text"
                        value={formData.servingUnit || "g"}
                        onChange={(e) => setFormData({ ...formData, servingUnit: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-lg text-center font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Nutrition per 1 Serving */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 text-center mb-3">
                    🍽️ สารอาหารต่อ 1 Serving ({formData.servingSize || 100}{formData.servingUnit || "g"})
                  </p>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-gray-500 mb-1">แคลอรี่ (kcal)</label>
                    <input
                      type="number"
                      value={formData.calories}
                      onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-orange-50 rounded-xl text-lg font-bold text-center"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">โปรตีน (g)</label>
                      <input
                        type="number"
                        value={formData.protein}
                        onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-2 bg-red-50 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">คาร์บ (g)</label>
                      <input
                        type="number"
                        value={formData.carbs}
                        onChange={(e) => setFormData({ ...formData, carbs: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-2 bg-yellow-50 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ไขมัน (g)</label>
                      <input
                        type="number"
                        value={formData.fat}
                        onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-2 bg-blue-50 rounded-lg text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">โซเดียม (mg)</label>
                      <input
                        type="number"
                        value={formData.sodium || ""}
                        onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-2 bg-purple-50 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">น้ำตาล (g)</label>
                      <input
                        type="number"
                        value={formData.sugar || ""}
                        onChange={(e) => setFormData({ ...formData, sugar: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-2 bg-pink-50 rounded-lg text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity - How many servings did you eat */}
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-red-800 text-center mb-1">
                    🍴 จำนวน Serving ที่รับประทาน
                  </p>
                  <p className="text-xs text-red-600 text-center mb-3">
                    (1 Serving = {formData.servingSize || 100}{formData.servingUnit || "g"})
                  </p>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                      className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-red-200"
                    >
                      <Minus className="w-5 h-5 text-red-600" />
                    </button>
                    <div className="text-center">
                      <span className="text-3xl font-bold text-red-700">{quantity}</span>
                      <p className="text-xs text-red-600">Serving</p>
                    </div>
                    <button
                      onClick={() => setQuantity(quantity + 0.5)}
                      className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-red-200"
                    >
                      <Plus className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                {/* Total Preview */}
                <div className="bg-gray-900 text-white rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    รวมทั้งหมด ({quantity} serving = {Math.round((formData.servingSize || 100) * quantity)}{formData.servingUnit || "g"})
                  </p>
                  <p className="text-2xl font-bold mb-2">{Math.round(formData.calories * quantity)} kcal</p>
                  <div className="grid grid-cols-5 gap-1 text-xs text-gray-400">
                    <div>P: {Math.round(formData.protein * quantity)}g</div>
                    <div>C: {Math.round(formData.carbs * quantity)}g</div>
                    <div>F: {Math.round(formData.fat * quantity)}g</div>
                    <div>Na: {Math.round((formData.sodium || 0) * quantity)}mg</div>
                    <div>Su: {Math.round((formData.sugar || 0) * quantity)}g</div>
                  </div>
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

      {/* Limit Reached Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="สแกนบาร์โค้ด"
        limitCount={limitInfo.limit}
        usedCount={limitInfo.used}
      />
    </AnimatePresence>
  );
}
