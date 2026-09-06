/**
 * คิวตรวจคลิปท่าออกกำลังกาย — ส่งการ์ดเข้า Telegram ให้เจ้าของกดผ่าน/ไม่ผ่านทีละใบ
 *
 * ทำไมต้องมีคนกด: ผมหาลิงก์ได้และตรวจได้ว่าลิงก์เปิดจริง/ฝังได้/ชื่อตรงท่า
 * แต่ **ยืนยันไม่ได้ว่าท่าในคลิปทำถูกหลักไหม** — แอปสุขภาพสอนท่าผิดแล้วคนเจ็บ
 * (เคยพลาดแนวนี้มาแล้วตอนโพสต์สกูบาแต่ใช้รูปฟรีไดฟ์ นักดำน้ำจริงจับได้)
 *
 * 🔴 สถานะทั้งหมดอยู่ใน DB — บอทรีสตาร์ทกี่ครั้งก็ไม่ส่งซ้ำ
 * 🔴 ส่งทีละใบ: ใบถัดไปออกเมื่อใบก่อนหน้าถูกกดแล้วเท่านั้น (แชทไม่ท่วม)
 *
 * 🔴 สถานะของ "ใบ" กับข้อสรุปของ "ท่า" คนละเรื่องกัน (บั๊กที่เจ้าของเจอ 6 ก.ย. 69):
 *    เดิม `skipped` ถูกใช้ทั้งตอนเจ้าของกด "ข้ามไปก่อน" และตอนเก็บกวาดใบที่เหลือหลังกดผ่าน
 *    แล้วโค้ดตีความว่า "ท่านี้จบแล้วตลอดกาล" → คลิปที่ระบบไปค้นมาใหม่ทีหลังไม่มีวันถูกส่ง
 *    และบอทขึ้น "ตรวจครบทุกท่าแล้ว 🎉" ทุกวันทั้งที่ยังเหลือ 7 ท่า + ใบค้าง 166 ใบ
 *    ตอนนี้แยกชัด:
 *      · `skipped`   = ข้ามรอบนี้ · เจอคลิปใหม่เมื่อไหร่ส่งมาถามได้อีก
 *      · `dismissed` = เจ้าของสั่งปิดถาวร · ห้ามถามอีก และห้ามเผาโควตาค้นให้
 *    คำว่า "จบแล้ว" ต้องหมายถึง approved | dismissed เท่านั้น
 */
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/secrets/store";
import { topUpCandidates, QuotaExceeded } from "@/lib/exerciseVideoSearch";

const API = "https://api.telegram.org/bot";

/** ท่าที่มีข้อสรุปแล้วจริง ๆ — ห้ามส่งการ์ดของท่านี้อีก */
const CONCLUDED = ["approved", "dismissed"] as const;
/** ใบที่ยังอยู่ในคิว (ยังไม่ถูกตัดสิน) */
const LIVE = ["pending", "sent", "awaiting_link"] as const;

async function creds() {
  const [token, chatId] = await Promise.all([
    getSecret("FOODIE_BOT_TOKEN"),
    getSecret("FOODIE_BOT_CHAT_ID"),
  ]);
  return { token: token?.trim() || "", chatId: chatId?.trim() || "" };
}

