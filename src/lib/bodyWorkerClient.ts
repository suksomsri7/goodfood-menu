/**
 * ตัวเรียก CV worker (WO-BP-1 §B2/§B4) — ฝั่ง Next คุยกับ worker/body_worker.py ที่รันบน host
 *
 * ทำไมแยกไฟล์: route ไม่ควรรู้เรื่อง timeout/รูปแบบ payload ของ worker
 * และ "worker ล่ม" มีกติกาเดียวที่ห้ามลืม — ไม่วิเคราะห์ = ไม่เก็บรูป (WO-BP-1 §B4 บรรทัดสุดท้าย)
 */
import { WorkerImage } from "@/lib/bodyScanGate";

/** ในคอนเทนเนอร์เรียกออกไปหา host (Fable ใส่ extra_hosts: host.docker.internal ตอน deploy) */
export const BODY_WORKER_URL = process.env.BODY_WORKER_URL || "http://host.docker.internal:8077";

/**
 * 15 วิ — PoC วัดได้ 30-80ms/ภาพ ดังนั้นถ้าเกิน 15 วินาทีคือ worker ค้าง ไม่ใช่ช้า
 * รอนานกว่านี้ = ผู้ใช้ยืนค้างอยู่หน้ากล้องโดยไม่รู้ว่าเกิดอะไรขึ้น
 */
export const WORKER_TIMEOUT_MS = 15_000;

/** ข้อความเดียวที่ user เห็นเมื่อ worker ใช้ไม่ได้ — ต้องบอกด้วยว่ารูปไม่ถูกเก็บ (WO-BP-1 §B4) */
export const WORKER_DOWN_MESSAGE = "ระบบวิเคราะห์ภาพไม่พร้อมชั่วคราว ลองอีกครั้งได้เลย (รูปยังไม่ถูกเก็บ)";

export type WorkerResult =
  | { ok: true; images: WorkerImage[]; ms: number }
  | { ok: false; reason: "down" | "bad_response" };

/**
 * ส่ง path (ฝั่ง host) ให้ worker วิเคราะห์
 * 🔴 ส่งแค่ path ไม่ส่งรูป — รูปไม่ควรวิ่งผ่าน HTTP ซ้ำอีกรอบโดยไม่จำเป็น
 *    และ worker มี guard ของตัวเองว่าจะอ่านได้เฉพาะไฟล์ใต้ private dir
 */
export async function analyzePaths(paths: string[]): Promise<WorkerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const res = await fetch(`${BODY_WORKER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[bodyWorker] worker ตอบ", res.status);
      // 4xx = เราส่งผิด (path ไม่ผ่าน guard) · 5xx = worker เอง — ทั้งคู่แปลว่าวิเคราะห์ไม่ได้ตอนนี้
      return { ok: false, reason: res.status >= 500 ? "down" : "bad_response" };
    }
    const data = (await res.json()) as { images?: WorkerImage[]; ms?: number };
    if (!Array.isArray(data?.images)) return { ok: false, reason: "bad_response" };
    return { ok: true, images: data.images, ms: typeof data.ms === "number" ? data.ms : 0 };
  } catch (e) {
    // timeout (AbortError) · ECONNREFUSED · DNS หา host.docker.internal ไม่เจอ → รวมเป็น "worker ล่ม" หมด
    console.error("[bodyWorker] เรียก worker ไม่สำเร็จ", (e as Error)?.name || e);
    return { ok: false, reason: "down" };
  } finally {
    clearTimeout(timer);
  }
}
