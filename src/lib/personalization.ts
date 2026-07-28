/**
 * WO-P.3 (สาย P) — ป้อน CoachMemory + BehaviorInsight กลับเข้า context กลาง
 *
 * จุดเดียวที่ประกอบ "ข้อมูลเฉพาะตัว" ของ user เป็นบล็อกข้อความสำหรับ prompt
 * ห้าม copy-paste logic นี้ไปที่อื่น — ทุก AI path ต้องเรียกผ่านที่นี่:
 *   gatherMemberContext (coaching.ts) → buildPrompt/morningCoach/coachChat/agent
 *   generateWeekPlan (planGenerator.ts) → weeklyAdjust (regenerate แผน)
 */
import { prisma } from "@/lib/prisma";
import { getMemories } from "@/lib/coachMemory";

const KIND_LABEL: Record<string, string> = {
  preference: "ชอบ",
  dislike: "ไม่ชอบ/เลี่ยง",
  constraint: "ข้อจำกัด",
  injury: "อาการบาดเจ็บ",
  schedule: "ตารางชีวิต",
  pattern: "พฤติกรรม",
  goal_note: "โน้ตเป้าหมาย",
  context: "บริบท",
};

/** kind ที่เป็น "ข้อห้าม" — แผน/คำแนะนำต้องไม่ขัดกับข้อเหล่านี้ */
const AVOID_KINDS = new Set(["dislike", "constraint", "injury"]);

/**
 * ต้องเขียนเชิงบวก: เคยเจอว่าถ้าสั่งแค่ "ห้ามแนะนำสิ่งที่ขัดข้อห้าม"
 * โมเดลจะปฏิเสธไม่แนะนำอะไรเลย ("ขอโทษครับ ผมแนะนำไม่ได้") แทนที่จะหาทางเลือกอื่นให้
 */
export const AVOID_INSTRUCTION =
  "เวลาแนะนำเมนู วัตถุดิบ หรือท่าออกกำลังกาย ให้เลี่ยงข้อห้ามข้างต้นเสมอ แล้วเสนอทางเลือกอื่นที่ปลอดภัยแทน — ห้ามปฏิเสธที่จะแนะนำ";

export interface PersonalMemory {
  kind: string;
  fact: string;
  confidence: number;
  source: string;
}

export interface PersonalInsight {
  metric: string;
  periodKey: string;
  text: string;
  value: unknown;
}

export interface Personalization {
  memories: PersonalMemory[];
  insights: PersonalInsight[];
  /** ข้อเท็จจริงที่ห้ามขัด (แพ้อาหาร/บาดเจ็บ/ข้อจำกัด) */
  avoid: string[];
  /** บล็อกข้อความพร้อมยัดเข้า prompt ("" = ไม่มีข้อมูล) */
  text: string;
}

export const EMPTY_PERSONALIZATION: Personalization = {
  memories: [],
  insights: [],
  avoid: [],
  text: "",
};

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} ชม.${m ? ` ${m} นาที` : ""}` : `${m} นาที`;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** แปลง BehaviorInsight (value เป็น Json) → ประโยคไทย · คืน null ถ้ารูปแบบไม่รู้จัก/ข้อมูลไม่พอ */
export function insightToText(metric: string, value: unknown): string | null {
  const v = (value ?? {}) as Record<string, unknown>;
  switch (metric) {
    case "sodium_trend": {
      const avg = num(v.avg);
      const target = num(v.target);
      if (!avg || !target) return null;
      const over = num(v.overDays);
      const worst = typeof v.worstWeekday === "string" ? v.worstWeekday : null;
      return `โซเดียมเฉลี่ย ${avg} mg/วัน (เป้า ≤${target}) · เกินเป้า ${over} วันใน 7 วัน${worst ? ` · หนักสุดวัน${worst}` : ""}`;
    }
    case "protein_gap": {
      const avg = num(v.avg);
      const target = num(v.target);
      if (!target) return null;
      const gap = num(v.gap);
      return `โปรตีนเฉลี่ย ${avg} g/วัน (เป้า ${target} g)${gap > 0 ? ` · ยังขาดอีก ${gap} g/วัน` : " · ถึงเป้าแล้ว"}`;
    }
    case "sleep_avg": {
      const avgMin = num(v.avgMin);
      if (!avgMin) return null;
      return `นอนเฉลี่ย ${fmtMinutes(avgMin)}/คืน (จาก ${num(v.nights)} คืน)`;
    }
    case "adherence": {
      const plans = num(v.plans);
      if (!plans) return null;
      return `ทำตามแผน 7 วันล่าสุด ${Math.round(num(v.score) * 100)}% (${plans} วันที่มีแผน)`;
    }
    case "weight_trend": {
      const delta = num(v.deltaKg);
      const from = num(v.from);
      const to = num(v.to);
      if (!from || !to) return null;
      return `น้ำหนัก 14 วัน ${delta > 0 ? "+" : ""}${delta} kg (${from} → ${to} kg)`;
    }
    default:
      return null;
  }
}

/**
 * ดึง memory + insight ล่าสุดของ member แล้วประกอบเป็นบล็อกเดียว
 * - memory: active เรียง confidence (getMemories)
 * - insight: เอา record ล่าสุดของแต่ละ metric (ข้าม metric ที่แปลงเป็นข้อความไม่ได้)
 */
export async function getPersonalization(
  memberId: string,
  opts?: { maxMemories?: number }
): Promise<Personalization> {
  const [mems, rawInsights] = await Promise.all([
    getMemories(memberId, opts?.maxMemories ?? 30),
    prisma.behaviorInsight.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const memories: PersonalMemory[] = mems.map((m) => ({
    kind: m.kind,
    fact: m.fact,
    confidence: m.confidence,
    source: m.source,
  }));

  // metric ละ 1 รายการ (ตัวล่าสุด)
  const seen = new Set<string>();
  const insights: PersonalInsight[] = [];
  for (const row of rawInsights) {
    if (seen.has(row.metric)) continue;
    const text = insightToText(row.metric, row.value);
    if (!text) continue;
    seen.add(row.metric);
    insights.push({ metric: row.metric, periodKey: row.periodKey, text, value: row.value });
  }

  const avoid = memories.filter((m) => AVOID_KINDS.has(m.kind)).map((m) => m.fact);

  const parts: string[] = [];
  if (memories.length) {
    parts.push(
      `สิ่งที่โค้ชจำเกี่ยวกับผู้ใช้ (จากที่ user เล่า + pattern จาก log จริง):\n` +
        memories.map((m) => `- [${KIND_LABEL[m.kind] || m.kind}] ${m.fact}`).join("\n")
    );
  }
  if (insights.length) {
    const period = insights[0].periodKey;
    parts.push(
      `ข้อมูลเชิงลึกจาก log จริง (สัปดาห์ ${period}):\n` +
        insights.map((i) => `- ${i.text}`).join("\n")
    );
  }
  if (avoid.length) {
    parts.push(`ข้อห้ามของผู้ใช้: ${avoid.join(" · ")}\n${AVOID_INSTRUCTION}`);
  }

  return { memories, insights, avoid, text: parts.join("\n\n") };
}

/** เวอร์ชันกันล้ม — ใช้ในเส้นทางที่ห้าม throw (cron/แผน) */
export async function getPersonalizationSafe(memberId: string): Promise<Personalization> {
  try {
    return await getPersonalization(memberId);
  } catch (e) {
    console.error("[personalization] load failed:", e);
    return EMPTY_PERSONALIZATION;
  }
}
