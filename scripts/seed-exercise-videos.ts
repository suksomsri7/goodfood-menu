/**
 * เติมคลิปตัวเลือกเข้าคิวตรวจ — ใช้ YouTube Data API v3 ค้นให้ครบทุกท่าในคลังรวดเดียว
 *
 * ใช้:  npx tsx scripts/seed-exercise-videos.ts            (ทุกท่าที่ยังไม่มีตัวเลือก)
 *       npx tsx scripts/seed-exercise-videos.ts squat_bw   (เจาะเฉพาะท่า)
 *
 * 🔴 ต้องมี secret `YOUTUBE_API_KEY` — ไม่มี = สคริปต์นี้ทำงานไม่ได้
 *    (ค้นแบบไม่มี key ต้องขูด HTML ของ YouTube ซึ่งเปราะและผิดเงื่อนไขการใช้งาน)
 * 🔴 ค้น 1 ครั้ง = 100 units จากโควตาฟรี 10,000/วัน → ~100 ท่า/วัน พอดีกับคลัง 116 ท่า
 *    ถ้าชนโควตาให้รันต่อวันถัดไป สคริปต์ข้ามท่าที่มีตัวเลือกแล้วเองอยู่แล้ว
 *
 * เลือกเฉพาะคลิปที่:
 *   · เป็นแนวตั้ง/สั้น (ตัวเล่นในแอปทำมาเพื่อ 9:16 — คลิปแนวนอนจะได้แถบเล็ก ๆ กลางจอ)
 *   · ฝังในแอปได้จริง (embeddable) และยังไม่ถูกลบ
 *   · ชื่อคลิปมีคำที่ตรงกับชื่อท่าภาษาอังกฤษ (กันคลิปรวมท่าที่ไม่ได้สอนท่านี้)
 */
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/secrets/store";

const MAX_PER_EXERCISE = 4;

type SearchItem = { id: { videoId?: string }; snippet: { title: string; channelTitle: string } };
type VideoItem = {
  id: string;
  snippet: { title: string; channelTitle: string };
  status: { embeddable: boolean; privacyStatus: string };
  contentDetails: { duration: string };
};

/** ISO-8601 (PT1M30S) → วินาที */
function seconds(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** ชื่อคลิปต้องพูดถึงท่านี้จริง — ตัดคำโหลจนเหลือคำที่มีความหมาย */
function titleMatches(title: string, nameEn: string): boolean {
  const stop = new Set(["the", "a", "an", "with", "and", "for", "to", "of", "up", "down", "exercise"]);
  const words = nameEn.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  if (!words.length) return true;
  const t = title.toLowerCase();
  const hit = words.filter((w) => t.includes(w)).length;
  return hit >= Math.ceil(words.length / 2); // ครึ่งหนึ่งของคำสำคัญก็พอ (ชื่อคลิปมักไม่ตรงเป๊ะ)
}

async function search(key: string, q: string): Promise<SearchItem[]> {
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  u.searchParams.set("key", key);
  u.searchParams.set("part", "snippet");
  u.searchParams.set("q", q);
  u.searchParams.set("type", "video");
  u.searchParams.set("maxResults", "20");
  u.searchParams.set("videoEmbeddable", "true");
  u.searchParams.set("videoDuration", "short"); // < 4 นาที
  u.searchParams.set("safeSearch", "strict");
  const r = await fetch(u);
  if (!r.ok) throw new Error(`search ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { items?: SearchItem[] }).items ?? [];
}

async function details(key: string, ids: string[]): Promise<VideoItem[]> {
  if (!ids.length) return [];
  const u = new URL("https://www.googleapis.com/youtube/v3/videos");
  u.searchParams.set("key", key);
  u.searchParams.set("part", "snippet,status,contentDetails");
  u.searchParams.set("id", ids.join(","));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`videos ${r.status}`);
  return ((await r.json()) as { items?: VideoItem[] }).items ?? [];
}

/** ท่าที่ลูกค้ามีโอกาสเจอบ่อยกว่า ต้องถูกตรวจก่อน */
function priorityOf(usedInPlan: boolean, tier: string): number {
  if (usedInPlan) return 0;
  return tier === "none" ? 10 : tier === "home" ? 20 : 30;
}

(async () => {
  const apiKey = await getSecret("YOUTUBE_API_KEY");
  if (!apiKey) {
    console.error("🔴 ยังไม่ได้ตั้ง YOUTUBE_API_KEY ที่ /backoffice/settings/api-keys");
    process.exit(1);
  }
  const only = process.argv[2];

  const [all, have, plans] = await Promise.all([
    prisma.exercise.findMany({ select: { key: true, name: true, nameEn: true, equipment: true } }),
    prisma.exerciseVideoCandidate.groupBy({ by: ["exerciseKey"] }),
    prisma.dailyPlan.findMany({ select: { exercisePlan: true } }),
  ]);
  const haveKeys = new Set(have.map((h) => h.exerciseKey));
  const used = new Set<string>();
  for (const p of plans) {
    for (const it of ((p.exercisePlan as { items?: Array<{ key?: string }> } | null)?.items ?? [])) {
      if (it.key) used.add(it.key);
    }
  }

  const todo = all.filter((e) => (only ? e.key === only : !haveKeys.has(e.key)));
  console.log(`จะค้นทั้งหมด ${todo.length} ท่า (คลังมี ${all.length} ท่า)`);

  let added = 0, empty = 0;
  for (const ex of todo) {
    const q = `${ex.nameEn || ex.name} proper form how to shorts`;
    try {
      const found = await search(apiKey, q);
      const ids = found.map((f) => f.id.videoId).filter(Boolean) as string[];
      const full = await details(apiKey, ids);
      const picks = full
        .filter((v) => v.status.embeddable && v.status.privacyStatus === "public")
        .filter((v) => seconds(v.contentDetails.duration) > 0 && seconds(v.contentDetails.duration) <= 90)
        .filter((v) => titleMatches(v.snippet.title, ex.nameEn || ex.name))
        .slice(0, MAX_PER_EXERCISE);

      if (!picks.length) { empty++; console.log(`  — ${ex.name}: ไม่เจอคลิปที่ผ่านเกณฑ์`); continue; }

      const priority = priorityOf(used.has(ex.key), ex.equipment);
      for (let i = 0; i < picks.length; i++) {
        const v = picks[i];
        await prisma.exerciseVideoCandidate.upsert({
          where: { exerciseKey_videoId: { exerciseKey: ex.key, videoId: v.id } },
          update: { title: v.snippet.title, channel: v.snippet.channelTitle, priority },
          create: {
            exerciseKey: ex.key, videoId: v.id, title: v.snippet.title,
            channel: v.snippet.channelTitle, rank: i, priority,
          },
        });
        added++;
      }
      console.log(`  ✓ ${ex.name.padEnd(24)} ${picks.length} ใบ (priority ${priority})`);
    } catch (e) {
      console.error(`  ✗ ${ex.name}:`, e instanceof Error ? e.message : e);
      // ชนโควตา = หยุดทั้งรอบ ไม่ต้องไล่ยิงให้ error เต็มจอ
      if (String(e).includes("403")) { console.error("🔴 น่าจะชนโควตารายวัน — รันต่อพรุ่งนี้ได้เลย"); break; }
    }
  }
  console.log(`\nเพิ่มตัวเลือก ${added} ใบ · ท่าที่ยังไม่เจอคลิปที่ผ่านเกณฑ์ ${empty} ท่า`);
  process.exit(0);
})();
