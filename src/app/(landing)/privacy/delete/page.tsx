import type { Metadata } from "next";
import Link from "next/link";

/**
 * หน้า "วิธีลบบัญชีและข้อมูล" แบบยืนเดี่ยว
 *
 * 🔴 Meta/Google ต้องการ URL ของ "คำแนะนำการลบข้อมูล" ที่เป็นลิงก์ธรรมดา
 *    บาง validator ไม่รับ URL ที่มี # (fragment) → แยกเป็นหน้าของตัวเองจะไม่มีข้อโต้แย้ง
 *    (ในนโยบายความเป็นส่วนตัวยังมีหัวข้อเดียวกันอยู่ที่ /privacy#delete-data)
 */
export const metadata: Metadata = {
  title: "วิธีลบบัญชีและข้อมูล | GoodFood Coach",
  description: "ขั้นตอนลบบัญชีและข้อมูลทั้งหมดของคุณออกจากแอป Coach ด้วยตัวเอง หรือขอให้เราลบให้",
};

export default function DeleteDataPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-bold text-gray-900">วิธีลบบัญชีและข้อมูลของคุณ</h1>
      <p className="mt-2 text-sm text-gray-500">แอป Coach · GoodFood (goodfood.in.th)</p>

      <h2 className="mt-8 text-xl font-semibold text-gray-900">ลบเองในแอป (ทันที)</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6">
        <li>เปิดแอป Coach แล้วไปที่เมนู <b>ตั้งค่า</b></li>
        <li>เลื่อนลงหัวข้อ <b>บัญชี</b> → กด <b>ลบบัญชีและข้อมูลทั้งหมด</b></li>
        <li>ยืนยันอีกครั้ง — บัญชีจะถูกลบทันที กู้คืนไม่ได้</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold text-gray-900">ข้อมูลที่ถูกลบ</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>บัญชีและโปรไฟล์ (ชื่อ อีเมล เพศ วันเกิด ส่วนสูง น้ำหนัก เป้าหมาย)</li>
        <li>บันทึกอาหาร น้ำ น้ำหนัก การออกกำลังกาย และการนอน</li>
        <li>แผนอาหาร/แผนออกกำลังกาย และประวัติการสนทนากับโค้ช</li>
        <li>รูปภาพที่อัปโหลด (รูปอาหาร รูปร่างกาย)</li>
        <li>การเชื่อมต่อบัญชีโซเชียลที่ใช้เข้าสู่ระบบ (Apple / Google / LINE / Facebook)</li>
      </ul>
      <p className="mt-3">
        ข้อมูลที่กฎหมายบังคับให้เก็บ เช่น หลักฐานการสั่งซื้อ/ชำระเงิน จะถูกเก็บต่อเท่าที่กฎหมายกำหนด
        แล้วลบทิ้งเมื่อพ้นกำหนด และจะไม่ถูกนำมาใช้ระบุตัวคุณอีก
      </p>

      <h2 className="mt-8 text-xl font-semibold text-gray-900">เข้าแอปไม่ได้ / อยากให้เราลบให้</h2>
      <p className="mt-3">
        ส่งอีเมลมาที่{" "}
        <a className="font-medium underline" href="mailto:support@goodfood.in.th">
          support@goodfood.in.th
        </a>{" "}
        แจ้งชื่อบัญชีหรืออีเมล/ช่องทางที่ใช้สมัคร เราจะลบให้ภายใน <b>7 วันทำการ</b> และแจ้งกลับเมื่อเรียบร้อย
      </p>

      <p className="mt-10 text-sm">
        <Link className="underline" href="/privacy">
          ← กลับไปที่นโยบายความเป็นส่วนตัว
        </Link>
      </p>
    </main>
  );
}
