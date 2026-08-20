/**
 * ที่เก็บภาพร่างกาย (WO-BODY §5 · WO-BP-1 §B4) — จุดเดียวในระบบที่รู้ว่าไฟล์ภาพร่างกายอยู่ไหน
 *
 * 🔴 ข้อบังคับสถาปัตยกรรม ไม่ใช่ option:
 *    ภาพร่างกายอยู่ใต้ PRIVATE_DIR เท่านั้น — ห้ามแตะ public/uploads เด็ดขาด
 *    public/uploads ถูก nginx เสิร์ฟสาธารณะ + immutable cache 30 วัน: ใครเดา URL ได้ก็เปิดได้
 *    และถึงจะลบไฟล์ทีหลัง สำเนาก็ยังค้างในแคชตามทางอีกเป็นเดือน
 *    (เทียบกับ smart-capture ที่เขียนรูป "อาหาร" ลง public/uploads — ตั้งใจให้ต่างกัน ห้ามลอกมาใช้ที่นี่)
 *
 * ทางออกเดียวของภาพ: GET /api/coach/body-photo/[scanId]/[view] (เช็คเจ้าของ + Cache-Control: no-store)
 *
 * โครงไฟล์ (path ใน DB เก็บแบบ "สัมพัทธ์" เพราะ mount point คนละที่กัน):
 *   <PRIVATE_DIR>/body/<memberId>/<scanId>-front.jpg      ← สแกนที่ commit แล้ว
 *   <PRIVATE_DIR>/body/<memberId>/pending-front.jpg       ← อัปโหลดผ่าน gate แล้ว รอ commit
 *   <PRIVATE_DIR>/body/<memberId>/pending-front.json      ← landmark ของภาพนั้น (ไม่ต้องวิเคราะห์ซ้ำตอน commit)
 */
import { mkdir, writeFile, readFile, unlink, rename, copyFile, stat } from "fs/promises";
import path from "path";

/**
 * ในคอนเทนเนอร์ = /app/private (Fable mount /var/lib/goodfood/private มาที่นี่)
 * รันนอกคอนเทนเนอร์ (สคริปต์/dev) ให้ตั้ง PRIVATE_DIR เอง
 */
export const PRIVATE_DIR = process.env.PRIVATE_DIR || "/app/private";

/**
 * path เดียวกันในสายตาของ CV worker ที่รันบน host
 * worker เห็นไฟล์เดียวกันคนละ path (host path ไม่ใช่ container path) และ guard ของมันวัดจาก root ฝั่ง host
 * → ตอนส่ง path ให้ worker ต้องแปลงด้วย workerPath() เสมอ ห้ามส่ง absPath() ของฝั่งเราไปตรง ๆ
 */
export const WORKER_PRIVATE_DIR = process.env.WORKER_PRIVATE_DIR || "/var/lib/goodfood/private";

/** โฟลเดอร์ย่อยของภาพร่างกาย (ใต้ PRIVATE_DIR) */
export const BODY_SUBDIR = "body";

export const BODY_VIEWS = ["front", "side", "back"] as const;
export type BodyView = (typeof BODY_VIEWS)[number];

/** ภาพที่ต้องมีเสมอถึงจะ commit ได้ (Quick = 2 ภาพ · back เป็นตัวเลือก) */
export const REQUIRED_VIEWS: BodyView[] = ["front", "side"];

/** ขนาดสูงสุดของรูปหลังถอด base64 — 8MB (ภาพจากมือถือหลังบีบอยู่แถว 1-3MB) */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** สิทธิ์ไฟล์/โฟลเดอร์: เจ้าของ process อ่านเขียนได้คนเดียว (กันคนอื่นบนเครื่องเดียวกันเปิดดู) */
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export function isBodyView(v: unknown): v is BodyView {
  return typeof v === "string" && (BODY_VIEWS as readonly string[]).includes(v);
}

