"use client";

import Image from "next/image";

interface LogoLoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export function LogoLoader({ 
  message = "กำลังโหลด...", 
  size = "md",
  fullScreen = true 
}: LogoLoaderProps) {
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  const content = (
    <div className="text-center">
      {/* Logo Container with Pulse Effect */}
      <div className="relative inline-block">
        {/* Outer Ring - Rotating */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#F44336] border-r-[#F44336] animate-spin" 
             style={{ 
               width: size === "sm" ? "6.5rem" : size === "md" ? "8.5rem" : "10.5rem",
               height: size === "sm" ? "6.5rem" : size === "md" ? "8.5rem" : "10.5rem",
               left: "50%",
               top: "50%",
               transform: "translate(-50%, -50%)",
             }} 
        />
        
        {/* Inner Ring - Counter Rotating */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-b-black border-l-black animate-spin-reverse" 
             style={{ 
               width: size === "sm" ? "5.5rem" : size === "md" ? "7.5rem" : "9.5rem",
               height: size === "sm" ? "5.5rem" : size === "md" ? "7.5rem" : "9.5rem",
               left: "50%",
               top: "50%",
               transform: "translate(-50%, -50%)",
               animationDirection: "reverse",
               animationDuration: "1.5s",
             }} 
        />
        
        {/* Logo with Pulse */}
        <div className={`${sizeClasses[size]} relative animate-pulse-scale`}>
          <Image
            src="/logo.jpg"
            alt="GOOD FOOD"
            fill
            className="object-contain rounded-lg"
            priority
          />
        </div>
      </div>

      {/* Loading Text with Fade Effect */}
      {message && (
        <div className="mt-6 space-y-2">
          <p className="text-gray-600 font-medium animate-pulse">{message}</p>
          <div className="flex justify-center gap-1">
            <span className="w-2 h-2 bg-[#F44336] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-[#F44336] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-[#F44336] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
