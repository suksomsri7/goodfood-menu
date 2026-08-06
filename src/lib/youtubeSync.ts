/**
 * ดึงคลิปช่อง YouTube ของ GoodFood ("YammY Studio") มาเก็บลงตาราง coach_videos
 * ใช้โดย cron /api/cron/video-sync (วันละครั้ง 05:10 น. ไทย) — แอปอ่านจาก DB เท่านั้น
 * 🔴 ห้ามยิง YouTube ต่อ request ของผู้ใช้
 *
 * 2 แหล่ง (เลือกอัตโนมัติ):
 *  1) YouTube Data API v3 — ถ้ามี env YOUTUBE_API_KEY (เห็นครบทุกคลิป, 1 หน่วยโควตา/หน้า)
 *  2) RSS ของช่อง — ถ้าไม่มี key (สถานะปัจจุบัน) เห็นเฉพาะคลิป public ล่าสุด ~15 คลิป ไม่ต้องใช้ key
 *
 * ทั้งสองทางเห็นเฉพาะคลิป public — คลิปที่ยัง private จะยังไม่โผล่ในแอป (ตั้งใจ)
 * การจับคู่คลิป ↔ หัวข้อสุขภาพ เป็น keyword ล้วน (deterministic) ไม่เรียก AI
 */
import { prisma } from "@/lib/prisma";
import { hasKeyword, type TopicKey } from "@/lib/memberTopics";

export const YT_CHANNEL_ID = "UCjFz_fjgbHzJikorSDkArVQ";
export const YT_UPLOADS_PLAYLIST_ID = "UUjFz_fjgbHzJikorSDkArVQ";

/**
 * คำในชื่อคลิป/คำอธิบาย → หัวข้อสุขภาพ (กลุ่มเดียวกับบทความ)
 * 🔴 แก้ตรงนี้ที่เดียวเมื่อเนื้อหาช่องขยายหัวข้อใหม่
 * ลำดับ key = ลำดับความสำคัญเดียวกับ memberSignals (โซเดียม → โปรตีน → นอน → น้ำหนัก → ออกกำลังกาย → น้ำตาล)
 * คำอังกฤษถูกจับแบบ "คำเต็ม" เท่านั้น (hasKeyword) — ไม่งั้น "if" จะไปโดน "life/fifty"
 */
export const VIDEO_TOPIC_KEYWORDS: Record<TopicKey, string[]> = {
  sodium: ["อาหารแปรรูป", "แปรรูปสูง", "โซเดียม", "เค็ม", "เกลือ", "ผงชูรส", "บะหมี่กึ่ง", "ความดัน", "sodium", "ultra-processed"],
  protein: ["โปรตีน", "proffee", "protein", "เวย์", "อกไก่", "กล้ามเนื้อ"],
  sleep: ["นอน", "หลับ", "เมลาโทนิน", "sleep"],
  weight: ["ลดน้ำหนัก", "ลดความอ้วน", "น้ำหนัก", "อดเป็นช่วง", "ฟาสติ้ง", "โยโย่", "ลดพุง", "ยุบพุง", "เผาผลาญ", "ไขมัน", "if", "fasting", "yoyo"],
  // 🔴 ห้ามใส่ "เวท" เดี่ยว ๆ — ไปโดน "เวที" (เจอจริงในคลิป fibermaxxing ที่พูดถึง CEO พูดบนเวที)
  exercise: ["ออกกำลังกาย", "เวทเทรนนิ่ง", "ยกเวท", "เล่นเวท", "คาร์ดิโอ", "วิ่ง", "ยืดเส้น", "cardio", "workout", "ฟิตเนส"],
  sugar: ["น้ำตาล", "ของหวาน", "หวาน", "ชานม", "น้ำอัดลม", "ใยอาหาร", "ไฟเบอร์", "sugar", "fiber", "fibermaxxing"],
};

/** คลิปนี้พูดเรื่องอะไรบ้าง (0..n เรื่อง) — ไม่เข้าอะไรเลย = [] (ยังโชว์ได้ในโหมดเติม) */
export function videoTopics(v: { title: string; description?: string | null }): TopicKey[] {
  const hay = `${v.title} ${v.description || ""}`.toLowerCase();
  return (Object.keys(VIDEO_TOPIC_KEYWORDS) as TopicKey[]).filter((k) =>
    VIDEO_TOPIC_KEYWORDS[k].some((w) => hasKeyword(hay, w))
  );
}

// ── ดึงรายการคลิป ────────────────────────────────────────────────────────

export type RawVideo = {
  videoId: string;
  title: string;
  description: string | null;
  thumbnail: string;
  publishedAt: Date;
};

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** parse RSS ของช่อง — regex เบา ๆ ไม่เพิ่ม dependency (feed โครงสร้างคงที่มานาน) */
export function parseChannelRss(xml: string): RawVideo[] {
  const out: RawVideo[] = [];
  for (const chunk of xml.split("<entry>").slice(1)) {
    const id = chunk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = chunk.match(/<media:title>([\s\S]*?)<\/media:title>/)?.[1] ?? chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = chunk.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !title || !published) continue;
    const desc = chunk.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? null;
    const thumb = chunk.match(/<media:thumbnail[^>]*\burl="([^"]+)"/)?.[1];
    out.push({
      videoId: id.trim(),
      title: decodeXml(title).trim(),
      description: desc ? decodeXml(desc).trim() : null,
      thumbnail: thumb ? decodeXml(thumb) : `https://i.ytimg.com/vi/${id.trim()}/hqdefault.jpg`,
      publishedAt: new Date(published),
    });
  }
  return out;
}

