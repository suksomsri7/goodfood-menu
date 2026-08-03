import { NextRequest, NextResponse } from "next/server";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { getAuthedMember } from "@/lib/coachAuth";
import { coachActive } from "@/lib/coachResolve";
import { checkUsageLimitForMember, logAiUsageByMemberId, creditsExhaustedResponse } from "@/lib/usage-limits";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/** เก็บรูปที่ถ่ายลง /uploads/coach-food (volume เดิมของ goodfood) → คืน public path · ล้มเหลว = ไม่เป็นไร ข้อมูลตัวเลขยังบันทึกได้ */
async function saveFoodImage(dataUrl: string): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:image\/(jpe?g|png|webp);base64,(.+)$/);
    if (!m) return null;
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const dir = path.join(process.cwd(), "public", "uploads", "coach-food");
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(m[2], "base64"));
    return `/uploads/coach-food/${name}`;
  } catch (e) {
    console.warn("[smart-capture] save image failed", e);
    return null;
  }
}

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
      model: aiModel(apiKey, "gpt-4o-mini"), // classify food/label ง่าย — ไม่ต้องเปลืองตัวใหญ่
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

/** แจ้งผู้ดูแลเมื่อ AI ใช้ไม่ได้ (ไม่งั้นไม่มีใครรู้จนกว่า user จะบ่น) — กันสแปมด้วยช่วงเวลา */
let lastOutageNotify = 0;
function notifyAiOutage(code: string, message: string) {
  const now = Date.now();
  if (now - lastOutageNotify < 30 * 60 * 1000) return;
  lastOutageNotify = now;
  const url = process.env.OPS_ALERT_WEBHOOK;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `🔴 Coach AI ใช้ไม่ได้ (${code}): ${message}` }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, description } = body;
    if (!image) return NextResponse.json({ error: "image required" }, { status: 400 });

    // F2: ต้อง auth เสมอ (กันยิง AI ฟรีไม่ระบุตัวตน) + gate สิทธิ์โค้ช
    const authed = await getAuthedMember(req);
    if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!coachActive(authed)) return NextResponse.json({ error: "locked" }, { status: 403 });
    const lineUserId = authed.lineUserId ?? undefined;

    // S4: จำกัดขนาดรูป — base64 ~10MB (รูปจริง ~7.5MB) ใหญ่กว่านี้ = ยัด payload มาเผาเงิน/แรม
    if (typeof image !== "string" || image.length > 10_000_000) {
      return NextResponse.json({ error: "รูปใหญ่เกินไป ลองถ่ายใหม่ครับ" }, { status: 413 });
    }

    // S1: โควตาถ่ายวิเคราะห์ (เดิมฝั่ง native ข้ามโควตาทั้งหมด)
    const quota = await checkUsageLimitForMember(authed, "dailyPhotoLimit");
    if (!quota.allowed) return creditsExhaustedResponse(quota);

    // ③ เก็บรูปลง timeline — เดิมวิเคราะห์เสร็จรูปหายไปเลย (MealLog.imageUrl ว่างตลอด)
    const [kind, imageUrl] = await Promise.all([classify(image), saveFoodImage(image)]);
    const base = process.env.APP_INTERNAL_BASE || "http://127.0.0.1:3000";
    const target = kind === "label" ? "/api/barcode/analyze" : "/api/analyze-food";

    const res = await fetch(`${base}${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // skipQuota: โควตาเช็ค/หักที่ชั้นนี้แล้ว — ไม่งั้น member ที่ผูก LINE โดนหัก 2 เด้ง
      body: JSON.stringify({ image, description, lineUserId, skipQuota: true }),
    });
    const json = await res.json();

    // ระบบ AI ใช้ไม่ได้ (เครดิตหมด/คีย์/แน่น) — คนละเรื่องกับ "รูปไม่ชัด" ต้องบอกตามจริง
    // 🔴 ยังไม่หักเครดิต: AI ล่มไม่ใช่ความผิด user
    if (res.status === 503 && json.reason) {
      notifyAiOutage(json.reason, json.error);
      return NextResponse.json({ error: json.error, reason: json.reason }, { status: 503 });
    }

    // กันค่าตัวอย่างสำรองของ endpoint เดิม (AI ล้ม → mock 300 kcal) — บอกตรงๆ ให้ถ่ายใหม่
    const name = json.data?.name || "";
    if (!json.success || !json.data || /ไม่สามารถวิเคราะห์|ตัวอย่าง|Mock/i.test(name)) {
      return NextResponse.json(
        { error: "วิเคราะห์ไม่สำเร็จ ลองถ่ายใหม่ให้เห็นอาหาร/ฉลากชัดขึ้นครับ" },
        { status: 422 }
      );
    }

    // 🔴 สำเร็จจริงแล้วค่อยหักเครดิต (เดิมหักก่อนเช็คผล → AI ล่มก็ยังโดนหัก)
    logAiUsageByMemberId(authed.id, "dailyPhotoLimit").catch(() => {});

    return NextResponse.json({
      kind,
      routedTo: target,
      success: true,
      imageUrl, // ③ path รูปที่เก็บไว้ — แอปแนบเข้า action → MealLog.imageUrl
      data: json.data,
    });
  } catch (e: any) {
    console.error("[smart-capture]", e);
    return NextResponse.json({ error: e.message || "smart-capture failed" }, { status: 500 });
  }
}
