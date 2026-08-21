/**
 * PT-E · ปรับ "แผนของวันนี้" ตามสิ่งที่เพิ่งเกิดกับผู้ใช้ (WO-PT-ENGINE §4.4)
 *
 *   เหลือเวลาแค่ X นาที → ตัดตามลำดับ accessory → เซ็ตท้าย → นาทีคาร์ดิโอ · ท่าหลักของวันอยู่ครบเสมอ
 *   ปวดตรง Y          → หาท่าแทนที่ pattern เดียวกันแต่ไม่กวนจุดนั้น · ไม่มีตัวแทน = ลดปริมาณแทนการตัดทิ้ง
 *
 * 🔴 ไฟล์นี้ต้องบริสุทธิ์: ไม่แตะ prisma / ไม่เรียกเวลาปัจจุบัน / ไม่ยิง AI
 *    (ตาราง exercises อยู่ใน DB → ผู้เรียกฉีด metaOf/pool เข้ามาเอง เหมือน readiness.ts)
 *
 * 🔴 หลักที่ยึด: ระบบต้องไม่ "เงียบ" — ทุกท่าที่โดนแตะได้ adjustNote ภาษาไทยติดไป
 *    และถ้าตัดจนสั้นกว่าที่ขอไม่ได้จริง ต้องบอกตรง ๆ ว่าสั้นสุดได้เท่าไหร่ ไม่ใช่แกล้งบอกว่าทำได้
 */

// ────────────────────────────── ค่าคงที่ของการประมาณเวลา ──────────────────────────────

/** วินาทีต่อ 1 ครั้ง (ยกขึ้น-ลงจังหวะปกติ) — ใช้ประมาณเวลาเท่านั้น ไม่ได้บังคับจังหวะผู้ใช้ */
export const SEC_PER_REP = 4;
/** พักระหว่างเซ็ตโดยประมาณ */
export const REST_SEC = 60;
/** ท่าจับเวลา/คาร์ดิโอ ตัดสั้นสุดได้แค่นี้ (สั้นกว่านี้ไม่เหลือผลการฝึก) */
export const MIN_CARDIO_MIN = 5;
/** เวลาอุ่นเครื่อง+คูลดาวน์ที่กินไปในทุกเซสชัน */
export const OVERHEAD_MIN = 3;

export type Priority = "main" | "secondary" | "accessory";

/** ท่าหนึ่งบรรทัดในแผน (= DailyPlan.exercisePlan.items[]) — เอาเท่าที่ไฟล์นี้ต้องใช้/เขียน */
export interface AdjustPlanItem {
  key?: string;
  name: string;
  sets?: number;
  reps?: number;
  minutes?: number;
  seconds?: number;
  weightKg?: number;
  note?: string;
  /** ทำไมวันนี้ท่านี้ถึงเปลี่ยน — โชว์ใต้ชื่อท่าในแอป (คนละช่องกับ readinessNote เพราะคนละสาเหตุ) */
  adjustNote?: string;
  [k: string]: unknown;
}

/** metadata ของท่าจากตาราง exercises — ผู้เรียกดึงมาให้ (ไฟล์นี้แตะ DB ไม่ได้) */
export interface ExerciseMeta {
  key: string;
  name: string;
  pattern: string | null;
  kind: "cardio" | "strength" | "mobility" | string;
  unit: "reps" | "minutes" | string;
  equipment?: string;
  cue?: string;
  difficulty?: number | null;
}
export type MetaOf = (item: AdjustPlanItem) => ExerciseMeta | null;

// ────────────────────────────── 1. ประมาณเวลาที่เซสชันกินจริง ──────────────────────────────

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const setsOf = (it: AdjustPlanItem): number => Math.max(0, Math.round(num(it.sets)));

/**
 * ท่านี้กินเวลากี่นาที = เวลาทำจริง + เวลาพัก "ระหว่าง" เซ็ต (ไม่นับพักหลังเซ็ตสุดท้าย)
 *   ท่านับครั้ง  = เซ็ต × ครั้ง × วินาทีต่อครั้ง
 *   ท่าจับเวลา  = เซ็ต × วินาทีต่อเซ็ต
 *   ท่านับนาที  = เซ็ต × นาที
 *
 * 🔴 `minutes` เป็น "นาทีต่อเซ็ต" เสมอ ไม่ใช่นาทีรวม — แผนจริงมีรูปแบบ {sets:3, minutes:1}
 *    (แพลงก์ 3 เซ็ต เซ็ตละ 1 นาที) ถ้าอ่านเป็นนาทีรวมจะประเมินสั้นกว่าจริง 5 เท่า
 *    ท่าที่ไม่มี sets (เดิน 20 นาที) = 1 เซ็ต → ได้ 20 นาทีเท่าเดิม
 */
