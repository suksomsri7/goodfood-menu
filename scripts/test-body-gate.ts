/**
 * เทส quality gate ของภาพสแกนร่างกาย (BP-1 · WO-BP-1 §B3/§B5) — รัน: npx tsx scripts/test-body-gate.ts
 *
 * ทำไมต้องมี: gate นี้เป็นคนตัดสินว่า "ภาพนี้ถูกลบทิ้ง" — ตัดสินผิดสองทางเจ็บคนละแบบ
 *   หลวมไป = เก็บภาพที่ยืนคนละระยะทุกสัปดาห์ → เทรนด์ใน BP-2 เล่านิทานว่าเอวขึ้น ๆ ลง ๆ ทั้งที่ตัวเท่าเดิม
 *   แน่นไป = คนถ่ายสิบครั้งไม่ผ่านสักครั้งแล้วเลิกใช้ฟีเจอร์ไปเลย
 * และเหตุผลไทยที่ตอบกลับคือ UI หลักของจอนี้ (user ยืนห่างจากเครื่อง ฟัง TTS อ่าน) — ข้อความผิด = เขาแก้ไม่ถูกจุด
 *
 * 🔴 ห้ามเทสด้วยรูปคนจริง — ทุกเคสในนี้เป็น payload จำลองที่เขียนขึ้นเอง (ตัวเลขในรูปแบบเดียวกับที่ worker คืน)
 *    ตัวเลขฐาน "คนยืนดี ๆ" อ้างอิงจากภาพ poster สาธารณะ squat_bw.jpg ที่รันผ่าน worker จริงตอนพัฒนา
 *    (bodyHeightFrac 0.76 · keyVisibility 0.88 · meanLuma 212)
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  gateImage,
  keyVisibility,
  bodyHeightFrac,
  tiltDeg,
  worstQuality,
  GATE_MESSAGES,
  KEY_LANDMARKS,
  LANDMARK_COUNT,
  LM_ANKLE_L,
  LM_ANKLE_R,
  LM_HIP_L,
  LM_HIP_R,
  LM_NOSE,
  LM_SHOULDER_L,
  LM_SHOULDER_R,
  MIN_KEY_VISIBILITY,
  MIN_BODY_HEIGHT_FRAC,
  MAX_BODY_HEIGHT_FRAC,
  MAX_TILT_DEG,
  MIN_MEAN_LUMA,
  MIN_TILT_SPAN_RATIO,
  tiltSpanRatio,
  type GateLandmark,
  type WorkerImage,
} from "../src/lib/bodyScanGate";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ── ตัวสร้าง payload จำลอง (เลียนรูปแบบที่ worker/body_worker.py คืนมาเป๊ะ) ──

const IMG_W = 720;
const IMG_H = 1280;

interface FakeOpts {
  /** สัดส่วนความสูงร่างในภาพ (จมูก→ข้อเท้า) */
  bodyFrac?: number;
  visibility?: number;
  /** เอียงเป็นองศา — ใส่ให้ทั้งเส้นไหล่และเส้นสะโพก */
  tilt?: number;
  meanLuma?: number;
  personCount?: number;
  maskCoverage?: number;
  landmarkCount?: number;
  width?: number;
  height?: number;
}

/**
 * สร้างชุด landmark 33 จุดของ "คนยืนตรง" แล้วปรับตามพารามิเตอร์
 * เอียง: หมุนเส้นไหล่/สะโพกเป็นองศาจริงในหน่วยพิกเซล แล้วแปลงกลับเป็นสัดส่วน
 * (ถ้าสร้างในหน่วยสัดส่วนตรง ๆ เทสจะไม่มีทางจับบั๊ก "ลืมคูณอัตราส่วนภาพ" ได้เลย)
 */
