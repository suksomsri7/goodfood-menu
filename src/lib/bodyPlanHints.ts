/**
 * สัญญาณร่างกาย → การกระทำในแผนสัปดาห์ (WO-BP-3 §B6 ฝั่ง Generator)
 *
 * แยกออกมาเป็นไฟล์ pure เพราะนี่คือจุดที่ "สัญญาณ" กลายเป็น "ท่าที่ user ต้องทำจริง"
 * ต้องเทสได้ว่าใส่ท่าเพิ่มถูกวัน ถูกเงื่อนไข และไม่ไปทับของเดิม โดยไม่ต้องมี DB/AI
 *
 * 🔴 ตำแหน่งการเรียกในสายการผลิตแผน: หลังจากเลือก/จับท่าเข้าคลังแล้ว และ "ก่อน" enforceAvoid
 *    - ก่อน enforceAvoid: ท่าที่เราเพิ่มต้องผ่านด่านข้อห้าม (เข่า/ไหล่/บาดเจ็บ) เหมือนท่าอื่นทุกท่า
 *      ถ้าเสียบหลังด่าน เราจะเป็นทางเดียวในระบบที่ยัดท่าให้คนที่ห้ามทำท่านั้นได้
 *    - ก่อน applyProgression: ตัวเลข (เซ็ต/น้ำหนัก) ต้องถูกคิดจากรายการท่าชุดสุดท้าย
 */
import type { CatalogExercise } from "@/lib/exerciseCatalog";
import type { DayPlan, ExercisePlanItem } from "@/lib/planGenerator";
import type { BodySignal } from "@/lib/bodySignals";

export interface BodyPlanHints {
  /** imbalance → ต้องมีท่าฝึกทีละข้างอย่างน้อย 1 ท่าในสัปดาห์ */
  unilateral: boolean;
  /** posture → ต่อท้ายวันเทรนด้วยยืดเหยียด 5 นาที (ไม่บังคับ) */
  mobility: boolean;
  /** recomp กำลังเวิร์ก → อย่าเปลี่ยนอะไร */
  keepProgram: boolean;
  /** ลงเร็วเกิน + แรงตก → ลดปริมาณเวทลง 1 ระดับ */
  volumeDown: boolean;
}

export const MOBILITY_MINUTES = 5;
export const MOBILITY_NOTE = "ข้อสังเกต posture — ไม่บังคับ ทำเท่าที่สบายครับ";
/** เซ็ตต่ำสุดหลังลดปริมาณ — ต่ำกว่านี้ไม่พอกระตุ้นให้รักษากล้ามไว้ตอนแคลอรี่ต่ำ */
export const MIN_SETS_AFTER_CUT = 2;

/**
 * ท่าที่ฝึกทีละข้าง — คลังปัจจุบันไม่มีคำว่า "single/unilateral" ในชื่อเลย
 * จึงต้องมีรายชื่อ key ที่รู้จักไว้ตรง ๆ คู่กับ regex สำหรับท่าที่เพิ่มเข้าคลังภายหลัง
 */
const UNILATERAL_KEYS = ["lunge", "step_up", "split_squat", "bulgarian_split", "single_leg_rdl", "side_plank", "bird_dog"];
const UNILATERAL_RE = /single|unilateral|split|lunge|step[_\s-]?up|ข้างเดียว|ขาเดียว|แขนเดียว|ทีละข้าง|ลันจ์|สเต็ปอัพ/i;
/** เรียงตามความตรงประเด็นกับ imbalance ขา (ต้นขา/น่องคือจุดที่ตัววัดจับความต่างได้) */
const UNILATERAL_PREFERENCE = ["lunge", "step_up", "split_squat", "bulgarian_split", "single_leg_rdl"];

export function isUnilateral(e: { key?: string; name?: string }): boolean {
  const key = String(e.key ?? "");
  if (UNILATERAL_KEYS.includes(key)) return true;
  return UNILATERAL_RE.test(key) || UNILATERAL_RE.test(String(e.name ?? ""));
}

const isMobilityItem = (it: ExercisePlanItem): boolean =>
  /ยืด|โยคะ|stretch|mobility|คูลดาวน์/i.test(`${it.key ?? ""} ${it.name ?? ""}`);

/** แปลงสัญญาณเป็น hint — สัญญาณที่ไม่มี = hint ปิด (ไม่ใช่เปิดไว้ก่อน) */
export function bodyHintsFromSignals(signals: BodySignal[] | null | undefined): BodyPlanHints {
  const has = (k: string) => Array.isArray(signals) && signals.some((s) => s.key === k);
  return {
    unilateral: has("imbalance"),
    mobility: has("posture_note"),
    keepProgram: has("recomp_working"),
    volumeDown: has("losing_too_fast"),
  };
}

