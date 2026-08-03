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

export function toFeedItem(a: ArticleRow): ArticleFeedItem {
  return {
    id: a.id,
    title: a.title,
    excerpt: a.excerpt,
    imageUrl: a.coverImage || a.ogImage || null,
    url: articleUrl(a.slug),
    category: a.category?.name ?? null,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
  };
}

// ── การจับคู่ตามพฤติกรรม ───────────────────────────────────────────────

export type TopicKey = "sodium" | "sugar" | "protein" | "sleep" | "weight" | "exercise";

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

export type MemberSignal = { topic: TopicKey; reason: string };

/**
 * ปัญหาพฤติกรรมของ member ตอนนี้ — อ่านจาก BehaviorInsight รายสัปดาห์ล่าสุด (cron insights เขียนไว้)
 * ยกเว้น "น้ำตาล" ที่ยังไม่มี metric ใน BehaviorInsight → คิดสดจาก MealLog 7 วัน (ยังคง deterministic)
 */
export async function memberSignals(member: {
  id: string;
  goalType: string | null;
  dailySugar: number | null;
}): Promise<MemberSignal[]> {
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [insights, sugarAgg, sugarDays] = await Promise.all([
    prisma.behaviorInsight.findMany({
      where: { memberId: member.id, periodType: "weekly" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.mealLog.aggregate({
      where: { memberId: member.id, date: { gte: since7 } },
      _sum: { sugar: true },
    }),
    prisma.mealLog.findMany({
      where: { memberId: member.id, date: { gte: since7 } },
      select: { date: true },
    }),
  ]);

  // metric ล่าสุดของแต่ละชนิด
  const latest = new Map<string, any>();
  for (const i of insights) if (!latest.has(i.metric)) latest.set(i.metric, i.value);

  const out: MemberSignal[] = [];

  const sodium = latest.get("sodium_trend");
  if (sodium && (Number(sodium.overDays) >= 2 || Number(sodium.avg) > Number(sodium.target || 2300))) {
    out.push({
      topic: "sodium",
      reason: `โซเดียมช่วงนี้เกินเป้าบ่อย (เฉลี่ย ${Math.round(Number(sodium.avg))} mg/วัน) บทความนี้ช่วยได้`,
    });
  }

  const protein = latest.get("protein_gap");
  if (protein && Number(protein.gap) > 0) {
    out.push({
      topic: "protein",
      reason: `โปรตีนยังขาดวันละ ~${Math.round(Number(protein.gap))} g บทความนี้มีไอเดียเพิ่มให้ครับ`,
    });
  }

  const sleep = latest.get("sleep_avg");
  if (sleep && Number(sleep.avgMin) > 0 && Number(sleep.avgMin) < 390) {
    const h = (Number(sleep.avgMin) / 60).toFixed(1);
    out.push({ topic: "sleep", reason: `ช่วงนี้นอนเฉลี่ย ${h} ชม./คืน ยังน้อยไป อ่านเรื่องนี้น่าจะช่วยครับ` });
  }

  const weight = latest.get("weight_trend");
  if (weight && member.goalType === "lose" && Number(weight.deltaKg) >= 0) {
    out.push({ topic: "weight", reason: "น้ำหนัก 2 สัปดาห์นี้ยังไม่ขยับลง ลองอ่านมุมนี้ดูครับ" });
  }

  const adherence = latest.get("adherence");
  if (adherence && Number(adherence.score) < 0.5) {
    out.push({ topic: "exercise", reason: "สัปดาห์นี้ทำตามแผนได้ไม่ครบ บทความนี้อาจช่วยให้กลับมาง่ายขึ้นครับ" });
  }

  // น้ำตาล: เฉลี่ยต่อวันจากวันที่มีบันทึกจริง (ไม่หารด้วย 7 ตรง ๆ — คนที่บันทึกไม่ครบจะดูดีเกินจริง)
  const target = member.dailySugar || 50;
  const daysLogged = new Set(sugarDays.map((x) => x.date.toISOString().slice(0, 10))).size;
  if (daysLogged >= 3) {
    const avgSugar = (sugarAgg._sum.sugar || 0) / daysLogged;
    if (avgSugar > target) {
      out.push({
        topic: "sugar",
        reason: `น้ำตาลเฉลี่ย ~${Math.round(avgSugar)} g/วัน (เป้า ${Math.round(target)}) บทความนี้ช่วยได้ครับ`,
      });
    }
  }

  return out;
}
