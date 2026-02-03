import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LiffProvider } from "@/components/providers/LiffProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoodFood Menu - นับแคลอรี่อย่างมืออาชีพ",
  description: "แอปนับแคลอรี่และสั่งอาหารเพื่อสุขภาพ",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4CAF50",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${inter.className} antialiased`}>
        <LiffProvider>{children}</LiffProvider>
      </body>
    </html>
  );
}