export interface ApplyHintsResult {
  days: DayPlan[];
  /** สิ่งที่ทำจริง — ใช้ log และให้ QC ตรวจได้ว่า hint ลงมือแล้วหรือแค่ตั้งใจ */
  applied: string[];
}

/**
 * เสียบ hint ลงแผน 7 วัน (คืนก้อนใหม่เสมอ ไม่แก้ของเดิมในที่)
 *
 * keepProgram: ปัจจุบันเป็น no-op โดยตั้งใจ — สายการผลิตแผนยังไม่มีกลไก "สลับท่าประจำสัปดาห์"
 * ให้ข้าม (ensureVariety = เติมท่าที่ขาด ไม่ใช่การสลับ) จึงไม่มีอะไรให้หยุด
 * สัญญาณนี้ยังถึง user ผ่านบริบทของโค้ช ("ที่ทำอยู่ได้ผล อย่าเพิ่งเปลี่ยน")
 */
export function applyBodyHints(
  days: DayPlan[],
  hints: BodyPlanHints,
  pool: CatalogExercise[]
): ApplyHintsResult {
  const applied: string[] = [];
  let out = days.map((d) => ({
    ...d,
    exercisePlan: { ...d.exercisePlan, items: d.exercisePlan.items.map((it) => ({ ...it })) },
  }));

  const trainingDayIdx = out
    .map((d, i) => ({ i, n: d.exercisePlan.items.length }))
    .filter((x) => x.n > 0)
    .map((x) => x.i);

  // ── 1) ท่าฝึกทีละข้าง (imbalance) ──
  if (hints.unilateral && trainingDayIdx.length) {
    const already = out.some((d) => d.exercisePlan.items.some((it) => isUnilateral(it)));
    if (!already) {
      const pick =
        UNILATERAL_PREFERENCE.map((k) => pool.find((e) => e.key === k)).find(Boolean) ??
        pool.find((e) => isUnilateral(e)) ??
        null;
      if (pick) {
        // วันเทรนที่มีท่ากำลังมากที่สุด = วันที่ท่านี้เข้ากับบริบทที่สุด (ไม่ไปโผล่ในวันคาร์ดิโอล้วน)
        const target =
          trainingDayIdx
            .map((i) => ({ i, strength: out[i].exercisePlan.items.filter((it) => it.sets != null).length }))
            .sort((a, b) => b.strength - a.strength)[0]?.i ?? trainingDayIdx[0];
        const item: ExercisePlanItem = {
          key: pick.key,
          name: pick.name,
          ...(pick.media ? { media: pick.media } : {}),
          ...(pick.unit === "reps" ? { sets: 3, reps: 10 } : { minutes: 5 }),
          note: "ทำทีละข้าง ข้างละเท่ากัน — ช่วยให้สองข้างสมดุลขึ้น",
        };
        out[target].exercisePlan.items.push(item);
        applied.push(`unilateral:${pick.key}@d${target}`);
      }
    } else {
      applied.push("unilateral:already");
    }
  }

  // ── 2) ยืดเหยียดท้ายวันเทรน (posture) ──
  if (hints.mobility) {
    const stretch = pool.find((e) => e.key === "stretch_full") ?? pool.find((e) => e.kind === "mobility") ?? null;
    if (stretch) {
      for (const i of trainingDayIdx) {
        if (out[i].exercisePlan.items.some(isMobilityItem)) continue;
        out[i].exercisePlan.items.push({
          key: stretch.key,
          name: stretch.name,
          minutes: MOBILITY_MINUTES,
          note: MOBILITY_NOTE,
        });
        out[i].exercisePlan.durationMin = (out[i].exercisePlan.durationMin ?? 0) + MOBILITY_MINUTES;
        applied.push(`mobility@d${i}`);
      }
    }
  }

  // ── 3) ลดปริมาณเวท 1 ระดับ (ลงเร็วเกิน + แรงตก) ──
  if (hints.volumeDown) {
    let cut = 0;
    out = out.map((d) => ({
      ...d,
      exercisePlan: {
        ...d.exercisePlan,
        items: d.exercisePlan.items.map((it) => {
          if (it.sets == null || it.sets <= MIN_SETS_AFTER_CUT) return it;
          cut++;
          return {
            ...it,
            sets: it.sets - 1,
            note: it.note
              ? `${it.note} · ลด 1 เซ็ตสัปดาห์นี้เพื่อให้ฟื้นตัวทัน`
              : "ลด 1 เซ็ตสัปดาห์นี้เพื่อให้ฟื้นตัวทัน",
          };
        }),
      },
    }));
    if (cut > 0) applied.push(`volumeDown:${cut}`);
  }

  return { days: out, applied };
}
