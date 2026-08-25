/**
 * ปั๊ม access token ของแอป (Bearer) ไว้ QC จอในแอปโดยไม่ต้องล็อกอินจริง
 *   npx tsx scripts/mint-app-token.ts <memberId|lineUserId>
 *
 * 🔴 ใช้กุญแจชุดเดียวกับ prod (COACH_JWT_SECRET/NEXTAUTH_SECRET) — token ที่ได้ใช้ยิง API จริงได้
 *    อย่าเผยแพร่ · อายุ 1 ชม. ตามของจริง
 */
import { prisma } from "../src/lib/prisma";
import { signSession } from "../src/lib/coachAuth";

async function main() {
  const key = process.argv[2];
  if (!key) throw new Error("ต้องระบุ memberId หรือ lineUserId");
  const member =
    (await prisma.member.findUnique({ where: { id: key } })) ??
    (await prisma.member.findUnique({ where: { lineUserId: key } }));
  if (!member) throw new Error(`ไม่พบสมาชิก: ${key}`);
  const { accessToken } = await signSession(member.id);
  console.log(accessToken);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
