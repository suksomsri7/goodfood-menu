import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | GoodFood",
  description:
    "นโยบายความเป็นส่วนตัวของ GoodFood — ข้อมูลใดที่เราเก็บ ใช้ทำอะไร และคุณมีสิทธิ์อะไรบ้าง",
  alternates: { canonical: "https://goodfood.in.th/privacy" },
};

const UPDATED = "22 พฤษภาคม 2569";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800">
      <header className="mb-10">
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← กลับหน้าแรก
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          นโยบายความเป็นส่วนตัว
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          ปรับปรุงล่าสุด: {UPDATED}
        </p>
      </header>

      <section className="space-y-4 leading-relaxed">
        <p>
          เว็บไซต์ GoodFood (goodfood.in.th) ให้บริการบทความเรื่องอาหารและโภชนาการ
          เราเคารพความเป็นส่วนตัวของผู้เข้าใช้บริการ และยึดหลักเก็บข้อมูลเท่าที่จำเป็น
          ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          1. ข้อมูลที่เราเก็บ
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>ข้อมูลการใช้งานทั่วไป:</strong> ที่อยู่ IP, ประเภท browser,
            หน้าที่เข้าชม, เวลาที่ใช้งาน — เก็บผ่าน analytics เพื่อปรับปรุงเว็บไซต์
          </li>
          <li>
            <strong>ข้อมูลบัญชี (ถ้าคุณสมัครสมาชิก):</strong> ชื่อ, อีเมล,
            ข้อมูลที่คุณกรอกใน profile
          </li>
          <li>
            <strong>Cookies:</strong> ใช้สำหรับการล็อกอินและจดจำการตั้งค่า
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          2. วัตถุประสงค์การใช้ข้อมูล
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>ให้บริการเว็บไซต์และฟีเจอร์ต่าง ๆ ที่คุณใช้งาน</li>
          <li>วิเคราะห์การใช้งานเพื่อปรับปรุงคุณภาพเนื้อหา</li>
          <li>ส่งข่าวสารและบทความใหม่ (เฉพาะกรณีที่คุณยินยอม)</li>
          <li>ปฏิบัติตามกฎหมายที่เกี่ยวข้อง</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          3. การเปิดเผยข้อมูลแก่บุคคลที่สาม
        </h2>
        <p>
          เราไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของคุณแก่บุคคลที่สาม
          ยกเว้นในกรณีดังนี้:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>ผู้ให้บริการที่จำเป็น (เช่น hosting, analytics) ภายใต้สัญญารักษาความลับ</li>
          <li>เมื่อต้องเปิดเผยตามกฎหมายหรือคำสั่งศาล</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          4. การโพสต์บนโซเชียลมีเดีย
        </h2>
        <p>
          เนื้อหาบทความบางส่วนถูกเผยแพร่อัตโนมัติบน Facebook และ Instagram
          ผ่านระบบของเรา การโต้ตอบของคุณบนแพลตฟอร์มเหล่านั้น
          เป็นไปตามนโยบายความเป็นส่วนตัวของแพลตฟอร์มนั้น ๆ
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          5. สิทธิของเจ้าของข้อมูล
        </h2>
        <p>คุณมีสิทธิ์:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>เข้าถึงและขอสำเนาข้อมูลของคุณ</li>
          <li>แก้ไขข้อมูลที่ไม่ถูกต้อง</li>
          <li>ขอลบข้อมูลของคุณ</li>
          <li>คัดค้านการประมวลผลข้อมูล</li>
          <li>ถอนความยินยอม</li>
        </ul>

        {/* 🔴 Meta/Google บังคับให้มี "คำแนะนำการลบข้อมูล" เป็น URL ที่เปิดอ่านได้จริง
            (ช่อง "การลบข้อมูลผู้ใช้" ในหน้าตั้งค่าแอป) — ต้องมี id ให้ลิงก์ตรงมาที่หัวข้อนี้ได้ */}
        <h2 id="delete-data" className="mt-8 scroll-mt-24 text-xl font-semibold text-gray-900">
          5.1 วิธีลบบัญชีและข้อมูลของคุณ
        </h2>
        <p>ลบได้เองทันทีจากในแอป ไม่ต้องรอใครอนุมัติ:</p>
        <ol className="list-decimal space-y-1 pl-6">
          <li>เปิดแอป Coach → เมนู <b>ตั้งค่า</b></li>
          <li>เลื่อนลงหัวข้อ <b>บัญชี</b> → กด <b>ลบบัญชีและข้อมูลทั้งหมด</b></li>
          <li>ยืนยันอีกครั้ง — ระบบจะลบบัญชี แผน บันทึกอาหาร/น้ำหนัก/การออกกำลังกาย
            รูปภาพ และการเชื่อมต่อบัญชีโซเชียล (Apple / Google / LINE / Facebook) ออกจากระบบ</li>
        </ol>
        <p>
          ถ้าเข้าแอปไม่ได้ ส่งอีเมลมาที่{" "}
          <a className="underline" href="mailto:support@goodfood.in.th">
            support@goodfood.in.th
          </a>{" "}
          พร้อมแจ้งชื่อบัญชีหรืออีเมลที่ใช้สมัคร เราจะดำเนินการลบให้ภายใน 7 วันทำการ
          และแจ้งกลับเมื่อลบเรียบร้อย
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          6. ความปลอดภัย
        </h2>
        <p>
          เราใช้มาตรการทางเทคนิคและการจัดการที่เหมาะสม
          เพื่อปกป้องข้อมูลของคุณจากการเข้าถึงโดยไม่ได้รับอนุญาต
          ทุกการสื่อสารผ่านเว็บไซต์ใช้ HTTPS encryption
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          7. การติดต่อ
        </h2>
        <p>
          หากมีข้อสงสัยหรือต้องการใช้สิทธิ์ตามนโยบายนี้ ติดต่อได้ที่:
        </p>
        <p className="rounded bg-gray-50 p-4">
          อีเมล:{" "}
          <a
            href="mailto:contact@goodfood.in.th"
            className="text-emerald-700 hover:underline"
          >
            contact@goodfood.in.th
          </a>
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          8. การปรับปรุงนโยบาย
        </h2>
        <p>
          เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว การเปลี่ยนแปลงจะมีผลทันทีเมื่อโพสต์บนหน้านี้
          กรุณาตรวจสอบหน้านี้เป็นระยะ
        </p>
      </section>

      <footer className="mt-16 border-t pt-6 text-sm text-gray-500">
        © {new Date().getFullYear()} GoodFood — goodfood.in.th
      </footer>
    </main>
  );
}
