import { prisma } from "@/lib/prisma";
import { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://www.goodfood.in.th";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  let articlePages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];
  let authorPages: MetadataRoute.Sitemap = [];

  try {
    const [articles, categories, authors] = await Promise.all([
      prisma.article.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.articleCategory.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.staff.findMany({
        where: {
          isActive: true,
          articles: { some: { status: "PUBLISHED" } },
        },
        select: { id: true, updatedAt: true },
      }),
    ]);

    articlePages = articles.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    categoryPages = categories.map((c) => ({
      url: `${baseUrl}/articles/category/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    authorPages = authors.map((a) => ({
      url: `${baseUrl}/articles/author/${a.id}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    // DB might not be available during build
  }

  return [...staticPages, ...articlePages, ...categoryPages, ...authorPages];
}
