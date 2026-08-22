/**
 * ปั๊มคุกกี้ `gf_member` (session ฝั่ง LIFF) ไว้ QC โดยไม่ต้องเปิดจากแอป LINE
 *
 *   npx tsx scripts/mint-member-cookie.ts <lineUserId>
 *   curl -H "Cookie: gf_member=$(npx tsx scripts/mint-member-cookie.ts Uxxxx)" "https://goodfood.in.th/api/meals?date=2026-08-22"
 *
 * 🔴 ของจริงต้องแลกผ่าน POST /api/auth/liff ด้วย id token ของ LINE เท่านั้น — ตัวนี้ใช้เฉพาะเครื่องที่มี .env.production
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

const lineUserId = process.argv[2];
if (!lineUserId) {
  console.error("ใช้: npx tsx scripts/mint-member-cookie.ts <lineUserId>");
  process.exit(1);
}

async function main() {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("goodfood.liff")
    .setSubject(lineUserId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret!));

  process.stdout.write(token);
}

main();
