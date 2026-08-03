/**
 * Push บทความสุขภาพแบบคัดตามพฤติกรรม (B2)
 *
 * กติกา (ทั้งหมด deterministic — ไม่เรียก AI):
 *  - บทความใหม่ ≤ ARTICLE_MAX_AGE_DAYS วัน และเผยแพร่แล้ว
 *  - จับคู่ keyword ของบทความ (title/tags/หมวด) กับปัญหาพฤติกรรมจริงของ member (BehaviorInsight)
 *  - ไม่ match ใคร = ไม่ส่ง (ห้าม broadcast บทความให้ทุกคน — เป็นวิธีที่เร็วที่สุดที่จะโดนปิดแจ้งเตือน)
 *  - 1 บทความ / member ส่งได้ครั้งเดียวตลอดกาล · เพดาน 3 บทความ/สัปดาห์/member
 *  - เคารพ notifyArticles + notificationsPausedUntil + เวลาเงียบ (เหมือน nudgeEngine)
 */
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { isAiCoachActive } from "@/lib/coaching";
import { bkkTodayKey } from "@/lib/planGenerator";
import { articleTopics, articleUrl, memberSignals, type TopicKey } from "@/lib/articleFeed";

const ARTICLE_MAX_AGE_DAYS = 3;
const WEEKLY_CAP = 3; // บทความสูงสุด/สัปดาห์/คน
const QUIET_START = 21; // ≥ 21:00 น. ไทย = เงียบ
const QUIET_END = 8; // < 08:00 น. ไทย = เงียบ
const DISPATCH_PREFIX = "article_";

function bkkHour(now: Date): number {
  return new Date(now.getTime() + 7 * 3600 * 1000).getUTCHours();
}

/** ตัดหัวข้อไม่ให้ยาวเกินบรรทัดแจ้งเตือนของ iOS */
function hook(title: string): string {
  const t = title.trim();
  return t.length <= 58 ? t : `${t.slice(0, 57)}…`;
}

export type ArticlePushResult = {
  ok: true;
  sent: number;
  checked: number;
  articles: number;
  skippedQuiet?: boolean;
  details: Array<{ memberId: string; status: string; articleId?: string; topic?: TopicKey }>;
};

export async function runArticlePush(now = new Date(), opts?: { force?: boolean }): Promise<ArticlePushResult> {
  const hour = bkkHour(now);
  const details: ArticlePushResult["details"] = [];

  // เวลาเงียบ — cron ตั้งไว้ 19:30 น. อยู่แล้ว แต่กันกรณียิงมือ/cron เพี้ยน
  if (!opts?.force && (hour >= QUIET_START || hour < QUIET_END)) {
    return { ok: true, sent: 0, checked: 0, articles: 0, skippedQuiet: true, details };
  }

  const since = new Date(now.getTime() - ARTICLE_MAX_AGE_DAYS * 24 * 3600 * 1000);
  const fresh = await prisma.article.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: since, lte: now } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      tags: true,
      publishedAt: true,
      category: { select: { name: true } },
    },
  });

  // บทความที่ไม่เข้าหัวข้อไหนเลย = ส่งให้ใครไม่ได้ ตัดทิ้งตั้งแต่ต้น
  const candidates = fresh
    .map((a) => ({ ...a, topics: articleTopics(a) }))
    .filter((a) => a.topics.length > 0);

  if (candidates.length === 0) {
    return { ok: true, sent: 0, checked: 0, articles: fresh.length, details };
  }

  const members = await prisma.member.findMany({
    where: {
      isActive: true,
      notifyArticles: true,
      deviceTokens: { some: {} },
      OR: [{ notificationsPausedUntil: null }, { notificationsPausedUntil: { lt: now } }],
    },
    include: { memberType: true },
  });

  const todayKey = bkkTodayKey();
  const weekAgoKey = new Date(todayKey.getTime() - 7 * 24 * 3600 * 1000);
  let sent = 0;

  for (const m of members) {
    if (!isAiCoachActive(m)) {
      details.push({ memberId: m.id, status: "no-access" });
      continue;
    }

    // เพดาน 3 บทความ/สัปดาห์
    const weekCount = await prisma.coachDispatchLog.count({
      where: { memberId: m.id, type: { startsWith: DISPATCH_PREFIX }, date: { gte: weekAgoKey } },
    });
    if (weekCount >= WEEKLY_CAP) {
      details.push({ memberId: m.id, status: "weekly-capped" });
      continue;
    }

    const signals = await memberSignals(m);
    if (signals.length === 0) {
      details.push({ memberId: m.id, status: "no-signal" });
      continue;
    }
    const byTopic = new Map(signals.map((s) => [s.topic, s.reason]));

    // เคยส่งบทความไหนไปแล้วบ้าง (ตลอดกาล)
    const seen = await prisma.coachDispatchLog.findMany({
      where: { memberId: m.id, type: { startsWith: DISPATCH_PREFIX } },
      select: { type: true },
    });
    const seenIds = new Set(seen.map((s) => s.type.slice(DISPATCH_PREFIX.length)));

    // บทความใหม่สุดที่ตรงกับปัญหาของเขา และยังไม่เคยส่ง
    const pick = candidates.find((a) => !seenIds.has(a.id) && a.topics.some((t) => byTopic.has(t)));
    if (!pick) {
      details.push({ memberId: m.id, status: "no-match" });
      continue;
    }
    const topic = pick.topics.find((t) => byTopic.has(t))!;

    const url = articleUrl(pick.slug);
    await sendPush(
      m.id,
      {
        title: hook(pick.title),
        body: byTopic.get(topic)!,
        data: { screen: "article", url, articleId: pick.id, topic },
      },
      "article"
    );

    // บันทึก dispatch เสมอ (ไม่ผูกกับผลส่ง push): บทความโผล่ในศูนย์แจ้งเตือนของแอปแล้ว
    // ถ้าผูกกับ push สำเร็จ เครื่องที่ token หมดอายุจะโดนยิงซ้ำทุกวัน
    await prisma.coachDispatchLog
      .create({ data: { memberId: m.id, date: todayKey, type: `${DISPATCH_PREFIX}${pick.id}` } })
      .catch(() => {});

    sent++;
    details.push({ memberId: m.id, status: "sent", articleId: pick.id, topic });
  }

  return { ok: true, sent, checked: members.length, articles: candidates.length, details };
}
