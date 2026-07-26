import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resizeAndUploadSocialBase } from "./compositeCard";
import { sharkPublish } from "./sharkClient";
import { getSecret } from "@/lib/secrets/store";

export type SocialCardJson = {
  imageText: { line1: string; line2: string };
  caption: string;
  hashtags: string[];
  firstComment?: string;
};

function isValidSocialCard(value: unknown): value is SocialCardJson {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  if (!v.imageText || typeof v.imageText.line1 !== "string" || typeof v.imageText.line2 !== "string") return false;
  if (typeof v.caption !== "string") return false;
  if (!Array.isArray(v.hashtags)) return false;
  return true;
}

function buildText(card: SocialCardJson, articleTitle: string, articleUrl: string): string {
  const tags = card.hashtags.filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  const readMore = `📖 อ่านบทความเต็ม: ${articleTitle}\n${articleUrl}`;
  return `${card.caption.trim()}\n\n${readMore}\n\n${tags}`.trim();
}

function siteOrigin(): string {
  return process.env.PUBLIC_SITE_URL || "https://goodfood.in.th";
}

function publicUrlForUpload(relPath: string): string {
  if (!relPath) return "";
  if (relPath.startsWith("http")) return relPath;
  return `${siteOrigin()}${relPath.startsWith("/") ? "" : "/"}${relPath}`;
}

/**
 * Dispatch one article's social card to SHARK. Returns the resulting
 * SocialDispatch row. Idempotent-ish: if already DISPATCHED, returns early.
 */
const MAX_ATTEMPTS = 3;

export async function dispatchArticleSocial(articleId: string): Promise<{
  ok: boolean;
  status: string;
  message?: string;
  socialPostId?: string;
}> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
      socialCard: true,
      socialImage: true,
      socialDispatchedAt: true,
      createdAt: true,
    },
  });
  if (!article) return { ok: false, status: "NOT_FOUND" };
  if (article.socialDispatchedAt) return { ok: true, status: "ALREADY_DISPATCHED" };

  const prevAttempts = await prisma.socialDispatch.count({
    where: { articleId: article.id, status: "FAILED" },
  });
  if (prevAttempts >= MAX_ATTEMPTS) {
    return { ok: false, status: "MAX_ATTEMPTS_REACHED", message: `${prevAttempts} previous failures` };
  }
  if (!isValidSocialCard(article.socialCard)) {
    // Mark as dispatched so cron won't retry this article forever
    await prisma.article.update({
      where: { id: article.id },
      data: { socialDispatchedAt: new Date() },
    });
    return { ok: false, status: "INVALID_CARD", message: "socialCard JSON malformed — marked dispatched to stop retries" };
  }
  if (!article.coverImage) {
    // Mark as dispatched so cron won't retry this article forever
    await prisma.article.update({
      where: { id: article.id },
      data: { socialDispatchedAt: new Date() },
    });
    return { ok: false, status: "NO_COVER", message: "article has no coverImage — marked dispatched to stop retries" };
  }

  const card = article.socialCard as SocialCardJson;
  const channelsRaw = (await getSecret("SHARK_CHANNEL_IDS")) || "";
  const channelIds = channelsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("*"));
  if (channelIds.length === 0) {
    return { ok: false, status: "NO_CHANNELS", message: "SHARK_CHANNEL_IDS empty or all masked" };
  }

  // Schedule = createdAt + 24h. If that's already in the past (e.g. retrying
  // an old article), publish 5 minutes from now instead so SHARK accepts it.
  const baseTime = new Date(article.createdAt.getTime() + 24 * 3600 * 1000);
  const minTime = new Date(Date.now() + 5 * 60 * 1000);
  const scheduledAt = baseTime < minTime ? minTime : baseTime;

  const dispatchRow = await prisma.socialDispatch.create({
    data: {
      articleId: article.id,
      channelIds,
      status: "PENDING",
      scheduledAt,
    },
  });

  try {
    // 1) resize cover to 1080×1350 raw — NO bake. SHARK composites overlay
    //    at FB-send time, so user can edit headline/watermark in photo editor
    //    before the scheduled send.
    let socialImage = article.socialImage;
    if (!socialImage) {
      const baseSource = article.coverImage.startsWith("/")
        ? publicUrlForUpload(article.coverImage)
        : article.coverImage;
      socialImage = await resizeAndUploadSocialBase(baseSource, `${article.id}`);
      await prisma.article.update({
        where: { id: article.id },
        data: { socialImage },
      });
    }

    // 2) POST SHARK with overlay metadata (no bake) — SHARK photo editor uses
    //    these as editable overlays + cron composites them at FB-send time.
    // URL goes inline in the caption (not as a first comment) — Meta demotes
    // "link in first comment" pattern, hurting reach on new Pages.
    const articleUrl = `${siteOrigin()}/articles/${article.slug}`;

    const result = await sharkPublish({
      channelIds,
      text: buildText(card, article.title, articleUrl),
      mediaUrl: publicUrlForUpload(socialImage),
      firstComment: "",
      scheduledAt,
      sourceTitle: article.title,
      socialOverlay: {
        line1: card.imageText.line1,
        line2: card.imageText.line2,
        watermarkText: "GoodFood",
        accent: "#FFCC00",
      },
    });

    const postId =
      (result?.scheduledPostId as string) ||
      (result?.id as string) ||
      (Array.isArray(result?.posts) ? result.posts[0]?.id : null) ||
      null;

    await prisma.$transaction([
      prisma.socialDispatch.update({
        where: { id: dispatchRow.id },
        data: {
          status: "DISPATCHED",
          sharkPostId: postId,
          dispatchedAt: new Date(),
          attemptCount: { increment: 1 },
        },
      }),
      prisma.article.update({
        where: { id: article.id },
        data: {
          socialDispatchedAt: new Date(),
          socialPostId: postId,
        },
      }),
    ]);

    return { ok: true, status: "DISPATCHED", socialPostId: postId || undefined };
  } catch (e: any) {
    await prisma.socialDispatch.update({
      where: { id: dispatchRow.id },
      data: {
        status: "FAILED",
        error: String(e?.message || e).slice(0, 500),
        attemptCount: { increment: 1 },
      },
    });
    return { ok: false, status: "FAILED", message: String(e?.message || e) };
  }
}

/**
 * Find articles ready for dispatch and process them sequentially. Used by the
 * cron endpoint. Keep concurrency at 1 — Sharp + SHARK rate limits both prefer
 * serial work, and the queue size is small.
 */
export async function dispatchPendingArticles(limit = 5): Promise<{
  scanned: number;
  dispatched: number;
  failed: number;
  results: Array<{ id: string; status: string; error?: string }>;
}> {
  const overLimit = await prisma.socialDispatch.groupBy({
    by: ["articleId"],
    where: { status: "FAILED" },
    _count: { _all: true },
    having: { articleId: { _count: { gte: MAX_ATTEMPTS } } },
  });
  const blockedIds = overLimit.map((g) => g.articleId);

  const pending = await prisma.article.findMany({
    where: {
      AND: [
        { socialDispatchedAt: null },
        { coverImage: { not: null } },
        { socialCard: { not: Prisma.JsonNull } },
        blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {},
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  let dispatched = 0;
  let failed = 0;
  for (const row of pending) {
    const r = await dispatchArticleSocial(row.id);
    if (r.ok && r.status === "DISPATCHED") dispatched++;
    else if (!r.ok) failed++;
    results.push({ id: row.id, status: r.status, error: r.message });
  }
  return { scanned: pending.length, dispatched, failed, results };
}
