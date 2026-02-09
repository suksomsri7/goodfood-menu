import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { AISection } from "@/components/landing/AISection";
import { ArticlesSection } from "@/components/landing/ArticlesSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Good Food | แอปนับแคลอรี่อัจฉริยะ สั่งอาหารเพื่อสุขภาพ",
  description:
    "Good Food แอปนับแคลอรี่อัจฉริยะด้วย AI ถ่ายรูปอาหารวิเคราะห์โภชนาการทันที สั่งอาหารเพื่อสุขภาพ พร้อม AI โค้ชส่วนตัว ใช้งานง่ายผ่าน LINE",
  keywords: [
    "นับแคลอรี่",
    "อาหารเพื่อสุขภาพ",
    "AI วิเคราะห์อาหาร",
    "ลดน้ำหนัก",
    "สุขภาพ",
    "Good Food",
    "แอปสุขภาพ",
    "นับแคล",
    "แอปนับแคลอรี่",
    "โภชนาการ",
  ],
  openGraph: {
    title: "Good Food | แอปนับแคลอรี่อัจฉริยะ สั่งอาหารเพื่อสุขภาพ",
    description:
      "แอปนับแคลอรี่อัจฉริยะด้วย AI ถ่ายรูปอาหารวิเคราะห์โภชนาการทันที สั่งอาหารเพื่อสุขภาพ ใช้งานง่ายผ่าน LINE",
    type: "website",
    locale: "th_TH",
    siteName: "Good Food",
  },
  twitter: {
    card: "summary_large_image",
    title: "Good Food | แอปนับแคลอรี่อัจฉริยะ",
    description:
      "แอปนับแคลอรี่อัจฉริยะด้วย AI ใช้งานง่ายผ่าน LINE",
  },
  alternates: {
    canonical: "/",
  },
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Good Food",
  description:
    "แอปนับแคลอรี่อัจฉริยะด้วย AI สั่งอาหารเพื่อสุขภาพ ใช้งานผ่าน LINE",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "THB",
  },
  featureList: [
    "นับแคลอรี่ด้วย AI",
    "วิเคราะห์อาหารจากรูปถ่าย",
    "สั่งอาหารเพื่อสุขภาพ",
    "สแกนบาร์โค้ด",
    "AI โค้ชส่วนตัว",
    "ติดตามความก้าวหน้า",
  ],
};

export default async function LandingPage() {
  // Fetch published articles for the articles section
  let articles: any[] = [];
  try {
    articles = await prisma.article.findMany({
      where: { status: "published" },
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      take: 6,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });
  } catch (error) {
    // DB might not be available during build
    console.error("Failed to fetch articles:", error);
  }

  // Serialize dates for client components
  const serializedArticles = articles.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    imageUrl: a.imageUrl,
    readTime: a.readTime,
    views: a.views,
    publishedAt: a.publishedAt?.toISOString() || null,
    category: a.category,
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <AISection />
        <ArticlesSection articles={serializedArticles} />
        <StatsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