export function estimateItemMinutes(it: AdjustPlanItem): number {
  const sets = Math.max(1, setsOf(it));
  const restMin = ((sets - 1) * REST_SEC) / 60;
  const seconds = num(it.seconds);
  if (seconds > 0) return round1((sets * seconds) / 60 + restMin);
  const reps = num(it.reps);
  if (reps > 0) return round1((sets * reps * SEC_PER_REP) / 60 + restMin);
  const minutes = num(it.minutes);
  if (minutes > 0) return round1(sets * minutes + restMin);
  return 0;
}

/** เวลาทั้งเซสชัน = ผลรวมของท่า + อุ่นเครื่อง/คูลดาวน์ (แผนว่าง = 0 ไม่ใช่ 3) */
export function estimateSessionMinutes(items: AdjustPlanItem[]): number {
  const list = Array.isArray(items) ? items : [];
  const body = list.reduce((n, it) => n + estimateItemMinutes(it), 0);
  return body > 0 ? Math.round(body + OVERHEAD_MIN) : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ────────────────────────────── 2. ธง priority ของแต่ละท่า ──────────────────────────────

/** ท่าที่ใช้กล้ามเนื้อหลายมัดพร้อมกัน — ตัดทิ้งแล้วเสียแก่นของวันนั้น */
const COMPOUND_PATTERNS = new Set(["squat", "hinge", "lunge", "push_h", "push_v", "pull_h", "pull_v"]);

/**
 * main | secondary | accessory
 *
 * เรียงตามที่ระบบวางแผนไว้อยู่แล้ว: ท่าแรก ๆ ของวันคือท่าหลัก (fitSessionLength ตัดจากท้ายด้วยหลักเดียวกัน)
 *   main      = compound ตัวแรกของวัน — หรือคาร์ดิโอตัวแรกถ้าวันนั้นไม่มี compound เลย (วันคาร์ดิโอล้วน)
 *   secondary = compound ตัวถัด ๆ ไป + คาร์ดิโอในวันที่มีเวท
 *   accessory = core / ยืดเหยียด / ท่าเดี่ยว ๆ ที่เหลือ
 *
 * ถ้าท่ามีธง priority ติดมากับแผนแล้ว (generator ปั๊มไว้) ใช้ของเดิมเสมอ — ไฟล์นี้เดาให้เฉพาะแผนเก่าที่ยังไม่มีธง
 */
export function derivePriorities(items: AdjustPlanItem[], metaOf: MetaOf): Priority[] {
  const list = Array.isArray(items) ? items : [];
  const metas = list.map((it) => metaOf(it));
  const isCompound = metas.map((m) => !!m?.pattern && COMPOUND_PATTERNS.has(m.pattern));
  const hasCompound = isCompound.some(Boolean);

  let mainTaken = false;
  return list.map((it, i) => {
    const stamped = String(it.priority ?? "");
    if (stamped === "main" || stamped === "secondary" || stamped === "accessory") {
      if (stamped === "main") mainTaken = true;
      return stamped as Priority;
    }
    const m = metas[i];
    if (isCompound[i]) {
      if (!mainTaken) {
        mainTaken = true;
        return "main";
      }
      return "secondary";
    }
    if (m?.kind === "cardio") {
      if (!hasCompound && !mainTaken) {
        mainTaken = true;
        return "main";
      }
      return "secondary";
    }
    return "accessory";
  });
}

// ────────────────────────────── 3. "เหลือเวลาแค่ X นาที" ──────────────────────────────

export interface ScaleResult {
  items: AdjustPlanItem[];
  /** แผนถูกแตะจริงไหม — false = อย่าไปบอก user ว่าปรับให้แล้ว */
  changed: boolean;
  /** เวลาที่ประมาณได้ ก่อน/หลังปรับ */
  beforeMin: number;
  afterMin: number;
  /** ชื่อท่าที่ถูกยกออกจากวันนี้ (ไม่ได้ลบจากโปรแกรม แค่วันนี้ไม่ทำ) */
  dropped: string[];
  /** ตัดจนสุดแล้วยังเกินเวลาที่ขอ — ต้องบอก user ตรง ๆ ห้ามเงียบ */
  shortfall: boolean;
  /** ข้อความระดับวัน ภาษาคน */
  summary: string;
}

/** ลดเซ็ตของท่าเดียว 1 เซ็ต (ห้ามเหลือ 0 = นั่นคือการตัดท่าทิ้ง ไม่ใช่ลดปริมาณ) */
function dropOneSet(it: AdjustPlanItem, why: string): boolean {
  const sets = setsOf(it);
  if (sets <= 1) return false;
  it.sets = sets - 1;
  it.adjustNote = `ลดเหลือ ${it.sets} เซ็ต — ${why}`;
  return true;
}

/**
 * ลดนาทีของท่าที่นับเป็นช่วงเวลาเดียว (เดิน/ปั่น) ทีละ 5 นาที — ต่ำสุด MIN_CARDIO_MIN
 * ท่าที่เป็นหลายเซ็ต (แพลงก์ 3×1 นาที) ไม่ตัดตรงนี้ — ต้องลดที่จำนวนเซ็ต ไม่ใช่ย่อเวลาต่อเซ็ตให้สั้นจนไม่เหลือท่า
 */
function trimMinutes(it: AdjustPlanItem, why: string): boolean {
  if (setsOf(it) > 1) return false;
  const min = num(it.minutes);
  if (!(min > MIN_CARDIO_MIN)) return false;
  const next = Math.max(MIN_CARDIO_MIN, Math.round((min - 5) / 5) * 5 || MIN_CARDIO_MIN);
  if (next >= min) return false;
  it.minutes = next;
  it.adjustNote = `ลดเหลือ ${next} นาที — ${why}`;
  return true;
}

/**
 * ย่อแผนวันนี้ให้ลงเวลาที่ผู้ใช้เหลือจริง
 *
 * ลำดับการตัด (ตาม §4.4 — คงแก่นของวันไว้ก่อนเสมอ):
 *   1. ยก accessory ออก ไล่จากท้ายขึ้นมา
 *   2. ตัดเซ็ตของ secondary ทีละเซ็ต ไล่จากท้าย
 *   3. ตัดนาทีคาร์ดิโอ/ท่าจับเวลา
 *   4. ตัดเซ็ตของ main เป็นทางสุดท้าย (เหลืออย่างน้อย 1 เซ็ต และห้ามยกท่าออก)
 * ตัดครบทุกทางแล้วยังเกิน = shortfall (บอกตามจริง)
 */
export function scaleToMinutes(items: AdjustPlanItem[], targetMin: number, metaOf: MetaOf): ScaleResult {
  const src = (Array.isArray(items) ? items : []).map((it) => ({ ...it }));
  const beforeMin = estimateSessionMinutes(src);
  const target = Math.max(MIN_CARDIO_MIN, Math.round(num(targetMin)));

  if (!src.length || beforeMin <= target) {
    return {
      items: src,
      changed: false,
      beforeMin,
      afterMin: beforeMin,
      dropped: [],
      shortfall: false,
      summary: src.length ? `แผนวันนี้ใช้เวลาประมาณ ${beforeMin} นาที อยู่ในเวลาที่มีอยู่แล้ว` : "วันนี้ไม่มีท่าในแผน",
    };
  }

  const why = `วันนี้มีเวลา ${target} นาที`;
  const prio = derivePriorities(src, metaOf);
  const keep = src.map(() => true);
  const dropped: string[] = [];
  const fits = () => estimateSessionMinutes(src.filter((_, i) => keep[i])) <= target;
  const aliveCount = () => keep.filter(Boolean).length;

  // 1. accessory ออกก่อน (ท้าย → ต้น)
  for (let i = src.length - 1; i >= 0 && !fits(); i--) {
    if (!keep[i] || prio[i] !== "accessory") continue;
    if (aliveCount() <= 1) break;
    keep[i] = false;
    dropped.push(src[i].name);
  }

  // 2. เซ็ตของ secondary (ท้าย → ต้น) — วนจนกว่าจะลดไม่ได้อีก
  for (let pass = 0; pass < 6 && !fits(); pass++) {
    let touched = false;
    for (let i = src.length - 1; i >= 0 && !fits(); i--) {
      if (!keep[i] || prio[i] !== "secondary") continue;
      if (dropOneSet(src[i], why)) touched = true;
    }
    if (!touched) break;
  }

  // 3. นาทีของคาร์ดิโอ/ท่าจับเวลา (ท้าย → ต้น) — main ก็ยอมให้สั้นลงได้ในขั้นนี้ เพราะยังได้ทำอยู่
  for (let pass = 0; pass < 12 && !fits(); pass++) {
    let touched = false;
    for (let i = src.length - 1; i >= 0 && !fits(); i--) {
      if (!keep[i]) continue;
      if (trimMinutes(src[i], why)) touched = true;
    }
    if (!touched) break;
  }

  // 4. เซ็ตของ main เป็นทางสุดท้าย
  for (let pass = 0; pass < 6 && !fits(); pass++) {
    let touched = false;
    for (let i = src.length - 1; i >= 0 && !fits(); i--) {
      if (!keep[i] || prio[i] !== "main") continue;
      if (dropOneSet(src[i], why)) touched = true;
    }
    if (!touched) break;
  }

  // 5. ยัง secondary ที่เหลือ 1 เซ็ตอยู่และยังเกิน → ยอมยกออก (แต่ main ห้ามแตะ)
  for (let i = src.length - 1; i >= 0 && !fits(); i--) {
    if (!keep[i] || prio[i] === "main") continue;
    if (aliveCount() <= 1) break;
    keep[i] = false;
    dropped.push(src[i].name);
  }

  const out = src.filter((_, i) => keep[i]);
  const afterMin = estimateSessionMinutes(out);
  const shortfall = afterMin > target;
  const changed = dropped.length > 0 || out.some((it) => !!it.adjustNote);

  /* 🔴 ข้อความต้องเป็นกลางเรื่องกาล — ก้อนเดียวกันนี้ถูกใช้ทั้งตอน "เสนอให้ดูก่อน" และตอน "ทำแล้ว"
     ถ้าเขียนว่า "ปรับให้แล้ว" ตั้งแต่ตอนเสนอ โค้ชจะพูดว่าทำแล้วทั้งที่ user ยังไม่ได้กดยืนยัน */
  let summary: string;
  if (!changed) {
    summary = `ตัดไม่ได้แล้ว วันนี้ต้องใช้ประมาณ ${afterMin} นาที`;
  } else if (shortfall) {
    summary = `สั้นที่สุดที่ทำได้คือประมาณ ${afterMin} นาที — สั้นกว่านี้จะไม่เหลือผลการฝึก`;
  } else {
    summary = `เหลือประมาณ ${afterMin} นาที${dropped.length ? ` · ยกออก ${dropped.length} ท่า` : ""}`;
  }

  return { items: out, changed, beforeMin, afterMin, dropped, shortfall, summary };
}

// ────────────────────────────── 4. "วันนี้ปวดตรง Y" ──────────────────────────────

export interface SubstituteOptions {
  /** ท่าที่เลือกได้จริงตามอุปกรณ์ที่เขามี (ผู้เรียกกรอง tier มาแล้ว) */
  pool: ExerciseMeta[];
  /** pattern ที่ต้องเลี่ยงเพราะจุดที่ปวด (มาจาก patternsForSoreAreas — ตารางเดียวกับ Readiness) */
  avoidPatterns: Set<string>;
  /** key ที่ต้องเลี่ยงตรง ๆ */
  avoidKeys?: Set<string>;
  /** ท่าที่ใช้ไปแล้วในวันนั้น (กันซ้ำ) */
  usedKeys?: Set<string>;
}

export interface SubstituteResult {
  item: AdjustPlanItem;
  /** เปลี่ยนท่าให้จริงไหม */
  swapped: boolean;
  /** ไม่มีตัวแทน → ลดปริมาณแทน (ดีกว่าตัดทิ้งจนวันนั้นขาดกล้ามเนื้อมัดนั้น) */
  reduced: boolean;
  from?: string;
  to?: string;
}

/**
 * หาท่าแทน 1 ท่า
 *   ชั้น 1: pattern เดียวกัน + ไม่กวนจุดที่ปวด + หน่วยเดียวกัน (แทนกันได้จริง)
 *   ชั้น 2: kind เดียวกัน + ไม่กวนจุดที่ปวด (ยอมข้าม pattern — ได้ออกกำลังกายดีกว่าไม่ได้ทำ)
 *   ไม่มีทั้งสองชั้น → คงท่าไว้แต่ลดปริมาณลง 1 เซ็ต + บอกเหตุผล
 * เลือกตัวที่ "ง่ายกว่า" ก่อนเสมอเมื่อคะแนนเท่ากัน (difficulty น้อยกว่า) — คนกำลังปวด ไม่ใช่เวลาไปลองท่ายาก
 */
export function substituteItem(
  it: AdjustPlanItem,
  areaLabelTh: string,
  opts: SubstituteOptions,
  metaOf: MetaOf
): SubstituteResult {
  const next: AdjustPlanItem = { ...it };
  const meta = metaOf(it);
  const avoidKeys = opts.avoidKeys ?? new Set<string>();
  const used = opts.usedKeys ?? new Set<string>();
  const why = `เลี่ยงท่าที่ลง${areaLabelTh} เพราะคุณบอกว่าปวดวันนี้`;

  const ok = (c: ExerciseMeta) =>
    c.key !== (it.key ?? "") &&
    !used.has(c.key) &&
    !avoidKeys.has(c.key) &&
    !(c.pattern && opts.avoidPatterns.has(c.pattern));

  const byEasy = (a: ExerciseMeta, b: ExerciseMeta) => (a.difficulty ?? 9) - (b.difficulty ?? 9);

  const tier1 = opts.pool
    .filter((c) => ok(c) && !!meta?.pattern && c.pattern === meta.pattern && c.unit === meta.unit)
    .sort(byEasy);
  const tier2 = opts.pool.filter((c) => ok(c) && !!meta && c.kind === meta.kind).sort(byEasy);
  const pick = tier1[0] ?? tier2[0];

  if (!pick) {
    const reduced = dropOneSet(next, why);
    if (!reduced) next.adjustNote = `${why} — ไม่มีท่าแทน ทำเท่าที่ไหวแล้วหยุดถ้าเจ็บขึ้น`;
    return { item: next, swapped: false, reduced };
  }

  next.key = pick.key;
  next.name = pick.name;
  next.note = pick.cue ?? next.note;
  next.adjustNote = `เปลี่ยนจาก${it.name} · ${why}`;
  // น้ำหนักของท่าเดิมใช้กับท่าใหม่ไม่ได้ (คนละท่า คนละแรง) — ให้ Player ถามใหม่ ดีกว่าสั่งเลขที่เดาเอง
  delete next.weightKg;
  delete next.rxReason;
  if (pick.unit === "reps") {
    next.reps = num(it.reps) > 0 ? it.reps : 12;
    next.sets = setsOf(it) > 0 ? it.sets : 3;
    delete next.minutes;
  } else {
    next.minutes = num(it.minutes) > 0 ? it.minutes : 20;
    delete next.reps;
    delete next.sets;
  }
  return { item: next, swapped: true, reduced: false, from: it.name, to: pick.name };
}

export interface SoreAdjustResult {
  items: AdjustPlanItem[];
  changed: boolean;
  swapped: number;
  reduced: number;
  summary: string;
}

/**
 * ปรับทั้งวันเพราะ "ปวดตรง Y"
 * ท่าที่ไม่ได้ลงจุดนั้นไม่ต้องแตะเลย (§4.1 ไม่หั่นทั้งวันเพราะปวดจุดเดียว)
 */
export function adjustForSoreArea(
  items: AdjustPlanItem[],
  areaLabelTh: string,
  opts: SubstituteOptions,
  metaOf: MetaOf
): SoreAdjustResult {
  const src = Array.isArray(items) ? items : [];
  const used = new Set<string>(src.map((it) => String(it.key ?? "")).filter(Boolean));
  let swapped = 0;
  let reduced = 0;

  const out = src.map((it) => {
    const meta = metaOf(it);
    const hit =
      (!!meta?.pattern && opts.avoidPatterns.has(meta.pattern)) ||
      (!!it.key && (opts.avoidKeys ?? new Set()).has(it.key));
    if (!hit) return it;

    const r = substituteItem(it, areaLabelTh, { ...opts, usedKeys: used }, metaOf);
    if (r.swapped) {
      swapped++;
      if (it.key) used.delete(it.key);
      if (r.item.key) used.add(r.item.key);
    } else if (r.reduced) {
      reduced++;
    }
    return r.item;
  });

  const changed = swapped > 0 || reduced > 0;
  // เป็นกลางเรื่องกาลด้วยเหตุผลเดียวกับ scaleToMinutes
  const summary = !changed
    ? `วันนี้ไม่มีท่าที่ลง${areaLabelTh}อยู่แล้ว ทำตามแผนเดิมได้เลย`
    : swapped > 0 && reduced > 0
      ? `เลี่ยง${areaLabelTh} โดยเปลี่ยนท่า ${swapped} ท่า และลดปริมาณอีก ${reduced} ท่า`
      : swapped > 0
        ? `เลี่ยง${areaLabelTh} โดยเปลี่ยนเป็นท่าอื่น ${swapped} ท่า`
        : `ไม่มีท่าแทนที่เหมาะ ใช้วิธีลดปริมาณ ${reduced} ท่าแทน`;

  return { items: out, changed, swapped, reduced, summary };
}