/**
 * YouTube ตอบ 404/500 เป็นครั้งคราวเมื่อยิงถี่จาก IP เดียว (ไม่ใช่ "ไม่มีช่องนี้")
 * cron วันละครั้งแทบไม่เจอ แต่ถ้าเจอแล้วล้มเลย = คลิปใหม่ช้าไป 1 วัน → ลองซ้ำ 3 ครั้ง
 */
async function fetchViaRss(): Promise<RawVideo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 8000));
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        // ไม่ส่ง UA เลย YouTube จะเมิน request แบบ bot บ่อยกว่า
        "User-Agent": "GoodFoodCoach/1.0 (+https://goodfood.in.th)",
        Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
      },
    });
    if (res.ok) return parseChannelRss(await res.text());
    lastStatus = res.status;
  }
  throw new Error(`youtube rss ${lastStatus}`);
}

type ApiItem = {
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    resourceId?: { videoId?: string };
    thumbnails?: Record<string, { url?: string }>;
  };
};

async function fetchViaApi(key: string): Promise<RawVideo[]> {
  const out: RawVideo[] = [];
  let pageToken = "";
  for (let page = 0; page < 20; page++) {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet` +
      `&playlistId=${YT_UPLOADS_PLAYLIST_ID}&maxResults=50&key=${encodeURIComponent(key)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`youtube api ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { items?: ApiItem[]; nextPageToken?: string };
    for (const it of json.items || []) {
      const s = it.snippet;
      const id = s?.resourceId?.videoId;
      // คลิปที่ private/ลบแล้วยังอยู่ใน playlist แต่ snippet ถูกปิดบัง → ข้าม (ให้ไปเป็น isActive=false)
      if (!id || !s?.title || s.title === "Private video" || s.title === "Deleted video") continue;
      const th = s.thumbnails || {};
      out.push({
        videoId: id,
        title: s.title,
        description: s.description || null,
        thumbnail:
          th.maxres?.url || th.standard?.url || th.high?.url || th.medium?.url || th.default?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        publishedAt: new Date(s.publishedAt || Date.now()),
      });
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return out;
}

export type SyncResult = {
  source: "api" | "rss";
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  videos: Array<{ videoId: string; title: string; topics: TopicKey[] }>;
};

/**
 * ดึง → upsert → ปิดคลิปที่หายไปจากแหล่ง (กลับเป็น private) — ไม่ลบแถวใด ๆ
 *
 * RSS เห็นแค่คลิปล่าสุด ~15 คลิป → ห้ามปิดคลิปเก่ากว่าหน้าต่างที่แหล่งเห็น
 * ไม่งั้นพอช่องมีคลิปเกิน 15 คลิป ของเก่าจะโดนปิดทั้งแถบทั้งที่ยัง public อยู่
 */
export async function syncCoachVideos(): Promise<SyncResult> {
  const key = process.env.YOUTUBE_API_KEY;
  const source: "api" | "rss" = key ? "api" : "rss";
  const list = key ? await fetchViaApi(key) : await fetchViaRss();

  // แหล่งคืนศูนย์คลิป = น่าจะแหล่งมีปัญหา ไม่ใช่ช่องว่างเปล่า → ไม่แตะข้อมูลเดิม
  if (list.length === 0) {
    return { source, fetched: 0, created: 0, updated: 0, deactivated: 0, reactivated: 0, videos: [] };
  }

  const existing = await prisma.coachVideo.findMany({ select: { videoId: true, isActive: true } });
  const known = new Map(existing.map((e) => [e.videoId, e.isActive]));

  let created = 0;
  let updated = 0;
  let reactivated = 0;
  const videos: SyncResult["videos"] = [];

  for (const v of list) {
    const topics = videoTopics(v);
    const data = {
      title: v.title,
      description: v.description,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      topics,
      isActive: true,
    };
    await prisma.coachVideo.upsert({
      where: { videoId: v.videoId },
      create: { videoId: v.videoId, ...data },
      update: data,
    });
    if (!known.has(v.videoId)) created++;
    else {
      updated++;
      if (known.get(v.videoId) === false) reactivated++;
    }
    videos.push({ videoId: v.videoId, title: v.title, topics });
  }

  const seen = new Set(list.map((v) => v.videoId));
  const oldestSeen = list.reduce((min, v) => (v.publishedAt < min ? v.publishedAt : min), list[0].publishedAt);
  const { count: deactivated } = await prisma.coachVideo.updateMany({
    where: {
      isActive: true,
      videoId: { notIn: [...seen] },
      // RSS = เห็นแค่หน้าต่างล่าสุด → ปิดได้เฉพาะคลิปที่อยู่ในหน้าต่างนั้นเท่านั้น
      ...(source === "rss" ? { publishedAt: { gte: oldestSeen } } : {}),
    },
    data: { isActive: false },
  });

  return { source, fetched: list.length, created, updated, deactivated, reactivated, videos };
}
