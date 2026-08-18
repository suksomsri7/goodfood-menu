/**
 * เทสตัวแกะลิงก์ YouTube — รัน: npx tsx scripts/test-youtube-url.ts
 *
 * ทำไมต้องมีเทสถาวร: แอดมินก๊อปลิงก์มาจากหลายที่ (แชร์จากมือถือ / แถบที่อยู่ / กดแชร์ใน Shorts)
 * แต่ละแบบหน้าตาไม่เหมือนกัน — ถ้าแกะพลาดแบบใดแบบหนึ่ง ปุ่ม ▶ จะหายไปเงียบ ๆ โดยไม่มี error
 */
import { parseYouTubeId, playableVideo } from "../src/lib/youtubeUrl";

const ID = "dQw4w9WgXcQ";

const cases: { input: string | null | undefined; want: string | null; note: string }[] = [
  { input: `https://www.youtube.com/shorts/${ID}`, want: ID, note: "Shorts ปกติ" },
  { input: `https://youtube.com/shorts/${ID}?si=abc123`, want: ID, note: "Shorts + ?si= (กดแชร์จากมือถือ)" },
  { input: `https://youtu.be/${ID}?si=xyz`, want: ID, note: "ลิงก์ย่อ youtu.be" },
  { input: `https://www.youtube.com/watch?v=${ID}&t=10s`, want: ID, note: "watch?v= + เวลา" },
  { input: `https://m.youtube.com/watch?v=${ID}`, want: ID, note: "โดเมน m. (มือถือ)" },
  { input: `youtube.com/shorts/${ID}`, want: ID, note: "ไม่มี https:// นำหน้า" },
  { input: `  https://www.youtube.com/embed/${ID}  `, want: ID, note: "มีช่องว่างหน้า-หลัง" },
  { input: `https://www.youtube.com/live/${ID}`, want: ID, note: "ไลฟ์" },
  { input: ID, want: ID, note: "วาง videoId มาเปล่า ๆ" },
  { input: "https://vimeo.com/12345", want: null, note: "เจ้าอื่น = ไม่รับ" },
  { input: "https://www.youtube.com/watch?v=short", want: null, note: "id สั้นกว่า 11 ตัว = ไม่รับ" },
  { input: "ไม่ใช่ลิงก์", want: null, note: "ข้อความมั่ว" },
  { input: "", want: null, note: "ว่าง" },
  { input: null, want: null, note: "null" },
  { input: undefined, want: null, note: "undefined" },
];

let failed = 0;
for (const c of cases) {
  const got = parseYouTubeId(c.input);
  const ok = got === c.want;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${c.note} → ${got ?? "null"}${ok ? "" : ` (ต้องได้ ${c.want ?? "null"})`}`);
}

// playableVideo ต้องคืนของครบ 3 ชิ้นให้แอปใช้ได้ทันที
const v = playableVideo(`https://youtu.be/${ID}?si=1`);
const shaped =
  v?.videoId === ID &&
  v?.url === `https://www.youtube.com/shorts/${ID}` &&
  v?.thumbnail === `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`;
if (!shaped) failed++;
console.log(`${shaped ? "✓" : "✗"} playableVideo คืน videoId/url/thumbnail ครบ`);

const empty = playableVideo("  ") === null;
if (!empty) failed++;
console.log(`${empty ? "✓" : "✗"} ลิงก์ว่าง = null (แอปจะไม่ขึ้นปุ่ม ▶)`);

console.log(failed === 0 ? `\nผ่านครบ ${cases.length + 2} เคส` : `\nพัง ${failed} เคส`);
process.exit(failed ? 1 : 0);
