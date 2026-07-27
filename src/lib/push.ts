/**
 * Push notification สำหรับ Coach native app
 * v1 ใช้ Expo Push API (รองรับทั้ง APNs + FCM ผ่าน service เดียว) — ย้ายไป APNs/FCM ตรงได้ภายหลัง
 * ยังคง LINE fallback ไว้สำหรับสมาชิกเดิมที่ยังไม่ลงแอป
 */
import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

/** ส่ง push ไปทุก device ของ member — คืนจำนวนที่ส่งสำเร็จ */
export async function sendPush(memberId: string, payload: PushPayload): Promise<number> {
  const tokens = await prisma.deviceToken.findMany({ where: { memberId } });
  if (tokens.length === 0) return 0;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: "default",
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => null);
    // เก็บกวาด token เสีย (DeviceNotRegistered)
    const receipts = (json?.data as Array<{ status: string; details?: { error?: string } }>) || [];
    const dead: string[] = [];
    receipts.forEach((r, i) => {
      if (r.status === "error" && r.details?.error === "DeviceNotRegistered") dead.push(tokens[i].token);
    });
    if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    return receipts.filter((r) => r.status === "ok").length;
  } catch (e) {
    console.error("[push] send failed", e);
    return 0;
  }
}

/** member มี device (ลงแอปแล้ว) ไหม — ใช้ตัดสินว่าจะส่ง push หรือ fallback LINE */
export async function hasDevice(memberId: string): Promise<boolean> {
  const c = await prisma.deviceToken.count({ where: { memberId } });
  return c > 0;
}
