/** ตัวช่วยฟอร์มท่าออกกำลังกายฝั่งแอดมิน — แชร์ระหว่าง POST /api/exercises และ PUT /api/exercises/[id] */
import { uploadMultipleToBunny, isBase64Image } from "@/lib/bunny";

const KINDS = ["cardio", "strength", "mobility"];
const TIERS = ["none", "home", "gym"];
const UNITS = ["reps", "minutes"];

/** แปลง+ตรวจ field ที่แอดมินกรอก — ใช้ร่วมกันทั้ง POST และ PUT */
export function exerciseFields(b: any) {
  const name = String(b.name || "").trim();
  if (!name) return { error: "ต้องมีชื่อท่า" };
  const met = Number(b.met);
  return {
    data: {
      name,
      kind: KINDS.includes(b.kind) ? b.kind : "strength",
      equipment: TIERS.includes(b.equipment) ? b.equipment : "none",
      impact: b.impact === "high" ? "high" : "low",
      unit: UNITS.includes(b.unit) ? b.unit : "reps",
      // MET เพี้ยน = แคลอรี่ทุกครั้งที่ user ติ๊กท่านี้เพี้ยนตาม — คุมช่วงตามตาราง Compendium (เดิน 2 → วิ่งเร็ว 12)
      met: Number.isFinite(met) ? Math.min(15, Math.max(1, met)) : 4,
      muscles: String(b.muscles || "").trim() || null,
      cue: String(b.cue || "").trim() || null,
      videoUrl: String(b.videoUrl || "").trim() || null,
      isActive: b.isActive !== false,
    },
  };
}

/** รูป: รับได้ทั้ง URL เดิมและ base64 ใหม่ (อัปโหลดให้) — จำกัด 6 รูปเท่าเมนูอาหาร */
export async function resolveImages(images: unknown): Promise<string[]> {
  if (!Array.isArray(images)) return [];
  const list = images.filter((x): x is string => typeof x === "string").slice(0, 6);
  const base64 = list.filter((x) => isBase64Image(x));
  const urls = list.filter((x) => !isBase64Image(x));
  const uploaded = base64.length ? await uploadMultipleToBunny(base64, "exercises") : [];
  return [...urls, ...uploaded];
}

