/**
 * ต่อ engine progression เข้ากับ "แผนสัปดาห์หน้า" (WO-PT-B ข้อ B5)
 *
 * แผนสัปดาห์หน้าไม่ควรถูก generate ใหม่จากศูนย์ทุกครั้ง — ท่าไหนที่ลูกค้าเคยทำจริง
 * ต้องเดินต่อจากตัวเลขของเขาเอง (18 กก. → 20 กก.) ไม่ใช่ให้ AI สุ่มมาใหม่ทุกสัปดาห์
 *
 * 🔴 ตำแหน่งการเรียก: ใน generateWeekPlan ต้องอยู่ "หลัง" snapExercises + enforceAvoid เสมอ
 *    ด่านความปลอดภัย (ข้อห้าม/บาดเจ็บ) ต้องเป็นตัวสุดท้ายที่ตัดสินว่าจะมีท่าอะไรในแผน
 *    ไฟล์นี้จึงแตะแค่ "ตัวเลข" ของท่าที่ผ่านด่านมาแล้ว ไม่เพิ่ม/เปลี่ยน/สลับท่าเอง
 */
import { computeNextForKeys, type NextForKey } from "@/lib/progressionStore";
import { pendingOverrides, markConsumed, type PendingOverrides } from "@/lib/ptOverride";
import { capWeeklyVolume, deloadSets, type Rx } from "@/lib/progression";
import type { DayPlan, ExercisePlanItem } from "@/lib/planGenerator";

/** ข้อความบอกว่าเป็นสัปดาห์พักฟื้น — ไปอยู่ใน aiNote ของทุกวัน */
export const DELOAD_NOTE = "สัปดาห์พักฟื้น — ลดปริมาณลงให้ร่างกายฟื้นตัว แล้วสัปดาห์หน้าค่อยกลับมาเพิ่ม";

/** ตัวเลือกที่ generator ส่งลงมาจาก TrainingProfile (เฟส D) */
export interface ProgressionPlanOpts {
  repRange?: [number, number] | null;
  /**
   * ใบสั่งของโค้ชมนุษย์ที่อ่านมาแล้ว — ส่งเข้ามาเพื่อให้ทั้งสัปดาห์ใช้ชุดเดียวกัน
   * ไม่ส่ง = ไฟล์นี้ไปอ่านเอง (ทางเรียกเดี่ยว ๆ ยังทำงานถูก)
   */
  overrides?: PendingOverrides;
}

/**
 * ข้อความบอกลูกค้าว่าเลขนี้มาจากคน ไม่ใช่สูตร — ต้องเห็นในแอป ไม่ใช่รู้กันแค่หลังบ้าน
 * 🔴 ต้อง "แทนที่" เหตุผลเดิมของ engine ไม่ใช่ต่อท้าย — เหตุผลเดิมพูดถึงน้ำหนักที่ไม่ได้ใช้แล้ว
 *    ("ลดเหลือ 30 กก." ทั้งที่ใบสั่งเป็น 42.5) เอามาต่อกันตรง ๆ = ลูกค้าอ่านแล้วไม่รู้จะเชื่อเลขไหน
 *    เลขเดิมยังมีค่าอยู่ จึงเก็บไว้ในวงเล็บว่า "ระบบเสนอไว้เท่าไร"
 */
export const COACH_SET_NOTE = (kg: number, engineKg?: number | null) =>
  engineKg != null && engineKg !== kg
    ? `โค้ชตั้งน้ำหนักให้เอง ${kg} กก. (ระบบเสนอไว้ ${engineKg} กก.)`
    : `โค้ชตั้งน้ำหนักให้เอง ${kg} กก.`;
export const COACH_DELOAD_NOTE = "โค้ชสั่งให้สัปดาห์นี้เป็นสัปดาห์พักฟื้น";

export interface ApplyProgressionResult {
  items: ExercisePlanItem[];
  /** จำนวนท่าที่ถูกเขียนทับด้วยตัวเลขจาก engine */
  applied: number;
  /** ทั้งสัปดาห์เป็นสัปดาห์พักฟื้นหรือไม่ */
  deloadWeek: boolean;
  /** จำนวน pattern ที่โดนเพดานปริมาณ +10% ตัดลง */
  capped: number;
}

/**
 * เขียนตัวเลขจาก Rx ลง item (ไม่แตะ key/name/media — ท่าถูกเลือกและกรองข้อห้ามมาแล้ว)
 * ท่าคาร์ดิโอเดิมในแผนไม่มี field sets (มีแต่ minutes) → ห้ามยัด "1 เซ็ต" เข้าไปให้จอโชว์แปลก ๆ
 */
