import { prisma } from "@/lib/prisma";
import { replyMessage, createTextMessage } from "@/lib/line";
import { requireAiCoach, gatherMemberContext } from "@/lib/coaching";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { checkUsageLimit, logAiUsage } from "@/lib/usage-limits";
import { bkkTodayKey } from "@/lib/planGenerator";

const CHAT_SYSTEM = `คุณคือ "โค้ชกู๊ด" นักโภชนาการและเทรนเนอร์ส่วนตัวคนไทย พูดคุยผ่าน LINE
กติกา:
- สุภาพ เป็นกันเอง ให้กำลังใจ ใช้ภาษาคนทั่วไป
- ตอบอิงข้อมูลจริงของผู้ใช้ที่ให้มาเท่านั้น ห้ามแต่งตัวเลข/เมนู/สถิติที่ไม่มีในข้อมูล
- ห้ามวินิจฉัยโรคหรือจ่ายยา ถ้าถามเรื่องอาการ/โรค/ยา ให้แนะนำพบแพทย์หรือเภสัชกร
- ห้ามสัญญาว่าจะติดต่อกลับหรือให้คนติดต่อกลับ
- ตอบสั้น กระชับ ไม่เกิน 3-4 ประโยค เป็นภาษาไทย`;

const REPLY_TIMEOUT_MS = 8000;
const FALLBACK_REPLY =
  "ตอนนี้โค้ชขอเวลาสักครู่นะครับ 🙏 ลองพิมพ์ถามใหม่อีกครั้ง หรือเปิดแอปดูแผน/บันทึกของวันนี้ได้เลยครับ";

function buildContextText(
  context: Awaited<ReturnType<typeof gatherMemberContext>>,
  plan: { mealPlan: unknown; exercisePlan: unknown } | null
): string {
  if (!context) return "";
  const lines: string[] = [];
  lines.push(`ชื่อ: ${context.name}`);
  lines.push(`เป้าหมาย: ${context.goal.type}`);
  if (context.goal.currentWeight != null)
    lines.push(`น้ำหนักปัจจุบัน ${context.goal.currentWeight} kg${context.goal.targetWeight != null ? ` → เป้า ${context.goal.targetWeight} kg` : ""}`);
  lines.push(
    `วันนี้ทานไป ${context.today.calories}/${context.targets.calories} kcal, โปรตีน ${context.today.protein}/${context.targets.protein}g, มื้อที่บันทึก ${context.today.mealCount}`
  );
  lines.push(`น้ำวันนี้ ${context.water.current}/${context.water.target} แก้ว`);
  if (context.today.meals.length) lines.push(`เมนูวันนี้: ${context.today.meals.join(", ")}`);
  if (context.exerciseToday) lines.push(`ออกกำลังกายวันนี้: ${context.exerciseToday.name} (${context.exerciseToday.calories} kcal)`);
  if (plan) {
    const mp = plan.mealPlan as { meals?: { slot: string; menu: string }[]; totalKcal?: number };
    const ep = plan.exercisePlan as { title?: string };
    lines.push(`แผนวันนี้: ออกกำลังกาย ${ep?.title || "-"}; อาหาร ~${mp?.totalKcal || 0} kcal (${(mp?.meals || []).map((m) => `${m.slot}:${m.menu}`).join(", ")})`);
  }
  /* BP-3 §B6 — ตัวเลขร่างกาย: เอว/ไขมันต้องพูดเป็น "ช่วง" เสมอ (กล้องประมาณได้ ±2-3 ซม.)
     ถ้าโค้ชพูดเลขเดี่ยวเมื่อไหร่ user จะเชื่อว่าเป็นค่าที่วัดจริง แล้วสัปดาห์หน้าที่เลขแกว่งเขาจะเลิกเชื่อทั้งระบบ */
  const b = context.body;
  if (b) {
    const parts: string[] = [];
    if (b.waistCm)
      parts.push(
        b.waistCm.source === "tape"
          ? `เอวจากสายวัด ${b.waistCm.lo} ซม.`
          : `เอวประมาณ ${b.waistCm.lo}-${b.waistCm.hi} ซม. (ค่าประมาณจากภาพ)`
      );
    if (b.bfPct) parts.push(`ไขมันประมาณ ${b.bfPct.lo}-${b.bfPct.hi}%`);
    if (b.lastScanDaysAgo != null) parts.push(`สแกนล่าสุด ${b.lastScanDaysAgo} วันที่แล้ว`);
    if (b.scoreOf100 != null) parts.push(`Body Score ${b.scoreOf100}/100`);
    if (parts.length) lines.push(`ร่างกาย: ${parts.join(" · ")}`);
    if (b.goal)
      lines.push(
        `เป้ารูปร่าง "${b.goal.label}": คืบหน้า ${b.goal.pctDone}%` +
          (b.goal.onTrack ? ` (${b.goal.onTrack})` : "") +
          (b.goal.weeksLeft != null ? ` เหลือ ${b.goal.weeksLeft} สัปดาห์` : "")
      );
    for (const s of b.signals ?? []) lines.push(`สัญญาณร่างกาย (${s.key}): ${s.message}`);
  }

  // WO-P.3 — memory + insight เฉพาะตัว
  if (context.personalization?.text) lines.push("", context.personalization.text);
  return lines.join("\n");
}

