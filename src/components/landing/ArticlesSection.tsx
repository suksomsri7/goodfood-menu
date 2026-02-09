"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Eye } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  readTime: number;
  views: number;
  publishedAt: string | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
}

interface ArticlesSectionProps {
  articles: Article[];
}

export function ArticlesSection({ articles }: ArticlesSectionProps) {
  if (articles.length === 0) return null;

  return (
    <section id="articles" className="py-24 md:py-32 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="text-sm font-medium text-primary-600 tracking-wide uppercase">
                บทความ
              </span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
                เรื่องน่ารู้
                <span className="text-gray-400"> เพื่อสุขภาพ</span>
              </h2>
            </div>
            <Link
              href="/articles"
              className="hidden md:inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ดูทั้งหมด
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.slice(0, 6).map((article, index) => (
            <ScrollReveal key={article.id} delay={index * 0.1}>
              <Link
                href={`/articles/${article.slug}`}
                className="group block"
              >
                <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
                  {/* Image */}
                  <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                    {article.imageUrl ? (
                      <Image
                        src={article.imageUrl}
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

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
                      {article.title}
                    </h3>
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
                    </div>
                  </div>
                </article>
              </Link>
            </ScrollReveal>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/articles"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50"
          >
            ดูบทความทั้งหมด
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
