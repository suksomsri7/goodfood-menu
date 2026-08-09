/**
 * หัวข้อสุขภาพ + สัญญาณพฤติกรรมของ member — ใช้ร่วมกันระหว่าง "บทความสำหรับคุณวันนี้"
 * (src/lib/articleFeed.ts) และ "คลิปสำหรับคุณวันนี้" (src/lib/videoFeed.ts)
 *
 * 🔴 ทั้งไฟล์นี้ deterministic ล้วน — ไม่เรียก AI ไม่สุ่มจริง
 *    เรียกซ้ำวันเดียวกันด้วย member เดียวกัน = ผลลัพธ์เดิมเป๊ะ
 *
 * แยกออกมาจาก articleFeed.ts ตอนทำฟีเจอร์คลิป เพื่อไม่ให้ต้อง copy-paste ตรรกะการคัด
 * (articleFeed.ts re-export ของเดิมต่อ — ผู้เรียกเดิมไม่ต้องแก้)
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type TopicKey = "sodium" | "sugar" | "protein" | "sleep" | "weight" | "exercise";

export type MemberSignal = { topic: TopicKey; reason: string };

/** เนื้อหาชนิดไหน — ใช้เลือกคำในเหตุผล ("บทความนี้ช่วยได้" vs "คลิปนี้ช่วยได้") */
export type ContentKind = "article" | "video";

const WORDING: Record<ContentKind, { noun: string; sleep: string; weight: string }> = {
  article: { noun: "บทความ", sleep: "อ่านเรื่องนี้น่าจะช่วยครับ", weight: "ลองอ่านมุมนี้ดูครับ" },
  video: { noun: "คลิป", sleep: "ดูคลิปนี้น่าจะช่วยครับ", weight: "ลองดูคลิปนี้ดูครับ" },
};

/**
 * ปัญหาพฤติกรรมของ member ตอนนี้ — อ่านจาก BehaviorInsight รายสัปดาห์ล่าสุด (cron insights เขียนไว้)
 * ยกเว้น "น้ำตาล" ที่ยังไม่มี metric ใน BehaviorInsight → คิดสดจาก MealLog 7 วัน (ยังคง deterministic)
 *
 * ลำดับที่คืนกลับ = ลำดับความสำคัญ (โซเดียม → โปรตีน → นอน → น้ำหนัก → ออกกำลังกาย → น้ำตาล)
 */
