import { NextResponse } from "next/server";
import { authorizeInfo, configuredProviders } from "@/lib/socialAuth";

export const dynamic = "force-dynamic";

/**
 * จอ login ในแอปถามก่อนว่า "ตอนนี้เข้าได้ทางไหนบ้าง"
 *
 * 🔴 ปุ่มที่กดแล้วพังแย่กว่าไม่มีปุ่ม — ทางไหนยังไม่ได้ใส่กุญแจในหลังบ้าน จะไม่โผล่ในแอป
 * 🔴 เส้นนี้เปิดสาธารณะโดยตั้งใจ (ต้องอ่านได้ก่อนล็อกอิน) — ส่งออกเฉพาะ client id ที่เป็นข้อมูลสาธารณะ
 *    ห้ามใส่ secret ใด ๆ ลงไปเด็ดขาด
 */
export async function GET() {
  const enabled = await configuredProviders();
  const [line, facebook] = await Promise.all([authorizeInfo("line"), authorizeInfo("facebook")]);

  const res = NextResponse.json({
    providers: enabled,
    // ข้อมูลเปิดหน้า login ของ provider (แอปเอาไปประกอบ URL เอง)
    line: line ?? null,
    facebook: facebook ?? null,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
