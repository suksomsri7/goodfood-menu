import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMember, coachActive } from "@/lib/coachResolve";
import { upsertMemories } from "@/lib/coachMemory";
import { syncInjuryMemoryToLimitation } from "@/lib/trainingProfileStore";
import { bkkDateKey, bkkTodayKey } from "@/lib/planGenerator";
import { resolveLogTime } from "@/lib/coachLogTime";
import { adjustTodayWorkout } from "@/lib/workoutAdjustStore";

/**
 * execute action ที่ user ยืนยันแล้ว (มาจาก /api/coach/agent)
 * POST { actions:[{tool,args}], acceptMemory?:[{kind,fact}], lineUserId? } (+ Bearer)
 *  → { done:[...], memorySaved }
 */

/** ที่มาของ MealLog ที่ยอมรับ (ค่าอื่นถือว่าเสียงพูด) — ตรงกับคอมเมนต์ใน schema.prisma */
/* "program" = กดปุ่ม "ทาน" จากกล่องปิ่นโตในหน้าโภชนาการ — ต้องแยกจาก manual
   เพราะหน้านั้นใช้หาว่า "มื้อนี้ทานไปหรือยัง" แล้วสลับปุ่มเป็น "ทานแล้ว" */
const VIA_KINDS = ["photo", "barcode", "voice", "manual", "program"];

