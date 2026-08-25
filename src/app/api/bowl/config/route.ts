import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";
import { BOWL_STEPS, DEFAULT_BOWL_BASE_PRICE, resolveStepLimits } from "@/lib/bowl";

export const dynamic = "force-dynamic";

/**
 * ราคาฐานของชามจัดเอง + เพดานจำนวน "ที่" ต่อขั้น
 * 🔴 หลังบ้านเท่านั้น — ตัวเลขนี้คือราคาขายจริง
 */
export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const s = await prisma.systemSetting.findUnique({ where: { id: "system" } });
  return NextResponse.json({
    basePrice: s?.bowlBasePrice ?? DEFAULT_BOWL_BASE_PRICE,
    steps: resolveStepLimits(s?.bowlStepLimits),
  });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff(req);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => ({}))) as { basePrice?: number; limits?: Record<string, number> };

  const data: { bowlBasePrice?: number; bowlStepLimits?: Record<string, number> } = {};

  if (body.basePrice !== undefined) {
    const p = Math.round(Number(body.basePrice));
    if (!Number.isFinite(p) || p < 0 || p > 5000) {
      return NextResponse.json({ error: "ราคาฐานต้องอยู่ระหว่าง 0–5000 บาท" }, { status: 400 });
    }
    data.bowlBasePrice = p;
  }

  if (body.limits !== undefined) {
    const limits: Record<string, number> = {};
    for (const s of BOWL_STEPS) {
      const raw = body.limits[s.key];
      if (raw === undefined) continue;
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n) || n < 1 || n > 9) {
        return NextResponse.json({ error: `เพดานของ ${s.title} ต้องอยู่ระหว่าง 1–9 ที่` }, { status: 400 });
      }
      limits[s.key] = n;
    }
    data.bowlStepLimits = limits;
  }

  const s = await prisma.systemSetting.upsert({
    where: { id: "system" },
    update: data,
    create: { id: "system", ...data },
  });

  return NextResponse.json({
    basePrice: s.bowlBasePrice,
    steps: resolveStepLimits(s.bowlStepLimits),
  });
}
