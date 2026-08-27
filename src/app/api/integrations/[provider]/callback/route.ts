import { NextRequest, NextResponse } from "next/server";
import { verifyStateTicket } from "@/lib/coachAuth";
import { PROVIDER_META, callbackUrl, creds, isProvider } from "@/lib/integrations/providers";
import { saveConnection } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

/**
 * ปลายทางที่ Fitbit/Strava ยิงกลับมาหลัง user กดยินยอม
 *
 * 🔴 ต้องเป็น https ของเว็บเรา (ทั้งสองเจ้าไม่ยอม redirect เข้า custom scheme) แล้วเราค่อย
 *    302 ต่อเข้า coach://oauth ให้แอปรู้ผล — แพตเทิร์นเดียวกับ login LINE/Facebook
 * 🔴 การแลก code เป็น token ทำที่นี่เท่านั้น (ต้องใช้ client secret)
 */
const APP_SCHEME = "coach://oauth";

function backToApp(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return NextResponse.redirect(`${APP_SCHEME}?${q}`, 302);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const denied = url.searchParams.get("error");

  if (!isProvider(provider)) return backToApp({ integration: provider, status: "error", reason: "unknown_provider" });
  if (denied) return backToApp({ integration: provider, status: "cancelled" });
  if (!code) return backToApp({ integration: provider, status: "error", reason: "no_code" });

  const memberId = await verifyStateTicket(state, `integration:${provider}`);
  if (!memberId) return backToApp({ integration: provider, status: "error", reason: "bad_state" });

  try {
    const meta = PROVIDER_META[provider];
    const c = await creds(provider);
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(provider),
    });
    if (meta.basicAuth) {
      headers.Authorization = "Basic " + Buffer.from(`${c.id}:${c.secret}`).toString("base64");
      body.set("client_id", c.id);
    } else {
      body.set("client_id", c.id);
      body.set("client_secret", c.secret);
    }

    const res = await fetch(meta.tokenUrl, { method: "POST", headers, body });
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !j?.access_token) {
      console.error(`[integrations/${provider}] แลก token ไม่ผ่าน`, res.status, JSON.stringify(j)?.slice(0, 300));
      return backToApp({ integration: provider, status: "error", reason: "token_exchange" });
    }

    await saveConnection(memberId, provider, {
      accessToken: String(j.access_token),
      refreshToken: (j.refresh_token as string) ?? null,
      expiresIn: typeof j.expires_in === "number" ? j.expires_in : null,
      scope: (j.scope as string) ?? null,
      externalId: String(j.user_id ?? (j.athlete as { id?: number } | undefined)?.id ?? ""),
    });

    return backToApp({ integration: provider, status: "ok" });
  } catch (e) {
    console.error(`[integrations/${provider}] callback ล้ม`, e);
    return backToApp({ integration: provider, status: "error", reason: "server" });
  }
}
