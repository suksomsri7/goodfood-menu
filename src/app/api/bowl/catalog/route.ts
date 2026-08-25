import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trustedMember } from "@/lib/memberAuth";
// รูปใน DB เก็บเป็น path สั้น — แอปมือถือ render ตรง ๆ ไม่ได้ ต้องเป็น URL เต็ม
import { absoluteImageUrl } from "@/lib/articleFeed";
import {
  ALLERGEN_OPTIONS,
  BowlStepKey,
  DEFAULT_BOWL_BASE_PRICE,
  perPortion,
  portionLabel,
  resolveStepLimits,
} from "@/lib/bowl";

export const dynamic = "force-dynamic";

/**
 * เมนูวัตถุดิบสำหรับจอ "จัดชามของคุณ" ในแอป
 *
 * 🔴 ตัวเลขทุกตัวที่ส่งออกเป็น "ต่อ 1 ที่" แล้ว — แอปห้ามคูณ/หารเพิ่มเอง
 *    (คลังเก็บเป็นต่อ 100 ก. การแปลงอยู่ที่ perPortion() ที่เดียว)
 * 🔴 ต้องมีตัวตนสมาชิกก่อน เพราะคำตอบมีธง "แพ้" ของคนคนนั้นติดมาด้วย
 *    ไม่มีตัวตน = 401 ห้ามเดา lineUserId จาก query string
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const member = await trustedMember(req, searchParams.get("lineUserId"));
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [settings, rows, profile] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { id: "system" } }),
    prisma.ingredient.findMany({
      // 🔴 ของหมด = ไม่ส่งให้แอปเลย ลูกค้าจะได้ไม่เห็นแล้วสั่งไม่ได้
      where: { isActive: true, soldOut: false, bowlStep: { not: null }, portionSize: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.foodProfile.findUnique({ where: { memberId: member.id }, select: { allergies: true } }),
  ]);

  const basePrice = settings?.bowlBasePrice ?? DEFAULT_BOWL_BASE_PRICE;
  const steps = resolveStepLimits(settings?.bowlStepLimits);

  // แบบสอบถามเก็บคำแพ้เป็นภาษาคน ("กุ้ง") — จับคู่กับรหัสที่ครัวติดไว้ที่วัตถุดิบ
  const allergyWords = (profile?.allergies ?? []).map((a) => a.trim()).filter(Boolean);
  const blockedCodes = new Set(
    ALLERGEN_OPTIONS.filter((o) => allergyWords.some((w) => o.label.includes(w) || w.includes(o.label))).map(
      (o) => o.value,
    ),
  );

  const items = rows.map((i) => {
    const hit = i.allergens.filter((a) => blockedCodes.has(a));
    const label = hit.map((a) => ALLERGEN_OPTIONS.find((o) => o.value === a)?.label ?? a);
    return {
      id: i.id,
      step: i.bowlStep as BowlStepKey,
      name: i.displayName || i.name,
      kitchenName: i.name,
      nameEn: i.nameEn,
      imageUrl: absoluteImageUrl(i.imageUrl),
      portionLabel: portionLabel(i),
      price: i.portionPrice,
      allergens: i.allergens,
      blocked: hit.length > 0,
      blockedReason: hit.length > 0 ? `คุณแพ้${label.join(" · ")}` : null,
      nutrition: perPortion(i),
    };
  });

  return NextResponse.json({
    basePrice,
    steps: steps.map((s) => ({
      key: s.key,
      no: s.no,
      title: s.title,
      th: s.th,
      limit: s.limit,
      exact: s.exact ?? false,
      items: items.filter((i) => i.step === s.key),
    })),
  });
}
