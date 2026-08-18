/**
 * แกะ videoId จากลิงก์ YouTube ที่แอดมินวางมา — รองรับทุกรูปแบบที่คนก๊อปมาจริง
 *
 * ทำไมต้องแกะฝั่ง server: แอดมินวางลิงก์แบบไหนก็ได้ (แชร์จากมือถือจะมี ?si=... ต่อท้าย)
 * ถ้าปล่อยให้แอปแกะเอง ต้องแก้ทั้งสองฝั่งทุกครั้งที่ YouTube เพิ่มรูปแบบใหม่
 */

/** videoId ของ YouTube = 11 ตัวอักษร a-z A-Z 0-9 _ - */
const ID = /^[A-Za-z0-9_-]{11}$/;

const PATH_PREFIXES = ["/shorts/", "/embed/", "/v/", "/live/"];

export function parseYouTubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // วาง videoId มาเปล่า ๆ ก็รับ
  if (ID.test(s)) return s;

  let u: URL;
  try {
    u = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return ID.test(id) ? id : null;
  }

  if (!host.endsWith("youtube.com")) return null;

  // youtube.com/watch?v=<id>
  const v = u.searchParams.get("v");
  if (v && ID.test(v)) return v;

  // youtube.com/shorts/<id> · /embed/<id> · /v/<id> · /live/<id>
  for (const p of PATH_PREFIXES) {
    if (u.pathname.startsWith(p)) {
      const id = u.pathname.slice(p.length).split("/")[0];
      if (ID.test(id)) return id;
    }
  }

  return null;
}

export interface PlayableVideo {
  videoId: string;
  url: string;
  thumbnail: string;
}

/** ข้อมูลคลิปที่แอปเอาไปเล่นได้ทันที — null = ลิงก์ว่างหรือแกะไม่ออก (แอปจะไม่ขึ้นปุ่ม ▶) */
export function playableVideo(raw: string | null | undefined): PlayableVideo | null {
  const videoId = parseYouTubeId(raw);
  if (!videoId) return null;
  return {
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`,
    // maxres ไม่มีทุกคลิป — hqdefault มีเสมอ จึงไม่มีทางได้รูปแตก
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}