function fakeImage(opts: FakeOpts = {}): WorkerImage {
  const {
    bodyFrac = 0.76,
    visibility = 0.95,
    tilt = 0,
    meanLuma = 150,
    personCount = 1,
    maskCoverage = 0.18,
    landmarkCount = LANDMARK_COUNT,
    width = IMG_W,
    height = IMG_H,
  } = opts;

  const noseY = 0.1;
  const ankleY = noseY + bodyFrac;
  const pts: GateLandmark[] = Array.from({ length: landmarkCount }, () => ({ x: 0.5, y: 0.5, visibility }));

  const setPair = (li: number, ri: number, y: number, halfWidthPx: number) => {
    // เส้นตรงยาว 2*halfWidthPx พิกเซล เอียง `tilt` องศา
    const rad = (tilt * Math.PI) / 180;
    const dxPx = Math.cos(rad) * halfWidthPx;
    const dyPx = Math.sin(rad) * halfWidthPx;
    if (pts[li]) pts[li] = { x: 0.5 + dxPx / width, y: y + dyPx / height, visibility };
    if (pts[ri]) pts[ri] = { x: 0.5 - dxPx / width, y: y - dyPx / height, visibility };
  };

  if (pts[LM_NOSE]) pts[LM_NOSE] = { x: 0.5, y: noseY, visibility };
  setPair(LM_SHOULDER_L, LM_SHOULDER_R, noseY + bodyFrac * 0.14, 0.09 * width);
  setPair(LM_HIP_L, LM_HIP_R, noseY + bodyFrac * 0.53, 0.07 * width);
  if (pts[LM_ANKLE_L]) pts[LM_ANKLE_L] = { x: 0.53, y: ankleY, visibility };
  if (pts[LM_ANKLE_R]) pts[LM_ANKLE_R] = { x: 0.47, y: ankleY, visibility };

  return {
    ok: true,
    personCount,
    landmarks: personCount > 0 ? pts : [],
    maskCoverage,
    width,
    height,
    meanLuma,
  };
}

const codes = (img: WorkerImage) => gateImage(img).issues.map((i) => i.code);

console.log("── ตัวช่วยคำนวณ (ต้องถูกก่อน ค่อยไปเชื่อคำตัดสิน) ──");

// 1. visibility เฉลี่ยของจุดสำคัญ
{
  check("จุดสำคัญคือ 9 จุด (จมูก ไหล่ สะโพก เข่า ข้อเท้า)", KEY_LANDMARKS.length === 9);
  check("ทุกจุด visibility 0.95 → เฉลี่ย 0.95", keyVisibility(fakeImage().landmarks) === 0.95);
  check("ไม่มี landmark เลย → null (ไม่ใช่ 0)", keyVisibility([]) === null && keyVisibility(undefined) === null);
  // จุดที่หายไปนับเป็น 0 — จุดที่ไม่มีคือจุดที่มองไม่เห็น
  const short = fakeImage({ landmarkCount: 5 }).landmarks!;
  const v = keyVisibility(short);
  check("landmark ไม่ครบ → จุดที่ขาดนับเป็น 0 (ไม่ใช่ข้ามทิ้ง)", v !== null && v < 0.6, String(v));
}

// 2. ความสูงร่างในภาพ
{
  check("bodyHeightFrac คิดจาก จมูก→ข้อเท้าที่ต่ำสุด", bodyHeightFrac(fakeImage({ bodyFrac: 0.7 }).landmarks) === 0.7);
  const lm = fakeImage().landmarks!.map((p) => ({ ...p }));
  lm[LM_ANKLE_L] = { ...lm[LM_ANKLE_L], y: 0.95 }; // ขาข้างหนึ่งอยู่ต่ำกว่า (ภาพด้านข้าง)
  check("ข้อเท้าสองข้างไม่เท่ากัน → ใช้ข้างที่ต่ำสุด", bodyHeightFrac(lm) === 0.85, String(bodyHeightFrac(lm)));
  check("ไม่มีจมูก/ข้อเท้า → null", bodyHeightFrac([]) === null);
}