/**
 * id ที่ยอมให้เอาไปต่อเป็นชื่อไฟล์ — cuid เป็น [a-z0-9] ล้วน (เผื่อ - ไว้สำหรับ id รูปแบบอื่นในอนาคต)
 * ไม่ใช่แค่กรอง ".." แต่เป็น allowlist: อะไรที่ไม่ตรงรูปแบบ = null แล้วผู้เรียกต้องตอบ 400/404
 * (กรองแบบ blocklist เคยพลาดมาแล้วทุกภาษาในโลก)
 */
export function safeId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 64) return null;
  return /^[a-z0-9-]+$/.test(s) ? s : null;
}

/** path สัมพัทธ์ของภาพในสแกนที่ commit แล้ว — ค่านี้คือสิ่งที่เก็บลง BodyScan.frontPath/sidePath/backPath */
export function scanPhotoPath(memberId: string, scanId: string, view: BodyView): string {
  const m = safeId(memberId);
  const s = safeId(scanId);
  if (!m || !s || !isBodyView(view)) throw new Error("bodyStorage: id หรือ view ไม่ถูกต้อง");
  return `${BODY_SUBDIR}/${m}/${s}-${view}.jpg`;
}

/** path สัมพัทธ์ของภาพที่อัปโหลดแล้วแต่ยังไม่ commit (ทับได้เรื่อย ๆ — ถ่ายใหม่ทับของเดิม) */
export function pendingPath(memberId: string, view: BodyView): string {
  const m = safeId(memberId);
  if (!m || !isBodyView(view)) throw new Error("bodyStorage: id หรือ view ไม่ถูกต้อง");
  return `${BODY_SUBDIR}/${m}/pending-${view}.jpg`;
}

/** landmark/metrics ของภาพ pending — เก็บคู่กันไว้เพื่อไม่ต้องเรียก worker ซ้ำตอน commit */
export function pendingMetaPath(memberId: string, view: BodyView): string {
  const m = safeId(memberId);
  if (!m || !isBodyView(view)) throw new Error("bodyStorage: id หรือ view ไม่ถูกต้อง");
  return `${BODY_SUBDIR}/${m}/pending-${view}.json`;
}

/** สัมพัทธ์ → absolute ในระบบไฟล์ของ process นี้ */
export function absPath(relPath: string): string {
  const rel = String(relPath ?? "").replace(/^\/+/, "");
  const abs = path.resolve(PRIVATE_DIR, rel);
  // กันซ้ำอีกชั้น เผื่อ path ในแถว DB เก่าถูกแก้มือจนหลุดออกนอก private dir
  const root = path.resolve(PRIVATE_DIR);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error("bodyStorage: path หลุดออกนอกพื้นที่ส่วนตัว");
  return abs;
}

/** สัมพัทธ์ → absolute ในสายตา CV worker (host path) */
export function workerPath(relPath: string): string {
  const rel = String(relPath ?? "").replace(/^\/+/, "");
  const abs = path.resolve(WORKER_PRIVATE_DIR, rel);
  const root = path.resolve(WORKER_PRIVATE_DIR);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error("bodyStorage: path หลุดออกนอกพื้นที่ส่วนตัว");
  return abs;
}

/** สร้างโฟลเดอร์ของสมาชิกคนนี้ (idempotent) */
export async function ensureMemberDir(memberId: string): Promise<void> {
  const m = safeId(memberId);
  if (!m) throw new Error("bodyStorage: memberId ไม่ถูกต้อง");
  await mkdir(path.join(absPath(BODY_SUBDIR), m), { recursive: true, mode: DIR_MODE });
}

/** เขียนไฟล์ใต้ private dir (สร้างโฟลเดอร์ให้ + สิทธิ์ 600) */
export async function writePrivate(relPath: string, data: Buffer | string): Promise<void> {
  const abs = absPath(relPath);
  await mkdir(path.dirname(abs), { recursive: true, mode: DIR_MODE });
  await writeFile(abs, data, { mode: FILE_MODE });
}

