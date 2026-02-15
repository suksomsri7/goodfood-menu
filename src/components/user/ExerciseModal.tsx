"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Clock, Dumbbell, ChevronDown, Camera, Loader2, Settings2, RotateCcw } from "lucide-react";
import { LimitReachedModal } from "./LimitReachedModal";

interface ExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineUserId?: string;
  onSave: (exercise: {
    name: string;
    type: string;
    duration: number;
    calories: number;
    intensity: string;
    note?: string;
  }) => void;
}

const EXERCISE_TYPES = [
  { 
    category: "คาร์ดิโอ", 
    exercises: [
      "วิ่ง", "เดินเร็ว", "ปั่นจักรยาน", "ว่ายน้ำ", "กระโดดเชือก", 
      "เต้นแอโรบิค", "เดินขึ้นบันได", "เดินบนลู่วิ่ง", "วิ่งบนลู่วิ่ง",
      "ปั่นจักรยานอยู่กับที่", "เครื่องเดินวงรี (Elliptical)", "เครื่องพายเรือ",
      "Step Aerobics", "Zumba", "เต้น", "กระโดดตบ (Jumping Jacks)"
    ] 
  },
  { 
    category: "เวทเทรนนิ่ง", 
    exercises: [
      "ยกน้ำหนัก", "วิดพื้น", "สควอท", "แพลงค์", "ดัมเบล",
      "บาร์เบล", "เครื่อง Leg Press", "เครื่อง Chest Press", "เครื่อง Lat Pulldown",
      "เครื่อง Cable", "ซิทอัพ", "Crunch", "Deadlift", "Bench Press",
      "Lunges", "Burpees", "Pull-up", "Chin-up", "Dips"
    ] 
  },
  { 
    category: "กีฬา", 
    exercises: [
      "แบดมินตัน", "เทนนิส", "บาสเกตบอล", "ฟุตบอล", "วอลเลย์บอล",
      "ปิงปอง", "กอล์ฟ", "มวย", "เทควันโด", "ยูโด", "คาราเต้",
      "สควอช", "แฮนด์บอล", "รักบี้", "ฮอกกี้", "สเก็ต", "สกี"
    ] 
  },
  { 
    category: "ยืดหยุ่น / ใจและกาย", 
    exercises: [
      "โยคะ", "ยืดเหยียด", "พิลาทิส", "ไทชิ", "ชี่กง",
      "โยคะร้อน (Hot Yoga)", "Foam Rolling", "การหายใจ"
    ] 
  },
  {
    category: "กิจกรรมอื่นๆ",
    exercises: [
      "ทำสวน", "ทำความสะอาดบ้าน", "ซักผ้า", "ล้างรถ", "เดินช้อปปิ้ง",
      "เล่นกับลูก", "จูงสุนัขเดินเล่น", "ขี่ม้า", "ปีนเขา", "ตั้งแคมป์"
    ]
  }
];

const CALORIES_PER_MINUTE: Record<string, number> = {
  // Cardio
  "วิ่ง": 10, "เดินเร็ว": 5, "ปั่นจักรยาน": 8, "ว่ายน้ำ": 9, 
  "กระโดดเชือก": 12, "เต้นแอโรบิค": 7, "เดินขึ้นบันได": 8,
  "เดินบนลู่วิ่ง": 5, "วิ่งบนลู่วิ่ง": 10, "ปั่นจักรยานอยู่กับที่": 7,
  "เครื่องเดินวงรี (Elliptical)": 8, "เครื่องพายเรือ": 9,
  "Step Aerobics": 8, "Zumba": 7, "เต้น": 6, "กระโดดตบ (Jumping Jacks)": 8,
  // Strength
  "ยกน้ำหนัก": 6, "วิดพื้น": 7, "สควอท": 6, "แพลงค์": 4, "ดัมเบล": 5,
  "บาร์เบล": 6, "เครื่อง Leg Press": 5, "เครื่อง Chest Press": 5,
  "เครื่อง Lat Pulldown": 5, "เครื่อง Cable": 5, "ซิทอัพ": 5,
  "Crunch": 4, "Deadlift": 7, "Bench Press": 6, "Lunges": 6,
  "Burpees": 10, "Pull-up": 8, "Chin-up": 8, "Dips": 6,
  // Sports
  "แบดมินตัน": 7, "เทนนิส": 8, "บาสเกตบอล": 8, "ฟุตบอล": 9,
  "วอลเลย์บอล": 6, "ปิงปอง": 4, "กอล์ฟ": 4, "มวย": 10,
  "เทควันโด": 10, "ยูโด": 10, "คาราเต้": 10, "สควอช": 9,
  "แฮนด์บอล": 8, "รักบี้": 9, "ฮอกกี้": 8, "สเก็ต": 7, "สกี": 8,
  // Flexibility
  "โยคะ": 3, "ยืดเหยียด": 2, "พิลาทิส": 4, "ไทชิ": 3, "ชี่กง": 2,
  "โยคะร้อน (Hot Yoga)": 5, "Foam Rolling": 2, "การหายใจ": 1,
  // Other activities
  "ทำสวน": 4, "ทำความสะอาดบ้าน": 3, "ซักผ้า": 2, "ล้างรถ": 3,
  "เดินช้อปปิ้ง": 3, "เล่นกับลูก": 4, "จูงสุนัขเดินเล่น": 3,
  "ขี่ม้า": 5, "ปีนเขา": 8, "ตั้งแคมป์": 3,
};

