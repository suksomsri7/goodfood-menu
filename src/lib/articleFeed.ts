/**
 * บทความสุขภาพ (goodfood.in.th/articles) ที่ส่งถึงผู้ใช้แอป Coach
 *
 * 2 ทาง:
 *  1) feed ในแอป — GET /api/coach/articles
 *  2) push คัดตามพฤติกรรมจริง — /api/cron/article-push (19:30 น. ทุกวัน)
 *
 * 🔴 การจับคู่บทความ ↔ ผู้ใช้ เป็น deterministic ทั้งหมด (keyword ↔ BehaviorInsight)
 *    ไม่เรียก AI — ไม่เสียเงิน ไม่แต่งข้อมูล และผลลัพธ์อธิบายได้ว่าทำไมถึงได้บทความนี้
 */
import { prisma } from "@/lib/prisma";
import {
  bkkDayString,
  dailyRank,
  matchByTopics,
  memberSignals,
  orderForDay,
  type MemberSignal,
  type TopicKey,
} from "@/lib/memberTopics";

// ของเดิมย้ายไปอยู่ memberTopics.ts (ใช้ร่วมกับฟีเจอร์คลิป) — re-export ไว้ให้ผู้เรียกเดิมไม่ต้องแก้
export { bkkDayString, dailyRank, memberSignals };
export type { MemberSignal, TopicKey };

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://goodfood.in.th").replace(/\/$/, "");

/**
 * ลิงก์หน้าบทความจริงบนเว็บ — src/app/(landing)/articles/[slug]/page.tsx
 * slug เป็นภาษาไทย: ห้าม encodeURI (LINE/Expo/เบราว์เซอร์ encode ให้เองตอนเปิด
 * ถ้า encode ซ้ำจะได้ %25E0%25B8... แล้ว 404)
 */
export function articleUrl(slug: string, utmSource = "coach_app"): string {
  return `${BASE_URL}/articles/${slug}?utm_source=${utmSource}`;
}

export type ArticleFeedItem = {
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  url: string;
  category: string | null;
  publishedAt: string | null;
};

export const ARTICLE_FEED_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  ogImage: true,
  tags: true,
  publishedAt: true,
  category: { select: { name: true } },
} as const;

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  ogImage: string | null;
  publishedAt: Date | null;
  category: { name: string } | null;
};

/**
 * รูปปกใน DB เก็บเป็น path สั้น (/uploads/articles/xxx.webp)
 * แอปเอาไป render ตรง ๆ ไม่ได้ (ไม่มี host) → ต้องคืน URL เต็มเสมอ
 */
export function absoluteImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function toFeedItem(a: ArticleRow): ArticleFeedItem {
  return {
    id: a.id,
    title: a.title,
    excerpt: a.excerpt,
    imageUrl: absoluteImageUrl(a.coverImage || a.ogImage),
    url: articleUrl(a.slug),
    category: a.category?.name ?? null,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
  };
}

// ── การจับคู่ตามพฤติกรรม ───────────────────────────────────────────────

/**
 * คำที่บอกว่าบทความ "เกี่ยวกับ" เรื่องอะไร — จับจาก title + tags + ชื่อหมวด
 * ตั้งใจให้แคบไว้ก่อน: ไม่ match ใคร = ไม่ส่ง ดีกว่าส่งมั่ว
 */
export const TOPIC_KEYWORDS: Record<TopicKey, string[]> = {
  sodium: ["โซเดียม", "เค็ม", "เกลือ", "น้ำปลา", "ซอส", "ผงชูรส", "ซุปก้อน", "บะหมี่กึ่ง", "ความดัน", "sodium"],
  sugar: ["น้ำตาล", "หวาน", "ของหวาน", "ชานม", "น้ำอัดลม", "ขนม", "เบเกอรี่", "เบาหวาน", "อินซูลิน", "sugar"],
  protein: ["โปรตีน", "อกไก่", "ไข่", "เต้าหู้", "เวย์", "ถั่ว", "กล้ามเนื้อ", "protein"],
  sleep: ["นอน", "หลับ", "พักผ่อน", "เมลาโทนิน", "นาฬิกาชีวิต", "sleep"],
  weight: ["น้ำหนัก", "ลดพุง", "ยุบพุง", "ไขมัน", "เผาผลาญ", "อ้วน", "plateau", "ตัน", "ลดความอ้วน"],
  exercise: ["ออกกำลังกาย", "เดิน", "วิ่ง", "เวท", "คาร์ดิโอ", "ยืดเส้น", "workout", "ฟิตเนส"],
};

