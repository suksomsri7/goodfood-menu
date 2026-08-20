#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
body_worker.py — CV worker ของ Body Progress (WO-BP-1 §B2 · +silhouette grid WO-BP-2 §B1)

ทำอย่างเดียว: รับ path รูป → คืน landmark 33 จุด + ตัวเลขคุณภาพภาพ + เงาร่าง (ดิบ ๆ ไม่ตัดสิน)
คนตัดสินว่า "ผ่าน/ไม่ผ่าน" คือ src/lib/bodyScanGate.ts ฝั่ง Next — ไฟล์นี้ห้ามมีความเห็น
คนคิดตัวเลขวัด (กว้าง/ลึก/รอบวง) คือ src/lib/bodyMeasure.ts — ไฟล์นี้ส่งแค่ข้อมูลดิบให้

ทำไมเป็น process แยกบน host ไม่ใช่ใน container:
  mediapipe + libgles ติดตั้งบน host แล้ว (PoC ผ่าน 30ms/ภาพ) · ยัดเข้า image Next = image บวมหลายร้อย MB
  container คุยผ่าน http://host.docker.internal:8077 (Fable เพิ่ม extra_hosts ตอน deploy)

🔴 กติกาความปลอดภัย (ห้ามแก้ให้หลวมลง):
  1. bind 127.0.0.1 เท่านั้น — ไม่มี auth ใด ๆ ในนี้ ถ้าหลุดออกเน็ตคือใครก็สั่งอ่านไฟล์ได้
  2. อ่านได้เฉพาะไฟล์ที่ realpath แล้วยังอยู่ใต้ PRIVATE_ROOT — กัน ../ และ symlink ที่ชี้ออกนอก
     (โดยเฉพาะ public/uploads: รูปร่างกายห้ามไปโผล่ที่นั่น และ worker ก็ห้ามอ่านจากที่นั่นด้วย)
  3. ไม่เขียนไฟล์ใด ๆ · ไม่ส่งอะไรออกเน็ต · ไม่ log ตัวเลข landmark (นั่นคือข้อมูลร่างกายลูกค้า)

รัน:  python3 worker/body_worker.py            (พอร์ต 8077)
      pm2 start ecosystem.body.config.js       (วิธีจริงบน VPS)
เทส:  curl -s localhost:8077/health
      curl -s localhost:8077/analyze -H 'content-type: application/json' \
        -d '{"paths":["/var/lib/goodfood/private/body/xxx/pending-front.jpg"]}'
