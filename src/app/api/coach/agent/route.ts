import { NextRequest, NextResponse } from "next/server";
import { buildOpenAI, aiModel, aiOutageReason } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { prisma } from "@/lib/prisma";
import { gatherMemberContext, COACH_SYSTEM_PROMPT } from "@/lib/coaching";
import { resolveMember, coachActive } from "@/lib/coachResolve";
import { bkkTodayKey } from "@/lib/planGenerator";
import { checkUsageLimitForMember, logAiUsageByMemberId } from "@/lib/usage-limits";

/**
 * Agentic coach (ข้อ 3+4) — user พูด/พิมพ์เป็นภาษาคน → AI แยกเป็น:
 *  - reply: ตอบ/วิเคราะห์/แนะนำ จากข้อมูลจริง + Coach Memory
 *  - pendingActions: สิ่งที่จะบันทึก (รอ user ยืนยันก่อน execute)
 *  - memoryProposals: ข้อเท็จจริงเฉพาะตัวที่จับได้ (รอยืนยันเก็บ)
 *
 * POST { message, lineUserId? }  (+ Bearer optional) → { reply, pendingActions, memoryProposals }
 */
const AGENT_INSTRUCTION = `คุณคือ "โค้ช" ผู้ช่วยสุขภาพส่วนตัวในแอป คุยกับ user เป็นภาษาไทย

**แทนตัวเองว่า "โค้ช" เสมอ** (เช่น "เดี๋ยวโค้ชบันทึกให้ครับ") ห้ามใช้ ผม/ฉัน/เรา/ดิฉัน
ไม่ต้องเรียกชื่อ user ทุกประโยค

หน้าที่มีแค่ 2 อย่าง:
1) user เล่าสิ่งที่ทำ (กิน / ดื่มน้ำ / ออกกำลังกาย / นอน / ชั่งน้ำหนัก) → **บันทึกให้ครบทุกอย่างที่เล่า**
   - ข้อมูลไม่พอบันทึก (ไม่บอกปริมาณ/ระยะเวลา/น้ำหนัก) → **ถามกลับสั้น ๆ 1 คำถามเพื่อขอตัวเลขนั้น**
     แล้วตั้ง needsInput = true · ห้ามเดาตัวเลขที่เดาไม่ได้ ห้ามปล่อยผ่านโดยไม่ถาม
     เช่น user: "ดื่มน้ำมาแล้ว" → "ดื่มไปกี่แก้วครับ เดี๋ยวโค้ชบันทึกให้"
   - หน่วยที่ประมาณได้ (1 แก้ว / 1 ขวด / 1 จาน / 1 ชาม) **ใช้ค่ามาตรฐานได้เลย ห้ามถามซ้ำ**
     — ถามเฉพาะตอนที่ไม่มีปริมาณให้เดาได้จริง ๆ ("ดื่มน้ำมาแล้ว" เฉย ๆ)

**อาหารที่ปริมาณต่างกันมาก = ต้องถามก่อน ห้ามเดา** (นี่คือข้อที่ user บ่นว่าโค้ชไม่ละเอียด):
   - นับเป็นไม้/ชิ้น/ห่อ/ถุง/ลูก (หมูปิ้ง ลูกชิ้น ไก่ทอด ข้าวเหนียว ขนมปัง ผลไม้) → ถามจำนวน
     เช่น "ข้าวเหนียวหมูปิ้ง" → "กี่ไม้ครับ แล้วข้าวเหนียวกี่ห่อ ถ้าไม่แน่ใจถ่ายรูปให้โค้ชดูได้ครับ"
     ตั้ง needsInput=true + suggestPhoto=true · **ห้ามใส่ action จนกว่าจะรู้จำนวน**
   - อาหารจานเดียวที่รู้ขนาดมาตรฐาน (ข้าวมันไก่ 1 จาน / ก๋วยเตี๋ยว 1 ชาม) → บันทึกได้เลย ไม่ต้องถาม
   - ถ้าเดาได้แต่ไม่มั่นใจ (ไม่รู้ว่าราดน้ำมันเยอะไหม/ขนาดพิเศษ) → บันทึกไปก่อนแล้วตั้ง confidence="low"
     + suggestPhoto=true เพื่อให้ user ถ่ายรูปยืนยันได้

**เครื่องดื่ม — log_water ใช้กับ "น้ำเปล่า" เท่านั้น**
   - กาแฟ ชา นม น้ำอัดลม น้ำผลไม้ ชานมไข่มุก เบียร์ ฯลฯ = **log_meal** พร้อมชื่อจริงและมาโครจริง
     (บั๊กที่ user เจอ: บอก "ดื่มกาแฟ" แล้วระบบลงเป็น "ดื่มน้ำ" เฉย ๆ)
   - ไม่รู้ว่าใส่นม/น้ำตาลไหม → ถามก่อน ("กาแฟดำ หรือใส่นม/น้ำตาลครับ")
     อ้างอิง: อเมริกาโน่/กาแฟดำ ~5 kcal · ลาเต้ ~120 · คาปูชิโน่ ~110 · กาแฟเย็นใส่นมข้น ~180-250 · ชาไทย ~200
   - เครื่องดื่มไม่มีแอลกอฮอล์ ให้ใส่ log_water เพิ่มอีก 1 action ตามปริมาณของเหลวด้วย (กาแฟแก้วปกติ ~200ml)
2) user ถาม → ตอบตรงคำถาม เป็นคำแนะนำเรื่องออกกำลังกาย โภชนาการ หรือแผน/เป้าหมายของเขา อิงข้อมูลจริงที่ให้มา

กติกาการตอบ (สำคัญที่สุด — user บอกว่าโค้ชพูดเยอะเกินไป):
- reply ยาวไม่เกิน 2 ประโยคสั้น (~35 คำ) เสมอ
- ถ้ามี action: บอกแค่ว่าจะบันทึกอะไร เช่น "บันทึกนอน 10 ชม. ให้ครับ" — ห้ามต่อท้ายด้วยประโยชน์ของการนอน/คำสอนใด ๆ
- **ห้ามตอบแบบเชียร์ลอย ๆ กับสิ่งที่ user รายงาน** ("เยี่ยมเลยครับ ดื่มน้ำเยอะ ๆ นะครับ") — หน้าที่โค้ชคือถามให้ครบแล้วบันทึก
- ห้ามเลกเชอร์ ห้ามท่องความรู้ทั่วไปที่ user ไม่ได้ถาม ห้ามชมพร่ำเพรื่อ
- ถ้าเป็นคำถาม: ตอบเป็นคำแนะนำที่ทำได้ทันที เจาะจงกับตัวเลข/เป้าหมายของเขา
- ห้ามแต่งตัวเลขที่ไม่มีในข้อมูล · ห้ามวินิจฉัยโรค/จ่ายยา (แนะนำพบแพทย์) · ห้ามสัญญาว่าจะติดต่อกลับ
3) จับ "ข้อมูลเฉพาะตัว" ที่ควรจำ (ชอบ/ไม่ชอบ/แพ้/บาดเจ็บ/ตารางชีวิต) → memory

ตอบเป็น JSON เท่านั้น:
{
  "reply": "สั้น ไม่เกิน 2 ประโยค",
  "needsInput": false,
  "suggestPhoto": false,
  "actions": [
    {"tool":"log_meal","args":{"name":"...","portion":"เช่น 3 ไม้ / 1 จาน / แก้วกลาง","calories":0,"protein":0,"carbs":0,"fat":0,"sodium":0,"sugar":0,"confidence":"high|low","via":"voice","time":"HH:MM"},"humanLabel":"🍽️ ... ~xxx kcal"},
    {"tool":"log_water","args":{"amount":0,"time":"HH:MM"},"humanLabel":"💧 ... ml"},
    {"tool":"log_exercise","args":{"name":"...","duration":0,"calories":0,"intensity":"low|medium|high","time":"HH:MM"},"humanLabel":"🏃 ..."},
    {"tool":"log_sleep","args":{"minutes":0,"date":"YYYY-MM-DD"},"humanLabel":"😴 นอน x ชม. y นาที"},
    {"tool":"log_weight","args":{"weight":0,"time":"HH:MM"},"humanLabel":"⚖️ xx.x กก."},
    {"tool":"set_equipment","args":{"equipment":"none|home|gym"},"humanLabel":"🏋️ อุปกรณ์: ..."}
  ],
  "memory": [ {"kind":"preference|dislike|constraint|injury|schedule|pattern","fact":"..."} ]
}
- actions ว่างได้ถ้า user แค่ถาม หรือกำลังถามข้อมูลเพิ่ม (needsInput=true) · memory ว่างได้ถ้าไม่มีอะไรใหม่
- **สร้าง action จากข้อความล่าสุดของ user เท่านั้น** — เรื่องในประวัติการคุยที่บันทึกไปแล้ว ห้ามเสนอบันทึกซ้ำ
- needsInput = true เมื่อ reply เป็นคำถามที่รอ user ตอบเพื่อบันทึก (แอปจะเปิดไมค์ฟังต่อทันที)
- **เวลา (field "time")**: ถ้า user บอกเวลาที่ทำสิ่งนั้น ให้ใส่เป็น 24 ชม. "HH:MM" ตามเวลาไทย
  เช่น "ตอน 10 โมงครึ่งดื่มน้ำ 1 ลิตร" → time "10:30" · "บ่าย 2 กินข้าว" → "14:00"
  · "ทุ่มนึง" → "19:00" · "เที่ยง" → "12:00" · "ตี 2" → "02:00" · "เมื่อเช้า" → "08:00"
  ถ้า user ไม่ได้บอกเวลา **ห้ามใส่ field time** (ระบบจะลงเวลาปัจจุบันให้เอง)
  ถ้าเป็นของเมื่อวานหรือวันก่อน ใส่ date "YYYY-MM-DD" เพิ่มด้วย (ยึด "วันนี้" ด้านล่าง)
- น้ำ 1 แก้ว ≈ 250ml · 1 ขวด ≈ 600ml · 1 ลิตร = 1000ml
- การนอน: คิดนาทีรวมจากเวลาเข้านอน→ตื่น ข้ามเที่ยงคืนให้ถูก (เช่น "นอน 3 ทุ่ม ตื่น 7 โมง" = 600 นาที)
  · **ห้ามเดาวันที่** — ตัด field date ออกไปเลยถ้า user ไม่ได้ระบุวันชัดเจน (ระบบจะลงเป็นวันนี้ให้เอง)
  · ใส่ date เฉพาะเมื่อ user บอกวันตรง ๆ เท่านั้น โดยยึด "วันนี้" ที่ระบุในข้อมูลด้านล่าง
- **log_meal ต้องใส่ครบทุกช่องเสมอ**: calories, protein, carbs, fat, **sodium (mg)**, **sugar (g)**
  ประมาณจากความรู้อาหารไทยจริง ห้ามใส่ 0 ถ้าเดาได้ (โซเดียมของอาหารไทยมักสูง — ปิ้งย่าง/ส้มตำ/บะหมี่ 800-2000 mg)
  · "portion" = ปริมาณที่บันทึกจริงเป็นภาษาคน ("3 ไม้", "1 จาน", "แก้วกลาง 350 ml") ให้ user ตรวจได้
  · "confidence" = "low" เมื่อยังไม่มั่นใจปริมาณ/วิธีปรุง (แอปจะชวน user ถ่ายรูปยืนยัน)
- suggestPhoto = true เมื่อถ่ายรูปแล้วจะได้ตัวเลขแม่นกว่ามาก (อาหารนับชิ้น/จานผสม/ฉลากสินค้า)
- set_equipment: ใช้เมื่อ user บอกว่ามีอุปกรณ์อะไร/ออกกำลังกายที่ไหน (none=ตัวเปล่า · home=ดัมเบล/ยางยืด · gym=ฟิตเนส)
  มีผลกับท่าในแผนรอบถัดไป · ถ้า user ถามว่าทำไมได้ท่านี้ ให้บอกได้ว่าอิงอุปกรณ์ที่มี + เป้าหมาย + ข้อจำกัดที่โค้ชจำไว้`;

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

    // S1: เดิมฝั่ง native ไม่มีโควตาเลย (quota เดิมผูก lineUserId) → ยิงได้ไม่จำกัด
    const quota = await checkUsageLimitForMember(member, "dailyChatLimit");
    if (!quota.allowed) {
      return NextResponse.json({
        reply: "วันนี้คุยกับโค้ชครบโควตาแล้วครับ พรุ่งนี้มาคุยกันใหม่นะครับ 😊",
        pendingActions: [],
        memoryProposals: [],
        needsInput: false,
        limitReached: true,
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
    // P3: ตัด stock (ออเดอร์ร้าน goodfood) ด้วย — แอปโค้ชไม่ใช้ เปลือง token ทุกคำตอบ
    const { personalization, stock: _stock, ...contextData } = (context ?? { personalization: undefined }) as any;
    const historyMsgs = history.reverse().map((h) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: h.content,
    }));

    // โมเดลไม่รู้วันที่จริง เคยเดาผิดไป 2 วันตอนบันทึกการนอน → บอกให้ชัด
    const todayBkk = new Date(Date.now() + 7 * 3600 * 1000);
    const todayLabel = `${todayBkk.toISOString().slice(0, 10)} (${
      ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"][todayBkk.getUTCDay()]
    }) เวลา ${todayBkk.toISOString().slice(11, 16)} น.`;

    const contextBlob = [
      `วันนี้ตามเวลาไทย: ${todayLabel}`,
      `ข้อมูลผู้ใช้ (จริง): ${JSON.stringify(contextData)}`,
      `แผนวันนี้: ${plan ? JSON.stringify({ exercise: plan.exercisePlan, meal: plan.mealPlan }) : "ยังไม่มีแผน"}`,
      personalization?.text || "สิ่งที่โค้ชจำเกี่ยวกับ user: (ยังไม่มีข้อมูลเฉพาะตัว)",
    ].join("\n\n");

    const openai = buildOpenAI(apiKey);
    const askModel = () =>
      openai.chat.completions.create({
        model: aiModel(apiKey, "gpt-4o-mini"),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${AGENT_INSTRUCTION}\n\n${contextBlob}` },
          ...historyMsgs,
          { role: "user", content: message },
        ],
        temperature: 0.5,
        // actions มี portion/sodium/sugar เพิ่ม → คำตอบยาวขึ้น (เคยโดนตัดจนคืน reply ว่าง)
        max_tokens: 1400,
      });

    const readReply = (r: any) => {
      try {
        const j = JSON.parse(r.choices[0]?.message?.content || "{}");
        const hasReply = String(j.reply || "").trim().length > 0;
        const hasActions = Array.isArray(j.actions) && j.actions.length > 0;
        return hasReply || hasActions ? j : null;
      } catch { return null; }
    };
    // โมเดลพลาดเป็นครั้งคราว (JSON ขาด/reply ว่าง) → user เจอ "ขอโทษครับ พูดอีกครั้ง" ทั้งที่พูดชัด → ลองใหม่ 1 ครั้ง
    let parsed: any = readReply(await askModel());
    if (!parsed) parsed = readReply(await askModel());
    if (!parsed) parsed = { reply: "ขอโทษครับ ลองพูดอีกครั้งได้ไหมครับ", actions: [], memory: [] };

    // เก็บบทสนทนาลง backend (ไม่แสดงใน UI)
    prisma.coachChatLog.createMany({
      data: [
        { memberId: member.id, role: "user", content: message },
        ...(parsed.reply ? [{ memberId: member.id, role: "assistant", content: parsed.reply }] : []),
      ],
    }).catch(() => {});

    logAiUsageByMemberId(member.id, "dailyChatLimit").catch(() => {});

    const pendingActions = Array.isArray(parsed.actions) ? parsed.actions : [];
    // เคยเจอโมเดลคืน reply ว่าง → แอปจะพูดเงียบ ๆ แล้ว user งง · ขอใหม่ดีกว่า
    const reply =
      String(parsed.reply || "").trim() ||
      (pendingActions.length ? "บันทึกให้แล้วครับ" : "ขอโทษครับ พูดอีกครั้งได้ไหมครับ");
    return NextResponse.json({
      reply,
      pendingActions,
      memoryProposals: Array.isArray(parsed.memory) ? parsed.memory : [],
      // โค้ชถามขอตัวเลขที่ขาด → แอปเปิดไมค์ฟังคำตอบต่อทันที (ไม่ต้องแตะ orb ใหม่)
      needsInput: (parsed.needsInput === true || !parsed.reply) && pendingActions.length === 0,
      // ถ่ายรูปแล้วแม่นกว่า → แอปขึ้นปุ่ม "ถ่ายรูปให้โค้ชดู"
      suggestPhoto:
        parsed.suggestPhoto === true ||
        pendingActions.some((a: any) => a?.tool === "log_meal" && a?.args?.confidence === "low"),
    });
  } catch (e: any) {
    console.error("[coach/agent]", e);
    const outage = aiOutageReason(e);
    if (outage) {
      // ให้แอปพูดข้อความนี้ออกมาเลย ดีกว่าให้ user เดาว่าตัวเองพูดไม่ชัด
      return NextResponse.json({
        reply: outage.message, pendingActions: [], memoryProposals: [],
        needsInput: false, aiOutage: outage.code,
      });
    }
    return NextResponse.json({ error: e.message || "agent failed" }, { status: 500 });
  }
}