async function tg(method: string, body: Record<string, unknown>) {
  const { token } = await creds();
  if (!token) throw new Error("ยังไม่ได้ตั้ง FOODIE_BOT_TOKEN");
  const res = await fetch(`${API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
  if (!j?.ok) throw new Error(`telegram ${method}: ${j?.description ?? res.status}`);
  return j.result as Record<string, unknown>;
}

/** จำนวนที่เหลือ — ใส่ท้ายการ์ดให้รู้ว่าอีกกี่ท่า จะได้กะเวลาถูก */
async function progress() {
  const [done, total] = await Promise.all([
    prisma.exerciseVideoCandidate.groupBy({ by: ["exerciseKey"], where: { status: { in: [...CONCLUDED] } } }),
    prisma.exerciseVideoCandidate.groupBy({ by: ["exerciseKey"] }),
  ]);
  return { done: done.length, total: total.length };
}

/**
 * ท่าที่ยังไม่ได้ข้อสรุป และตอนนี้ไม่มีตัวเลือกเหลือให้เสิร์ฟแล้ว = "ค้างจริง ต้องมีคนช่วย"
 * 🔴 "ข้ามไปก่อน" ไม่นับเป็นข้อสรุป — ท่าที่ข้ามไว้แล้วยังไม่มีคลิป ต้องโผล่ในลิสต์นี้เสมอ
 *    ไม่งั้นมันหายไปจากสายตาทุกคนทั้งที่ยังไม่เสร็จ
 */
async function concludedKeys(): Promise<Set<string>> {
  const rows = await prisma.exerciseVideoCandidate.findMany({
    where: { status: { in: [...CONCLUDED] } },
    select: { exerciseKey: true },
    distinct: ["exerciseKey"],
  });
  return new Set(rows.map((r) => r.exerciseKey));
}

/**
 * แยกท่าที่ยังไม่มีคลิปออกเป็น 2 กอง — ตัวตัดสินว่าจะพูดว่า "ครบ" ได้ไหม
 * แยกเป็นฟังก์ชันบริสุทธิ์เพราะนี่คือจุดที่เคยโกหก (ขึ้น "ครบทุกท่า" ทั้งที่เหลือ 7 ท่า)
 *   stuck     = ยังไม่มีข้อสรุป ต้องตามต่อ
 *   dismissed = เจ้าของสั่งปิดถาวรเอง ไม่ต้องตาม แต่ยัง "ไม่มีคลิป" อยู่ดี ห้ามนับเป็นครบเงียบ ๆ
 */
export function splitRemaining<T extends { key: string }>(
  noVideo: T[],
  concluded: Set<string>,
): { stuck: T[]; dismissed: T[] } {
  return {
    stuck: noVideo.filter((n) => !concluded.has(n.key)),
    dismissed: noVideo.filter((n) => concluded.has(n.key)),
  };
}

async function unresolvedKeys(): Promise<string[]> {
  const [done, all, live] = await Promise.all([
    concludedKeys(),
    prisma.exerciseVideoCandidate.findMany({ select: { exerciseKey: true }, distinct: ["exerciseKey"] }),
    prisma.exerciseVideoCandidate.findMany({ where: { status: { in: [...LIVE] } }, select: { exerciseKey: true }, distinct: ["exerciseKey"] }),
  ]);
  const liveSet = new Set(live.map((p) => p.exerciseKey));
  return all.map((a) => a.exerciseKey).filter((k) => !done.has(k) && !liveSet.has(k));
}

/**
 * ส่งใบถัดไป — คืน false เมื่อไม่มีอะไรให้ส่งแล้ว
 * `onlyKey` = บังคับให้ส่งของท่านั้น (ใช้ตอนกด "ขอตัวอื่น")
 */
export async function sendNextCard(onlyKey?: string): Promise<boolean> {
  const { chatId } = await creds();
  if (!chatId) throw new Error("ยังไม่ได้ตั้ง FOODIE_BOT_CHAT_ID");

  // มีใบที่ส่งไปแล้วยังไม่ถูกกด = รออยู่ อย่าเพิ่งส่งเพิ่ม (ยกเว้นกรณีขอตัวอื่นของท่าเดิม)
  if (!onlyKey) {
    const waiting = await prisma.exerciseVideoCandidate.count({ where: { status: "sent" } });
    if (waiting > 0) return false;
  }

  /* ท่าที่ "จบแล้ว" = กดผ่าน หรือสั่งปิดถาวร — ห้ามส่งใบของท่านั้นอีก
     🔴 "ข้ามไปก่อน" ไม่อยู่ในนี้: ตอนกดข้าม ใบที่ค้างอยู่ถูกปิดไปหมดแล้ว ท่านั้นจึงเงียบไปเอง
        แต่พอระบบไปค้นคลิปใหม่มาได้ ต้องกลับมาถามได้อีก (ไม่งั้นใบใหม่ค้างตายอยู่ใน DB) */
  const settledKeys = [...(await concludedKeys())];

  const next = await prisma.exerciseVideoCandidate.findFirst({
    where: {
      status: "pending",
      ...(onlyKey ? { exerciseKey: onlyKey } : { exerciseKey: { notIn: settledKeys } }),
    },
    orderBy: [{ priority: "asc" }, { rank: "asc" }, { createdAt: "asc" }],
  });
  if (!next) {
    /* 🔴 บั๊กที่เจ้าของเจอ 27 ส.ค. 69: ท่าที่กด "ขอตัวอื่น" จนหมดตัวเลือก จะไม่มีการ์ดโผล่อีกเลย
       ของเดิมส่งข้อความเปล่า ๆ แล้วเดินหน้าต่อ → ท่านั้นค้างอยู่ในสถานะ "ยังไม่จบ" แต่ไม่มีทางทำต่อ
       และตอนไล่หมดคิวยังขึ้น "ตรวจครบทุกท่าแล้ว" ทั้งที่ยังไม่ครบ = ระบบโกหก
       แก้: ส่งข้อความ **พร้อมปุ่ม** ที่อ้างด้วย exerciseKey (ไม่ต้องมีใบ candidate) ให้ทำต่อได้เสมอ */
    if (onlyKey) {
      /* 🔴 27 ส.ค. 69 เจ้าของทัก: กด "ขอตัวอื่น" แล้วขึ้น "หมดตัวเลือก" ทั้งที่ YouTube ยังมีอีกเยอะ
         ของหมด ≠ ไม่มีของ — แค่ที่ค้นไว้ล่วงหน้าหมด · ไปค้นสดต่อก่อนเสมอ */
      let quotaOut = false;
      const added = await topUpCandidates(onlyKey).catch((e) => {
        // 🔴 โควตาหมด ≠ ไม่มีคลิป — ต้องบอกตามจริง ไม่งั้นเจ้าของไปหาลิงก์เองทั้งที่พรุ่งนี้ระบบหาให้ได้
        if (e instanceof QuotaExceeded) quotaOut = true;
        return 0;
      });
      if (added > 0) return sendNextCard(onlyKey);

      const exName = (await prisma.exercise.findUnique({ where: { key: onlyKey }, select: { name: true } }))?.name;
      await tg("sendMessage", {
        chat_id: chatId,
        text: quotaOut
          ? `โควตาค้นหา YouTube ของวันนี้หมดแล้วครับ (รีเซ็ตประมาณบ่าย 2 เวลาไทย) — ตอนนี้ส่งลิงก์เองได้ หรือข้ามไว้ก่อน เดี๋ยวพรุ่งนี้ผมหาให้ใหม่ "${exName ?? onlyKey}"`
          : `หาคลิปของ "${exName ?? onlyKey}" เพิ่มแล้วแต่ไม่เจอที่ผ่านเกณฑ์ — ส่งลิงก์เองได้ หรือข้ามไว้ก่อนครับ`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✏️ ใช้ลิงก์ที่ผมส่ง", callback_data: `xv:linkkey:${onlyKey}` },
              { text: "⛔ ข้ามท่านี้", callback_data: `xv:skipkey:${onlyKey}` },
            ],
            [{ text: "🚫 ไม่เอาท่านี้ถาวร", callback_data: `xv:killkey:${onlyKey}` }],
          ],
        },
      });
      return true; // ถือว่ามีของค้างให้ตัดสิน ไม่เดินหน้าไปท่าอื่นจนกว่าจะกด
    }

    /* 🔴 ข้อความปิดท้ายต้องตัดสินจาก "ท่าที่ยังไม่มีคลิปจริง ๆ" ไม่ใช่จากคิวใบว่าง
       ของเดิมดูแค่ว่าไม่มีใบให้ส่งแล้ว → ขึ้น "ครบทุกท่า 🎉" ทุกวันทั้งที่เหลือ 7 ท่า
       บอกครบทั้งที่ไม่ครบ = ไม่มีใครไปตามงานที่เหลือต่อ ซึ่งแย่กว่าไม่ส่งข้อความเลย */
    const [noVideo, done] = await Promise.all([
      prisma.exercise.findMany({ where: { videoUrl: null, isActive: true }, select: { key: true, name: true } }),
      concludedKeys(),
    ]);
    const { stuck, dismissed } = splitRemaining(noVideo, done);

    if (stuck.length) {
      await tg("sendMessage", {
        chat_id: chatId,
        text:
          `ตรวจของที่ผมหามาครบแล้ว แต่ยังเหลือ ${stuck.length} ท่าที่ยังไม่มีคลิป:\n` +
          stuck.map((n) => `• ${n.name}`).join("\n") +
          `\n\nส่งลิงก์เองได้ หรือบอกผมว่า "หามาเพิ่ม" เดี๋ยวไปค้นให้ใหม่ครับ`,
      });
      return false;
    }
    if (dismissed.length) {
      await tg("sendMessage", {
        chat_id: chatId,
        text:
          `ตรวจครบทุกท่าที่เปิดไว้แล้วครับ 🎉\n` +
          `เหลือ ${dismissed.length} ท่าที่คุณสั่งปิดถาวรไว้ (ยังไม่มีคลิป): ` +
          dismissed.map((n) => n.name).join(" · ") +
          `\nเปลี่ยนใจพิมพ์ "เปิดใหม่" ได้ครับ`,
      });
      return false;
    }
    await tg("sendMessage", { chat_id: chatId, text: "ตรวจครบทุกท่าแล้วครับ 🎉" });
    return false;
  }

  const ex = await prisma.exercise.findUnique({
    where: { key: next.exerciseKey },
    select: { name: true, nameEn: true, muscles: true, cue: true },
  });
  const p = await progress();

  const caption =
    `<b>${ex?.name ?? next.exerciseKey}</b>` +
    (ex?.nameEn ? ` · ${ex.nameEn}` : "") +
    (ex?.muscles ? `\n<i>${ex.muscles}</i>` : "") +
    (ex?.cue ? `\n💡 ${ex.cue}` : "") +
    `\n\n🎬 ${next.title}` +
    (next.channel ? `\n📺 ${next.channel}` : "") +
    `\nhttps://www.youtube.com/shorts/${next.videoId}` +
    `\n\nตรวจแล้ว ${p.done}/${p.total} ท่า`;

  const sent = await tg("sendPhoto", {
    chat_id: chatId,
    photo: `https://i.ytimg.com/vi/${next.videoId}/hqdefault.jpg`,
    caption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ ผ่าน", callback_data: `xv:ok:${next.id}` },
          { text: "🔄 ขอตัวอื่น", callback_data: `xv:no:${next.id}` },
        ],
        [{ text: "✏️ ใช้ลิงก์ที่ผมส่ง", callback_data: `xv:link:${next.id}` }],
        [{ text: "⛔ ข้ามท่านี้ไปก่อน", callback_data: `xv:skip:${next.id}` }],
        [{ text: "🚫 ไม่เอาท่านี้ถาวร", callback_data: `xv:kill:${next.id}` }],
      ],
    },
  });

  await prisma.exerciseVideoCandidate.update({
    where: { id: next.id },
    data: { status: "sent", sentAt: new Date(), messageId: Number(sent.message_id) || null },
  });
  return true;
}