/**
 * ตอบแชท LINE ด้วย AI (reply — ฟรี ไม่กินโควตา push)
 * เรียกจาก webhook เฉพาะข้อความ text ที่มี replyToken
 */
export async function handleCoachChat(
  userId: string,
  text: string,
  replyToken: string | undefined,
  conversationId: string
): Promise<void> {
  if (!replyToken || !text || !text.trim()) return;

  const { member, active } = await requireAiCoach(userId);
  if (!member) return; // ไม่ใช่สมาชิก → เงียบ (ไม่สแปม)

  const todayKey = bkkTodayKey();

  // ── ไม่มีสิทธิ์: แนะนำคอร์ส 1 ครั้ง/วัน ──
  if (!active) {
    const already = await prisma.coachDispatchLog.findUnique({
      where: { memberId_date_type: { memberId: member.id, date: todayKey, type: "chat_upsell" } },
    });
    if (already) return; // ตอบไปแล้ววันนี้ → เงียบ
    await prisma.coachDispatchLog.create({
      data: { memberId: member.id, date: todayKey, type: "chat_upsell" },
    });
    await replyMessage(replyToken, [
      createTextMessage(
        "ขอบคุณที่ทักมาครับ 🙏 ฟีเจอร์โค้ช AI ส่วนตัว (ตอบคำถามสุขภาพ+วางแผน) เปิดให้สมาชิกคอร์สโค้ช สนใจเริ่มใช้งานทักแอดมินได้เลยนะครับ"
      ),
    ]);
    return;
  }

  // ── มีสิทธิ์: เช็คโควตาแชท ──
  const limit = await checkUsageLimit(userId, "dailyChatLimit");
  if (!limit.allowed) {
    await replyMessage(replyToken, [
      createTextMessage("วันนี้คุยกับโค้ชครบโควตาแล้วครับ 😊 พรุ่งนี้มาคุยกันใหม่ หรือเปิดแอปดูแผน/บันทึกได้ตลอดเลยครับ"),
    ]);
    return;
  }

  const apiKey = await getSecret("OPENAI_API_KEY");
  if (!apiKey) {
    await replyMessage(replyToken, [createTextMessage(FALLBACK_REPLY)]);
    return;
  }

  // context + แผนวันนี้ + ประวัติแชท 10 ข้อความล่าสุด
  const [context, plan, history] = await Promise.all([
    gatherMemberContext(member.id),
    prisma.dailyPlan.findUnique({ where: { memberId_date: { memberId: member.id, date: todayKey } } }),
    prisma.lineMessage.findMany({
      where: { conversationId, type: "text", content: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const contextText = buildContextText(context, plan);
  const historyMsgs = history
    .reverse()
    .map((m) => ({
      role: (m.direction === "outgoing" ? "assistant" : "user") as "assistant" | "user",
      content: m.content || "",
    }))
    .filter((m) => m.content.trim().length > 0);

  const messages = [
    { role: "system" as const, content: `${CHAT_SYSTEM}\n\nข้อมูลผู้ใช้ปัจจุบัน:\n${contextText}` },
    ...historyMsgs,
  ];
  // ประวัติล่าสุดจบด้วยข้อความ user ปัจจุบันอยู่แล้ว (webhook เก็บก่อนเรียก) — เผื่อ race ให้ append ถ้ายังไม่มี
  if (historyMsgs[historyMsgs.length - 1]?.content !== text) {
    messages.push({ role: "user" as const, content: text });
  }

  let replyText = FALLBACK_REPLY;
  try {
    const openai = buildOpenAI(apiKey);
    const aiPromise = openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o-mini"),
      messages,
      max_tokens: 300,
      temperature: 0.7,
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), REPLY_TIMEOUT_MS));
    const resp = await Promise.race([aiPromise, timeout]);
    if (resp) {
      replyText = resp.choices[0]?.message?.content?.trim() || FALLBACK_REPLY;
    }
  } catch (e) {
    console.error("[coachChat] AI error:", e);
  }

  const ok = await replyMessage(replyToken, [createTextMessage(replyText)]);
  if (ok && replyText !== FALLBACK_REPLY) {
    // เก็บคำตอบ + หักโควตา (เฉพาะเมื่อตอบด้วย AI จริง)
    await prisma.lineMessage.create({
      data: { conversationId, type: "text", direction: "outgoing", content: replyText },
    });
    await logAiUsage(userId, "dailyChatLimit");
  }
}
