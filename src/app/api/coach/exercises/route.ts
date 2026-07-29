import { NextResponse } from "next/server";
import { EXERCISE_CATALOG } from "@/lib/exerciseCatalog";

export const dynamic = "force-dynamic";

/**
 * คลังท่าออกกำลังกาย + สื่อสาธิต — แอปค้นด้วย key ที่มากับแผน
 * (เพิ่มคลิปใหม่ที่ backend แล้วแอปเห็นทันที ไม่ต้อง build ใหม่)
 * GET → { items: [...], withMedia: [key] }
 */
export async function GET() {
  return NextResponse.json({
    items: EXERCISE_CATALOG,
    withMedia: EXERCISE_CATALOG.filter((e) => e.media).map((e) => e.key),
  });
}