/** ผู้ใช้กดปุ่มบนการ์ด — คืนข้อความสั้น ๆ ที่จะเด้งบนหัวจอ Telegram */
export async function handleDecision(data: string): Promise<string> {
  const [, action, id] = data.split(":");

  /* ปุ่มที่อ้างด้วย "ชื่อท่า" ไม่ใช่ใบ candidate — ใช้กับท่าที่หมดตัวเลือกแล้ว */
  if (action === "linkkey" || action === "skipkey" || action === "killkey") {
    const { chatId: cid } = await creds();
    const exName = (await prisma.exercise.findUnique({ where: { key: id }, select: { name: true } }))?.name ?? id;
    if (action === "skipkey" || action === "killkey") {
      const permanent = action === "killkey";
      await prisma.exerciseVideoCandidate.updateMany({
        where: { exerciseKey: id },
        data: { status: permanent ? "dismissed" : "skipped", decidedAt: new Date() },
      });
      if (permanent) {
        await tg("sendMessage", {
          chat_id: cid,
          text: `🚫 ปิดท่า "${exName}" ถาวรแล้ว — จะไม่ถามอีกและไม่ไปค้นคลิปให้แล้ว\n(เปลี่ยนใจพิมพ์ "เปิดใหม่" ได้)`,
        }).catch(() => {});
      }
      await sendNextCard();
      return permanent ? "ปิดท่านี้ถาวรแล้ว" : "ข้ามท่านี้แล้ว";
    }
    // จองคิวรอลิงก์ด้วยใบที่ถูกปฏิเสธไปแล้วใบล่าสุด (ไม่ต้องสร้างแถวหลอก)
    const last = await prisma.exerciseVideoCandidate.findFirst({
      where: { exerciseKey: id },
      orderBy: { rank: "desc" },
    });
    if (last) await prisma.exerciseVideoCandidate.update({ where: { id: last.id }, data: { status: "awaiting_link" } });
    await tg("sendMessage", {
      chat_id: cid,
      text: `✏️ ส่งลิงก์ YouTube ของท่า "${exName}" มาได้เลยครับ (พิมพ์ ยกเลิก เพื่อยกเลิก)`,
    });
    return "รอลิงก์จากคุณครับ";
  }

  const row = await prisma.exerciseVideoCandidate.findUnique({ where: { id } });
  if (!row) return "ไม่เจอรายการนี้แล้ว";
  if (row.status !== "sent") return "ใบนี้กดไปแล้ว";

  const { chatId } = await creds();
  const now = new Date();

  if (action === "ok") {
    await prisma.$transaction([
      prisma.exerciseVideoCandidate.update({ where: { id }, data: { status: "approved", decidedAt: now } }),
      // ใบที่เหลือของท่านี้ไม่ต้องถามอีก
      prisma.exerciseVideoCandidate.updateMany({
        where: { exerciseKey: row.exerciseKey, status: "pending" },
        data: { status: "skipped", decidedAt: now },
      }),
      prisma.exercise.update({
        where: { key: row.exerciseKey },
        data: { videoUrl: `https://www.youtube.com/shorts/${row.videoId}` },
      }),
    ]);
    if (row.messageId) {
      await tg("editMessageCaption", {
        chat_id: chatId,
        message_id: row.messageId,
        caption: `✅ <b>ใช้คลิปนี้แล้ว</b>\n${row.title}\nhttps://www.youtube.com/shorts/${row.videoId}`,
        parse_mode: "HTML",
      }).catch(() => {});
    }
    await sendNextCard();
    return "บันทึกแล้ว ✅";
  }

  if (action === "link") {
    /* รอให้เจ้าของพิมพ์ลิงก์มาเอง — จดไว้ใน DB ไม่ใช่ตัวแปรในบอท
       (บอทรีสตาร์ทกลางทางแล้วลืมว่ารออะไรอยู่ = ลิงก์ที่พิมพ์มาหายเฉย ๆ) */
    await prisma.exerciseVideoCandidate.update({ where: { id }, data: { status: "awaiting_link" } });
    const exName = (await prisma.exercise.findUnique({ where: { key: row.exerciseKey }, select: { name: true } }))?.name;
    await tg("sendMessage", {
      chat_id: chatId,
      text: `✏️ ส่งลิงก์ YouTube ของท่า "${exName ?? row.exerciseKey}" มาได้เลยครับ\n(ส่งข้อความถัดไปเป็นลิงก์ · พิมพ์ ยกเลิก เพื่อกลับไปเลือกจากที่ผมหามา)`,
    });
    return "รอลิงก์จากคุณครับ";
  }

  if (action === "kill") {
    /* ปิดถาวร = ปิดทุกใบของท่านี้ รวมใบที่เคยถูกปฏิเสธไปแล้ว
       (ถ้าปิดแค่ใบที่ยังไม่ตัดสิน ท่านี้จะกลับมาโผล่ทันทีที่ระบบค้นเจอใบใหม่) */
    await prisma.exerciseVideoCandidate.updateMany({
      where: { exerciseKey: row.exerciseKey },
      data: { status: "dismissed", decidedAt: now },
    });
    if (row.messageId) {
      await tg("editMessageCaption", {
        chat_id: chatId,
        message_id: row.messageId,
        caption: `🚫 ปิดท่านี้ถาวร — ${row.exerciseKey}\n(เปลี่ยนใจพิมพ์ "เปิดใหม่")`,
      }).catch(() => {});
    }
    await sendNextCard();
    return "ปิดท่านี้ถาวรแล้ว";
  }

  if (action === "skip") {
    await prisma.exerciseVideoCandidate.updateMany({
      where: { exerciseKey: row.exerciseKey, status: { in: ["sent", "pending"] } },
      data: { status: "skipped", decidedAt: now },
    });
    if (row.messageId) {
      await tg("editMessageCaption", {
        chat_id: chatId,
        message_id: row.messageId,
        caption: `⛔ ข้ามท่านี้ไว้ก่อน — ${row.exerciseKey}`,
      }).catch(() => {});
    }
    await sendNextCard();
    return "ข้ามท่านี้แล้ว";
  }

  // ขอตัวอื่นของท่าเดิม
  await prisma.exerciseVideoCandidate.update({ where: { id }, data: { status: "rejected", decidedAt: now } });
  if (row.messageId) {
    await tg("editMessageCaption", {
      chat_id: chatId,
      message_id: row.messageId,
      caption: `🔄 ไม่เอาใบนี้ — ${row.title}`,
    }).catch(() => {});
  }
  await sendNextCard(row.exerciseKey);
  return "หาตัวใหม่ให้แล้ว";
}

