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
  const sizeConfig = {
    sm: { logo: 96, outer: 112, inner: 104 },
    md: { logo: 128, outer: 152, inner: 140 },
    lg: { logo: 160, outer: 188, inner: 174 },
  };

  const config = sizeConfig[size];

  const content = (
    <div className="text-center">
      {/* Logo Container */}
      <div 
        className="relative flex items-center justify-center"
        style={{ width: config.outer, height: config.outer }}
      >
        {/* Outer Ring - Rotating */}
        <div 
          className="absolute rounded-full border-4 border-transparent border-t-[#F44336] border-r-[#F44336] animate-spin"
          style={{ 
            width: config.outer,
            height: config.outer,
            top: 0,
            left: 0,
          }} 
        />
        
        {/* Inner Ring - Counter Rotating */}
        <div 
          className="absolute rounded-full border-4 border-transparent border-b-gray-300 border-l-gray-300 animate-spin-reverse"
          style={{ 
            width: config.inner,
            height: config.inner,
          }} 
        />
        
        {/* Logo with Pulse */}
        <div 
          className="relative animate-pulse-scale"
          style={{ width: config.logo, height: config.logo }}
        >
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
