import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { bkkDateKey, bkkTodayKey, type MealPlanItem } from "@/lib/planGenerator";
import { MAIN_SLOTS } from "@/lib/goodfoodMealPicker";
// ตัวเดียวกับที่ feed บทความใช้ — รูปใน DB เก็บเป็น path สั้น แอป render ตรง ๆ ไม่ได้
import { absoluteImageUrl } from "@/lib/articleFeed";

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

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/**
 * วันที่แบบที่คนไทยอ่านในแชท — dateKey เป็น BKK midnight เก็บเป็น UTC อยู่แล้ว
 * จึงอ่าน getUTC* ตรง ๆ ห้ามแปลงเขตเวลาซ้ำ (แปลงซ้ำ = วันเพี้ยนไป 1 วัน)
 */
function thaiDateLabel(dateKey: Date): string {
  return `${dateKey.getUTCDate()} ${TH_MONTHS[dateKey.getUTCMonth()]} ${dateKey.getUTCFullYear() + 543}`;
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

  const params = new URL(req.url).searchParams;
  const dateKey = bkkDateFromParam(params.get("date"));

  /* สั่งทีละกล่อง — คนที่ยังไม่เข้าโปรแกรมเห็นเมนูจริงของครัวเป็นการ์ดทีละใบ
     ปุ่มบนการ์ดต้องสั่ง "ใบนั้น" ไม่ใช่ทั้งวันตามแผน (ซึ่งเขายังไม่ได้สมัคร) */
  const foodId = (params.get("foodId") || "").trim();
  if (foodId) {
    const food = await prisma.food.findFirst({
      where: { id: foodId, isActive: true },
      select: { id: true, name: true, price: true },
    });
    if (!food) return NextResponse.json({ available: false, reason: "food_not_found" });
    return orderResponse({
      memberId: member.id,
      dateKey,
      rawOa,
      items: [{ slot: params.get("slot") || "", menu: food.name, foodId: food.id, price: food.price ?? 0, servings: 1, imageUrl: null }],
      single: true,
    });
  }

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

  return orderResponse({
    memberId: member.id,
    dateKey,
    rawOa,
    items: meals.map((m) => ({
      slot: m.slot,
      menu: m.menu,
      foodId: m.foodId ?? null,
      price: m.price ?? 0,
      servings: m.servings ?? 1,
      imageUrl: m.imageUrl ?? null,
    })),
  });
}

interface OrderItem {
  slot: string;
  menu: string;
  foodId: string | null;
  price: number;
  servings: number;
  imageUrl: string | null;
}

/**
 * ประกอบข้อความ + deep link จากรายการที่สั่งได้จริง (ใช้ร่วมกันทั้งสั่งทั้งวันและสั่งทีละกล่อง)
 * 🔴 ข้อความต้องอ่านรู้เรื่องในแชทของแอดมินเอง — รหัสอ้างอิงคือสิ่งเดียวที่ผูกกลับมาที่สมาชิกได้
 */
function orderResponse(opts: {
  memberId: string;
  dateKey: Date;
  rawOa: string;
  items: OrderItem[];
  single?: boolean;
}) {
  const { memberId, dateKey, rawOa, items, single } = opts;
  const total = Math.round(items.reduce((s, m) => s + (m.price ?? 0), 0) * 100) / 100;
  const code = orderCode(memberId, dateKey);
  const dateLabel = dateKey.toISOString().slice(0, 10);

  /* ขึ้นต้นว่า "สนใจสั่งอาหาร" ไม่ใช่ "สั่งอาหาร" (เจ้าของสั่ง 21 ส.ค.)
     คนกดปุ่มนี้ยังไม่ได้จ่ายและยังไม่ได้ตกลงอะไร — เขียนว่าสั่งแล้วคือพูดแทนเขา
     แอดมินได้คุยยืนยันก่อนเสมอ · วันที่เป็นภาษาคน ส่วนวันที่แบบเครื่องอ่านอยู่ในรหัสอ้างอิงแล้ว */
  const lines = [
    `สนใจสั่งอาหาร วันที่ ${thaiDateLabel(dateKey)}`,
    "",
    ...items.map((m) =>
      single
        ? `• ${m.menu}${m.slot ? ` (${m.slot})` : ""} — ${m.price ?? 0} บาท`
        : `• ${m.slot}: ${m.menu} — ${m.price ?? 0} บาท`
    ),
    ...(single ? [] : ["", `รวม ${total} บาท`]),
    "",
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
    single: !!single,
    items: items.map((m) => ({ ...m, imageUrl: absoluteImageUrl(m.imageUrl) })),
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
