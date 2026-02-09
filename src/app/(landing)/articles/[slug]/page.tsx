import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ArrowLeft, Clock, Eye, Calendar, Tag } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getArticle(slug: string) {
  try {
    const article = await prisma.article.findUnique({
      where: { slug, status: "published" },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });
    return article;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return { title: "ไม่พบบทความ | Good Food" };
  }

  return {
    title: `${article.title} | Good Food`,
    description: article.excerpt || article.title,
    openGraph: {
      title: article.title,
      description: article.excerpt || article.title,
      type: "article",
      locale: "th_TH",
      siteName: "Good Food",
      publishedTime: article.publishedAt?.toISOString(),
      authors: article.author ? [article.author] : undefined,
      images: article.imageUrl ? [article.imageUrl] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt || article.title,
      images: article.imageUrl ? [article.imageUrl] : [],
    },
    alternates: {
      canonical: `/articles/${article.slug}`,
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  // Increment view count (fire and forget)
  prisma.article
    .update({
      where: { id: article.id },
      data: { views: { increment: 1 } },
    })
    .catch(() => {});

  // Fetch related articles
  let relatedArticles: any[] = [];
  try {
    relatedArticles = await prisma.article.findMany({
      where: {
        status: "published",
        id: { not: article.id },
        ...(article.categoryId && { categoryId: article.categoryId }),
      },
      take: 3,
      orderBy: { publishedAt: "desc" },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });
  } catch {}

  // JSON-LD structured data for article
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: article.imageUrl,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: article.author
      ? { "@type": "Person", name: article.author }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: "Good Food",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `/articles/${article.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main className="pt-24 pb-16">
        <article className="max-w-3xl mx-auto px-6">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับไปบทความ
            </Link>
          </div>

          {/* Header */}
          <header className="mb-8">
            {article.category && (
              <div
                className="inline-flex px-3 py-1 rounded-full text-xs font-medium text-white mb-4"
                style={{ backgroundColor: article.category.color }}
              >
                {article.category.name}
              </div>
            )}

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="mt-4 text-lg text-gray-500 leading-relaxed">
                {article.excerpt}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {article.author && (
                <span className="font-medium text-gray-600">
                  {article.author}
                </span>
              )}
              {article.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(article.publishedAt).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {article.readTime} นาทีในการอ่าน
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {article.views.toLocaleString()} views
              </span>
            </div>
          </header>

          {/* Featured Image */}
          {article.imageUrl && (
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10">
              <Image
                src={article.imageUrl}
                alt={article.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Article Content */}
          {article.content && (
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          )}

          {/* Tags */}
          {article.tags && (
            <div className="mt-10 pt-8 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  แท็ก
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {article.tags.split(",").map((tag: string) => (
                  <span
                    key={tag.trim()}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 mt-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              บทความที่เกี่ยวข้อง
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedArticles.map((related: any) => (
                <Link
                  key={related.id}
                  href={`/articles/${related.slug}`}
                  className="group block"
                >
                  <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300">
                    <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                      {related.imageUrl ? (
                        <Image
                          src={related.imageUrl}
                          alt={related.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
                          <span className="text-4xl">📖</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {related.title}
                      </h3>
                      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {related.readTime} นาที
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
