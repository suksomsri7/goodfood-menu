import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ArticleReadTracker } from "@/components/landing/ArticleReadTracker";
import { ArrowLeft, Clock, Eye, Calendar, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "https://www.goodfood.in.th";

async function getArticle(rawSlug: string) {
  const slug = (() => {
    try {
      return decodeURIComponent(rawSlug);
    } catch {
      return rawSlug;
    }
  })();
  try {
    return await prisma.article.findUnique({
      where: { slug, status: "PUBLISHED" },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        authorStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
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

  const heroImage = article.coverImage || article.ogImage || undefined;
  const ogImage = article.ogImage || article.coverImage || undefined;
  const description = article.metaDescription || article.excerpt || article.title;
  const canonical = article.canonicalUrl || `${BASE_URL}/articles/${article.slug}`;

  return {
    title: `${article.title} | Good Food`,
    description,
    keywords: article.focusKeyword ? [article.focusKeyword] : undefined,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      locale: "th_TH",
      siteName: "Good Food",
      url: canonical,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: article.authorStaff?.name ? [article.authorStaff.name] : undefined,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    alternates: {
      canonical,
      languages: { "th-TH": canonical },
    },
  };
}

type RecipeData = {
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  ingredients?: string[];
  instructions?: string[];
  nutrition?: {
    calories?: string;
    proteinContent?: string;
    carbohydrateContent?: string;
    fatContent?: string;
  };
  rating?: { value?: number; count?: number };
};

function buildJsonLd(article: any) {
  const url = article.canonicalUrl || `${BASE_URL}/articles/${article.slug}`;
  const image = article.coverImage || article.ogImage || undefined;
  const author = article.authorStaff?.name
    ? { "@type": "Person", name: article.authorStaff.name }
    : undefined;
  const publisher = {
    "@type": "Organization",
    name: "Good Food",
    url: BASE_URL,
  };

  const recipe = article.recipeData as RecipeData | null | undefined;
  const isRecipe =
    recipe && typeof recipe === "object" && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "หน้าแรก", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "บทความ", item: `${BASE_URL}/articles` },
      ...(article.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: article.category.name,
              item: `${BASE_URL}/articles/category/${article.category.slug}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: article.category ? 4 : 3,
        name: article.title,
        item: url,
      },
    ],
  };

  if (isRecipe) {
    const recipeLd = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: article.title,
      description: article.metaDescription || article.excerpt || undefined,
      image: image ? [image] : undefined,
      author,
      datePublished: article.publishedAt?.toISOString(),
      dateModified: article.updatedAt.toISOString(),
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      recipeYield: recipe.recipeYield,
      recipeCategory: recipe.recipeCategory || article.category?.name,
      recipeCuisine: recipe.recipeCuisine,
      keywords: article.focusKeyword,
      recipeIngredient: recipe.ingredients,
      recipeInstructions: recipe.instructions?.map((step, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text: step,
      })),
      nutrition: recipe.nutrition
        ? {
            "@type": "NutritionInformation",
            calories: recipe.nutrition.calories,
            proteinContent: recipe.nutrition.proteinContent,
            carbohydrateContent: recipe.nutrition.carbohydrateContent,
            fatContent: recipe.nutrition.fatContent,
          }
        : undefined,
      aggregateRating: recipe.rating?.value
        ? {
            "@type": "AggregateRating",
            ratingValue: recipe.rating.value,
            ratingCount: recipe.rating.count || 1,
          }
        : undefined,
      publisher,
    };
    return [recipeLd, breadcrumb];
  }

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription || article.excerpt || undefined,
    image: image ? [image] : undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author,
    publisher,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: article.focusKeyword || article.tags || undefined,
  };
  return [articleLd, breadcrumb];
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  prisma.article
    .update({ where: { id: article.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  let relatedArticles: any[] = [];
  try {
    const candidates = await prisma.article.findMany({
      where: { status: "PUBLISHED", id: { not: article.id } },
      take: 30,
      orderBy: { publishedAt: "desc" },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
    const articleTags = (article.tags || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const focusKw = (article.focusKeyword || "").toLowerCase();
    const scored = candidates.map((c) => {
      let score = 0;
      if (c.categoryId && c.categoryId === article.categoryId) score += 3;
      const cTags = (c.tags || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      score += cTags.filter((t) => articleTags.includes(t)).length * 2;
      if (focusKw && (c.title.toLowerCase().includes(focusKw) || (c.focusKeyword || "").toLowerCase() === focusKw)) {
        score += 2;
      }
      return { article: c, score };
    });
    relatedArticles = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.article);
    if (relatedArticles.length < 3) {
      const filler = candidates
        .filter((c) => !relatedArticles.some((r) => r.id === c.id))
        .slice(0, 3 - relatedArticles.length);
      relatedArticles = [...relatedArticles, ...filler];
    }
  } catch {}

  const jsonLdNodes = buildJsonLd(article);
  const hero = article.coverImage || article.ogImage;

  return (
    <>
      {jsonLdNodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
      <ArticleReadTracker articleId={article.id} slug={article.slug} />
      <Navbar />
      <main className="pt-24 pb-16">
        <article className="max-w-3xl mx-auto px-6">
          <div className="mb-8">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับไปบทความ
            </Link>
          </div>

          <header className="mb-8">
            {article.category && (
              <Link
                href={`/articles/category/${article.category.slug}`}
                className="inline-flex px-3 py-1 rounded-full text-xs font-medium text-white mb-4"
                style={{ backgroundColor: article.category.color }}
              >
                {article.category.name}
              </Link>
            )}

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="mt-4 text-lg text-gray-500 leading-relaxed">{article.excerpt}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {article.authorStaff && (
                <Link
                  href={`/articles/author/${article.authorStaff.id}`}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  {article.authorStaff.name}
                </Link>
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

          {hero && (
            <div className="relative aspect-[3/2] rounded-2xl overflow-hidden mb-10">
              <Image src={hero} alt={article.title} fill className="object-cover" priority />
            </div>
          )}

          {article.content && (
            <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />
          )}

          {article.tags && (
            <div className="mt-10 pt-8 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">แท็ก</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {article.tags.split(",").map((tag: string) => (
                  <span key={tag.trim()} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full">
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>

        {relatedArticles.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 mt-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">บทความที่เกี่ยวข้อง</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedArticles.map((related: any) => (
                <Link key={related.id} href={`/articles/${related.slug}`} className="group block">
                  <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300">
                    <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                      {related.coverImage ? (
                        <Image
                          src={related.coverImage}
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
