import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { toPer100 } from "@/lib/catalogPer100";

export const dynamic = "force-dynamic";

/**
 * ค้นคลังอาหาร 856 รายการ แล้วเสนอค่า "ต่อ 100 ก." ให้ครัวกดเติมลงฟอร์ม
 * แถวที่แกะน้ำหนักหน่วยบริโภคไม่ออกจะไม่ถูกเสนอเลย — ดีกว่าเดาแล้วให้ครัวเชื่อผิด ๆ
 */
export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ items: [] });

  const rows = await prisma.foodCatalog.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { aliases: { has: q } }] },
    select: { name: true, portion: true, calories: true, protein: true, carbs: true, fat: true, sodium: true, sugar: true },
    take: 40,
  });

  const items = rows.map(toPer100).filter((x): x is NonNullable<typeof x> => x !== null).slice(0, 15);
  return NextResponse.json({ items, skipped: rows.length - items.length });
}
