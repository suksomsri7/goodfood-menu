/**
 * pm2 config ของ CV worker (Body Progress · WO-BP-1 §B2)
 *
 * รันบน host ไม่ใช่ใน container — mediapipe + libgles ติดตั้งบน host แล้ว
 * container คุยผ่าน http://host.docker.internal:8077 (ต้องมี extra_hosts ใน docker-compose)
 *
 *   pm2 start ecosystem.body.config.js
 *   pm2 logs body-worker
 *   pm2 save
 *
 * 🔴 bind 127.0.0.1 เท่านั้น (ตั้งในตัว worker) — service นี้ไม่มี auth
 *    ใครถึงพอร์ตนี้ได้ = สั่งอ่านไฟล์ใต้ private dir ได้
 */
module.exports = {
  apps: [
    {
      name: "body-worker",
      script: "worker/body_worker.py",
      interpreter: "python3",
      cwd: __dirname,
      // 1 instance เท่านั้น: โมเดลกินแรมและ VPS มี 2 core — คิวเดียวพอ (3 ภาพ ~0.5 วิ)
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      // โมเดล ~5MB + numpy — ปกติอยู่แถว 300-400MB · เกิน 600MB = มีอะไรรั่ว ให้ restart
      max_memory_restart: "600M",
      env: {
        BODY_PRIVATE_DIR: "/var/lib/goodfood/private",
        // 172.17.0.1 = docker bridge — container ถึงได้ โลกภายนอกถึงไม่ได้ (127.0.0.1 container มองไม่เห็น)
        BODY_WORKER_HOST: "172.17.0.1",
        BODY_WORKER_PORT: "8077",
        PYTHONUNBUFFERED: "1",
      },
      out_file: "/var/log/pm2/body-worker.out.log",
      error_file: "/var/log/pm2/body-worker.err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