// 3. 🔴 มุมเอียงต้องแก้อัตราส่วนภาพก่อน (บั๊กที่พลาดง่ายที่สุดของ gate นี้)
{
  const a = { x: 0.4, y: 0.5, visibility: 1 };
  const b = { x: 0.6, y: 0.5, visibility: 1 };
  check("เส้นแนวนอนสนิท → 0°", tiltDeg(a, b, IMG_W, IMG_H) === 0);

  // ต่างกัน 0.1 ทั้งแกน x และ y บนภาพ 720×1280: จริง ๆ คือ 72px vs 128px = 60.6°
  const c = { x: 0.4, y: 0.4, visibility: 1 };
  const d = { x: 0.5, y: 0.5, visibility: 1 };
  const withSize = tiltDeg(c, d, IMG_W, IMG_H)!;
  const noSize = tiltDeg(c, d)!;
  check("แก้อัตราส่วนภาพแล้วได้ 60.6° (ไม่ใช่ 45° ของสัดส่วนดิบ)", Math.abs(withSize - 60.64) < 0.1, `${withSize}°`);
  check("ไม่ส่งขนาดภาพมา → ตกไปคิดบนสัดส่วนดิบ 45° (ยังตรวจได้ ดีกว่าไม่ตรวจ)", Math.abs(noSize - 45) < 0.01);
  check("จุดหาย → null", tiltDeg(null, d, IMG_W, IMG_H) === null);
}

console.log("\n── คำตัดสิน: เคสที่ต้องผ่าน ──");

// 4. คนยืนดี ๆ กลางภาพ แสงพอ → good
{
  const r = gateImage(fakeImage());
  check("ยืนเต็มตัว ตรง แสงพอ → good + ไม่มีเหตุผลต้องบอก", r.pass && r.quality === "good" && r.reason === null, r.reasons.join(" / "));
}

// 5. เคสจากภาพจริงที่รันผ่าน worker ตอนพัฒนา (squat_bw.jpg — poster สาธารณะ)
{
  const r = gateImage(fakeImage({ bodyFrac: 0.7605, visibility: 0.8762, meanLuma: 212.34, maskCoverage: 0.164, width: 480, height: 853 }));
  check("ตัวเลขจากภาพจริงที่ worker วิเคราะห์ → ผ่าน", r.pass, `${r.quality} · ${r.reasons.join(" / ") || "ไม่มีข้อสังเกต"}`);
}

// 6. แถบ ok: ผ่านแบบเฉียดเกณฑ์ ต้องเก็บได้แต่มีข้อสังเกต
{
  const nearFar = gateImage(fakeImage({ bodyFrac: 0.58 }));
  check(
    "ยืนค่อนข้างไกลแต่ยังเกิน 55% → ok (เก็บได้ + เตือนว่าไกล)",
    nearFar.pass && nearFar.quality === "ok" && nearFar.issues.some((i) => i.code === "too_far" && i.severity === "warn"),
    nearFar.reasons.join(" / ")
  );
  const nearDark = gateImage(fakeImage({ meanLuma: 70 }));
  check("แสงพอแต่ไม่สว่างนัก (70) → ok ไม่ใช่ poor", nearDark.pass && nearDark.quality === "ok", nearDark.reasons.join(" / "));
  const nearTilt = gateImage(fakeImage({ tilt: 5 }));
  check("เอียง 5° (ยังไม่เกิน 7°) → ok ไม่ปฏิเสธ", nearTilt.pass && nearTilt.quality === "ok", nearTilt.reasons.join(" / "));
  const nearVis = gateImage(fakeImage({ visibility: 0.8 }));
  check("visibility 0.80 (เกิน 0.7 แต่ไม่ถึง 0.85) → ok", nearVis.pass && nearVis.quality === "ok", nearVis.reasons.join(" / "));
}

console.log("\n── คำตัดสิน: เคสที่ต้องไม่ผ่าน (poor = ลบไฟล์ทิ้ง) ──");

