import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";
import { bkkTodayKey } from "@/lib/planGenerator";

/**
 * บันทึกการนอนด้วยมือจากแอป (แตะวงแหวน "การนอน" → กรอกเวลานอน/เวลาตื่น)
 * POST { bedTime:"HH:MM", wakeTime:"HH:MM", date?:"YYYY-MM-DD" } (Bearer)
 *   date = วันที่ตื่น ตามเวลาไทย (ไม่ส่ง = วันนี้) · ข้ามเที่ยงคืนคำนวณให้เอง
 *   หรือส่ง { minutes } ตรง ๆ ก็ได้
 * → { ok, minutes }
 *
 * source = "manual" แยกจาก healthkit/voice · initial-data เอา max ของ source (ไม่บวกกัน)
 */
export async function POST(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { bedTime, wakeTime, date, minutes: rawMinutes } = await req.json();

    let minutes: number;
    if (Number.isFinite(Number(rawMinutes))) {
      minutes = Math.round(Number(rawMinutes));
    } else {
      const hm = (v: unknown) => {
        if (typeof v !== "string" || !/^\d{1,2}:\d{2}$/.test(v.trim())) return null;
        const [h, m] = v.trim().split(":").map(Number);
        if (h > 23 || m > 59) return null;
        return h * 60 + m;
      };
      const bed = hm(bedTime);
      const wake = hm(wakeTime);
      if (bed === null || wake === null) {
        return NextResponse.json({ error: "ต้องส่ง bedTime/wakeTime เป็น HH:MM" }, { status: 400 });
      }
      minutes = wake - bed;
      if (minutes <= 0) minutes += 24 * 60; // เข้านอนก่อนเที่ยงคืน ตื่นวันรุ่งขึ้น
    }
    if (minutes <= 0 || minutes > 24 * 60) {
      return NextResponse.json({ error: "ระยะเวลานอนไม่ถูกต้อง" }, { status: 400 });
    }

    // วันที่ตื่น (BKK) — ไม่รับวันอนาคต/เก่ากว่า 14 วัน
    const today = bkkTodayKey();
    let key = today;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const asked = new Date(`${date}T00:00:00.000Z`);
      const ageDays = (today.getTime() - asked.getTime()) / 86400000;
      // asked เป็น UTC midnight อยู่แล้ว = รูปแบบเดียวกับ bkkDateKey (วัน BKK)
      if (!isNaN(asked.getTime()) && ageDays >= 0 && ageDays <= 14) key = asked;
    }

    await prisma.sleepLog.upsert({
      where: { memberId_date_source: { memberId: member.id, date: key, source: "manual" } },
      update: { minutesAsleep: minutes },
      create: { memberId: member.id, date: key, minutesAsleep: minutes, source: "manual" },
    });

    return NextResponse.json({ ok: true, minutes, date: key.toISOString().slice(0, 10) });
  } catch (e: any) {
    console.error("[coach/sleep]", e);
    return NextResponse.json({ error: e.message || "save failed" }, { status: 500 });
  }
}