export async function readPrivate(relPath: string): Promise<Buffer> {
  return readFile(absPath(relPath));
}

export async function privateExists(relPath: string): Promise<boolean> {
  try {
    const s = await stat(absPath(relPath));
    return s.isFile();
  } catch {
    return false;
  }
}

export async function privateSize(relPath: string): Promise<number | null> {
  try {
    return (await stat(absPath(relPath))).size;
  } catch {
    return null;
  }
}

/**
 * ลบไฟล์แบบไม่โวย — ไม่มีไฟล์ = ถือว่าสำเร็จ (ปลายทางที่ต้องการคือ "ไม่มีไฟล์นี้แล้ว")
 * 🔴 ห้ามให้ throw: ทุกที่ที่เรียกตัวนี้คือเส้นทาง "ลบรูปของลูกค้า" ซึ่งต้องเดินต่อจนจบเสมอ
 */
export async function safeDelete(relPath: string): Promise<boolean> {
  try {
    await unlink(absPath(relPath));
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") console.warn("[bodyStorage] ลบไฟล์ไม่สำเร็จ", code);
    return false;
  }
}

/** ย้ายไฟล์ (pending → ชื่อจริง) — ข้าม device ไม่ได้ก็ copy แล้วลบต้นทาง */
export async function movePrivate(fromRel: string, toRel: string): Promise<void> {
  const from = absPath(fromRel);
  const to = absPath(toRel);
  await mkdir(path.dirname(to), { recursive: true, mode: DIR_MODE });
  try {
    await rename(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== "EXDEV") throw e;
    await copyFile(from, to);
    await unlink(from).catch(() => {});
  }
}

export interface DecodedImage {
  buffer: Buffer;
  /** jpg | png — เก็บลงดิสก์เป็นนามสกุล .jpg เสมอตามชื่อไฟล์ที่ออกแบบไว้ (เนื้อในเป็นอะไรก็ได้ที่ worker อ่านออก) */
  kind: "jpg" | "png";
  bytes: number;
}

/**
 * แกะ dataURL → Buffer พร้อมเพดานขนาด
 * รับเฉพาะ jpeg/png (heic/webp ยังไม่รับ — mediapipe บน host อ่านไม่ได้ทุกฟอร์แมต และเราไม่แปลงฟอร์แมตในนี้)
 * คืน error เป็นข้อความไทยที่บอกทางแก้ ไม่ใช่รหัสข้อผิดพลาด
 */
export function decodeImageDataUrl(raw: unknown): { ok: true; image: DecodedImage } | { ok: false; error: string } {
  const s = typeof raw === "string" ? raw : "";
  if (!s) return { ok: false, error: "ไม่พบรูปที่ส่งมา ลองถ่ายใหม่อีกครั้งนะครับ" };
  const m = s.match(/^data:image\/(jpe?g|png);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) return { ok: false, error: "รองรับเฉพาะรูป JPEG หรือ PNG เท่านั้น" };
  // เช็คขนาดจากความยาว base64 ก่อนถอด — ถอดก่อนแล้วค่อยเช็คคือยอมให้เขาจองแรมไปแล้ว
  const b64 = m[2].replace(/\s/g, "");
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: "รูปใหญ่เกินไป (เกิน 8MB) ลองถ่ายใหม่ด้วยความละเอียดที่เล็กลงนะครับ" };
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    return { ok: false, error: "อ่านรูปที่ส่งมาไม่ได้ ลองถ่ายใหม่อีกครั้งนะครับ" };
  }
  if (buffer.length === 0) return { ok: false, error: "ไม่พบรูปที่ส่งมา ลองถ่ายใหม่อีกครั้งนะครับ" };
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: "รูปใหญ่เกินไป (เกิน 8MB) ลองถ่ายใหม่ด้วยความละเอียดที่เล็กลงนะครับ" };
  }
  return { ok: true, image: { buffer, kind: m[1] === "png" ? "png" : "jpg", bytes: buffer.length } };
}
