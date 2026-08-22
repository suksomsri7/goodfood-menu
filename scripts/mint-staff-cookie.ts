/**
 * ปั๊มคุกกี้ `gf_staff` ไว้ QC หน้าหลังบ้าน/เส้น API ที่ต้องล็อกอิน (ไม่ต้องรู้รหัสของเจ้าของ)
 *
 *   npx tsx scripts/mint-staff-cookie.ts            # พิมพ์ค่าคุกกี้
 *   curl -H "Cookie: gf_staff=$(npx tsx scripts/mint-staff-cookie.ts)" https://goodfood.in.th/api/members
 *
 * 🔴 รันได้เฉพาะบนเครื่องที่มี `.env.production` (คือ VPS) — โทเค็นอายุ 1 ชม.
 * 📌 หน้าเว็บหลังบ้านยังเช็ค localStorage `goodfood_staff` ด้วย ถ้าจะถ่ายรูปหน้าจอต้องฉีดตัวนั้นเพิ่ม
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";

const env = readFileSync(join(process.cwd(), ".env.production"), "utf8");
const secret = env.match(/^NEXTAUTH_SECRET=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!secret) {
  console.error("ไม่เจอ NEXTAUTH_SECRET ใน .env.production");
  process.exit(1);
}

async function main() {
  const token = await new SignJWT({ email: "qc@goodfood.local", role: "Admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("goodfood.backoffice")
    .setSubject(process.argv[2] || "staff_admin")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret!));

  process.stdout.write(token);
}

main();
