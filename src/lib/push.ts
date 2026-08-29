/**
 * Push notification สำหรับ Coach native app
 * v1 ใช้ Expo Push API (รองรับทั้ง APNs + FCM ผ่าน service เดียว) — ย้ายไป APNs/FCM ตรงได้ภายหลัง
 * ยังคง LINE fallback ไว้สำหรับสมาชิกเดิมที่ยังไม่ลงแอป
 */
import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /**
   * หมวดของ notification (iOS) — ทำให้ปุ่มลัดในแจ้งเตือน/นาฬิกาโผล่ โดยไม่ต้องเปิดแอป
   * เช่น "NUDGE_WATER" = ปุ่ม "ดื่มแล้ว +250"
   * ฝั่งแอปลงทะเบียนหมวดไว้ด้วย setNotificationCategoryAsync (src/lib/nudgeActions.ts)
   * 🔴 ชื่อ field ของ Expo Push HTTP API คือ `categoryId` (คนละตัวกับ `categoryIdentifier`
   *    ที่ใช้ตอนตั้ง local notification ฝั่งแอป) — ใส่ผิดชื่อ = ปุ่มไม่ขึ้นแบบเงียบ ๆ
   */
  categoryId?: string;
};

/**
 * ทุก push ต้องโผล่ในศูนย์แจ้งเตือนของแอปด้วย (เหมือน Notification Center ของ iPhone)
 * เขียนที่จุดเดียวตรงนี้ → เพิ่ม push ที่ไหนใหม่ก็ได้ในแอปอัตโนมัติ
 * เก็บแม้ส่ง push ไม่สำเร็จ/ยังไม่มี device — user เปิดแอปแล้วต้องเห็นย้อนหลัง
 */
async function recordNotification(memberId: string, payload: PushPayload, type: string) {
  try {
    await prisma.coachNotification.create({
      data: {
        memberId,
        type,
        title: payload.title,
        body: payload.body,
        data: (payload.data as object) ?? undefined,
      },
    });
  } catch (e) {
    console.error("[push] บันทึกศูนย์แจ้งเตือนไม่สำเร็จ", e);
  }
}

