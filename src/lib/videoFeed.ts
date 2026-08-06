/**
 * "คลิปสำหรับคุณวันนี้" — คลิปสั้นจากช่อง YouTube ของ GoodFood ที่คัดให้ member รายวัน
 * อ่านจากตาราง coach_videos (cron /api/cron/video-sync เติมไว้) ไม่ยิง YouTube ต่อ request
 *
 * ตรรกะการคัดเหมือน "บทความสำหรับคุณวันนี้" ทุกประการ — ใช้โค้ดชุดเดียวกันใน memberTopics.ts
 * (memberSignals / matchByTopics / orderForDay / dailyRank) ต่างกันแค่คลังเนื้อหาและคำในเหตุผล
 */
import { prisma } from "@/lib/prisma";
import {
  bkkDayString,
  matchByTopics,
  memberSignals,
  orderForDay,
  type TopicKey,
} from "@/lib/memberTopics";

export type VideoFeedItem = {
  videoId: string;
  title: string;
  thumbnail: string;
  url: string;
  publishedAt: string;
};

export type DailyVideoItem = VideoFeedItem & { matchedTopic?: TopicKey; reason?: string };

type VideoRow = {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: Date;
  topics: string[];
};

export const VIDEO_FEED_SELECT = {
  videoId: true,
  title: true,
  thumbnail: true,
  publishedAt: true,
  topics: true,
} as const;

export function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function toVideoItem(v: VideoRow): VideoFeedItem {
  return {
    videoId: v.videoId,
    title: v.title,
    thumbnail: v.thumbnail,
    url: videoUrl(v.videoId),
    publishedAt: v.publishedAt.toISOString(),
  };
}

/**
 * คลิปประจำวันของ member: ที่ตรงกับพฤติกรรมมาก่อน (เรียงตามความหนักของปัญหา)
 * แล้วเติมด้วยคลิปที่เหลือ · หมุนเวียนทุกเที่ยงคืนไทยแบบ deterministic
 *
 * ต่างจากบทความตรงที่ "ไม่กรองคลิปที่ไม่เข้าหัวข้อทิ้ง" — ทั้งช่องเป็นคลิปสาระสุขภาพอยู่แล้ว
 * คลิปที่ topics ว่างจึงยังใช้เติมท้ายได้ (คลังคลิปเล็กกว่าคลังบทความมาก)
 */
export async function pickDailyVideos(
  member: { id: string; goalType: string | null; dailySugar: number | null },
  limit: number,
  now = new Date(),
  dayKeyOverride?: string
): Promise<{ items: DailyVideoItem[]; dayKey: string }> {
  const dayKey = dayKeyOverride || bkkDayString(now);

  const pool = await prisma.coachVideo.findMany({
    where: { isActive: true, publishedAt: { lte: now } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: VIDEO_FEED_SELECT,
  });

  const signals = await memberSignals(member, "video").catch(() => []);
  const matches = matchByTopics(pool, (v) => v.topics as TopicKey[], signals);

  const { ordered, matchById } = orderForDay({
    items: pool,
    idOf: (v) => v.videoId,
    matches,
    signals,
    memberId: member.id,
    dayKey,
  });

  const items = ordered.slice(0, Math.max(0, limit)).map((v) => {
    const m = matchById.get(v.videoId);
    return { ...toVideoItem(v), ...(m ? { matchedTopic: m.topic, reason: m.reason } : {}) };
  });
  return { items, dayKey };
}
