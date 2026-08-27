import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember, signStateTicket } from "@/lib/coachAuth";
import { PROVIDER_META, callbackUrl, creds, isProvider } from "@/lib/integrations/providers";

export const dynamic = "force-dynamic";

/**
 * GET → { url } ให้แอปเปิดในเบราว์เซอร์เพื่อกดยินยอม
 *
 * 🔴 แอปไม่ประกอบ URL เอง เพราะต้องใช้ client id + redirect_uri ที่ต้องตรงเป๊ะกับที่ลงทะเบียนไว้
 *    ให้เซิร์ฟเวอร์เป็นเจ้าของค่าพวกนี้ที่เดียว จะได้แก้ได้โดยไม่ต้อง build แอปใหม่
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { provider } = await ctx.params;
  if (!isProvider(provider)) return NextResponse.json({ error: "ไม่รู้จักบริการนี้" }, { status: 400 });

  const meta = PROVIDER_META[provider];
  const c = await creds(provider);
  if (!c.id || !c.secret) {
    return NextResponse.json({ error: `ยังไม่ได้ใส่กุญแจของ ${meta.label} ที่หลังบ้าน` }, { status: 503 });
  }

  const state = await signStateTicket(member.id, `integration:${provider}`);
  const params = new URLSearchParams({
    client_id: c.id,
    response_type: "code",
    redirect_uri: callbackUrl(provider),
    scope: meta.scope,
    state,
  });
  // Strava บังคับให้ระบุว่าจะขอสิทธิ์ใหม่ทุกครั้งหรือใช้ของเดิม — ไม่ใส่แล้วจะไม่ได้ scope ที่ขอ
  if (provider === "strava") params.set("approval_prompt", "auto");

  const res = NextResponse.json({ url: `${meta.authUrl}?${params.toString()}` });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