function mergeRx(item: ExercisePlanItem, rx: Rx): ExercisePlanItem {
  const setless = item.sets == null && rx.sets <= 1;
  const out: ExercisePlanItem = { ...item, rxReason: rx.reason };
  if (!setless) out.sets = rx.sets;
  if (rx.weightKg != null) out.weightKg = rx.weightKg;
  if (rx.reps != null) out.reps = rx.reps;
  if (rx.seconds != null) {
    out.seconds = rx.seconds;
    // จอ/แคลอรี่เดิมอ่าน minutes — เก็บทั้งคู่ให้ตรงกัน (อย่างน้อย 1 นาที ไม่งั้นแผนโชว์ 0)
    out.minutes = Math.max(1, Math.round((rx.seconds * (setless ? 1 : rx.sets)) / 60));
  }
  if (rx.deload) out.deload = true;
  return out;
}

/**
 * applyProgression(memberId, items) — items คือ "ท่าทั้งสัปดาห์" (แผน 7 วันแบนเป็นลิสต์เดียว)
 * ท่าไหนมีข้อมูลจริง (next ≠ null) เขียนทับ sets/reps/weightKg/minutes + แนบ rxReason
 * ท่าใหม่ที่ยังไม่เคยทำ = ปล่อยตามแผน (ห้ามเดาน้ำหนักให้คนที่ไม่เคยยก)
 */
export async function applyProgression(
  memberId: string,
  items: ExercisePlanItem[],
  /** เฟส D: ช่วงครั้งของสัปดาห์นี้จาก TrainingProfile — ไม่ส่ง = ค่าปริยายเดิม (v1 คือ [8,12] ทุกคน) */
  opts: ProgressionPlanOpts = {}
): Promise<ApplyProgressionResult> {
  const keys = [...new Set(items.map((i) => i.key).filter((k): k is string => !!k))];
  if (!keys.length) return { items, applied: 0, deloadWeek: false, capped: 0 };

  const nexts = await computeNextForKeys(memberId, keys, new Date(), { repRange: opts.repRange ?? null });
  const ov = opts.overrides ?? (await pendingOverrides(memberId));

  // ── สัปดาห์พักฟื้นทั้งสัปดาห์: ท่าที่ใส่น้ำหนักได้ติด deload ตั้งแต่ครึ่งหนึ่งขึ้นไป ──
  const loadable = keys
    .map((k) => nexts.get(k))
    .filter((n): n is NextForKey => !!n && n.mode === "loadable" && !!n.next);
  const deloadHits = loadable.filter((n) => n.next?.deload).length;
  // โค้ชสั่งพักฟื้น = พักฟื้น ไม่ต้องรอให้ครึ่งหนึ่งของท่าติดเงื่อนไขเอง
  const deloadWeek = ov.forceDeload || (loadable.length > 0 && deloadHits * 2 >= loadable.length);

  let applied = 0;
  let out = items.map((item) => {
    const rx = item.key ? nexts.get(item.key)?.next : null;
    if (!rx) return { ...item };
    applied++;
    return mergeRx(item, rx);
  });

  // ทั้งสัปดาห์พักฟื้น = ทุกท่าลดปริมาณ 40% (รวมท่าที่ยังไม่มีข้อมูลของตัวเอง)
  if (deloadWeek) {
    const note = ov.forceDeload ? `${COACH_DELOAD_NOTE} — ${DELOAD_NOTE}` : DELOAD_NOTE;
    out = out.map((item) => {
      const next: ExercisePlanItem = {
        ...item,
        deload: true,
        rxReason: item.rxReason ? `${item.rxReason} · ${note}` : note,
      };
      // ท่านับเซ็ต → ตัดเซ็ต · ท่าที่วัดเป็นนาที (เดิน/คาร์ดิโอ) → ตัดนาทีด้วยสูตรเดียวกัน อย่างน้อย 5 นาที
      if (item.sets != null) next.sets = deloadSets(item.sets);
      else if (item.minutes != null) next.minutes = Math.max(5, deloadSets(item.minutes));
      return next;
    });
  }

  // ── เพดานความปลอดภัย: ปริมาณรวมต่อ pattern ต่อสัปดาห์ เพิ่มได้ ≤ +10% ──
  // เทียบยอดทั้งสัปดาห์กับยอดทั้งสัปดาห์ที่ทำจริงรอบล่าสุด (ท่าตัวเปล่าไม่มีน้ำหนัก = ไม่เข้าเพดาน)
  const patterns = new Map<string, { idx: number[]; base: number }>();
  for (let i = 0; i < out.length; i++) {
    const key = out[i].key;
    const info = key ? nexts.get(key) : undefined;
    const pattern = info?.pattern;
    if (!pattern) continue;
    const bucket = patterns.get(pattern) ?? { idx: [], base: 0 };
    bucket.idx.push(i);
    patterns.set(pattern, bucket);
  }
  // ยอดจริงสัปดาห์ล่าสุดนับ "ต่อท่า" ครั้งเดียว แม้ท่านั้นจะโผล่ในแผนหลายวัน
  for (const key of keys) {
    const info = nexts.get(key);
    if (!info?.pattern || !info.lastWeekVolume) continue;
    const bucket = patterns.get(info.pattern);
    if (bucket) bucket.base += info.lastWeekVolume;
  }

  let capped = 0;
  for (const [, bucket] of patterns) {
    if (!(bucket.base > 0)) continue; // ไม่มีฐานเทียบ (สัปดาห์แรก) → ไม่คุม
    const rxList: Rx[] = bucket.idx.map((i) => ({
      sets: out[i].sets ?? 3,
      reps: out[i].reps,
      weightKg: out[i].weightKg,
      reason: out[i].rxReason ?? "",
    }));
    const res = capWeeklyVolume(bucket.base, rxList);
    if (!res.capped) continue;
    capped++;
    bucket.idx.forEach((itemIdx, j) => {
      out[itemIdx] = { ...out[itemIdx], sets: res.rx[j].sets, reps: res.rx[j].reps ?? out[itemIdx].reps };
      if (res.rx[j].reason) out[itemIdx].rxReason = res.rx[j].reason;
    });
  }

  /* ── ใบสั่งน้ำหนักของโค้ชมนุษย์: ทับเป็นตัวสุดท้าย ──────────────────────────
     วางไว้หลังเพดานปริมาณโดยตั้งใจ — เพดาน +10% เป็นกติกาที่ engine ใช้กันตัวเองเร่งเกิน
     แต่คนที่ดูลูกค้าอยู่ตรงหน้าต้องสั่งทับได้ (ไม่งั้นปุ่มนี้ก็หลอกแอดมินว่าสั่งแล้ว)
     ทับเฉพาะ "น้ำหนัก" · จำนวนเซ็ต/ครั้งยังเดินตามเพดานเดิม และไม่แตะท่าที่ไม่ได้สั่ง */
  if (ov.weightByKey.size) {
    out = out.map((item) => {
      const kg = item.key ? ov.weightByKey.get(item.key) : undefined;
      if (kg == null) return item;
      return { ...item, weightKg: kg, rxReason: COACH_SET_NOTE(kg, item.weightKg ?? null) };
    });
  }
  // ปั๊มว่าใช้แล้วเฉพาะตอนที่ไฟล์นี้อ่านเอง — ถ้าตัวเรียกส่งเข้ามา แปลว่าเขาคุมรอบชีวิตของใบสั่งเอง
  if (!opts.overrides) await markConsumed(ov.ids);

  return { items: out, applied, deloadWeek, capped };
}

