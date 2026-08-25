import { NextRequest, NextResponse } from "next/server";
import { APP_REDIRECT_SCHEME } from "@/lib/socialAuth";

export const dynamic = "force-dynamic";

/**
 * สะพานกลับเข้าแอป — Facebook ยอม redirect ไปที่ https เท่านั้น
 * Facebook → เส้นนี้ → 302 ต่อไปที่ coach://oauth?provider=facebook&code=...
 *
 * 🔴 ไม่แตะ code เลย แค่ส่งต่อ — การแลก token เกิดตอนแอปยิง POST /api/auth/native/facebook
 *    (ถ้าแลกตรงนี้ ต้องส่ง session กลับผ่าน URL ซึ่งไปโผล่ใน log/history ของเบราว์เซอร์)
 */
export function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const out = new URLSearchParams({ provider: "facebook" });
  for (const k of ["code", "state", "error", "errorMessage", "error_description"]) {
    const v = p.get(k);
    if (v) out.set(k === "errorMessage" || k === "error_description" ? "errorMessage" : k, v);
  }
  return NextResponse.redirect(`${APP_REDIRECT_SCHEME}?${out.toString()}`);
}
