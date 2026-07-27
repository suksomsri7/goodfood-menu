import { NextRequest, NextResponse } from "next/server";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { prisma } from "@/lib/prisma";
import { gatherMemberContext, COACH_SYSTEM_PROMPT } from "@/lib/coaching";
import { memoriesAsText } from "@/lib/coachMemory";
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
const AGENT_INSTRUCTION = `${COACH_SYSTEM_PROMPT}

คุณกำลังช่วย user ผ่านแอป (พูดหรือพิมพ์) หน้าที่:
1) ถ้า user เล่าว่ากิน/ดื่ม/ออกกำลังกายอะไร → สร้าง action เพื่อ "บันทึก" (ประมาณแคลอรี่/มาโครจากความรู้โภชนาการไทย)
2) ถ้า user ถาม/ขอคำแนะนำ/วิเคราะห์ → ตอบใน reply โดยใช้ข้อมูลจริงที่ให้มา (ห้ามแต่งตัวเลข)
3) จับ "ข้อมูลเฉพาะตัว" ที่ควรจำ (ชอบ/ไม่ชอบ/แพ้/บาดเจ็บ/ตารางชีวิต) → memoryProposals

ตอบเป็น JSON เท่านั้น:
{
  "reply": "ข้อความโค้ชตอบ user ภาษาไทย กระชับ อบอุ่น",
  "actions": [
    {"tool":"log_meal","args":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"sodium":0,"sugar":0,"via":"voice"},"humanLabel":"🍽️ ... ~xxx kcal"},
    {"tool":"log_water","args":{"amount":0},"humanLabel":"💧 ... ml"},
    {"tool":"log_exercise","args":{"name":"...","duration":0,"calories":0,"intensity":"low|medium|high"},"humanLabel":"🏃 ..."}
  ],
  "memory": [ {"kind":"preference|dislike|constraint|injury|schedule|pattern","fact":"..."} ]
}
- actions ว่างได้ถ้า user แค่ถาม · memory ว่างได้ถ้าไม่มีอะไรใหม่
- ปริมาณน้ำ 1 แก้ว ≈ 250ml`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;
    if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

    const member = await resolveMember(req, body.lineUserId);
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
    const [context, plan, memText] = await Promise.all([
      gatherMemberContext(member.id),
      prisma.dailyPlan.findUnique({ where: { memberId_date: { memberId: member.id, date: todayKey } } }),
      memoriesAsText(member.id),
    ]);

    const contextBlob = [
      `ข้อมูลผู้ใช้ (จริง): ${JSON.stringify(context)}`,
      `แผนวันนี้: ${plan ? JSON.stringify({ exercise: plan.exercisePlan, meal: plan.mealPlan }) : "ยังไม่มีแผน"}`,
      `สิ่งที่โค้ชจำเกี่ยวกับ user:\n${memText}`,
    ].join("\n\n");

    const openai = buildOpenAI(apiKey);
    const resp = await openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o-mini"),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${AGENT_INSTRUCTION}\n\n${contextBlob}` },
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