/**
 * เวอร์ชันที่ planGenerator ใช้ — รับแผนทั้งสัปดาห์ (7 วัน) คิดรวมทีเดียว
 * (ต้องคิดรวมเพราะกติกา "สัปดาห์พักฟื้น" กับ "เพดานปริมาณต่อสัปดาห์" ตัดสินจากทั้งสัปดาห์ ไม่ใช่รายวัน)
 */
export async function applyProgressionToWeek(
  memberId: string,
  days: DayPlan[],
  opts: ProgressionPlanOpts = {}
): Promise<{ days: DayPlan[]; applied: number; deloadWeek: boolean; capped: number }> {
  const flat: ExercisePlanItem[] = [];
  const spans: { start: number; count: number }[] = [];
  for (const d of days) {
    const items = d.exercisePlan.items ?? [];
    spans.push({ start: flat.length, count: items.length });
    flat.push(...items);
  }
  if (!flat.length) return { days, applied: 0, deloadWeek: false, capped: 0 };

  // อ่านใบสั่งของโค้ชครั้งเดียวต่อ 1 สัปดาห์ แล้วค่อยปั๊มว่าใช้แล้วตอนท้าย
  // (ปล่อยให้ applyProgression อ่านเอง = ใบสั่งถูกปั๊มทิ้งตั้งแต่วันแรกของสัปดาห์)
  const ov = opts.overrides ?? (await pendingOverrides(memberId));
  const res = await applyProgression(memberId, flat, { ...opts, overrides: ov });

  const out = days.map((d, i) => {
    const span = spans[i];
    const items = res.items.slice(span.start, span.start + span.count);
    return {
      ...d,
      exercisePlan: { ...d.exercisePlan, items },
      aiNote: res.deloadWeek ? (d.aiNote ? `${DELOAD_NOTE} · ${d.aiNote}` : DELOAD_NOTE) : d.aiNote,
    };
  });

  if (!opts.overrides) await markConsumed(ov.ids);

  return { days: out, applied: res.applied, deloadWeek: res.deloadWeek, capped: res.capped };
}
