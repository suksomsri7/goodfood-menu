#!/usr/bin/env bash
# เฝ้าการย้ายโซน goodfood.in.th ไปบัญชี Cloudflare ใหม่ (Siamdivethailand@gmail.com)
#
#   bash scripts/watch-dns-migration.sh          # ตรวจครั้งเดียว
#   LOOP=1 bash scripts/watch-dns-migration.sh   # ตรวจซ้ำทุก 5 นาที
#
# ลำดับที่ถูกต้อง (ห้ามสลับ):
#   1) ลบ DNSSEC/DS ที่ THNIC  → 2) รอ DS หายจาก parent (TTL 7200)
#   3) เปลี่ยน NS เป็น cullen/janet → 4) รอ Active → 5) เปิด Email Routing
#
# 🔴 ถ้าเปลี่ยน NS ทั้งที่ DS ยังอยู่ = DNSSEC ไม่ผ่าน → SERVFAIL ทั้งโดเมน (เว็บ+LINE webhook+เมล ดับ)
set -uo pipefail
D=goodfood.in.th
NEW_NS="cullen.ns.cloudflare.com janet.ns.cloudflare.com"

check() {
  echo "══ $(date '+%F %H:%M:%S') ══"

  DS=$(dig @1.1.1.1 DS $D +short)
  if [ -n "$DS" ]; then
    echo "1️⃣  DNSSEC: ⛔ ยังมี DS อยู่ที่ .in.th → ห้ามเปลี่ยน NS"
    echo "    $DS"
  else
    echo "1️⃣  DNSSEC: ✅ ไม่มี DS แล้ว — เปลี่ยน NS ได้"
  fi

  NS=$(dig @1.1.1.1 NS $D +short | tr -d '.' | sort | tr '\n' ' ')
  echo "2️⃣  NS ปัจจุบัน: ${NS:-(ไม่มี)}"
  hit=0
  for n in $NEW_NS; do echo "$NS" | grep -q "${n%.}" && hit=$((hit+1)); done
  [ "$hit" = 2 ] && echo "    ✅ ชี้มาที่โซนใหม่แล้ว" || echo "    ⏳ ยังเป็นโซนเดิม (ernest/vita)"

  A=$(dig @1.1.1.1 $D A +short | head -1)
  echo "3️⃣  A record: ${A:-(ไม่มี)} $([ "$A" = "72.62.196.201" ] && echo '✅ ชี้เครื่องเราตรง (DNS only)' || echo '⚠️ ไม่ใช่ IP เดิม — เช็คว่าเปิด proxy อยู่หรือเปล่า')"

  MX=$(dig @1.1.1.1 MX $D +short | tr '\n' ' ')
  if echo "$MX" | grep -q "mx.cloudflare.net"; then
    echo "4️⃣  MX: ✅ $MX"
  else
    echo "4️⃣  MX: ⏳ ยังไม่มี (${MX:-ว่าง}) — เปิด Email Routing หลังโซน Active"
  fi

  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://$D || echo ERR)
  echo "5️⃣  เว็บ: $code $([ "$code" = "200" ] && echo '✅ ปกติ' || echo '⚠️')"
  echo
}

if [ "${LOOP:-0}" = "1" ]; then
  while true; do check; sleep 300; done
else
  check
fi