/** ส่ง push ไปทุก device ของ member + บันทึกลงศูนย์แจ้งเตือน — คืนจำนวนที่ส่งสำเร็จ */
export async function sendPush(memberId: string, payload: PushPayload, type = "system"): Promise<number> {
  await recordNotification(memberId, payload, type);

  let tokens = await prisma.deviceToken.findMany({ where: { memberId } });
  if (tokens.length === 0) return 0;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: "default",
    /* 🔴 channelId ต้องตรงกับที่แอปสร้างไว้ใน coach-app/app/_layout.tsx (ensureAndroidChannel)
       ไม่ส่งมา = Android เอาไปลงช่องทาง default ที่ importance ต่ำ → เข้าถาดเงียบ ๆ
       ไม่เด้ง heads-up banner แบบ iOS (Fable QC WO-B8 · 29 ส.ค. 69)
       ⚠️ iOS ไม่สนใจฟิลด์นี้ ส่งไปทุกเครื่องได้เลย ไม่ต้องแยกตามแพลตฟอร์ม */
    channelId: "default",
    // ใส่เฉพาะเมื่อมีหมวดจริง — ส่ง undefined ไปด้วยไม่มีประโยชน์และทำ payload รก
    ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
  }));

  // แจ้งเตือนแบบมีปุ่มลัดพังแบบเงียบ ๆ ได้ง่าย (ปุ่มไม่ขึ้นแต่ push ส่งสำเร็จ)
  // → log payload ไว้เฉพาะกรณีที่มีหมวด (นาน ๆ ครั้ง ไม่ใช่ทุก push) เพื่อตรวจย้อนหลังได้
  if (payload.categoryId) {
    // ไม่ log token (เป็นข้อมูลที่ยิง push หา user ได้) — เอาแค่พอรู้ว่าหมวดติดไปจริง
    console.log(
      "[push] ส่งแจ้งเตือนมีปุ่มลัด",
      JSON.stringify({ memberId, type, categoryId: payload.categoryId, count: messages.length })
    );
  }

  /** ยิงชุดข้อความไปที่ Expo แล้วคืนผลดิบ */
  async function postToExpo(batch: typeof messages) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    return (await res.json().catch(() => null)) as
      | { data?: Array<{ status: string; details?: { error?: string } }>; errors?: Array<{ code?: string; details?: Record<string, string[]> }> }
      | null;
  }

  try {
    let json = await postToExpo(messages);

    /* 🔴 26 ส.ค. 69 — บั๊กที่ทำให้ "ไม่ได้รับแจ้งเตือนเลย" มาตลอดโดยไม่มีใครรู้:
       เครื่องเดียวเคยลงแอปจาก Expo project คนละตัว (ของเก่า @coach-fits-team/coach กับของตอนนี้)
       token 2 ใบจึงคนละโปรเจกต์ · Expo ปฏิเสธ **ทั้งคำขอ** ด้วย PUSH_TOO_MANY_EXPERIENCE_IDS
       → ok 0 ทุกครั้ง แต่ไม่ใช่ DeviceNotRegistered เลยไม่ถูกเก็บกวาด วนแบบนี้ไปเรื่อย ๆ

       ⚠️ ห้ามแก้ด้วยการยิงทีละใบเฉย ๆ — สองใบนั้นคือ "เครื่องเดียวกัน" เจ้าของจะได้แจ้งเตือนซ้ำสองอันทุกครั้ง
       (เจอกับตัวแล้ว 26 ส.ค.) ที่ถูกคือ **ทิ้งใบเก่าไปเลย**: Expo บอกมาในรายละเอียด error ว่าใบไหนอยู่โปรเจกต์ไหน
       → เก็บกลุ่มที่มีใบซึ่ง "เพิ่งต่ออายุล่าสุด" (แอปที่ใช้อยู่จริงรีเฟรช token ทุกครั้งที่เปิด) ที่เหลือลบทิ้ง */
    const mismatch = json?.errors?.find((e) => e?.code === "PUSH_TOO_MANY_EXPERIENCE_IDS");
    if (messages.length > 1 && mismatch) {
      const groups = Object.values((mismatch.details ?? {}) as Record<string, string[]>);
      const newest = [...tokens].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())[0];
      const keepGroup = groups.find((g) => g.includes(newest.token)) ?? [newest.token];
      const drop = tokens.filter((t) => !keepGroup.includes(t.token)).map((t) => t.token);
      if (drop.length) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: drop } } });
        console.warn(
          "[push] ทิ้ง token ของ Expo project เก่า",
          JSON.stringify({ memberId, dropped: drop.length, kept: keepGroup.length })
        );
      }
      const keep = messages.filter((msg) => keepGroup.includes(msg.to));
      json = keep.length ? await postToExpo(keep) : { data: [] };
      tokens = tokens.filter((t) => keepGroup.includes(t.token));
    }

    // เก็บกวาด token เสีย (DeviceNotRegistered)
    const receipts = (json?.data as Array<{ status: string; details?: { error?: string } }>) || [];
    const dead: string[] = [];
    receipts.forEach((r, i) => {
      if (r.status === "error" && r.details?.error === "DeviceNotRegistered") dead.push(tokens[i].token);
    });
    if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });

    /* 🔴 26 ส.ค. 69: push ล้มแบบเงียบสนิทมาตลอด — เห็นแค่ "push-failed" ใน cron แต่ไม่รู้ว่า Expo ว่าอะไร
       (เจอตอนต่อแจ้งเตือนเข้ากับรายการงานค้าง: ส่ง 2 เครื่อง ok 0 แต่ token ไม่ถูกถอนสักตัว)
       log เฉพาะตอนมีปัญหา ไม่ log token */
    const ok = receipts.filter((r) => r.status === "ok").length;
    // เทียบกับจำนวน token ที่เหลือจริง ไม่ใช่จำนวนตอนตั้งต้น (ถ้าเพิ่งทิ้งใบเก่าไปจะกลายเป็น false alarm)
    if (ok < tokens.length) {
      console.error(
        "[push] ส่งไม่ผ่าน",
        JSON.stringify({
          memberId,
          type,
          ok,
          total: tokens.length,
          errors: receipts.filter((r) => r.status !== "ok").map((r) => ({ status: r.status, ...r.details })),
          topLevel: (json as { errors?: unknown })?.errors ?? null,
        })
      );
    }
    return ok;
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
