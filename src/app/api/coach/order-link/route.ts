import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { bkkDateKey, bkkTodayKey, type MealPlanItem } from "@/lib/planGenerator";
import { MAIN_SLOTS } from "@/lib/goodfoodMealPicker";

export const dynamic = "force-dynamic";

/**
 * ปุ่ม "สั่งอาหารวันนี้" — ประกอบ deep link ทักแชท LINE OA พร้อมข้อความสั่งซื้อที่พิมพ์ไว้ให้แล้ว
 *
 * GET /api/coach/order-link?date=YYYY-MM-DD   (Bearer · ไม่ส่ง date = วันนี้ตามเวลาไทย)
 *  → { available: true, url, message, items[], total, code, oaId }
 *  → { available: false, reason }   เมื่อยังไม่ตั้ง LINE OA หรือวันนั้นไม่มีมื้อที่สั่งได้
 *
 * LINE OA ID ตั้งที่ /backoffice/settings (SystemSetting.lineOaId) — ยังไม่ตั้ง = ปุ่มไม่ขึ้น
 * 🔴 ไม่แต่งเมนู: หยิบเฉพาะมื้อที่มี foodId จริงจากแผนของวันนั้นเท่านั้น
 */
function bkkDateFromParam(raw: string | null): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return bkkDateKey(new Date(d.getTime() - 7 * 3600_000));
  }
  return bkkTodayKey();
}

/** รหัสติดตามออเดอร์ที่แอดมินเอาไปเทียบกับสมาชิกได้ */
export function orderCode(memberId: string, dateKey: Date): string {
  return `C-${memberId.slice(-6)}-${dateKey.toISOString().slice(0, 10).replace(/-/g, "")}`;
}

export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await prisma.systemSetting
    .findUnique({ where: { id: "system" }, select: { lineOaId: true } })
    .catch(() => null);
  const rawOa = (settings?.lineOaId || "").trim();
  if (!rawOa) {
    return NextResponse.json({ available: false, reason: "no_oa_configured" });
  }

  const dateKey = bkkDateFromParam(new URL(req.url).searchParams.get("date"));
  const plan = await prisma.dailyPlan.findUnique({
    where: { memberId_date: { memberId: member.id, date: dateKey } },
    select: { mealPlan: true },
  });

  const meals = ((plan?.mealPlan as { meals?: MealPlanItem[] } | null)?.meals ?? []).filter(
    (m) => m?.source === "goodfood" && !!m.foodId && MAIN_SLOTS.includes(m.slot as never)
  );
  if (meals.length === 0) {
    return NextResponse.json({ available: false, reason: "no_orderable_meals" });
  }

  const total = Math.round(meals.reduce((s, m) => s + (m.price ?? 0), 0) * 100) / 100;
  const code = orderCode(member.id, dateKey);
  const dateLabel = dateKey.toISOString().slice(0, 10);

  const lines = [
    `สั่งอาหารวันที่ ${dateLabel} ครับ`,
    "",
    ...meals.map((m) => `• ${m.slot}: ${m.menu} — ${m.price ?? 0} บาท`),
    "",
    `รวม ${total} บาท`,
    `รหัสอ้างอิง: ${code}`,
  ];
  const message = lines.join("\n");

  // LINE deep link: ต้องเป็น basic ID พร้อม @ และ encode (@goodfood → %40goodfood)
  const oaId = rawOa.startsWith("@") ? rawOa : `@${rawOa}`;
  const url = `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`;

  const res = NextResponse.json({
    available: true,
    url,
    message,
    oaId,
    code,
    total,
    date: dateLabel,
    items: meals.map((m) => ({
      slot: m.slot,
      menu: m.menu,
      foodId: m.foodId,
      price: m.price ?? 0,
      servings: m.servings ?? 1,
      imageUrl: m.imageUrl ?? null,
    })),
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
