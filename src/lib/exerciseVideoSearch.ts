/**
 * ค้นคลิปสอนท่าจาก YouTube — ใช้ร่วมกันระหว่างสคริปต์เติมทั้งคลัง กับการ "หาเพิ่มสด ๆ"
 * ตอนเจ้าของกด "ขอตัวอื่น" จนหมดตัวเลือก
 *
 * 🔴 27 ส.ค. 69 เจ้าของเจอ: กด "ขอตัวอื่น" แล้วขึ้น "หมดคลิปตัวเลือกแล้ว" ทั้งที่ YouTube ยังมีคลิปอีกเยอะ
 *    ของเดิมเสิร์ฟได้เฉพาะที่ค้นไว้ล่วงหน้า — พอรอบแรกกรองเข้มจนเหลือใบเดียว ปฏิเสธทีเดียวก็ตัน
 *    ตอนนี้หมดเมื่อไหร่ = ไปค้นสดต่อทันที (ยังไม่มี key ก็ยังทำงานได้ แค่ไม่มีของเพิ่ม)
 */
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/secrets/store";

type SearchItem = { id: { videoId?: string } };
type VideoItem = {
  id: string;
  snippet: { title: string; channelTitle: string };
  status: { embeddable: boolean; privacyStatus: string };
  contentDetails: { duration: string };
};

function seconds(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const STOP = new Set(["the", "a", "an", "with", "and", "for", "to", "of", "up", "down", "exercise"]);

/** ชื่อคลิปพูดถึงท่านี้จริงไหม — `loose` ใช้ตอนค้นรอบเก็บตก (ยอมให้ตรงคำเดียวก็พอ) */
export function titleMatches(title: string, nameEn: string, loose = false): boolean {
  const words = nameEn.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return true;
  const t = title.toLowerCase();
  const hit = words.filter((w) => t.includes(w)).length;
  return hit >= (loose ? 1 : Math.ceil(words.length / 2));
}

/** โควตาค้นหารายวันหมด — ต้องแยกจาก "ไม่เจอคลิป" ให้ชัด ไม่งั้นระบบโกหกว่าหาไม่เจอ */
export class QuotaExceeded extends Error {
  constructor() { super("โควตาค้นหา YouTube ของวันนี้หมดแล้ว"); }
}

async function api(path: string, params: Record<string, string>, key: string) {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  u.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (r.status === 429 || r.status === 403) throw new QuotaExceeded();
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export type Candidate = { videoId: string; title: string; channel: string };

/**
 * ค้นคลิปของท่าหนึ่ง — คืนเฉพาะที่ยังไม่เคยเห็น
 * `loose` = ผ่อนเกณฑ์ (ยาวได้ถึง 3 นาที · ชื่อตรงคำเดียวก็พอ) ใช้ตอนของหมดแล้วจริง ๆ
 */
export async function findCandidates(
  nameEn: string,
  nameTh: string,
  excludeIds: string[],
  loose = false
): Promise<Candidate[]> {
  const key = await getSecret("YOUTUBE_API_KEY");
  if (!key) return [];

  /* 🔴 คำค้นเดียวไม่พอ — ชื่อท่าบางตัวกว้างมาก ("Basic Yoga Flow") ค้นแบบเดียวแล้วได้ใบเดียว
     พอเจ้าของกดไม่เอา = ตันทันที · ยิงหลายคำค้นแล้วรวมผล ทั้งอังกฤษและ**ไทย**
     (ช่องออกกำลังกายไทยมีเยอะ และคนไทยดูรู้เรื่องกว่า) */
  const queries = loose
    ? [`${nameTh} วิธีทำ`, `${nameEn || nameTh} tutorial`, `${nameEn || nameTh} #shorts`]
    : [`${nameEn || nameTh} proper form how to shorts`];

  const ids: string[] = [];
  for (const q of queries) {
    const found = (await api("search", {
      part: "snippet", q, type: "video", maxResults: "25",
      videoEmbeddable: "true", videoDuration: "short", safeSearch: "strict",
    }, key).catch((e) => { if (e instanceof QuotaExceeded) throw e; return null; })) as { items?: SearchItem[] } | null;
    for (const f of found?.items ?? []) {
      const id = f.id.videoId;
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  const fresh = ids.filter((id) => !excludeIds.includes(id));
  if (!fresh.length) return [];

  const full = (await api("videos", {
    part: "snippet,status,contentDetails", id: fresh.slice(0, 30).join(","),
  }, key).catch((e) => { if (e instanceof QuotaExceeded) throw e; return null; })) as { items?: VideoItem[] } | null;

  const maxSec = loose ? 180 : 90;
  return (full?.items ?? [])
    .filter((v) => v.status.embeddable && v.status.privacyStatus === "public")
    .filter((v) => { const s = seconds(v.contentDetails.duration); return s > 0 && s <= maxSec; })
    .filter((v) => titleMatches(v.snippet.title, nameEn || nameTh, loose))
    .map((v) => ({ videoId: v.id, title: v.snippet.title, channel: v.snippet.channelTitle }));
}

/**
 * เติมตัวเลือกให้ท่าหนึ่งแบบสด ๆ — คืนจำนวนที่เพิ่มได้
 * ลองเกณฑ์ปกติก่อน ไม่ได้ค่อยผ่อนเกณฑ์ (ดีกว่าตันแล้วให้เจ้าของไปหาลิงก์เอง)
 */
export async function topUpCandidates(exerciseKey: string, want = 3): Promise<number> {
  const ex = await prisma.exercise.findUnique({
    where: { key: exerciseKey },
    select: { name: true, nameEn: true },
  });
  if (!ex) return 0;

  const seen = await prisma.exerciseVideoCandidate.findMany({
    where: { exerciseKey },
    select: { videoId: true, rank: true, priority: true },
  });
  const seenIds = seen.map((s) => s.videoId);
  const startRank = Math.max(0, ...seen.map((s) => s.rank)) + 1;
  const priority = seen[0]?.priority ?? 10;

  let picks = await findCandidates(ex.nameEn ?? "", ex.name, seenIds, false);
  if (picks.length < want) {
    const more = await findCandidates(ex.nameEn ?? "", ex.name, [...seenIds, ...picks.map((p) => p.videoId)], true);
    picks = [...picks, ...more];
  }
  picks = picks.slice(0, want);

  for (let i = 0; i < picks.length; i++) {
    await prisma.exerciseVideoCandidate.upsert({
      where: { exerciseKey_videoId: { exerciseKey, videoId: picks[i].videoId } },
      update: { status: "pending", title: picks[i].title, channel: picks[i].channel },
      create: {
        exerciseKey, videoId: picks[i].videoId, title: picks[i].title,
        channel: picks[i].channel, rank: startRank + i, priority,
      },
    });
  }
  return picks.length;
}
