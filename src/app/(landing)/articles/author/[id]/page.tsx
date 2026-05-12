import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ArrowLeft, Clock, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "https://www.goodfood.in.th";

async function getAuthor(id: string) {
  const staff = await prisma.staff.findUnique({
    where: { id, isActive: true },
    select: { id: true, name: true, avatarUrl: true, createdAt: true },
  });
  if (!staff) return null;
  const articles = await prisma.article.findMany({
    where: { authorId: id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
    },
  });
  return { staff, articles };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getAuthor(id);
  if (!data) return { title: "ไม่พบผู้เขียน | Good Food" };

  const { staff } = data;
  const title = `บทความโดย ${staff.name} | Good Food`;
  const description = `บทความทั้งหมดที่เขียนโดย ${staff.name} บน Good Food`;
  const canonical = `${BASE_URL}/articles/author/${staff.id}`;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile", locale: "th_TH", url: canonical, siteName: "Good Food" },
    alternates: { canonical, languages: { "th-TH": canonical } },
  };
}

export default async function AuthorPage({ params }: Props) {
  const { id } = await params;
  const data = await getAuthor(id);
  if (!data) notFound();
  const { staff, articles } = data;

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: staff.name,
    url: `${BASE_URL}/articles/author/${staff.id}`,
    image: staff.avatarUrl || undefined,
    worksFor: { "@type": "Organization", name: "Good Food", url: BASE_URL },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "หน้าแรก", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "บทความ", item: `${BASE_URL}/articles` },
      {
        "@type": "ListItem",
        position: 3,
        name: staff.name,
        item: `${BASE_URL}/articles/author/${staff.id}`,
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              บทความทั้งหมด
            </Link>
            <div className="flex items-center gap-4">
              {staff.avatarUrl ? (
                <Image
                  src={staff.avatarUrl}
                  alt={staff.name}
                  width={80}
                  height={80}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-3xl font-bold text-primary-600">
                  {staff.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{staff.name}</h1>
                <p className="mt-1 text-sm text-gray-500">{articles.length} บทความ</p>
              </div>
            </div>
          </div>

          {articles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article: any) => (
                <Link key={article.id} href={`/articles/${article.slug}`} className="group block">
                  <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300">
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
                          style={{ backgroundColor: article.category.color }}
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
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2">{article.excerpt}</p>
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
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <span className="text-6xl mb-4 block">✍️</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มีบทความ</h3>
              <p className="text-gray-500">{staff.name} ยังไม่มีบทความเผยแพร่</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