// 7. ไม่เจอคน
{
  const r = gateImage(fakeImage({ personCount: 0 }));
  check("ไม่เจอคนในภาพ → poor", !r.pass && r.quality === "poor");
  check("เหตุผล = 'ยังเห็นไม่เต็มตัว ลองถอยอีกนิดครับ'", r.reason === GATE_MESSAGES.no_person, r.reason ?? "");
  check("ติดรหัส no_person", codes(fakeImage({ personCount: 0 })).includes("no_person"));
}

// 8. ห้องมืดจนตรวจไม่เจอคน → ต้องบอก "เปิดไฟ" ไม่ใช่ "ถอยอีกนิด"
{
  const r = gateImage(fakeImage({ personCount: 0, meanLuma: 20 }));
  check("มืดจนตรวจไม่เจอคน → เหตุผลแรกคือเรื่องแสง (สาเหตุราก)", r.reason === GATE_MESSAGES.dark, r.reason ?? "");
  check("แต่ยังรายงานทั้งสองข้อ ไม่กลบข้อมูล", r.reasons.length >= 2, r.reasons.join(" / "));
}

// 9. visibility ต่ำ (ใส่ผ้าคลุม/ยืนหลังโซฟา)
{
  const r = gateImage(fakeImage({ visibility: 0.5 }));
  check("visibility เฉลี่ย 0.50 < 0.70 → poor", !r.pass && r.quality === "poor");
  check("เหตุผล = 'ยังเห็นไม่เต็มตัว ลองถอยอีกนิดครับ'", r.reason === GATE_MESSAGES.low_visibility, r.reason ?? "");
  const edge = gateImage(fakeImage({ visibility: MIN_KEY_VISIBILITY }));
  check(`visibility = ${MIN_KEY_VISIBILITY} พอดี → ยังผ่าน (เกณฑ์คือ "น้อยกว่า" ไม่ใช่ "ไม่ถึง")`, edge.pass);
}

// 10. ไกลไป
{
  const r = gateImage(fakeImage({ bodyFrac: 0.4 }));
  check("ตัวสูงแค่ 40% ของภาพ → poor + 'ไกลไป'", !r.pass && r.reason === GATE_MESSAGES.too_far, r.reason ?? "");
  const edge = gateImage(fakeImage({ bodyFrac: MIN_BODY_HEIGHT_FRAC }));
  check(`ที่เกณฑ์ ${MIN_BODY_HEIGHT_FRAC} พอดี → ยังผ่าน`, edge.pass, edge.quality);
  const just = gateImage(fakeImage({ bodyFrac: 0.549 }));
  check("ต่ำกว่าเกณฑ์นิดเดียว (0.549) → ไม่ผ่าน", !just.pass);
}

// 11. ใกล้ไป
{
  const r = gateImage(fakeImage({ bodyFrac: 0.97 }));
  check("ตัวสูง 97% ของภาพ → poor + 'ใกล้ไป'", !r.pass && r.reason === GATE_MESSAGES.too_close, r.reason ?? "");
  const edge = gateImage(fakeImage({ bodyFrac: MAX_BODY_HEIGHT_FRAC }));
  check(`ที่เกณฑ์ ${MAX_BODY_HEIGHT_FRAC} พอดี → ยังผ่าน`, edge.pass, edge.quality);
}

// 12. เอียง (กล้องพิงผนังเบี้ยว)
{
  const r = gateImage(fakeImage({ tilt: 12 }));
  check("เส้นไหล่/สะโพกเอียง 12° → poor", !r.pass && r.quality === "poor");
  check("เหตุผล = 'ยืนตรง ๆ กล้องอาจเอียงอยู่'", r.reason === GATE_MESSAGES.tilted, r.reason ?? "");
  const edge = gateImage(fakeImage({ tilt: MAX_TILT_DEG }));
  check(`เอียง ${MAX_TILT_DEG}° พอดี → ยังผ่าน (แถบ ok)`, edge.pass && edge.quality === "ok");
  const over = gateImage(fakeImage({ tilt: 7.5 }));
  check("เอียง 7.5° → ไม่ผ่าน", !over.pass);
}

