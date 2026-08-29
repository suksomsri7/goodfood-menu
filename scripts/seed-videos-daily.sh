#!/bin/bash
# เติมคลิปเข้าคิวตรวจให้ครบทุกท่า — รันวันละครั้ง แล้วปลด cron ตัวเองทิ้งเมื่อครบ 100%
# (เจ้าของสั่ง 29 ส.ค. 69: "ตั้งจนกว่าจะหมด")
#
# ทำ 2 อย่าง:
#   1. ท่าใหม่ที่ยังไม่เคยค้น            → seed-exercise-videos.ts
#   2. ท่าที่ตัวเลือกหมดแล้วไม่ผ่านสักอัน → topUpCandidates() หามาเพิ่ม
#      🔴 ข้อ 2 สำคัญ: seeder ข้ามท่าที่ "มีตัวเลือกแล้ว" เสมอ ไม่สนว่าตัวเลือกนั้นถูกปัดตกไปหมดแล้วหรือยัง
#         ท่าที่โดนปัดตกครบจึงค้างเป็นทางตันถาวรถ้าไม่มีตัวนี้ (เคยเจอกับท่า Walk fast)
#
# 🔴 SECRETS_MASTER_KEY อยู่ใน container เท่านั้น (ไม่มีใน .env บนเครื่อง) → ต้องดึงออกมาก่อนรัน
# 🔴 โควตา YouTube ~100 ครั้งค้น/วัน — ทั้งสองขั้นข้ามของที่ไม่ต้องทำเอง รันซ้ำได้ไม่เสียหาย
set -u
cd /root/projects/goodfood || exit 1

KEY=$(docker exec goodfood-web printenv SECRETS_MASTER_KEY 2>/dev/null)
if [ -z "$KEY" ]; then echo "$(date '+%F %T') ข้ามรอบนี้: อ่าน SECRETS_MASTER_KEY จาก container ไม่ได้"; exit 1; fi
export SECRETS_MASTER_KEY="$KEY"

echo "════ $(date '+%F %T') เติมคลิปเข้าคิว ════"

# ── 1. ท่าใหม่ที่ยังไม่เคยค้น ──
npx tsx scripts/seed-exercise-videos.ts 2>&1 | tail -2

# ── 2. ท่าที่ตัวเลือกหมดแล้ว + นับที่เหลือ ──
npx tsx -e '
import { prisma } from "@/lib/prisma";
import { topUpCandidates, QuotaExceeded } from "@/lib/exerciseVideoSearch";

(async () => {
  // ท่าที่ยังไม่มีคลิป และไม่เหลือตัวเลือกให้ตรวจแล้ว = ทางตัน ต้องหามาเพิ่ม
  const dead: Array<{ key: string; name: string }> = await prisma.$queryRaw`
    SELECT e.key, e.name FROM exercises e
    WHERE e."videoUrl" IS NULL
      AND EXISTS (SELECT 1 FROM exercise_video_candidates c WHERE c."exerciseKey" = e.key)
      AND NOT EXISTS (
        SELECT 1 FROM exercise_video_candidates c
        WHERE c."exerciseKey" = e.key AND c.status IN (${"pending"}, ${"sent"}))
    LIMIT 40`;

  let added = 0;
  for (const ex of dead) {
    try {
      const n = await topUpCandidates(ex.key);
      if (n > 0) { added += n; console.log(`  + ${ex.name}: หามาเพิ่ม ${n} คลิป`); }
    } catch (e) {
      if (e instanceof QuotaExceeded) { console.log("  โควตา YouTube วันนี้หมด — ไว้ต่อพรุ่งนี้"); break; }
      console.log(`  ! ${ex.name}: ${(e as Error).message.slice(0, 80)}`);
    }
  }
  console.log(`ทางตัน ${dead.length} ท่า · เติมเพิ่ม ${added} คลิป`);

  const total = await prisma.exercise.count();
  const withVid = await prisma.exercise.count({ where: { NOT: { videoUrl: null } } });
  console.log(`มีคลิปแล้ว ${withVid}/${total} ท่า`);
  await prisma.$disconnect();
  // exit 9 = ครบทุกท่าแล้ว ให้ shell ถอด cron ตัวเองทิ้ง
  process.exit(withVid >= total ? 9 : 0);
})();
'
if [ $? -eq 9 ]; then
  crontab -l 2>/dev/null | grep -v 'seed-videos-daily.sh' | crontab -
  echo "$(date '+%F %T') ✅ ทุกท่ามีคลิปครบแล้ว — ถอด cron ตัวนี้ออกเรียบร้อย"
fi