/** แกะ videoId จากลิงก์ทุกรูปแบบที่คนวางมา (shorts / watch?v= / youtu.be) */
function parseId(raw: string): string | null {
  const m = raw.match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/) ?? raw.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

/**
 * เจ้าของพิมพ์ลิงก์มาเอง
 * คืน handled=false เมื่อ "ตอนนี้ไม่ได้รอลิงก์อยู่" → บอทต้องเงียบ ห้ามไปทับ flow อื่นของ content-bot
 * 🔴 ต้องตรวจว่าคลิปเปิดได้จริงก่อนบันทึก — วางลิงก์ผิด/คลิปถูกลบแล้ว จะกลายเป็นปุ่ม ▶ ที่กดไปเจอจอดำ
 */
export async function handleManualLink(text: string): Promise<{ handled: boolean; message?: string }> {
  const waiting = await prisma.exerciseVideoCandidate.findFirst({ where: { status: "awaiting_link" } });
  if (!waiting) return { handled: false };

  const { chatId } = await creds();
  const raw = text.trim();

  if (/^(ยกเลิก|cancel)$/i.test(raw)) {
    await prisma.exerciseVideoCandidate.update({ where: { id: waiting.id }, data: { status: "sent" } });
    return { handled: true, message: "ยกเลิกแล้ว — กดปุ่มบนการ์ดเดิมต่อได้เลยครับ" };
  }

  const videoId = parseId(raw);
  if (!videoId) return { handled: true, message: "อ่านลิงก์ไม่ออกครับ — ส่งลิงก์ YouTube มาอีกครั้ง (หรือพิมพ์ ยกเลิก)" };

  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  if (!res.ok) return { handled: true, message: "ลิงก์นี้เปิดไม่ได้ (ถูกลบ/เป็นส่วนตัว/ปิดการฝัง) — ลองลิงก์อื่นนะครับ" };
  const meta = (await res.json()) as { title?: string; author_name?: string };

  const now = new Date();
  await prisma.$transaction([
    prisma.exerciseVideoCandidate.upsert({
      where: { exerciseKey_videoId: { exerciseKey: waiting.exerciseKey, videoId } },
      update: { status: "approved", decidedAt: now, title: meta.title ?? raw, channel: meta.author_name ?? null },
      create: {
        exerciseKey: waiting.exerciseKey, videoId, title: meta.title ?? raw,
        channel: meta.author_name ?? null, status: "approved", decidedAt: now, priority: 0,
      },
    }),
    // ใบที่เหลือของท่านี้ไม่ต้องถามอีก (รวมใบที่กำลังรอลิงก์อยู่)
    prisma.exerciseVideoCandidate.updateMany({
      where: { exerciseKey: waiting.exerciseKey, status: { in: ["pending", "sent", "awaiting_link"] } },
      data: { status: "skipped", decidedAt: now },
    }),
    prisma.exercise.update({
      where: { key: waiting.exerciseKey },
      data: { videoUrl: `https://www.youtube.com/shorts/${videoId}` },
    }),
  ]);

  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ ใช้ลิงก์ของคุณแล้ว — ${meta.title ?? videoId}`,
  }).catch(() => {});
  await sendNextCard();
  return { handled: true }; // ตอบไปแล้วด้วยข้อความข้างบน ไม่ต้องตอบซ้ำ
}

/**
 * คำสั่งข้อความสั้น ๆ ที่เจ้าของพิมพ์เข้ามา — ตอนนี้มีคำเดียวคือ "หามาเพิ่ม"
 * 🔴 28 ส.ค. 69: ข้อความของบอทเองบอกว่า "บอกผมให้ไปหามาเพิ่มก็ได้ครับ" แต่ไม่เคยมีตัวรับ
 *    เจ้าของพิมพ์แล้วเงียบ — บอกให้ทำอะไรได้ ต้องทำได้จริง
 */
export async function handleCommand(text: string): Promise<{ handled: boolean; message?: string }> {
  const cmd = text.trim();

  /* "เปิดใหม่" — ทางกลับของปุ่มปิดถาวร
     🔴 การตัดสินใจถาวรต้องมีทางถอย ไม่งั้นกดพลาดครั้งเดียวแล้วท่านั้นหายจากระบบตลอดไป */
  if (/^(เปิดใหม่|เปิดใหม)$/i.test(cmd)) {
    const reopened = await prisma.exerciseVideoCandidate.updateMany({
      where: { status: "dismissed" },
      data: { status: "pending", decidedAt: null },
    });
    if (!reopened.count) return { handled: true, message: "ตอนนี้ไม่มีท่าที่ปิดถาวรไว้ครับ" };
    await sendNextCard();
    return { handled: true, message: `เปิดกลับมา ${reopened.count} ใบแล้วครับ` };
  }

  if (!/^(หามาเพิ่ม|หาเพิ่ม|หาใหม่)$/i.test(cmd)) return { handled: false };

  const [stuck, noVideo, done] = await Promise.all([
    unresolvedKeys(),
    prisma.exercise.findMany({ where: { videoUrl: null, isActive: true }, select: { key: true, name: true } }),
    concludedKeys(),
  ]);
  /* 🔴 ท่าที่สั่งปิดถาวรต้องไม่ถูกค้นให้ — ของเดิมยิงค้นทุกท่าที่ไม่มีคลิปทุกวัน
     เผาโควตา YouTube ไปกับของที่เจ้าของบอกแล้วว่าไม่เอา */
  const targets = [...new Set([...stuck, ...noVideo.map((n) => n.key)])].filter((k) => !done.has(k));
  if (!targets.length) {
    const dismissed = noVideo.filter((n) => done.has(n.key));
    return {
      handled: true,
      message: dismissed.length
        ? `ท่าที่เปิดไว้มีคลิปครบแล้วครับ 🎉 (ปิดถาวรไว้ ${dismissed.length} ท่า — พิมพ์ "เปิดใหม่" ถ้าอยากให้หาต่อ)`
        : "ทุกท่ามีคลิปครบแล้วครับ 🎉",
    };
  }

  const { chatId } = await creds();
  let added = 0;
  let quotaOut = false;
  for (const key of targets) {
    try {
      added += await topUpCandidates(key);
    } catch (e) {
      if (e instanceof QuotaExceeded) { quotaOut = true; break; }
    }
  }

  if (quotaOut && added === 0) {
    return {
      handled: true,
      message: "โควตาค้นหา YouTube ของวันนี้หมดแล้วครับ (รีเซ็ตประมาณบ่าย 2 เวลาไทย) — พรุ่งนี้ผมหาให้ใหม่อัตโนมัติ",
    };
  }
  if (!added) {
    const names = noVideo.filter((n) => targets.includes(n.key)).map((n) => n.name).join(" · ");
    return { handled: true, message: `หาเพิ่มแล้วแต่ไม่เจอคลิปใหม่ที่ผ่านเกณฑ์ครับ (${names}) — ส่งลิงก์เองได้เลย` };
  }

  await tg("sendMessage", { chat_id: chatId, text: `หามาเพิ่มได้ ${added} ใบ — ส่งให้ตรวจเลยครับ` }).catch(() => {});
  await sendNextCard();
  return { handled: true };
}

export async function answerCallback(callbackId: string, text: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, text }).catch(() => {});
}