// 12b. เอียงเฉพาะสะโพก (ยืนถ่ายน้ำหนักลงขาเดียว) — ต้องจับได้แม้ไหล่ตรง
{
  const lm = fakeImage().landmarks!.map((p) => ({ ...p }));
  lm[LM_HIP_L] = { ...lm[LM_HIP_L], y: lm[LM_HIP_L].y + 0.03 };
  const r = gateImage({ ...fakeImage(), landmarks: lm });
  check("ไหล่ตรงแต่สะโพกเอียง → จับได้ (ใช้เส้นที่เอียงกว่าตัดสิน)", !r.pass && r.reason === GATE_MESSAGES.tilted, r.reason ?? "");
}

/* 12c. 🔴 ภาพด้านข้าง: ไหล่ซ้าย-ขวาซ้อนกัน → มุมที่คำนวณได้เป็นสัญญาณรบกวน ห้ามเอาไปปฏิเสธภาพ
   เคสนี้มาจากการรัน worker จริงกับ squat_bw.jpg (คนยืนตรงเป๊ะ ถ่ายด้านข้าง) แล้วได้ 51.19°
   ถ้าไม่กัน ภาพ "ด้านข้าง" ที่ระบบบังคับให้ถ่ายทุกครั้งจะถูกปฏิเสธเกือบทั้งหมด */
{
  const sideish = fakeImage({ bodyFrac: 0.7605, visibility: 0.8762, meanLuma: 212.34, width: 480, height: 853 });
  const lm = sideish.landmarks!.map((p) => ({ ...p }));
  // ไหล่ห่างกันแค่ ~10px บนภาพกว้าง 480 (ค่าจริงจาก worker) และเหลื่อมกันในแนวตั้ง
  lm[LM_SHOULDER_L] = { ...lm[LM_SHOULDER_L], x: 0.42714, y: 0.25498 };
  lm[LM_SHOULDER_R] = { ...lm[LM_SHOULDER_R], x: 0.40547, y: 0.23982 };
  lm[LM_HIP_L] = { ...lm[LM_HIP_L], x: 0.3975, y: 0.51039 };
  lm[LM_HIP_R] = { ...lm[LM_HIP_R], x: 0.3691, y: 0.50698 };
  const img = { ...sideish, landmarks: lm };

  const raw = gateImage(img, "front");
  check("(ยืนยันอาการ) เส้นไหล่สั้นมากจนมุมเพี้ยน → วัดได้ 51°", Math.round(raw.metrics.shoulderTiltDeg ?? 0) === 51, `${raw.metrics.shoulderTiltDeg}°`);
  check(
    `ความกว้างเส้นไหล่ของภาพด้านข้าง < เกณฑ์ ${MIN_TILT_SPAN_RATIO}`,
    (raw.metrics.shoulderSpanRatio ?? 1) < MIN_TILT_SPAN_RATIO,
    String(raw.metrics.shoulderSpanRatio)
  );
  {
    const front = gateImage(fakeImage(), "front");
    check(
      `ภาพด้านหน้าปกติ ความกว้างเส้นไหล่ ≥ เกณฑ์ (วัดมุมได้)`,
      (front.metrics.shoulderSpanRatio ?? 0) >= MIN_TILT_SPAN_RATIO,
      String(front.metrics.shoulderSpanRatio)
    );
    check(
      "tiltSpanRatio: ไม่มีความสูงร่างให้เทียบ → null",
      tiltSpanRatio({ x: 0.4, y: 0.5, visibility: 1 }, { x: 0.6, y: 0.5, visibility: 1 }, null, IMG_W, IMG_H) === null
    );
  }
  check(
    "เส้นไหล่สั้นเกินเกณฑ์วัดได้ → ข้ามการตรวจเอียง แม้ระบุว่าเป็นภาพด้านหน้า",
    raw.pass && !raw.issues.some((i) => i.code === "tilted"),
    `${raw.quality} · span ${raw.metrics.shoulderSpanRatio}`
  );
  const asSide = gateImage(img, "side");
  check("ระบุ view=side → ผ่าน ไม่โดนข้อหาเอียง", asSide.pass && !asSide.issues.some((i) => i.code === "tilted"), asSide.quality);
  const noView = gateImage(img);
  check("ไม่ส่ง view มาเลย → ชั้นกันเรขาคณิตยังทำงาน", noView.pass, noView.reasons.join(" / "));
}

