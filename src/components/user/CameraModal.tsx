"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, RotateCcw, Calculator, Loader2 } from "lucide-react";

interface CameraModalProps {
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

type CameraState = "camera" | "preview" | "analyzing" | "result";

export function CameraModal({ isOpen, onClose, onSave }: CameraModalProps) {
  const [state, setState] = useState<CameraState>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Form state for nutrition details
  const [formData, setFormData] = useState({
    name: "",
    weight: "",
    ingredients: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    sodium: "",
    sugar: "",
    multiplier: "1",
  });

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("ไม่สามารถเข้าถึงกล้องได้");
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Take photo
  const takePhoto = () => {
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
        setState("preview");
        stopCamera();
      }
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setState("camera");
    setFormData({
      name: "",
      weight: "",
      ingredients: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      sodium: "",
      sugar: "",
      multiplier: "1",
    });
    setAiMessage("");
    setAnalysisError("");
    startCamera();
  };

  // AI analysis state
  const [aiMessage, setAiMessage] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string>("");

  // Analyze nutrition using GPT-4o
  const analyzeNutrition = async () => {
    if (!capturedImage) return;
    
    setState("analyzing");
    setAnalysisError("");
    setAiMessage("");
    
    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: capturedImage,
          description: formData.ingredients, // User's description
        }),
      });

      const result = await response.json();
      
      if (result.error && !result.data) {
        throw new Error(result.error);
      }

      const data = result.data;
      
      setFormData({
        name: data.name || "อาหาร",
        weight: String(data.weight || ""),
        ingredients: data.ingredients || "",
        calories: String(data.calories || ""),
        protein: String(data.protein || ""),
        carbs: String(data.carbs || ""),
        fat: String(data.fat || ""),
        sodium: String(data.sodium || ""),
        sugar: String(data.sugar || ""),
        multiplier: "1",
      });

      // Show AI description/message
      if (data.description) {
        setAiMessage(data.description);
      }
      
      // Show error message if there was one
      if (result.error) {
        setAnalysisError(result.error);
      }
      
      setState("result");
      
    } catch (error: any) {
      console.error("Analysis error:", error);
      setAnalysisError(error.message || "เกิดข้อผิดพลาดในการวิเคราะห์");
      
      // Set default values on error
      setFormData({
        name: "อาหาร",
        weight: "200",
        ingredients: formData.ingredients || "",
        calories: "300",
        protein: "10",
        carbs: "40",
        fat: "12",
        sodium: "500",
        sugar: "5",
        multiplier: "1",
      });
      
      setState("result");
    }
  };

  // Handle save
  const handleSave = () => {
    onSave({
      name: formData.name || "อาหาร",
      calories: Number(formData.calories) || 0,
      protein: Number(formData.protein) || 0,
      carbs: Number(formData.carbs) || 0,
      fat: Number(formData.fat) || 0,
      sodium: Number(formData.sodium) || 0,
      sugar: Number(formData.sugar) || 0,
      weight: formData.weight ? Number(formData.weight) : undefined,
      multiplier: Number(formData.multiplier) || 1,
      ingredients: formData.ingredients,
      imageUrl: capturedImage || undefined,
    });
    handleClose();
  };

  // Handle close
  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setState("camera");
    setFormData({
      name: "",
      weight: "",
      ingredients: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      sodium: "",
      sugar: "",
      multiplier: "1",
    });
    setAiMessage("");
    setAnalysisError("");
    onClose();
  };

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && state === "camera") {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Background - Camera or Captured Image */}
        <div className="absolute inset-0">
          {state === "camera" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            capturedImage && (
              <img
                src={capturedImage}
                alt="Captured food"
                className="w-full h-full object-cover"
              />
            )
          )}
        </div>

        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Camera Mode - Capture Button */}
        {state === "camera" && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button
              onClick={takePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center"
            >
              <div className="w-16 h-16 rounded-full bg-white border-2 border-gray-400" />
            </button>
          </div>
        )}

        {/* Preview Mode - Pull-up Sheet */}
        {(state === "preview" || state === "analyzing" || state === "result") && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="p-6">
              {/* Handle */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />

              {state === "preview" && (
                <>
                  <h2 className="text-lg font-semibold text-center mb-4">
                    ถ่ายรูปสำเร็จ
                  </h2>

                  {/* Food Description Input */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-2">
                      รายละเอียดอาหาร (ไม่บังคับ)
                    </label>
                    <textarea
                      value={formData.ingredients}
                      onChange={(e) =>
                        setFormData({ ...formData, ingredients: e.target.value })
                      }
                      placeholder="เช่น ข้าวผัดกระเพรา ไข่ดาว ไม่ใส่พริก..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 resize-none placeholder:text-gray-400"
                    />
                  </div>
                  
                  <p className="text-gray-400 text-center text-xs mb-4">
                    กดปุ่มคำนวณสารอาหารเพื่อวิเคราะห์อาหารจากรูปภาพ
                  </p>

                  {/* Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={analyzeNutrition}
                      className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <Calculator className="w-5 h-5" />
                      คำนวณสารอาหาร
                    </button>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={retakePhoto}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-5 h-5" />
                        ถ่ายใหม่
                      </button>
                      
                      <button
                        onClick={handleClose}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                </>
              )}

              {state === "analyzing" && (
                <div className="py-12 flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
                  <p className="text-gray-600">กำลังวิเคราะห์อาหาร...</p>
                </div>
              )}

              {state === "result" && (
                <>
                  <h2 className="text-lg font-semibold text-center mb-4">
                    ผลการวิเคราะห์
                  </h2>

                  {/* AI Message */}
                  {aiMessage && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-xl">
                      <p className="text-sm text-blue-700">💡 {aiMessage}</p>
                    </div>
                  )}

                  {/* Error Message */}
                  {analysisError && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-xl">
                      <p className="text-sm text-yellow-700">⚠️ {analysisError}</p>
                      <p className="text-xs text-yellow-600 mt-1">คุณสามารถแก้ไขข้อมูลด้านล่างได้</p>
                    </div>
                  )}

                  <div className="max-h-[50vh] overflow-y-auto space-y-4 pb-4">
                    {/* Food Name */}
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        ชื่ออาหาร
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                      />
                    </div>

                    {/* Ingredients */}
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        ส่วนประกอบ
                      </label>
                      <textarea
                        value={formData.ingredients}
                        onChange={(e) =>
                          setFormData({ ...formData, ingredients: e.target.value })
                        }
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 resize-none"
                      />
                    </div>

                    {/* Weight & Multiplier */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          น้ำหนัก (g)
                        </label>
                        <input
                          type="number"
                          value={formData.weight}
                          onChange={(e) =>
                            setFormData({ ...formData, weight: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          จำนวน (เท่า)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.multiplier}
                          onChange={(e) =>
                            setFormData({ ...formData, multiplier: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                    </div>

                    {/* Nutrition Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-sm text-gray-500 mb-1">
                          แคลอรี่ (Kcal)
                        </label>
                        <input
                          type="number"
                          value={formData.calories}
                          onChange={(e) =>
                            setFormData({ ...formData, calories: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          โปรตีน (g)
                        </label>
                        <input
                          type="number"
                          value={formData.protein}
                          onChange={(e) =>
                            setFormData({ ...formData, protein: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          คาร์โบไฮเดรต (g)
                        </label>
                        <input
                          type="number"
                          value={formData.carbs}
                          onChange={(e) =>
                            setFormData({ ...formData, carbs: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          ไขมัน (g)
                        </label>
                        <input
                          type="number"
                          value={formData.fat}
                          onChange={(e) =>
                            setFormData({ ...formData, fat: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          โซเดียม (mg)
                        </label>
                        <input
                          type="number"
                          value={formData.sodium}
                          onChange={(e) =>
                            setFormData({ ...formData, sodium: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">
                          น้ำตาล (g)
                        </label>
                        <input
                          type="number"
                          value={formData.sugar}
                          onChange={(e) =>
                            setFormData({ ...formData, sugar: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save & Retake Buttons */}
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={handleSave}
                      className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium"
                    >
                      บันทึก
                    </button>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={retakePhoto}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-5 h-5" />
                        ถ่ายใหม่
                      </button>
                      
                      <button
                        onClick={handleClose}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
