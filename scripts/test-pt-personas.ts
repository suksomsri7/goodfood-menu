/**
 * ทดสอบ "ความเป็น Personal Trainer" ของ engine ด้วยลูกค้าจำลอง 3 คนที่โปรไฟล์ต่างกันสุดขั้ว
 *
 * คำถามที่ตอบ: แผนที่จัดออกมา "ต่างกันตามตัวบุคคล" จริงไหม — วันเทรน/เวลา/อุปกรณ์/อาการบาดเจ็บ/PAR-Q
 * + เช็คอินความพร้อมต่ำแล้วแผนวันนี้ถูกลดจริงไหม + progression ตั้งน้ำหนักครั้งถัดไปจากข้อมูลจริงไหม
 *
 * รัน:  npx tsx scripts/test-pt-personas.ts          (บนโฮสต์ VPS — ใช้ DB จริงผ่าน 127.0.0.1:5437)
 * 🔴 สร้าง member สังเคราะห์ (อีเมล qc-persona-*@test.local) แล้วลบทิ้งตอนจบ — ไม่แตะบัญชีจริง
 * 🔴 ยิง AI จริง 3 ครั้ง (สร้างแผน 3 คน) — อย่ารันวนซ้ำเล่น ๆ
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── โหลด env ก่อน import lib ใด ๆ (prisma อ่าน DATABASE_URL ตอน import) ──
const envFile = readFileSync(join(process.cwd(), ".env.production"), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
// ในไฟล์ชี้ hostname ของ docker network — จากโฮสต์ต้องเข้า port ที่ map ไว้
process.env.DATABASE_URL = "postgresql://goodfood:goodfood_password@127.0.0.1:5437/goodfood_db";

type Persona = {
  tag: string;
  member: Record<string, unknown>;
  profile: Record<string, unknown>;
  equipment?: Record<string, unknown>[];
  injuries?: Record<string, unknown>[];
};

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { generateWeekPlan, bkkTodayKey } = await import("../src/lib/planGenerator");
  const { adjustPlanForReadiness, patternsForSoreAreas, computeReadiness } = await import("../src/lib/readiness");
  const { computeNextForKeys, updateProgressionState } = await import("../src/lib/progressionStore");

  const start = bkkTodayKey();
  const created: string[] = [];

  const base = {
    gender: "male", height: 175, weight: 90, goalWeight: 75, goalType: "lose",
    activityLevel: "sedentary", isOnboarded: true, isActive: true,
    dailyCalories: 1900, dailyProtein: 130, dailyCarbs: 200, dailyFat: 60,
    bmr: 1800, tdee: 2400,
  };

  const personas: Persona[] = [
    {
      tag: "A มือใหม่ลดน้ำหนัก · จ/พ/ศ 30 นาที · ไม่มีอุปกรณ์ · เข่าห้ามกระแทก",
      member: { ...base, email: "qc-persona-a@test.local", name: "A-มือใหม่" },
      profile: {
        primaryGoal: "fat_loss", daysPerWeek: 3, sessionMin: 30,
        trainDays: ["mon", "wed", "fri"], likes: [], dislikes: [],
        calibration: true, calibrationStartedAt: new Date(),
      },
      injuries: [{ area: "knee", severity: "avoid", note: "เข่าเสื่อม ห้ามท่าลงเข่า", active: true }],
    },
    {
      tag: "B สายกล้าม · จ/อ/พฤ/ส 60 นาที · ดัมเบล 2.5-24kg · ประสบการณ์ 2 ปี",
      member: { ...base, email: "qc-persona-b@test.local", name: "B-สายกล้าม", goalType: "gain", weight: 70, goalWeight: 78 },
      profile: {
        primaryGoal: "muscle_gain", style: "hypertrophy", daysPerWeek: 4, sessionMin: 60,
        trainDays: ["mon", "tue", "thu", "sat"], experienceMonths: 24,
        calibration: true, calibrationStartedAt: new Date(),
      },
      equipment: [{ type: "dumbbell", minKg: 2.5, maxKg: 24, incrementKg: 2.5, isPair: true }],
    },
    {
      tag: "C สุขภาพทั่วไป · PAR-Q ติดธง (ยังไม่ผ่านหมอ) · 2 วัน",
      member: { ...base, email: "qc-persona-c@test.local", name: "C-PARQ", goalType: "maintain" },
      profile: {
        primaryGoal: "general", daysPerWeek: 2, sessionMin: 30, trainDays: ["tue", "sat"],
        parq: { q1: true, q2: false, q3: false, answeredAt: new Date().toISOString() },
        parqFlag: true,
        calibration: true, calibrationStartedAt: new Date(),
      },
    },
  ];

  const dayName = (d: Date) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getUTCDay()];

  for (const p of personas) {
    const m = await prisma.member.create({ data: p.member as any });
    created.push(m.id);
    await prisma.trainingProfile.create({ data: { memberId: m.id, ...(p.profile as any) } });
    for (const eq of p.equipment ?? []) await prisma.memberEquipment.create({ data: { memberId: m.id, ...(eq as any) } });
    for (const inj of p.injuries ?? []) await prisma.injuryLimitation.create({ data: { memberId: m.id, ...(inj as any) } });

    console.log(`\n━━━ ${p.tag} ━━━`);
    const t0 = Date.now();
    const res = await generateWeekPlan(m.id, start);
    console.log(`   สร้าง ${res.created} วัน · fallback=${res.usedFallback} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const plans = await prisma.dailyPlan.findMany({ where: { memberId: m.id }, orderBy: { date: "asc" } });
    for (const pl of plans) {
      const ex: any = pl.exercisePlan;
      const items = (ex?.items ?? []) as any[];
      const line = items.map((it) =>
        `${it.name}${it.sets ? ` ${it.sets}x${it.reps ?? (it.minutes ? it.minutes + "นาที" : "?")}` : it.minutes ? ` ${it.minutes}นาที` : ""}${it.weightKg ? ` @${it.weightKg}kg` : ""}`
      ).join(" · ");
      console.log(`   ${dayName(pl.date)} ${String(pl.date.toISOString()).slice(5, 10)} | ${ex?.title ?? "-"} (${ex?.durationMin ?? 0}น.) ${line ? "| " + line : ""}`);
      if (items[0]?.rxReason) console.log(`        เหตุผล: ${items[0].rxReason}`);
    }
  }

  // ── readiness: เช็คอินแย่ + ปวดเข่า → แผน "วันนี้" ของ B ถูกลดยังไง (ฟังก์ชันเดียวกับปุ่ม apply ในแอป) ──
  console.log("\n━━━ เช็คอินความพร้อมต่ำ (นอน 5 ชม. · พลังงาน 2/5 · ปวดเข่า 4/5) → ปรับแผนวันเทรนของ B ━━━");
  const scored = computeReadiness({
    energy: 2, soreness: 4,
    sleep: { minutes: 300, goalMinutes: 480 },
    hrv: null, rhr: null,
  } as any);
  console.log(`   คะแนน ${scored.score} → ช่วง "${scored.band}"`);
  const bPlans = await prisma.dailyPlan.findMany({ where: { memberId: created[1] }, orderBy: { date: "asc" } });
  const trainDay = bPlans.find((pl) => (((pl.exercisePlan as any)?.items ?? []) as any[]).length >= 2);
  if (trainDay) {
    const items = ((trainDay.exercisePlan as any).items ?? []) as any[];
    const exRows = await prisma.exercise.findMany({ select: { key: true, name: true, pattern: true } });
    const byKey = new Map(exRows.map((e) => [e.key, e.pattern]));
    const byName = new Map(exRows.map((e) => [e.name, e.pattern]));
    const patternOf = (it: any) => byKey.get(String(it.key ?? "")) ?? byName.get(String(it.name ?? "")) ?? null;
    // 🔴 signature เป็น positional (items, band, soreAreas, patternOf) — เคยส่งเป็น object แล้วผลหลอกว่า "ไม่ปรับ"
    const adj = adjustPlanForReadiness(items as any, scored.band, ["knee"], patternOf);
    console.log("   ก่อน:", items.map((i: any) => `${i.name} ${i.sets ?? "-"}x${i.reps ?? i.minutes ?? "-"}`).join(" · "));
    console.log("   หลัง:", (adj.items as any[]).map((i: any) => `${i.name} ${i.sets ?? "-"}x${i.reps ?? i.minutes ?? "-"}`).join(" · "));
    for (const i of adj.items as any[]) if (i.readinessNote) console.log(`     → ${i.name}: ${i.readinessNote}`);
  } else {
    console.log("   (B ไม่มีวันเทรนที่มี ≥2 ท่าในสัปดาห์นี้ — ข้าม)");
  }

  // ── progression: B เล่นจริง 1 สัปดาห์ → ระบบตั้งน้ำหนักครั้งถัดไปเองไหม ──
  console.log("\n━━━ B เล่นดัมเบลสควอท 2 เซสชัน (10kg ทำครบเป้า feel=good) → ใบสั่งครั้งถัดไป ━━━");
  const bId = created[1];
  const mkSet = (daysAgo: number, setNo: number) => ({
    memberId: bId, exerciseKey: "db_squat", exerciseName: "ดัมเบลสควอท", setNo,
    targetWeightKg: 10, targetReps: 12, actualWeightKg: 10, actualReps: 12, feel: "good",
    date: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
  });
  await prisma.setLog.createMany({
    data: [mkSet(4, 1), mkSet(4, 2), mkSet(4, 3), mkSet(1, 1), mkSet(1, 2), mkSet(1, 3)],
  });
  await updateProgressionState(bId, "db_squat");
  const next = await computeNextForKeys(bId, ["db_squat"]);
  const nx = next.get("db_squat");
  console.log(`   ใบสั่งถัดไป: ${JSON.stringify(nx?.next)}`);
  console.log(`   (อุปกรณ์ increment 2.5kg → ถ้าขึ้นน้ำหนักต้องเป็น 12.5 ไม่ใช่เลขลอย ๆ)`);

  // ── เก็บกวาด ──
  for (const id of created) await prisma.member.delete({ where: { id } });
  const leftover = await prisma.member.count({ where: { email: { endsWith: "@test.local" } } });
  console.log(`\n🧹 ลบ member สังเคราะห์ ${created.length} คนแล้ว (เหลือค้าง ${leftover})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