const INTENSITY_LABELS: Record<string, string> = {
  low: "เบา",
  moderate: "ปานกลาง",
  high: "หนัก",
};

type Mode = "select" | "custom" | "scan";

export function ExerciseModal({ isOpen, onClose, onSave, lineUserId }: ExerciseModalProps) {
  const [mode, setMode] = useState<Mode>("select");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [customExercise, setCustomExercise] = useState("");
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState("moderate");
  const [note, setNote] = useState("");
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom mode states
  const [customCalories, setCustomCalories] = useState<number | null>(null);
  const [customDistance, setCustomDistance] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ limit?: number; used?: number }>({});
  const [aiResult, setAiResult] = useState<{
    name: string;
    duration: number;
    calories: number;
    distance?: string;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const exerciseName = mode === "scan" 
    ? (customExercise || aiResult?.name || "")
    : mode === "custom"
    ? (customExercise || "กำหนดเอง")
    : (selectedExercise || customExercise || "");
  
  // Calculate estimated calories
  const calculateCalories = () => {
    if ((mode === "custom" || mode === "scan") && customCalories !== null) {
      return customCalories;
    }
    if (mode === "scan" && aiResult?.calories) {
      return aiResult.calories;
    }
    const baseRate = CALORIES_PER_MINUTE[exerciseName] || 5;
    let multiplier = 1;
    if (intensity === "low") multiplier = 0.8;
    if (intensity === "high") multiplier = 1.3;
    return Math.round(baseRate * duration * multiplier);
  };

  const estimatedCalories = calculateCalories();

  const handleSubmit = async () => {
    const finalName = mode === "scan" 
      ? (customExercise || aiResult?.name || "ออกกำลังกาย")
      : mode === "custom"
      ? (customExercise || "กำหนดเอง")
      : exerciseName;
    
    if (!finalName || duration <= 0) return;

    setIsSubmitting(true);
    
    const exerciseType = EXERCISE_TYPES.find(t => 
      t.exercises.includes(finalName)
    )?.category || (mode === "scan" ? "เครื่องออกกำลังกาย" : mode === "custom" ? "กำหนดเอง" : "อื่นๆ");

    onSave({
      name: finalName,
      type: exerciseType,
      duration: mode === "scan" && aiResult?.duration ? aiResult.duration : duration,
      calories: estimatedCalories,
      intensity,
      note: note || (customDistance ? `ระยะทาง: ${customDistance}` : undefined),
    });

    resetForm();
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setMode("select");
    setSelectedExercise("");
    setCustomExercise("");
    setDuration(30);
    setIntensity("moderate");
    setNote("");
    setShowExerciseList(false);
    setCustomCalories(null);
    setCustomDistance("");
    setCapturedImage(null);
    setAiResult(null);
    stopCamera();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setStream(mediaStream);
      setShowCamera(true);
    } catch (error) {
      console.error("Failed to access camera:", error);
      alert("ไม่สามารถเข้าถึงกล้องได้");
    }
  };

  // Effect to assign stream to video element when both are ready
  useEffect(() => {
    if (showCamera && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showCamera, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageData);
        stopCamera();
        analyzeImage(imageData);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        setCapturedImage(imageData);
        analyzeImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (imageData: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, lineUserId }),
      });

      const data = await res.json();
      
      // Check for limit reached
      if (data.limitReached) {
        setLimitInfo({ limit: data.limit, used: data.used });
        setShowLimitModal(true);
        setCapturedImage(null);
        setIsAnalyzing(false);
        return;
      }

      if (res.ok) {
        setAiResult(data);
        if (data.duration) setDuration(data.duration);
        if (data.calories) setCustomCalories(data.calories);
        if (data.distance) setCustomDistance(data.distance);
        if (data.name) setCustomExercise(data.name);
      } else {
        alert("ไม่สามารถวิเคราะห์ภาพได้ กรุณาลองใหม่หรือกรอกข้อมูลเอง");
      }
    } catch (error) {
      console.error("Failed to analyze image:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  // Full-screen camera mode for scan
  if (mode === "scan" && showCamera) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Full screen camera view */}
          <div className="absolute inset-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Header with title */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent pt-4 pb-16 px-4">
            <div className="flex items-center justify-between">
              <div className="w-10" /> {/* Spacer */}
              <h1 className="text-white text-lg font-semibold">
                ถ่ายรูปหน้าจอเครื่องออกกำลังกาย
              </h1>
              <button
                onClick={() => {
                  stopCamera();
                }}
                className="p-2 bg-black/30 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Guide text */}
          <div className="absolute top-24 left-0 right-0 text-center">
            <p className="text-white/80 text-sm">
              AI จะอ่านค่า เวลา, แคลอรี่, ระยะทาง
            </p>
          </div>

          {/* Capture button */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center"
            >
              <div className="w-16 h-16 rounded-full bg-white border-2 border-orange-400" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">บันทึกการออกกำลังกาย</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setMode("select")}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mode === "select" 
                ? "text-red-600 border-b-2 border-red-500" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Dumbbell className="w-4 h-4 inline mr-1" />
            เลือกประเภท
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mode === "custom" 
                ? "text-blue-600 border-b-2 border-blue-500" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings2 className="w-4 h-4 inline mr-1" />
            กำหนดเอง
          </button>
          <button
            onClick={() => setMode("scan")}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mode === "scan" 
                ? "text-orange-600 border-b-2 border-orange-500" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Camera className="w-4 h-4 inline mr-1" />
            สแกนหน้าจอ
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          
          {mode === "select" ? (
            <>
              {/* Exercise Selection Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทการออกกำลังกาย
                </label>
                
                <div 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white cursor-pointer flex items-center justify-between"
                  onClick={() => setShowExerciseList(!showExerciseList)}
                >
                  <span className={selectedExercise ? "text-gray-900" : "text-gray-400"}>
                    {selectedExercise || "เลือกการออกกำลังกาย"}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showExerciseList ? "rotate-180" : ""}`} />
                </div>

                {showExerciseList && (
                  <div className="mt-2 border border-gray-200 rounded-xl bg-white max-h-48 overflow-y-auto">
                    {EXERCISE_TYPES.map((group) => (
                      <div key={group.category}>
                        <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0">
                          {group.category}
                        </div>
                        {group.exercises.map((exercise) => (
                          <button
                            key={exercise}
                            className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                              selectedExercise === exercise ? "bg-red-50 text-red-600" : "text-gray-700"
                            }`}
                            onClick={() => {
                              setSelectedExercise(exercise);
                              setCustomExercise("");
                              setShowExerciseList(false);
                            }}
                          >
                            {exercise}
                            <span className="text-xs text-gray-400 ml-2">
                              ~{CALORIES_PER_MINUTE[exercise] || 5} kcal/นาที
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <input
                    type="text"
                    value={customExercise}
                    onChange={(e) => {
                      setCustomExercise(e.target.value);
                      setSelectedExercise("");
                    }}
                    placeholder="หรือพิมพ์ชื่อการออกกำลังกาย..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  ระยะเวลา (นาที)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="180"
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-center"
                  />
                </div>
              </div>

              {/* Intensity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ความหนัก
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "moderate", "high"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setIntensity(level)}
                      className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                        intensity === level
                          ? level === "low" 
                            ? "bg-blue-100 text-blue-600 border-2 border-blue-300"
                            : level === "moderate"
                            ? "bg-yellow-100 text-yellow-600 border-2 border-yellow-300"
                            : "bg-red-100 text-red-600 border-2 border-red-300"
                          : "bg-gray-100 text-gray-600 border-2 border-transparent"
                      }`}
                    >
                      {INTENSITY_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : mode === "custom" ? (
            <>
              {/* Custom Mode - Manual Entry */}
              <div className="space-y-4">
                {/* Exercise Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อการออกกำลังกาย
                  </label>
                  <input
                    type="text"
                    value={customExercise}
                    onChange={(e) => setCustomExercise(e.target.value)}
                    placeholder="เช่น ลู่วิ่ง, จักรยาน, เครื่อง Elliptical..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Duration & Calories Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เวลา (นาที)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      แคลอรี่ (kcal)
                    </label>
                    <input
                      type="number"
                      value={customCalories ?? ""}
                      onChange={(e) => setCustomCalories(parseInt(e.target.value) || null)}
                      placeholder="ประมาณอัตโนมัติ"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Distance (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ระยะทาง (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    value={customDistance}
                    onChange={(e) => setCustomDistance(e.target.value)}
                    placeholder="เช่น 5.2 km, 3000 m"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Intensity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ความหนัก
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["low", "moderate", "high"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setIntensity(level)}
                        className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                          intensity === level
                            ? level === "low" 
                              ? "bg-blue-100 text-blue-600 border-2 border-blue-300"
                              : level === "moderate"
                              ? "bg-yellow-100 text-yellow-600 border-2 border-yellow-300"
                              : "bg-red-100 text-red-600 border-2 border-red-300"
                            : "bg-gray-100 text-gray-600 border-2 border-transparent"
                        }`}
                      >
                        {INTENSITY_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Scan Mode */}
              
              {/* Camera Button - Only show when no image captured */}
              {!capturedImage && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-4">
                      ถ่ายรูปหน้าจอเครื่องออกกำลังกาย<br/>
                      <span className="text-xs text-gray-400">AI จะอ่านค่า เวลา, แคลอรี่, ระยะทาง</span>
                    </p>
                    <button
                      onClick={startCamera}
                      className="w-full py-6 border-2 border-dashed border-orange-300 rounded-xl text-orange-500 hover:bg-orange-50 transition-colors flex flex-col items-center gap-2"
                    >
                      <Camera className="w-12 h-12" />
                      <span className="font-medium">ถ่ายรูปหน้าจอเครื่อง</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Results after capture - Show image + analysis */}
              {capturedImage && (
                <div className="space-y-4">
                  {/* Analyzing state */}
                  {isAnalyzing && (
                    <div className="py-8 flex flex-col items-center">
                      <Loader2 className="w-12 h-12 text-orange-400 animate-spin mb-4" />
                      <p className="text-gray-600">กำลังวิเคราะห์รูปภาพ...</p>
                    </div>
                  )}

                  {/* Results - Editable form */}
                  {!isAnalyzing && (
                    <>
                      {/* Small preview image */}
                      <div className="relative">
                        <img 
                          src={capturedImage} 
                          alt="Captured" 
                          className="w-full h-32 object-cover rounded-xl"
                        />
                        <button
                          onClick={() => {
                            setCapturedImage(null);
                            setAiResult(null);
                            setCustomCalories(null);
                            setCustomDistance("");
                            setCustomExercise("");
                            startCamera();
                          }}
                          className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Form fields */}
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500 text-center">
                          {aiResult ? "ผลการวิเคราะห์ (แก้ไขได้)" : "กรอกข้อมูลด้วยตนเอง"}
                        </p>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ชื่อการออกกำลังกาย
                          </label>
                          <input
                            type="text"
                            value={customExercise}
                            onChange={(e) => setCustomExercise(e.target.value)}
                            placeholder="เช่น ลู่วิ่ง, จักรยาน..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              เวลา (นาที)
                            </label>
                            <input
                              type="number"
                              value={duration}
                              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              แคลอรี่ (kcal)
                            </label>
                            <input
                              type="number"
                              value={customCalories ?? ""}
                              onChange={(e) => setCustomCalories(parseInt(e.target.value) || null)}
                              placeholder="ประมาณอัตโนมัติ"
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ระยะทาง (ไม่บังคับ)
                          </label>
                          <input
                            type="text"
                            value={customDistance}
                            onChange={(e) => setCustomDistance(e.target.value)}
                            placeholder="เช่น 5.2 km"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Estimated Calories */}
          {(exerciseName || mode === "custom" || (mode === "scan" && (aiResult || customExercise))) && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {(mode === "custom" || mode === "scan") && customCalories ? "แคลอรี่ที่เผาผลาญ" : "แคลอรี่ (โดยประมาณ)"}
                  </span>
                </div>
                <span className="text-2xl font-bold text-orange-500">
                  {estimatedCalories} <span className="text-sm font-normal">kcal</span>
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button
            onClick={handleSubmit}
            disabled={
              (mode === "select" && !exerciseName) || 
              (mode === "custom" && !customExercise) || 
              (mode === "scan" && !customExercise && !aiResult) ||
              duration <= 0 || 
              isSubmitting || 
              isAnalyzing
            }
            className={`w-full py-3.5 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === "scan" 
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : mode === "custom"
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>

      {/* Limit Reached Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="วิเคราะห์การออกกำลังกาย"
        limitCount={limitInfo.limit}
        usedCount={limitInfo.used}
      />
    </div>
  );
}
