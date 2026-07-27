import { NextRequest, NextResponse } from "next/server";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { getAuthedMember } from "@/lib/coachAuth";

/**
 * ถ่ายรูปปุ่มเดียว (ข้อ 2) — AI แยกเองว่าเป็น "จานอาหาร" หรือ "ฉลากโภชนาการ"
 * แล้ว route ไป analyze-food หรือ barcode/analyze อัตโนมัติ (reuse logic เดิมทั้งหมด)
 *
 * POST { image (base64 data URL), description?, lineUserId? }  (+ Bearer optional)
 *  → { kind: "food" | "label" | "unknown", data, routedTo }
 */
async function classify(image: string): Promise<"food" | "label" | "unknown"> {
  const apiKey = await getSecret("OPENAI_API_KEY");
  if (!apiKey) return "unknown";
  const openai = buildOpenAI(apiKey);
  try {
    const res = await openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o"),
      messages: [
        {
          role: "system",
          content:
            'จำแนกรูปภาพเป็นหนึ่งใน: "food" (จานอาหาร/เครื่องดื่มจริง), "label" (ฉลากโภชนาการ/บาร์โค้ด/บรรจุภัณฑ์สินค้า), "unknown". ตอบ JSON เท่านั้น: {"kind":"food|label|unknown"}',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "รูปนี้คืออะไร" },
            { type: "image_url", image_url: { url: image, detail: "low" } },
          ] as any,
        },
      ],
      temperature: 0,
      max_tokens: 20,
    });
    const txt = res.choices[0]?.message?.content || "";
    const m = txt.match(/food|label|unknown/i);
    return (m?.[0].toLowerCase() as "food" | "label" | "unknown") || "unknown";
  } catch {
    return "unknown";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, description } = body;
    if (!image) return NextResponse.json({ error: "image required" }, { status: 400 });

    // รองรับทั้ง JWT (native) และ lineUserId (LIFF เดิม)
    const authed = await getAuthedMember(req);
    const lineUserId = authed?.lineUserId ?? body.lineUserId ?? undefined;

    const kind = await classify(image);
    const base = process.env.APP_INTERNAL_BASE || "http://127.0.0.1:3000";
    const target = kind === "label" ? "/api/barcode/analyze" : "/api/analyze-food";

    const res = await fetch(`${base}${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "label"
          ? { image, description, lineUserId }
          : { image, description, lineUserId }
      ),
    });
    const json = await res.json();

    return NextResponse.json({
      kind,
      routedTo: target,
      success: json.success ?? false,
      data: json.data ?? null,
      error: json.error,
    });
  } catch (e: any) {
    console.error("[smart-capture]", e);
    return NextResponse.json({ error: e.message || "smart-capture failed" }, { status: 500 });
  }
}