// 12d. ภาพด้านข้างที่เอียงจริง ๆ ต้องยังจับได้จากเส้นสะโพก/ตัวชี้อื่น ไม่ใช่ปล่อยหมด
{
  const front = fakeImage({ tilt: 20 });
  check("ภาพด้านหน้าเอียง 20° (เส้นไหล่กว้างปกติ) → ยังปฏิเสธเหมือนเดิม", !gateImage(front, "front").pass);
  check("ภาพด้านหน้าเอียง 20° แต่ระบุ view=side → ไม่ตรวจเอียง (เชื่อ view ที่แอปส่งมา)", gateImage(front, "side").pass);
}

// 13. แสงน้อย
{
  const r = gateImage(fakeImage({ meanLuma: 40 }));
  check("meanLuma 40 < 60 → poor", !r.pass && r.quality === "poor");
  check("เหตุผล = 'แสงน้อยไป เปิดไฟหรือหันหน้าเข้าแสงครับ'", r.reason === GATE_MESSAGES.dark, r.reason ?? "");
  const edge = gateImage(fakeImage({ meanLuma: MIN_MEAN_LUMA }));
  check(`meanLuma = ${MIN_MEAN_LUMA} พอดี → ยังผ่าน`, edge.pass);
}

// 14. มีคนอื่นในเฟรม
{
  const r = gateImage(fakeImage({ personCount: 2 }));
  check("เจอมากกว่าหนึ่งคน → poor + บอกให้เหลือคนเดียว", !r.pass && r.reason === GATE_MESSAGES.many_people, r.reason ?? "");
}

// 15. worker วิเคราะห์ภาพนี้ไม่ได้ (ไฟล์เสีย)
{
  const r = gateImage({ ok: false, error: "อ่านรูปไม่สำเร็จ" });
  check("worker ตอบ ok:false → poor + ไม่โทษท่าทางของ user", !r.pass && r.reason === GATE_MESSAGES.worker_failed, r.reason ?? "");
  const nul = gateImage(null);
  check("ไม่มีข้อมูลภาพเลย (null) → poor ไม่ throw", !nul.pass && nul.quality === "poor");
}

// 16. เจอคนแต่ landmark ไม่ครบ 33 จุด
{
  const r = gateImage(fakeImage({ landmarkCount: 20 }));
  check("landmark ไม่ครบ 33 จุด → poor (เอาไปวัดต่อไม่ได้)", !r.pass && codes(fakeImage({ landmarkCount: 20 })).includes("no_landmarks"));
}

console.log("\n── หลายปัญหาพร้อมกัน + สรุปคุณภาพทั้งสแกน ──");

// 17. หลายปัญหา → รายงานครบ เรียงตามความสำคัญ
{
  const r = gateImage(fakeImage({ bodyFrac: 0.45, tilt: 15, meanLuma: 30 }));
  check("ไกล+เอียง+มืด → poor และรายงานครบทั้งสามข้อ", !r.pass && r.reasons.length >= 3, r.reasons.join(" / "));
  check("ข้อแรกที่ TTS อ่าน = เรื่องแสง (สาเหตุรากมาก่อน)", r.reason === GATE_MESSAGES.dark, r.reason ?? "");
  check("ข้อที่ระดับ reject ต้องมาก่อน warn เสมอ", r.issues[0].severity === "reject");
}

