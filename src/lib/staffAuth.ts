/**
 * Session ของพนักงานหลังบ้าน — คุกกี้ httpOnly ที่เซ็นด้วย JWT
 *
 * 🔴 ทำไมต้องเพิ่ม: หน้าหลังบ้านเดิมเก็บสถานะ login ไว้ใน localStorage อย่างเดียว
 *    API ฝั่ง server จึงไม่รู้ว่าใครเรียก — ใครยิง /api/... ตรง ๆ ก็ได้ข้อมูล
 *    เมนูอาหารรั่วยังพอทำเนา แต่ API ชุดโปรแกรมปิ่นโตมี ชื่อ-เบอร์-ที่อยู่-ข้อมูลสุขภาพ ของลูกค้า
 *    จึงบังคับใช้คุกกี้นี้กับ /api/program/* ทั้งหมด
 *
 * ทำแบบ "เพิ่ม" ไม่ใช่ "เปลี่ยน": login เดิมยังคืน staff object ให้ localStorage เหมือนเดิม
 * หน้าเก่าทุกหน้าจึงทำงานต่อได้ ไม่ต้องแก้อะไร
 */
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "@/lib/secrets/store";

const COOKIE = "gf_staff";
const ISSUER = "goodfood.backoffice";
const TTL_SECONDS = 12 * 60 * 60; // กะทำงาน 1 วัน

async function key(): Promise<Uint8Array> {
  const s = (await getSecret("NEXTAUTH_SECRET")) || process.env.NEXTAUTH_SECRET || "";
  if (!s) throw new Error("no session secret (set NEXTAUTH_SECRET)");
  return new TextEncoder().encode(s);
}

export interface StaffClaims {
  sub: string;
  email: string;
  role: string | null;
}

export async function issueStaffCookie(res: NextResponse, staff: StaffClaims): Promise<void> {
  const token = await new SignJWT({ email: staff.email, role: staff.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(staff.sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(await key());

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function clearStaffCookie(res: NextResponse): void {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function readStaff(req: NextRequest): Promise<StaffClaims | null> {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, await key(), { issuer: ISSUER, algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, email: String(payload.email ?? ""), role: (payload.role as string) ?? null };
  } catch {
    return null;
  }
}

/** ใช้เปิดหัว route: `const staff = await requireStaff(req); if (staff instanceof NextResponse) return staff;` */
export async function requireStaff(req: NextRequest): Promise<StaffClaims | NextResponse> {
  const staff = await readStaff(req);
  if (!staff) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบหลังบ้านก่อน" }, { status: 401 });
  }
  return staff;
}