// เวลาที่ user บอกมาเอง (time/date เวลาไทย) → Date จริง — ใช้ตัวเดียวกับ /api/coach/update-entry

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const member = await resolveMember(req);
    if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!coachActive(member)) return NextResponse.json({ error: "locked" }, { status: 403 });

    const actions: Array<{ tool: string; args: any }> = (Array.isArray(body.actions) ? body.actions : []).slice(0, 20);
    const done: string[] = [];
    /** เรื่องที่ทำไม่ได้/ไม่มีอะไรให้ทำ — ต้องบอก user ตรง ๆ ไม่ใช่เงียบแล้วปล่อยให้เข้าใจว่าสำเร็จ */
    const notes: string[] = [];
    // clamp กันค่าเพี้ยน/ติดลบ/มหาศาล (NaN → 0)
    const num = (v: any, max: number) => Math.min(max, Math.max(0, Number(v) || 0));

    for (const a of actions) {
      const g = a.args || {};
      const at = resolveLogTime(g); // เวลาที่ user บอกเอง (ถ้ามี)
      if (a.tool === "log_meal") {
        // ปริมาณที่ตกลงกัน ("3 ไม้", "แก้วกลาง") ต่อท้ายชื่อ → ไทม์ไลน์อ่านแล้วรู้ว่าบันทึกเท่าไร
        const baseName = String(g.name || "อาหาร").trim();
        const portion = typeof g.portion === "string" ? g.portion.trim() : "";
        const fullName = portion && !baseName.includes(portion) ? `${baseName} ${portion}` : baseName;
        await prisma.mealLog.create({
          data: {
            memberId: member.id,
            name: fullName.slice(0, 120),
            weight: g.weight != null ? num(g.weight, 5000) : null,
            calories: num(g.calories, 6000),
            protein: num(g.protein, 500),
            carbs: num(g.carbs, 1000),
            fat: num(g.fat, 500),
            sodium: g.sodium != null ? num(g.sodium, 20000) : null,
            sugar: g.sugar != null ? num(g.sugar, 1000) : null,
            ingredients: g.ingredients ?? null,
            imageUrl:
              // 🔴 ห้ามมี ".." — regex เดิม ([\w\-./]) ปล่อย /uploads/../ ผ่านได้ (path traversal ในค่าที่เก็บ)
              typeof g.imageUrl === "string" && /^\/uploads\/[\w\-./]+$/.test(g.imageUrl) && !g.imageUrl.includes("..")
                ? g.imageUrl
                : null,
            // WO-B: หน้ากรอกเองส่ง via="manual" มา · ทางเสียง/AI ไม่ส่งอะไร → "voice" เหมือนเดิม
            via: VIA_KINDS.includes(g.via) ? g.via : "voice",
            ...(at ? { date: at } : {}),
          },
        });
        done.push("log_meal");
      } else if (a.tool === "log_water") {
        await prisma.waterLog.create({
          data: { memberId: member.id, amount: num(g.amount, 5000), ...(at ? { date: at } : {}) },
        });
        done.push("log_water");
      } else if (a.tool === "log_exercise") {
        await prisma.exerciseLog.create({
          data: {
            memberId: member.id,
            name: String(g.name || "ออกกำลังกาย").slice(0, 120),
            type: g.type ?? null,
            duration: num(g.duration, 1440),
            calories: num(g.calories, 6000),
            intensity: g.intensity ?? null,
            source: "manual",
            ...(at ? { date: at } : {}),
          },
        });
        done.push("log_exercise");
      } else if (a.tool === "log_sleep") {
        // นอน: คีย์เป็น "วันที่ตื่น" (BKK) · source=voice แยกจาก healthkit กันทับกัน
        const minutes = Math.round(num(g.minutes, 1440));
        if (minutes > 0) {
          // ไม่เชื่อวันที่จาก AI ตรง ๆ — เคยเดาย้อนไป 2 วัน · อนาคต/เก่ากว่า 14 วัน = ใช้วันนี้แทน
          const today = bkkTodayKey();
          let date = today;
          if (typeof g.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) {
            const asked = bkkDateKey(new Date(`${g.date}T00:00:00.000Z`));
            const ageDays = (today.getTime() - asked.getTime()) / 86400000;
            if (!isNaN(asked.getTime()) && ageDays >= 0 && ageDays <= 14) date = asked;
          }
          {
            await prisma.sleepLog.upsert({
              where: { memberId_date_source: { memberId: member.id, date, source: "voice" } },
              update: { minutesAsleep: minutes },
              create: { memberId: member.id, date, minutesAsleep: minutes, source: "voice" },
            });
            done.push("log_sleep");
          }
        }
      } else if (a.tool === "set_equipment") {
        // user บอกด้วยเสียงว่ามีอุปกรณ์อะไร → มีผลกับท่าในแผนรอบถัดไป
        const eq = String(g.equipment || "");
        if (["none", "home", "gym"].includes(eq)) {
          await prisma.member.update({ where: { id: member.id }, data: { equipment: eq } });
          done.push("set_equipment");
        }
      } else if (a.tool === "adjust_workout") {
        /* PT-E §4.4 — "วันนี้เหลือเวลาแค่ 20 นาที" / "วันนี้ปวดเข่า"
           ผ่าน doConfirm มาแล้วเหมือน action อื่น จึง apply ได้เลย
           ล้มตรงนี้ห้ามทำให้ทั้งชุด action พัง (คนอาจสั่งบันทึกอาหารมาพร้อมกัน) */
        try {
          const mode = g.mode === "sore" ? "sore" : "time";
          const out = await adjustTodayWorkout(
            member.id,
            (member as { equipment?: string | null }).equipment,
            { mode, minutes: Number(g.minutes), area: g.area, apply: true },
            new Date()
          );
          if (out.applied) done.push("adjust_workout");
          else notes.push(out.message);
        } catch (err) {
          console.error("[coach/execute:adjust_workout]", err);
          notes.push("ปรับแผนวันนี้ไม่สำเร็จ ลองบอกโค้ชอีกครั้งนะ");
        }
      } else if (a.tool === "log_weight") {
        const w = Number(g.weight);
        if (Number.isFinite(w) && w > 0 && w <= 500) {
          await prisma.weightLog.create({
            data: {
              memberId: member.id,
              weight: w,
              note: typeof g.note === "string" && g.note.trim() ? g.note.trim().slice(0, 60) : "voice",
              ...(at ? { date: at } : {}),
            },
          });
          done.push("log_weight");
        }
      }
      // "จัดแผนทั้งสัปดาห์ใหม่" ยังไม่เปิดให้สั่งด้วยเสียง (ต้อง regenerate ทั้งชุด) — ข้ามอย่างปลอดภัย
      // ปรับเฉพาะ "วันนี้" ทำได้แล้วที่ adjust_workout ด้านบน
    }

    let memorySaved = 0;
    const VALID_KINDS = ["preference", "pattern", "constraint", "goal_note", "dislike", "injury", "schedule", "context"];
    if (Array.isArray(body.acceptMemory) && body.acceptMemory.length) {
      const clean = body.acceptMemory
        .slice(0, 20)
        .filter((m: any) => VALID_KINDS.includes(m?.kind) && typeof m?.fact === "string" && m.fact.trim())
        .map((m: any) => ({ kind: m.kind, fact: String(m.fact).slice(0, 200), source: "chat" }));
      const saved = await upsertMemories(member.id, clean);
      memorySaved = saved.length;

      /* WO-PT-D §S5 — อาการบาดเจ็บเขียนสองชั้น: CoachMemory (ความจำที่โค้ชเอาไปคุย)
         + InjuryLimitation (ตัวกรองท่าจริงใน generator) เพราะข้อความอิสระกรองท่าไม่ได้
         ล้มตรงนี้ = ความจำยังบันทึกแล้ว ห้ามทำให้ทั้ง request พัง */
      for (const m of clean.filter((x: { kind: string }) => x.kind === "injury")) {
        await syncInjuryMemoryToLimitation(member.id, m.fact);
      }
    }

    return NextResponse.json({ done, memorySaved, ...(notes.length ? { notes } : {}) });
  } catch (e: any) {
    console.error("[coach/execute]", e);
    return NextResponse.json({ error: e.message || "execute failed" }, { status: 500 });
  }
}
