/**
 * ยิงจริงใส่เว็บที่รันอยู่ แล้วเช็คว่า "คนนอกที่ไม่ได้ล็อกอิน" เห็นอะไรได้บ้าง
 *
 * ไม่ได้อยู่ในชุด `pnpm test:engines` เพราะต้องต่อเน็ต — รันมือหลัง deploy ทุกครั้งที่แตะ API หลังบ้าน
 *   npx tsx scripts/check-api-auth.ts                      # ยิง prod
 *   BASE=http://127.0.0.1:3001 npx tsx scripts/check-api-auth.ts
 *
 * 🔴 21-22 ส.ค. 2569: เส้นหลังบ้านทั้งชุดเคยเปิดโล่ง (ใครก็อ่านรายชื่อสมาชิก/แก้เมนู/สร้างพนักงานได้)
 *    ไฟล์นี้คือด่านกันพลาดซ้ำ — เพิ่มเส้นใหม่ทุกครั้งที่สร้าง route หลังบ้าน
 */
const BASE = process.env.BASE || "https://goodfood.in.th";

type Expect = "locked" | "open";
interface Case {
  path: string;
  method?: string;
  body?: unknown;
  expect: Expect;
  note: string;
}

const CASES: Case[] = [
  // ── ต้องปิด (401) ──
  { path: "/api/members", expect: "locked", note: "รายชื่อสมาชิก + ข้อมูลสุขภาพ" },
  { path: "/api/staff", expect: "locked", note: "บัญชีพนักงาน" },
  { path: "/api/roles", expect: "locked", note: "สิทธิ์การใช้งาน" },
  { path: "/api/member-types", expect: "locked", note: "ประเภทสมาชิก" },
  { path: "/api/orders", expect: "locked", note: "ออเดอร์ทั้งร้าน (ไม่ระบุ lineUserId)" },
  { path: "/api/orders/pending-count", expect: "locked", note: "จำนวนออเดอร์ค้าง" },
  { path: "/api/dashboard/stats", expect: "locked", note: "สรุปยอดร้าน" },
  { path: "/api/line/conversations", expect: "locked", note: "แชท LINE ของลูกค้า" },
  { path: "/api/line/unread", expect: "locked", note: "แชทที่ยังไม่อ่าน" },
  { path: "/api/settings/payment-accounts", expect: "locked", note: "บัญชีรับเงิน" },
  { path: "/api/backoffice/barcode-products", expect: "locked", note: "คลังบาร์โค้ด" },
  { path: "/api/debug/test-inactive", expect: "locked", note: "เครื่องมือ debug (ยิง push ได้)" },
  { path: "/api/foods", method: "POST", body: {}, expect: "locked", note: "สร้างเมนู" },
  { path: "/api/categories", method: "POST", body: {}, expect: "locked", note: "สร้างหมวด" },
  { path: "/api/restaurants", method: "POST", body: {}, expect: "locked", note: "สร้างร้าน" },
  { path: "/api/packages", method: "POST", body: {}, expect: "locked", note: "สร้างแพ็กเกจ" },
  { path: "/api/promotions", method: "POST", body: {}, expect: "locked", note: "สร้างโปรโมชัน" },
  { path: "/api/staff", method: "POST", body: {}, expect: "locked", note: "สร้างพนักงานใหม่ (ยกระดับสิทธิ์)" },
  { path: "/api/settings/ai-coach", method: "PATCH", body: {}, expect: "locked", note: "แก้ค่าโค้ช AI" },

  // ── ฝั่ง LIFF: ตัวตนต้องมาจากคุกกี้ที่แลกกับ LINE เท่านั้น (ส่ง ?lineUserId= มาเฉย ๆ ต้องไม่ผ่าน) ──
  { path: "/api/meals?lineUserId=Uqctest&date=2026-08-22", expect: "locked", note: "บันทึกอาหารของคนอื่น" },
  { path: "/api/water?lineUserId=Uqctest", expect: "locked", note: "น้ำของคนอื่น" },
  { path: "/api/weight?lineUserId=Uqctest", expect: "locked", note: "น้ำหนักของคนอื่น" },
  { path: "/api/cart?lineUserId=Uqctest", expect: "locked", note: "ตะกร้าของคนอื่น" },
  { path: "/api/addresses?lineUserId=Uqctest", expect: "locked", note: "ที่อยู่ของคนอื่น" },
  { path: "/api/members/me?lineUserId=Uqctest", expect: "locked", note: "โปรไฟล์ของคนอื่น" },
  { path: "/api/member/progress-photos?lineUserId=Uqctest", expect: "locked", note: "รูป progress ของคนอื่น" },
  { path: "/api/member/notification-settings?lineUserId=Uqctest", expect: "locked", note: "ตั้งค่าแจ้งเตือนของคนอื่น" },
  { path: "/api/orders?lineUserId=Uqctest", expect: "locked", note: "ออเดอร์ของคนอื่น" },
  { path: "/api/cal/initial-data?lineUserId=Uqctest", expect: "locked", note: "หน้าแคลอรี่ของคนอื่น" },
  { path: "/api/plan?lineUserId=Uqctest&month=2026-08", expect: "locked", note: "แผนของคนอื่น" },
  { path: "/api/recommendation?lineUserId=Uqctest", expect: "locked", note: "คำแนะนำ AI ของคนอื่น (เผาเครดิต)" },
  { path: "/api/members/me", method: "POST", body: { lineUserId: "Uqctest", displayName: "x" }, expect: "locked", note: "สร้าง/แก้โปรไฟล์คนอื่น" },
  { path: "/api/meals", method: "POST", body: { lineUserId: "Uqctest", name: "x", calories: 1 }, expect: "locked", note: "ยัดบันทึกอาหารให้คนอื่น" },
  { path: "/api/weight", method: "POST", body: { lineUserId: "Uqctest", weight: 70 }, expect: "locked", note: "ยัดน้ำหนักให้คนอื่น" },
  { path: "/api/auth/liff", method: "POST", body: { idToken: "ไม่ใช่ token จริง" }, expect: "locked", note: "แลก session ด้วย token ปลอม" },

  // ── ต้องเปิด (ลูกค้าใช้จริง) ──
  { path: "/api/auth/setup-status", expect: "open", note: "หน้า login ถามว่ามีพนักงานหรือยัง" },
  { path: "/api/foods", expect: "open", note: "เมนูอาหารหน้าร้าน" },
  { path: "/api/categories", expect: "open", note: "หมวดอาหารหน้าร้าน" },
  { path: "/api/restaurants?active=true", expect: "open", note: "รายชื่อร้านหน้าเมนู" },
  { path: "/api/packages", expect: "open", note: "แพ็กเกจหน้าร้าน" },
  { path: "/api/promotions", expect: "open", note: "โปรโมชันหน้าร้าน" },
  { path: "/api/settings/payment-accounts/default", expect: "open", note: "บัญชีโอนเงินที่ลูกค้าต้องเห็น" },
  { path: "/api/settings/ai-coach", expect: "open", note: "ค่าโค้ชที่หน้าลูกค้าอ่าน" },
];

async function main() {
  let bad = 0;
  for (const c of CASES) {
    const method = c.method ?? "GET";
    let status = 0;
    try {
      const res = await fetch(BASE + c.path, {
        method,
        ...(c.body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.body) } : {}),
      });
      status = res.status;
    } catch (e) {
      console.log(`⚠️  ${method} ${c.path} — ยิงไม่ถึง (${(e as Error).message})`);
      bad++;
      continue;
    }
    // "ปิด" = ต้องได้ 401/403 · "เปิด" = ต้องไม่ใช่ 401/403 (400/404 จาก body ว่างถือว่าผ่านด่านแล้ว)
    const locked = status === 401 || status === 403;
    const ok = c.expect === "locked" ? locked : !locked;
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${status} ${method} ${c.path} — ${c.note}`);
  }
  console.log(bad === 0 ? `\nผ่านครบ ${CASES.length} เส้น` : `\n❌ มีปัญหา ${bad} เส้น`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