/** บทความนี้พูดเรื่องอะไรบ้าง (0..n เรื่อง) */
export function articleTopics(a: { title: string; tags?: string | null; category?: { name: string } | null }): TopicKey[] {
  const hay = [a.title, a.tags || "", a.category?.name || ""].join(" ").toLowerCase();
  return (Object.keys(TOPIC_KEYWORDS) as TopicKey[]).filter((k) =>
    TOPIC_KEYWORDS[k].some((w) => hay.includes(w.toLowerCase()))
  );
}

// ── จับคู่บทความ ↔ ปัญหาของ member (ใช้ร่วมกันระหว่าง cron push กับ feed รายวัน) ──

type MatchableArticle = { title: string; tags?: string | null; category?: { name: string } | null };

/** บทความนี้ "เกี่ยวกับสุขภาพ" ไหม — ใช้ตัวเดียวกับที่ cron ใช้กรองก่อนส่ง push */
export function isHealthArticle(a: MatchableArticle): boolean {
  return articleTopics(a).length > 0;
}

export type ArticleMatch<T> = { article: T; topic: TopicKey; reason: string };

/**
 * บทความไหนตรงกับปัญหาพฤติกรรมของ member บ้าง (คงลำดับที่ส่งเข้ามา)
 * แชร์ระหว่าง /api/cron/article-push (เลือก 1 บทไปเตือน) กับ
 * /api/coach/articles?daily=1 (จัดอันดับ "บทความสำหรับคุณวันนี้")
 */
export function matchArticles<T extends MatchableArticle>(
  articles: T[],
  signals: MemberSignal[]
): Array<ArticleMatch<T>> {
  return matchByTopics(articles, articleTopics, signals).map((m) => ({
    article: m.item,
    topic: m.topic,
    reason: m.reason,
  }));
}

// ── "บทความสำหรับคุณวันนี้" — หมุนเวียนรายวันแบบ deterministic ──

export type DailyArticleItem = ArticleFeedItem & { matchedTopic?: TopicKey; reason?: string };

/**
 * บทความประจำวันของ member: ที่ตรงกับพฤติกรรมมาก่อน แล้วเติมด้วยบทความสุขภาพทั่วไป
 * ทั้งหมด deterministic — ไม่เรียก AI ไม่สุ่มจริง
 */
export async function pickDailyArticles(
  member: { id: string; goalType: string | null; dailySugar: number | null },
  limit: number,
  now = new Date(),
  dayKeyOverride?: string
): Promise<{ items: DailyArticleItem[]; dayKey: string }> {
  const dayKey = dayKeyOverride || bkkDayString(now);

  const pool = await prisma.article.findMany({
    where: { status: "PUBLISHED", publishedAt: { not: null, lte: now } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: ARTICLE_FEED_SELECT,
  });

  // กรองบทความที่ไม่เกี่ยวสุขภาพออก (ตัวเดียวกับที่ cron ใช้ — เช่น ข่าวประชาสัมพันธ์ร้าน)
  const health = pool.filter((a) => isHealthArticle(a));

  const signals = await memberSignals(member).catch(() => []);
  const matches = matchArticles(health, signals);
  const { ordered, matchById } = orderForDay({
    items: health,
    idOf: (a) => a.id,
    matches: matches.map((m) => ({ item: m.article, topic: m.topic, reason: m.reason })),
    signals,
    memberId: member.id,
    dayKey,
    limit,
  });

  const items = ordered.slice(0, Math.max(0, limit)).map((a) => {
    const m = matchById.get(a.id);
    return { ...toFeedItem(a), ...(m ? { matchedTopic: m.topic, reason: m.reason } : {}) };
  });
  return { items, dayKey };
}
