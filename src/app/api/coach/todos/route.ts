import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { buildTodos } from "@/lib/todos";

export const dynamic = "force-dynamic";

/**
 * GET — รายการ "สิ่งที่ควรทำตอนนี้" ของวันนี้
 * เงื่อนไขทั้งหมดอยู่ใน `src/lib/todos.ts` จุดเดียว (แจ้งเตือนก็อ่านจากตัวเดียวกัน)
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const todos = await buildTodos(member);

  const res = NextResponse.json({ todos });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

/**
 * กด "ไม่ได้กินมื้อนี้" — ข้ามงานค้างข้อนั้นของวันนี้
 * POST { key }  → { ok, skippedToday, note? }
 *
 * 🔴 ไม่ใช่แค่ปิดการ์ด — เก็บไว้เป็นพฤติกรรมด้วย ข้ามครบ 3 ครั้งใน 14 วัน ระบบจะเลิกถามมื้อนั้นเอง
 *    (คนทำ IF ไม่ควรโดนตื๊อทุกเช้าไปตลอดชีวิต)
 */
const SKIPPABLE = new Set(["breakfast", "lunch", "dinner"]);

export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = (body.key ?? "").trim();
  if (!SKIPPABLE.has(key)) return NextResponse.json({ error: "ข้ามข้อนี้ไม่ได้" }, { status: 400 });

  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  const dayKey = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));

  await prisma.todoSkip.upsert({
    where: { memberId_key_date: { memberId: member.id, key, date: dayKey } },
    update: {},
    create: { memberId: member.id, key, date: dayKey },
  });

  const times = await prisma.todoSkip.count({
    where: { memberId: member.id, key, date: { gte: new Date(dayKey.getTime() - 14 * 86400000) } },
  });

  return NextResponse.json({
    ok: true,
    skippedToday: true,
    // บอกให้รู้ตัวว่าระบบเรียนรู้แล้ว ไม่ใช่เงียบหายไปเฉย ๆ
    note: times >= 3 ? "รับทราบครับ — ต่อไปผมจะไม่ถามมื้อนี้อีก (เปลี่ยนใจได้ทุกเมื่อ แค่บันทึกมื้อนี้เข้ามา)" : undefined,
  });
}
