import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveMember } from "@/lib/coachResolve";
import { frequentFoodsList } from "@/lib/foodCache";

export const dynamic = "force-dynamic";

/**
 * ค้นอาหารสำหรับ "กรอกเอง" — ไม่เรียก AI เลย (นี่คือจุดประสงค์: ลดค่า OpenRouter)
 *
 * GET /api/coach/foods            → { frequent: [...] }  เมนูที่ user คนนี้กินบ่อยใน 60 วัน
 * GET /api/coach/foods?q=กะเพรา   → { frequent: [...ที่ชื่อ match...], catalog: [...] }
 *
 * shape ของ item (API contract — ฝั่งแอปเขียนตามนี้แล้ว ห้ามเปลี่ยน):
 *   { name, portion?, calories, protein, carbs, fat, sodium?, sugar?, source: "frequent"|"catalog" }
 */
const LIMIT = 20;

type CatalogRow = {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number | null;
  sugar: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const member = await resolveMember(req);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 60);

    // เมนูที่เคยกิน = คำตอบที่ตรงตัวที่สุดของคนนี้ → มาก่อนคลังกลางเสมอ
    const freqRows = await frequentFoodsList(member.id, q ? 60 : 30);
    const needle = q.toLowerCase();
    const frequent = (q ? freqRows.filter((r) => r.name.toLowerCase().includes(needle)) : freqRows)
      .slice(0, LIMIT)
      .map((r) => ({
        name: r.name,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        sodium: r.sodium,
        sugar: r.sugar,
        source: "frequent" as const,
      }));

    if (!q) return NextResponse.json({ frequent });

    /*
     * คลังกลาง: ต้องค้นทั้ง name และ aliases แบบ contains
     * Prisma เทียบ String[] ได้แค่ has/hasSome (ตรงตัวเป๊ะ) → ใช้ SQL ตรงกับ unnest + ILIKE แทน
     * เรียง: ชื่อขึ้นต้นด้วยคำค้นก่อน → ชื่อสั้นกว่า (ตรงกว่า) → ชื่อตามตัวอักษร
     */
    const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    const prefix = `${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    const rows = await prisma.$queryRaw<CatalogRow[]>(Prisma.sql`
      SELECT name, portion, calories, protein, carbs, fat, sodium, sugar
      FROM food_catalog
      WHERE name ILIKE ${like}
         OR EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE a ILIKE ${like})
      ORDER BY (name ILIKE ${prefix}) DESC, length(name) ASC, name ASC
      LIMIT ${LIMIT}
    `);

    const catalog = rows.map((r) => ({ ...r, source: "catalog" as const }));
    return NextResponse.json({ frequent, catalog });
  } catch (e: any) {
    console.error("[coach/foods]", e);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
