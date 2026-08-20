#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
body_worker.py — CV worker ของ Body Progress (WO-BP-1 §B2)

ทำอย่างเดียว: รับ path รูป → คืน landmark 33 จุด + ตัวเลขคุณภาพภาพ (ดิบ ๆ ไม่ตัดสิน)
คนตัดสินว่า "ผ่าน/ไม่ผ่าน" คือ src/lib/bodyScanGate.ts ฝั่ง Next — ไฟล์นี้ห้ามมีความเห็น

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
    masks = getattr(res, "segmentation_masks", None) or []
    if masks:
        m = masks[0].numpy_view()
        mask_coverage = float(np.mean(m > MASK_THRESHOLD))

    return {
        "ok": True,
        "path": path,
        "personCount": person_count,
        "landmarks": landmarks,
        "maskCoverage": round(mask_coverage, 5),
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
