import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * "ระบบนี้มีพนักงานในฐานข้อมูลแล้วหรือยัง" — คำถามเดียวที่หน้า login ต้องรู้ก่อนล็อกอิน
 *
 * 🔴 ทำไมต้องมี: AuthGuard เดิมถาม `GET /api/staff` เพื่อดูว่ามีพนักงานหรือยัง
 *    พอปิด /api/staff ให้เฉพาะพนักงาน (ข้อมูลอีเมล/สิทธิ์รั่วสู่สาธารณะ) guard จะได้ 401
 *    แล้วตีความว่า "ยังไม่มีพนักงาน = โหมดติดตั้งครั้งแรก" → เปิดหลังบ้านให้คนนอกเห็น
 *    เส้นนี้จึงตอบแค่ boolean ตัวเดียว ไม่มีข้อมูลใครหลุดออกไป
 */
export async function GET() {
  const count = await prisma.staff.count();
  const res = NextResponse.json({ hasStaff: count > 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
