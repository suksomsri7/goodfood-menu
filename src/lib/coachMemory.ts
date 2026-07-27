/**
 * Coach Memory (สาย P) — จำพฤติกรรม/ข้อจำกัด/ความชอบเฉพาะตัวของ user
 * ใช้เป็น context ทุกครั้งที่วางแผน + ตอบคำถาม (ข้อ 3+4 ของ user)
 */
import { prisma } from "@/lib/prisma";

export type MemoryKind =
  | "preference"
  | "pattern"
  | "constraint"
  | "goal_note"
  | "dislike"
  | "injury"
  | "schedule"
  | "context";

export type MemoryProposal = { kind: MemoryKind; fact: string; source?: string; confidence?: number };

/** ดึง memory ที่ active เรียงตาม confidence — ใช้ยัดเข้า context */
export async function getMemories(memberId: string, max = 30) {
  return prisma.coachMemory.findMany({
    where: { memberId, active: true },
    orderBy: [{ confidence: "desc" }, { lastSeenAt: "desc" }],
    take: max,
  });
}

/** สรุป memory เป็น bullet ภาษาไทยสำหรับ prompt */
export async function memoriesAsText(memberId: string): Promise<string> {
  const mems = await getMemories(memberId);
  if (!mems.length) return "(ยังไม่มีข้อมูลเฉพาะตัว)";
  const label: Record<string, string> = {
    preference: "ชอบ",
    dislike: "ไม่ชอบ/เลี่ยง",
    constraint: "ข้อจำกัด",
    injury: "อาการบาดเจ็บ",
    schedule: "ตารางชีวิต",
    pattern: "พฤติกรรม",
    goal_note: "โน้ตเป้าหมาย",
    context: "บริบท",
  };
  return mems.map((m) => `- [${label[m.kind] || m.kind}] ${m.fact}`).join("\n");
}

/** upsert memory — dedup ต่อ fact (case-insensitive), เจอซ้ำ → เด้ง confidence + lastSeenAt */
export async function upsertMemory(memberId: string, p: MemoryProposal) {
  const fact = p.fact.trim();
  if (!fact) return null;
  const existing = await prisma.coachMemory.findFirst({
    where: { memberId, fact: { equals: fact, mode: "insensitive" } },
  });
  if (existing) {
    return prisma.coachMemory.update({
      where: { id: existing.id },
      data: {
        active: true,
        lastSeenAt: new Date(),
        confidence: Math.min(1, existing.confidence + 0.1),
        kind: p.kind,
      },
    });
  }
  return prisma.coachMemory.create({
    data: {
      memberId,
      kind: p.kind,
      fact,
      source: p.source || "chat",
      confidence: p.confidence ?? 0.6,
    },
  });
}

export async function upsertMemories(memberId: string, proposals: MemoryProposal[]) {
  const out = [];
  for (const p of proposals) out.push(await upsertMemory(memberId, p));
  return out.filter(Boolean);
}

/** user ลบ/ปิด memory (privacy) */
export async function deactivateMemory(memberId: string, id: string) {
  return prisma.coachMemory.updateMany({ where: { id, memberId }, data: { active: false } });
}

/** confidence decay สำหรับ pattern ที่ไม่เจอนาน (เรียกจาก cron สาย P) */
export async function decayStale(memberId: string, olderThanDays = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 3600 * 1000);
  await prisma.coachMemory.updateMany({
    where: { memberId, source: "log_pattern", lastSeenAt: { lt: cutoff }, active: true },
    data: { confidence: { decrement: 0.2 } },
  });
  await prisma.coachMemory.updateMany({
    where: { memberId, confidence: { lte: 0.1 }, active: true },
    data: { active: false },
  });
}