// 18. metrics ต้องติดกลับไปเสมอ (จอ/log เอาไปดูได้ว่าทำไมถึงไม่ผ่าน)
{
  const r = gateImage(fakeImage({ bodyFrac: 0.7, meanLuma: 111, maskCoverage: 0.2 }));
  check(
    "metrics ครบ (visibility/ระยะ/เอียง/แสง/mask)",
    r.metrics.keyVisibility === 0.95 &&
      r.metrics.bodyHeightFrac === 0.7 &&
      r.metrics.meanLuma === 111 &&
      r.metrics.maskCoverage === 0.2 &&
      r.metrics.shoulderTiltDeg === 0,
    JSON.stringify(r.metrics)
  );
}

// 19. คุณภาพของทั้งสแกน = ภาพที่แย่ที่สุด
{
  check("good + good → good", worstQuality(["good", "good"]) === "good");
  check("good + ok → ok", worstQuality(["good", "ok"]) === "ok");
  check("ok + poor → poor", worstQuality(["ok", "poor"]) === "poor");
  check("ค่าแปลก ๆ /ว่าง → ถือว่า good ไม่พัง", worstQuality([null, undefined, "??"]) === "good");
}

// 20. ข้อความไทยทุกอันต้องมีจริงและเป็นไทย (TTS อ่านอันนี้ออกเสียง)
{
  const all = Object.values(GATE_MESSAGES);
  check("ข้อความครบทุกรหัส และไม่มีอันไหนว่าง", all.every((m) => m.trim().length > 5));
  check("ทุกข้อความเป็นภาษาไทย", all.every((m) => /[฀-๿]/.test(m)));
  check(
    "ข้อความบอก 'ทางแก้' ไม่ใช่ตำหนิผู้ใช้",
    !all.some((m) => /ผิดพลาด|ไม่ถูกต้อง|error|invalid/i.test(m)),
    all.join(" | ")
  );
}

console.log("\n── กติกาบ้าน ──");

// 21. gate ต้องเป็นคณิตล้วน (เทสได้ทุกกติกา ไม่ต้องมี DB/ไฟล์/เวลา)
{
  try {
    const src = readFileSync(join(process.cwd(), "src/lib/bodyScanGate.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    check("ไม่ import prisma/fs/fetch", !/@\/lib\/prisma|from "fs|fetch\(/.test(code));
    check("ไม่เรียกเวลาปัจจุบัน (ผลต้องซ้ำได้เสมอ)", !/new Date\(/.test(code) && !/Date\.now\(/.test(code));
  } catch {
    console.log("… ข้ามการตรวจไฟล์ (รันจากนอกโฟลเดอร์โปรเจกต์)");
  }
}

// 22. 🔴 ไม่มีที่ไหนในสายเก็บภาพร่างกายแตะ public/uploads (WO-BODY §5 ข้อ 1)
{
  try {
    const files = [
      "src/lib/bodyStorage.ts",
      "src/app/api/coach/body-scan/route.ts",
      "src/app/api/coach/body-scan/commit/route.ts",
      "src/app/api/coach/body-photo/[scanId]/[view]/route.ts",
    ];
    let dirty: string | null = null;
    for (const f of files) {
      const code = readFileSync(join(process.cwd(), f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (/["'`][^"'`]*public\/uploads|"public"\s*,/.test(code)) dirty = f;
    }
    check("ไม่มีไฟล์ไหนในสายภาพร่างกายเขียนลง public/uploads", dirty === null, dirty ?? "");
  } catch {
    console.log("… ข้ามการตรวจไฟล์ (รันจากนอกโฟลเดอร์โปรเจกต์)");
  }
}

console.log(failed === 0 ? `\n✅ ผ่านทั้งหมด ${total} เคส` : `\n❌ ไม่ผ่าน ${failed}/${total} เคส`);
process.exit(failed === 0 ? 0 : 1);