export async function memberSignals(
  member: { id: string; goalType: string | null; dailySugar: number | null },
  kind: ContentKind = "article"
): Promise<MemberSignal[]> {
  const w = WORDING[kind];
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [insights, sugarAgg, sugarDays] = await Promise.all([
    prisma.behaviorInsight.findMany({
      where: { memberId: member.id, periodType: "weekly" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.mealLog.aggregate({
      where: { memberId: member.id, date: { gte: since7 } },
      _sum: { sugar: true },
    }),
    prisma.mealLog.findMany({
      where: { memberId: member.id, date: { gte: since7 } },
      select: { date: true },
    }),
  ]);

  // metric ล่าสุดของแต่ละชนิด
  const latest = new Map<string, any>();
  for (const i of insights) if (!latest.has(i.metric)) latest.set(i.metric, i.value);

  const out: MemberSignal[] = [];

  const sodium = latest.get("sodium_trend");
  if (sodium && (Number(sodium.overDays) >= 2 || Number(sodium.avg) > Number(sodium.target || 2300))) {
    out.push({
      topic: "sodium",
      reason: `โซเดียมช่วงนี้เกินเป้าบ่อย (เฉลี่ย ${Math.round(Number(sodium.avg))} mg/วัน) ${w.noun}นี้ช่วยได้`,
    });
  }

  const protein = latest.get("protein_gap");
  if (protein && Number(protein.gap) > 0) {
    out.push({
      topic: "protein",
      reason: `โปรตีนยังขาดวันละ ~${Math.round(Number(protein.gap))} g ${w.noun}นี้มีไอเดียเพิ่มให้ครับ`,
    });
  }

  const sleep = latest.get("sleep_avg");
  if (sleep && Number(sleep.avgMin) > 0 && Number(sleep.avgMin) < 390) {
    const h = (Number(sleep.avgMin) / 60).toFixed(1);
    out.push({ topic: "sleep", reason: `ช่วงนี้นอนเฉลี่ย ${h} ชม./คืน ยังน้อยไป ${w.sleep}` });
  }

  const weight = latest.get("weight_trend");
  if (weight && member.goalType === "lose" && Number(weight.deltaKg) >= 0) {
    out.push({ topic: "weight", reason: `น้ำหนัก 2 สัปดาห์นี้ยังไม่ขยับลง ${w.weight}` });
  }

  const adherence = latest.get("adherence");
  if (adherence && Number(adherence.score) < 0.5) {
    out.push({
      topic: "exercise",
      reason: `สัปดาห์นี้ทำตามแผนได้ไม่ครบ ${w.noun}นี้อาจช่วยให้กลับมาง่ายขึ้นครับ`,
    });
  }

  // น้ำตาล: เฉลี่ยต่อวันจากวันที่มีบันทึกจริง (ไม่หารด้วย 7 ตรง ๆ — คนที่บันทึกไม่ครบจะดูดีเกินจริง)
  const target = member.dailySugar || 50;
  const daysLogged = new Set(sugarDays.map((x) => x.date.toISOString().slice(0, 10))).size;
  if (daysLogged >= 3) {
    const avgSugar = (sugarAgg._sum.sugar || 0) / daysLogged;
    if (avgSugar > target) {
      out.push({
        topic: "sugar",
        reason: `น้ำตาลเฉลี่ย ~${Math.round(avgSugar)} g/วัน (เป้า ${Math.round(target)}) ${w.noun}นี้ช่วยได้ครับ`,
      });
    }
  }

  return out;
}

// ── จับคู่เนื้อหา ↔ ปัญหาของ member ──────────────────────────────────────

export type TopicMatch<T> = { item: T; topic: TopicKey; reason: string };

/**
 * ของชิ้นไหนตรงกับปัญหาของ member บ้าง (คงลำดับที่ส่งเข้ามา)
 * topicsOf = วิธีอ่าน "เรื่องที่ของชิ้นนี้พูดถึง" (บทความ = คิดสดจาก title/tags, คลิป = อ่านคอลัมน์ topics)
 */
export function matchByTopics<T>(
  items: T[],
  topicsOf: (item: T) => TopicKey[],
  signals: MemberSignal[]
): Array<TopicMatch<T>> {
  if (signals.length === 0) return [];
  const byTopic = new Map(signals.map((s) => [s.topic, s.reason]));
  const out: Array<TopicMatch<T>> = [];
  for (const item of items) {
    const topic = topicsOf(item).find((t) => byTopic.has(t));
    if (topic) out.push({ item, topic, reason: byTopic.get(topic)! });
  }
  return out;
}

// ── หมุนเวียนรายวันแบบ deterministic ────────────────────────────────────

/** วันที่ตามเวลาไทย YYYY-MM-DD (คลังเนื้อหาไม่โต แต่ชุดที่เห็นต้องเปลี่ยนทุกเที่ยงคืนไทย) */
export function bkkDayString(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * ลำดับสุ่มที่ "ทำซ้ำได้" — seed จาก memberId + วันที่ BKK + id ของชิ้นนั้น
 * 🔴 ห้ามใช้ Math.random: เรียกซ้ำในวันเดียวกันต้องได้ชุดเดิมเป๊ะ (แอปรีเฟรช/หลายเครื่องต้องตรงกัน)
 */
export function dailyRank(memberId: string, dayKey: string, itemId: string): string {
  return createHash("sha256").update(`${memberId}:${dayKey}:${itemId}`).digest("hex").slice(0, 16);
}

/** rank เดียวกันในรูปเลข 0..1 — ใช้ถ่วงน้ำหนักการหมุนหัวข้อ */
function rankUnit(memberId: string, dayKey: string, itemId: string): number {
  return parseInt(dailyRank(memberId, dayKey, itemId).slice(0, 8), 16) / 0xffffffff;
}

/**
 * หัวข้อที่แรงกว่าควรโผล่บ่อยกว่า แต่ **ห้ามผูกขาด**
 * ถ่วงด้วยลำดับความสำคัญ (step 0.15) แล้วเขย่าด้วย rank รายวัน
 * → signal อันดับ 1 ชนะราว 60% ของวัน ที่เหลือสลับให้อันดับรอง ๆ ได้โผล่บ้าง
 * (ถ้าใช้ลำดับความสำคัญตรง ๆ user จะเห็นแต่ธีมเดิมทุกวัน = บั๊กที่กำลังแก้)
 */
const TOPIC_WEIGHT_STEP = 0.15;

function topicOrderForDay(signals: MemberSignal[], memberId: string, dayKey: string): TopicKey[] {
  return signals
    .map((sig, i) => ({
      topic: sig.topic,
      score: rankUnit(memberId, dayKey, `topic:${sig.topic}`) + i * TOPIC_WEIGHT_STEP,
    }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.topic);
}

/** วันก่อนหน้าของ dayKey ("YYYY-MM-DD") */
function prevDayKey(dayKey: string): string {
  return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() - 86400_000).toISOString().slice(0, 10);
}

/** คลังใหญ่พอที่จะตัดของเมื่อวานทิ้งได้โดยไม่ทำให้วันนี้ขาด */
const NO_REPEAT_POOL_FACTOR = 1.5;

export type OrderForDayOpts<T> = {
  items: T[];
  idOf: (item: T) => string;
  matches: Array<TopicMatch<T>>;
  signals: MemberSignal[];
  memberId: string;
  dayKey: string;
  /** จำนวนช่องที่จะโชว์จริง — ต้องส่งมาถึงจะจัดสรรช่องแบบ matched/explore ได้ */
  limit?: number;
  /** ภายใน: 1 = กำลังคำนวณของเมื่อวานอยู่ ห้ามย้อนต่ออีกชั้น (กัน recursion ไม่รู้จบ) */
  _depth?: number;
};

/**
 * เลือกของ `limit` ชิ้นสำหรับวันนี้ — จัดสรรช่องแบบ "ครึ่งตรงปัญหา ครึ่งเปิดโลก"
 *
 * ⚠️ ของเดิมเรียง matched ทั้งหมดไว้หัวเสมอ พอ limit=2 และมี matched 2 ชิ้น
 *    2 ช่องนั้นถูกจองตายตัว ผู้ใช้เห็นของเดิมทุกวัน (บั๊กที่ user รายงาน)
 *
 * กติกาใหม่:
 *  - ช่อง matched = ceil(limit/2) ช่อง · หมุนหัวข้อรายวันข้ามทุก signal ที่ user มี
 *  - ช่องที่เหลือ = explore หมุนจากของทั้งหมดที่ยังไม่ถูกใช้ (รวม matched ที่ไม่ได้ลงช่อง)
 *  - ถ้าคลังใหญ่พอ (> limit × 1.5) ตัดของที่เลือกไปเมื่อวานออกจากผู้เข้าชิงวันนี้
 *  - เติมไม่ครบ = ดึงของที่ตัดออกกลับมา (ห้ามคืนช่องว่างให้ user)
 */
export function orderForDay<T>(opts: OrderForDayOpts<T>): {
  ordered: T[];
  matchById: Map<string, { topic: TopicKey; reason: string }>;
} {
  const { items, idOf, matches, signals, memberId, dayKey } = opts;
  const depth = opts._depth ?? 0;
  const limit = opts.limit && opts.limit > 0 ? opts.limit : items.length;

  const matchById = new Map(matches.map((m) => [idOf(m.item), { topic: m.topic, reason: m.reason }]));
  const byRank = (a: T, b: T) =>
    dailyRank(memberId, dayKey, idOf(a)).localeCompare(dailyRank(memberId, dayKey, idOf(b)));

  // ── ห้ามซ้ำวันติดกัน: คำนวณของเมื่อวานด้วยฟังก์ชันเดียวกัน (stateless ไม่ต้องเก็บตาราง) ──
  let excluded = new Set<string>();
  if (depth === 0 && items.length > limit * NO_REPEAT_POOL_FACTOR) {
    const yesterday = orderForDay({ ...opts, dayKey: prevDayKey(dayKey), _depth: 1 });
    excluded = new Set(yesterday.ordered.slice(0, limit).map(idOf));
  }
  const fresh = items.filter((x) => !excluded.has(idOf(x)));
  const pool = fresh.length >= limit ? fresh : items; // ตัดแล้วไม่พอ = ไม่ตัด

  const picked: T[] = [];
  const usedIds = new Set<string>();
  const take = (x: T) => { picked.push(x); usedIds.add(idOf(x)); };

  // ── ช่อง matched: วนหัวข้อตามลำดับของวันนี้ หัวข้อละ 1 ชิ้น (ครบแล้ววนซ้ำหัวข้อเดิมได้) ──
  const matchedSlots = Math.min(Math.ceil(limit / 2), pool.filter((x) => matchById.has(idOf(x))).length);
  const topicsToday = topicOrderForDay(signals, memberId, dayKey);
  let guard = 0;
  while (picked.length < matchedSlots && guard++ < topicsToday.length * 3) {
    const topic = topicsToday[(guard - 1) % topicsToday.length];
    const cand = pool
      .filter((x) => !usedIds.has(idOf(x)) && matchById.get(idOf(x))?.topic === topic)
      .sort(byRank)[0];
    if (cand) take(cand);
  }

  // ── ช่องที่เหลือ: explore จากของทั้งหมดที่ยังไม่ถูกใช้ (matched ที่ตกค้าง + ทั่วไป) ──
  for (const x of pool.filter((y) => !usedIds.has(idOf(y))).sort(byRank)) {
    if (picked.length >= limit) break;
    take(x);
  }

  // ── ยังไม่ครบ (คลังเล็ก/ถูกตัดไปเยอะ) → ดึงของที่เหลือทั้งหมดมาเติม ห้ามคืนช่องว่าง ──
  const leftovers = items.filter((x) => !usedIds.has(idOf(x))).sort(byRank);
  return { ordered: [...picked, ...leftovers], matchById };
}

// ── ช่วยจับคีย์เวิร์ด ────────────────────────────────────────────────────

/**
 * คีย์เวิร์ดไทย = หาแบบ substring ตรง ๆ (ภาษาไทยไม่มีเว้นวรรคระหว่างคำ)
 * คีย์เวิร์ดอังกฤษ = ต้องเป็นคำเต็ม ไม่งั้น "if" จะไปโดน "fifty/life" ฯลฯ
 */
export function hasKeyword(haystackLower: string, keyword: string): boolean {
  const k = keyword.toLowerCase();
  if (/^[\x20-\x7e]+$/.test(k)) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(haystackLower);
  }
  return haystackLower.includes(k);
}
