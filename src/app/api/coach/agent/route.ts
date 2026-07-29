import { NextRequest, NextResponse } from "next/server";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { prisma } from "@/lib/prisma";
import { gatherMemberContext, COACH_SYSTEM_PROMPT } from "@/lib/coaching";
import { resolveMember, coachActive } from "@/lib/coachResolve";
import { bkkTodayKey } from "@/lib/planGenerator";

/**
 * Agentic coach (ข้อ 3+4) — user พูด/พิมพ์เป็นภาษาคน → AI แยกเป็น:
 *  - reply: ตอบ/วิเคราะห์/แนะนำ จากข้อมูลจริง + Coach Memory
 *  - pendingActions: สิ่งที่จะบันทึก (รอ user ยืนยันก่อน execute)
 *  - memoryProposals: ข้อเท็จจริงเฉพาะตัวที่จับได้ (รอยืนยันเก็บ)
 *
 * POST { message, lineUserId? }  (+ Bearer optional) → { reply, pendingActions, memoryProposals }
 */
const AGENT_INSTRUCTION = `คุณคือ "โค้ช" ผู้ช่วยสุขภาพส่วนตัวในแอป คุยกับ user เป็นภาษาไทย

หน้าที่มีแค่ 2 อย่าง:
1) user เล่าสิ่งที่ทำ (กิน / ดื่มน้ำ / ออกกำลังกาย / นอน / ชั่งน้ำหนัก) → สร้าง action บันทึกให้ครบทุกอย่างที่เล่า
2) user ถาม → ตอบตรงคำถาม เป็นคำแนะนำเรื่องออกกำลังกาย โภชนาการ หรือแผน/เป้าหมายของเขา อิงข้อมูลจริงที่ให้มา

กติกาการตอบ (สำคัญที่สุด — user บอกว่าโค้ชพูดเยอะเกินไป):
- reply ยาวไม่เกิน 2 ประโยคสั้น (~35 คำ) เสมอ
- ถ้ามี action: บอกแค่ว่าจะบันทึกอะไร เช่น "บันทึกนอน 10 ชม. ให้ครับ" — ห้ามต่อท้ายด้วยประโยชน์ของการนอน/คำสอนใด ๆ
- ห้ามเลกเชอร์ ห้ามท่องความรู้ทั่วไปที่ user ไม่ได้ถาม ห้ามชมพร่ำเพรื่อ
- ถ้าเป็นคำถาม: ตอบเป็นคำแนะนำที่ทำได้ทันที เจาะจงกับตัวเลข/เป้าหมายของเขา
- ห้ามแต่งตัวเลขที่ไม่มีในข้อมูล · ห้ามวินิจฉัยโรค/จ่ายยา (แนะนำพบแพทย์) · ห้ามสัญญาว่าจะติดต่อกลับ
3) จับ "ข้อมูลเฉพาะตัว" ที่ควรจำ (ชอบ/ไม่ชอบ/แพ้/บาดเจ็บ/ตารางชีวิต) → memory

ตอบเป็น JSON เท่านั้น:
{
  "reply": "สั้น ไม่เกิน 2 ประโยค",
  "actions": [
    {"tool":"log_meal","args":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"sodium":0,"sugar":0,"via":"voice"},"humanLabel":"🍽️ ... ~xxx kcal"},
    {"tool":"log_water","args":{"amount":0},"humanLabel":"💧 ... ml"},
    {"tool":"log_exercise","args":{"name":"...","duration":0,"calories":0,"intensity":"low|medium|high"},"humanLabel":"🏃 ..."},
    {"tool":"log_sleep","args":{"minutes":0,"date":"YYYY-MM-DD"},"humanLabel":"😴 นอน x ชม. y นาที"},
    {"tool":"log_weight","args":{"weight":0},"humanLabel":"⚖️ xx.x กก."}
  ],
  "memory": [ {"kind":"preference|dislike|constraint|injury|schedule|pattern","fact":"..."} ]
}
- actions ว่างได้ถ้า user แค่ถาม · memory ว่างได้ถ้าไม่มีอะไรใหม่
- น้ำ 1 แก้ว ≈ 250ml · 1 ขวด ≈ 600ml
- การนอน: คิดนาทีรวมจากเวลาเข้านอน→ตื่น ข้ามเที่ยงคืนให้ถูก (เช่น "นอน 3 ทุ่ม ตื่น 7 โมง" = 600 นาที)
  · **ห้ามเดาวันที่** — ตัด field date ออกไปเลยถ้า user ไม่ได้ระบุวันชัดเจน (ระบบจะลงเป็นวันนี้ให้เอง)
  · ใส่ date เฉพาะเมื่อ user บอกวันตรง ๆ เท่านั้น โดยยึด "วันนี้" ที่ระบุในข้อมูลด้านล่าง
- ประมาณแคลอรี่/มาโครอาหารไทยจากความรู้จริง อย่าใส่ 0 ถ้าเดาได้`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;
    if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

    const member = await resolveMember(req);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!coachActive(member)) {
      return NextResponse.json({
        reply: "ฟีเจอร์โค้ช AI สำหรับสมาชิกคอร์สครับ ติดต่อแอดมินเพื่อเปิดใช้งานได้เลย 😊",
        pendingActions: [],
        memoryProposals: [],
        locked: true,
      });
    }

    const apiKey = await getSecret("OPENAI_API_KEY");
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

    const todayKey = bkkTodayKey();
    const [context, plan, history] = await Promise.all([
      gatherMemberContext(member.id),
      prisma.dailyPlan.findUnique({ where: { memberId_date: { memberId: member.id, date: todayKey } } }),
      // บทสนทนาเก่า 10 ข้อความ (เก็บ backend เงียบๆ — Siri style ไม่แสดงใน UI)
      prisma.coachChatLog.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    // WO-P.3 — memory + insight มากับ context แล้ว (แยกออกจาก JSON กันซ้ำซ้อนใน prompt)
    const { personalization, ...contextData } = context ?? { personalization: undefined };
    const historyMsgs = history.reverse().map((h) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: h.content,
    }));

    // โมเดลไม่รู้วันที่จริง เคยเดาผิดไป 2 วันตอนบันทึกการนอน → บอกให้ชัด
    const todayBkk = new Date(Date.now() + 7 * 3600 * 1000);
    const todayLabel = `${todayBkk.toISOString().slice(0, 10)} (${
      ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"][todayBkk.getUTCDay()]
    })`;

    const contextBlob = [
      `วันนี้ตามเวลาไทย: ${todayLabel}`,
      `ข้อมูลผู้ใช้ (จริง): ${JSON.stringify(contextData)}`,
      `แผนวันนี้: ${plan ? JSON.stringify({ exercise: plan.exercisePlan, meal: plan.mealPlan }) : "ยังไม่มีแผน"}`,
      personalization?.text || "สิ่งที่โค้ชจำเกี่ยวกับ user: (ยังไม่มีข้อมูลเฉพาะตัว)",
    ].join("\n\n");

    const openai = buildOpenAI(apiKey);
    const resp = await openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o-mini"),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${AGENT_INSTRUCTION}\n\n${contextBlob}` },
        ...historyMsgs,
        { role: "user", content: message },
      ],
      temperature: 0.5,
      max_tokens: 700,
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(resp.choices[0]?.message?.content || "{}");
    } catch {
      parsed = { reply: "ขอโทษครับ ลองพูดอีกครั้งได้ไหมครับ", actions: [], memory: [] };
    }

    // เก็บบทสนทนาลง backend (ไม่แสดงใน UI)
    prisma.coachChatLog.createMany({
      data: [
        { memberId: member.id, role: "user", content: message },
        ...(parsed.reply ? [{ memberId: member.id, role: "assistant", content: parsed.reply }] : []),
      ],
    }).catch(() => {});

    return NextResponse.json({
      reply: parsed.reply || "",
      pendingActions: Array.isArray(parsed.actions) ? parsed.actions : [],
      memoryProposals: Array.isArray(parsed.memory) ? parsed.memory : [],
    });
  } catch (e: any) {
    console.error("[coach/agent]", e);
    return NextResponse.json({ error: e.message || "agent failed" }, { status: 500 });
  }
}