"""

import base64
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np

import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

# ── ค่าคงที่ (path เดียวกับที่ volume ของ container ชี้มา) ──
PRIVATE_ROOT = os.path.realpath(os.environ.get("BODY_PRIVATE_DIR", "/var/lib/goodfood/private"))
MODEL_PATH = os.environ.get("BODY_MODEL_PATH", os.path.join(PRIVATE_ROOT, "models", "pose_landmarker_lite.task"))
HOST = os.environ.get("BODY_WORKER_HOST", "127.0.0.1")
PORT = int(os.environ.get("BODY_WORKER_PORT", "8077"))

# ภาพต่อคำขอ — สแกนหนึ่งครั้งมี 3 ภาพเป็นอย่างมาก (แต่ API ฝั่ง Next ส่งทีละภาพ)
MAX_PATHS = 3
# body ของคำขอ: มีแค่ path ไม่มีรูป → ไม่ควรเกินไม่กี่ KB
MAX_BODY_BYTES = 64 * 1024
# mask ถือว่า "เป็นคน" ที่ค่านี้ขึ้นไป (mediapipe คืน float 0-1)
MASK_THRESHOLD = 0.5

# ขนาดตารางเงาร่างที่ส่งกลับ (WO-BP-2 §B1) — 128×256 bit-packed = 4096 ไบต์ → base64 ~5.5KB
# ทำไมไม่ส่ง mask เต็ม: mask เต็มของภาพ 720×1280 = ~1MB ต่อภาพ แค่ส่งผ่าน JSON ก็แพงกว่างานทั้งหมดที่เหลือ
# ทำไม 128×256 พอ: ตัววัดต้องการ "ความกว้างของลำตัวที่ระดับ y" ไม่ใช่ขอบคม — 1 ช่อง ≈ 5-6 พิกเซล (~1 ซม.บนคนจริง)
GRID_W = 128
GRID_H = 256

_landmarker = None  # โหลดครั้งเดียวตอนสตาร์ท — โหลดใหม่ทุก request = 300ms+ ต่อภาพ


def log(msg: str) -> None:
    """log ลง stderr เท่านั้น (pm2 แยก out/err ให้) — ห้าม log ค่า landmark หรือชื่อไฟล์เต็มของลูกค้า"""
    print("[body_worker] %s" % msg, file=sys.stderr, flush=True)


def load_landmarker():
    """สร้าง PoseLandmarker ตัวเดียวใช้ตลอดอายุ process (single-thread — VPS 2 core ไม่ต้องขนาน)"""
    global _landmarker
    if _landmarker is not None:
        return _landmarker
    if not os.path.isfile(MODEL_PATH):
        raise RuntimeError("ไม่พบโมเดลที่ %s" % MODEL_PATH)
    opts = vision.PoseLandmarkerOptions(
        base_options=mpp.BaseOptions(model_asset_path=MODEL_PATH),
        output_segmentation_masks=True,
    )
    _landmarker = vision.PoseLandmarker.create_from_options(opts)
    log("โหลดโมเดลแล้ว: %s" % MODEL_PATH)
    return _landmarker


def safe_path(raw):
    """
    path ที่ยอมให้อ่าน = realpath แล้วยังอยู่ใต้ PRIVATE_ROOT และเป็นไฟล์จริง
    ใช้ realpath (ไม่ใช่ normpath) เพราะต้องคลาย symlink ด้วย — symlink ที่ชี้ไป /etc/shadow จะผ่าน normpath ได้
    คืน (path, None) ถ้าผ่าน · (None, เหตุผล) ถ้าไม่ผ่าน
    """
    if not isinstance(raw, str) or not raw:
        return None, "path ไม่ถูกต้อง"
    real = os.path.realpath(raw)
    if real != PRIVATE_ROOT and not real.startswith(PRIVATE_ROOT + os.sep):
        return None, "path อยู่นอกพื้นที่ส่วนตัว"
    if not os.path.isfile(real):
        return None, "ไม่พบไฟล์"
    return real, None


def mean_luma(rgb: np.ndarray) -> float:
    """
    ความสว่างเฉลี่ยทั้งภาพ 0-255 (Rec.601 luma) — คิดจากทั้งภาพ ไม่ใช่เฉพาะตัวคน
    ตั้งใจให้ mask-agnostic: ถ้าคิดเฉพาะในตัวคน คนใส่เสื้อดำในห้องสว่างจะถูกหาว่า "แสงน้อย"
    ซึ่งไม่ใช่ปัญหาที่ user แก้ได้ด้วยการเปิดไฟ
    """
    arr = rgb.astype(np.float32)
    if arr.ndim == 2:
        gray = arr
    else:
        ch = arr.shape[2]
        if ch >= 3:
            gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        else:
            gray = arr[:, :, 0]
    return float(np.mean(gray))


def mask_bounds(binary: np.ndarray):
    """
    กรอบสี่เหลี่ยมที่ล้อมเงาร่าง เป็นสัดส่วน 0-1 ของภาพ "ก่อนย่อ" (WO-BP-2 §B1)

    ตัวสเกลส่วนสูงใช้ top→bottom ของกรอบนี้ ไม่ใช่ landmark จมูก→ข้อเท้า:
      จมูกไม่ใช่ยอดหัว และข้อเท้าไม่ใช่พื้น — ใช้ landmark จะขาดหายไปทั้งกระหม่อมและฝ่าเท้า (~10% ของส่วนสูง)
      กรอบ mask คือหัวจรดเท้าจริง ๆ ซึ่งเป็นสิ่งเดียวกับ "ส่วนสูง" ที่ผู้ใช้กรอกไว้ในโปรไฟล์
    bottom/right เป็นขอบนอก (แถวสุดท้าย+1) → (bottom-top)×สูงภาพ = จำนวนพิกเซลของร่างพอดี
    คืน None ถ้า mask ว่าง (ไม่เจอคน) — ห้ามคืนกรอบเต็มภาพ เพราะปลายทางจะคิดสเกลผิดโดยไม่รู้ตัว
    """
    rows = np.any(binary, axis=1)
    cols = np.any(binary, axis=0)
    if not rows.any() or not cols.any():
        return None
    h, w = int(binary.shape[0]), int(binary.shape[1])
    r = np.flatnonzero(rows)
    c = np.flatnonzero(cols)
    return {
        "top": round(float(r[0]) / h, 5),
        "bottom": round(float(r[-1] + 1) / h, 5),
        "left": round(float(c[0]) / w, 5),
        "right": round(float(c[-1] + 1) / w, 5),
    }


def mask_grid(binary: np.ndarray) -> dict:
    """
    ย่อ mask เป็นตาราง GRID_W×GRID_H แล้ว bit-pack เป็น base64 (row-major · MSB ก่อน)

    ย่อแบบ "เฉลี่ยพื้นที่แล้วตัดที่ 0.5" ไม่ใช่หยิบพิกเซลตัวแทน (nearest):
      nearest จะทำให้แขน/น่องที่บางกว่า 1 ช่องหายไปทั้งเส้นในบางแถวแบบสุ่ม → ความกว้างกระพริบระหว่างสแกน
      เฉลี่ยพื้นที่ให้ผลนิ่ง: ภาพเดิม = ตารางเดิมทุกครั้ง (กติกา deterministic ของ WO-BODY §1)
    ใช้ integral image เพื่อให้เป็น O(พื้นที่ภาพ) ครั้งเดียว — ภาพ 720×1280 ใช้เวลาไม่กี่มิลลิวินาที
    """
    h, w = int(binary.shape[0]), int(binary.shape[1])
    ii = np.zeros((h + 1, w + 1), dtype=np.int32)
    ii[1:, 1:] = np.cumsum(np.cumsum(binary.astype(np.int32), axis=0), axis=1)

    r_edge = np.linspace(0, h, GRID_H + 1).astype(np.int64)
    c_edge = np.linspace(0, w, GRID_W + 1).astype(np.int64)
    r0, r1 = r_edge[:-1, None], r_edge[1:, None]
    c0, c1 = c_edge[None, :-1], c_edge[None, 1:]

    sums = ii[r1, c1] - ii[r0, c1] - ii[r1, c0] + ii[r0, c0]
    areas = (r1 - r0) * (c1 - c0)
    # ช่องที่ไม่มีพิกเซลต้นทางเลย (ภาพเล็กกว่าตาราง) = ว่าง ไม่ใช่ "เป็นคน"
    cells = np.where(areas > 0, sums * 2 >= areas, False)

    packed = np.packbits(cells.astype(np.uint8), axis=-1, bitorder="big")
    return {
        "w": GRID_W,
        "h": GRID_H,
        "data": base64.b64encode(packed.tobytes()).decode("ascii"),
    }


def analyze_one(path: str) -> dict:
    """วิเคราะห์ 1 ภาพ → dict ตามสัญญาใน WO-BP-1 §B2 (ตัวเลขดิบล้วน ไม่ตัดสินผ่าน/ไม่ผ่าน)"""
    landmarker = load_landmarker()
    image = mp.Image.create_from_file(path)
    rgb = image.numpy_view()
    height, width = int(rgb.shape[0]), int(rgb.shape[1])

    res = landmarker.detect(image)
    poses = res.pose_landmarks or []
    person_count = len(poses)

    landmarks = []
    if person_count > 0:
        # lite model ตรวจคนเดียว — ถ้าเจอหลายชุด (ไม่ควรเกิด) เอาชุดแรก
        for lm in poses[0]:
            landmarks.append(
                {
                    "x": round(float(lm.x), 5),
                    "y": round(float(lm.y), 5),
                    # visibility อาจไม่มีในบาง build → ถือว่า 0 (ไม่ใช่ 1) เพื่อไม่ให้ gate ปล่อยผ่านมั่ว ๆ
                    "visibility": round(float(getattr(lm, "visibility", 0.0) or 0.0), 4),
                }
            )

    mask_coverage = 0.0
    grid = None
    bounds = None
    masks = getattr(res, "segmentation_masks", None) or []
    if masks:
        # binary ตัวเดียวใช้ทั้งสามค่า — threshold ต้องเป็นตัวเดียวกัน ไม่งั้น coverage กับ grid จะเล่าคนละเรื่อง
        # mediapipe จริงคืน (H,W,1) ไม่ใช่ (H,W) — บีบแกน channel ทิ้งก่อน ไม่งั้น integral image พัง
        binary = np.squeeze(np.asarray(masks[0].numpy_view())) > MASK_THRESHOLD
        if binary.ndim != 2:
            binary = binary.reshape(binary.shape[0], binary.shape[1])
        mask_coverage = float(np.mean(binary))
        bounds = mask_bounds(binary)
        # ไม่มีกรอบ = mask ว่าง → ตารางก็ไม่มีประโยชน์ (และ null บอกปลายทางตรง ๆ ว่า "วัดไม่ได้")
        if bounds is not None:
            grid = mask_grid(binary)

    return {
        "ok": True,
        "path": path,
        "personCount": person_count,
        "landmarks": landmarks,
        "maskCoverage": round(mask_coverage, 5),
        # เพิ่มใหม่ (WO-BP-2 §B1) — ของเดิมทุก field ข้างบนคงรูปเดิมเป๊ะ เพราะ gate ของ BP-1 ยังอ่านอยู่
        "maskGrid": grid,
        "maskBounds": bounds,
        "width": width,
        "height": height,
        "meanLuma": round(mean_luma(rgb), 2),
    }


def analyze_paths(raw_paths) -> dict:
    if not isinstance(raw_paths, list) or not raw_paths:
        return {"error": "ต้องส่ง paths เป็น array ของ path อย่างน้อย 1 รายการ"}
    if len(raw_paths) > MAX_PATHS:
        return {"error": "ส่งได้สูงสุด %d ภาพต่อครั้ง" % MAX_PATHS}

    started = time.time()
    images = []
    for raw in raw_paths:
        path, reason = safe_path(raw)
        if path is None:
            # ไม่ส่ง path ที่ผิดกลับไปใน error — กันการใช้ worker เป็นเครื่องมือ probe ระบบไฟล์
            log("ปฏิเสธ path (%s)" % reason)
            images.append({"ok": False, "error": reason})
            continue
        try:
            images.append(analyze_one(path))
        except Exception as e:  # noqa: BLE001 — ภาพเสีย/ไม่ใช่รูป ต้องไม่ทำให้ทั้ง request ตาย
            log("วิเคราะห์ไม่สำเร็จ: %s" % type(e).__name__)
            images.append({"ok": False, "error": "อ่านรูปไม่สำเร็จ"})

    ms = int((time.time() - started) * 1000)
    log("วิเคราะห์ %d ภาพใน %dms" % (len(images), ms))
    return {"ok": True, "ms": ms, "images": images}


class Handler(BaseHTTPRequestHandler):
    server_version = "bodyworker/1.0"
    protocol_version = "HTTP/1.1"

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        """ปิด access log ปริยายของ BaseHTTPRequestHandler — path มี memberId อยู่ ไม่ควรลง log"""
        return

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            self._send(200, {"ok": True, "model": os.path.basename(MODEL_PATH), "loaded": _landmarker is not None})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.split("?")[0] != "/analyze":
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send(400, {"error": "ขนาดคำขอไม่ถูกต้อง"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:  # noqa: BLE001
            self._send(400, {"error": "JSON ไม่ถูกต้อง"})
            return

        result = analyze_paths(payload.get("paths"))
        self._send(400 if "error" in result else 200, result)


def main() -> None:
    log("private root = %s" % PRIVATE_ROOT)
    try:
        load_landmarker()  # โหลดตั้งแต่สตาร์ท — request แรกจะได้ไม่ช้ากว่าที่เหลือ
    except Exception as e:  # noqa: BLE001
        log("เริ่มไม่สำเร็จ: %s" % e)
        sys.exit(1)
    server = HTTPServer((HOST, PORT), Handler)
    log("ฟังอยู่ที่ http://%s:%d" % (HOST, PORT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("ปิดตัวลง")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
