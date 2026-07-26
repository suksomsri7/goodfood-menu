import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Clock, Eye, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "บทความสุขภาพ | Good Food",
  description:
    "บทความเรื่องสุขภาพ โภชนาการ การออกกำลังกาย และเคล็ดลับการดูแลตัวเอง จาก Good Food",
  openGraph: {
    title: "บทความสุขภาพ | Good Food",
    description:
      "บทความเรื่องสุขภาพ โภชนาการ และเคล็ดลับการดูแลตัวเอง",
    type: "website",
    locale: "th_TH",
    siteName: "Good Food",
  },
  alternates: {
    canonical: "/articles",
  },
};

export default async function ArticlesPage() {
  let articles: any[] = [];
  let categories: any[] = [];

  try {
    [articles, categories] = await Promise.all([
      prisma.article.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        include: {
          category: {
            select: { id: true, name: true, slug: true, color: true, icon: true },
          },
        },
      }),
      prisma.articleCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }),
    ]);
  } catch (error) {
    console.error("Failed to fetch articles:", error);
  }

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับหน้าแรก
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              บทความ<span className="text-gray-400">สุขภาพ</span>
            </h1>
            <p className="mt-3 text-gray-500 max-w-lg">
              เรื่องน่ารู้เกี่ยวกับสุขภาพ โภชนาการ การออกกำลังกาย
              และเคล็ดลับการดูแลตัวเอง
            </p>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              <Link
                href="/articles"
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-full"
              >
                ทั้งหมด
              </Link>
              {categories.map((cat: any) => (
                <Link
                  key={cat.id}
                  href={`/articles/category/${cat.slug}`}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-gray-200 transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}

          {/* Articles Grid */}
          {articles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article: any) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="group block"
                >
                  <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
                    <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                      {article.coverImage ? (
                        <Image
                          src={article.coverImage}
                          alt={article.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
                          <span className="text-4xl">📖</span>
                        </div>
                      )}
                      {article.category && (
                        <div
                          className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{
                            backgroundColor: article.category.color,
                          }}
                        >
                          {article.category.name}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h2 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {article.title}
                      </h2>
                      {article.excerpt && (
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {article.readTime} นาที
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {article.views.toLocaleString()}
                        </span>
                        {article.publishedAt && (
                          <span>
                            {new Date(
                              article.publishedAt
                            ).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <span className="text-6xl mb-4 block">📝</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ยังไม่มีบทความ
              </h3>
              <p className="text-gray-500">
                บทความใหม่กำลังจะมาเร็วๆ นี้
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
