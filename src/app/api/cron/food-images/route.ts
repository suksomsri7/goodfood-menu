import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToBunny } from "@/lib/bunny";
import { generateFoodImage } from "@/lib/foodImage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * เติมรูปให้เมนูที่ยังไม่มีรูป — เรียกเป็นชุด (งานซ่อมข้อมูล ไม่ใช่ของที่ผู้ใช้กด)
 * secret เดียวกับ cron ตัวอื่นทั้งระบบ (ARTICLE_CRON_SECRET)
 *
 * ทำทีละใบเรียงกัน ไม่ยิงขนาน — เครดิตมีจำกัดและอยากให้หยุดได้ทันทีเมื่อเจอปัญหา
 */
export async function POST(req: NextRequest) {
  const expected = process.env.ARTICLE_CRON_SECRET;
  if (!expected || req.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 5)));

  const foods = await prisma.food.findMany({
    where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: "" }] },
    select: { id: true, name: true, description: true, ingredients: true, calories: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: limit,
  });

  const done: { name: string; imageUrl: string; model: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const f of foods) {
    try {
      const { dataUrl, model } = await generateFoodImage({
        name: f.name,
        description: f.description,
        ingredients: f.ingredients,
        calories: f.calories,
        categoryName: f.category?.name ?? null,
      });
      const url = await uploadToBunny(dataUrl, "foods", `${f.id}-ai.png`);
      await prisma.food.update({ where: { id: f.id }, data: { imageUrl: url, imageIsAi: true } });
      done.push({ name: f.name, imageUrl: url, model });
    } catch (e: any) {
      failed.push({ name: f.name, error: String(e?.message || e).slice(0, 200) });
      // เครดิตหมด/คีย์ผิด = ยิงต่อก็พังทุกใบ หยุดเลยดีกว่าเผาเวลา
      if (/credit|insufficient|401|403/i.test(String(e?.message || ""))) break;
    }
  }

  const left = await prisma.food.count({ where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: "" }] } });
  return NextResponse.json({ ok: true, generated: done.length, failed, left, done });
}
