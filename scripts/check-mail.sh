#!/usr/bin/env bash
# ตรวจว่าอีเมลของ goodfood.in.th ตั้งครบและรับจริงไหม
#
#   bash scripts/check-mail.sh              # ตรวจ DNS อย่างเดียว
#   SEND_TEST=1 bash scripts/check-mail.sh  # ส่งเมลทดสอบเข้า support@goodfood.in.th ด้วย (ผ่าน Resend ของ SHARK)
#
# 📌 goodfood.in.th DNS อยู่ที่ Cloudflare — วิธีที่เลือกไว้คือ Cloudflare Email Routing (ฟรี)
#    CF จะใส่ MX 3 แถว (route1/2/3.mx.cloudflare.net) + SPF ให้อัตโนมัติเมื่อเปิดใช้งาน
set -uo pipefail
DOMAIN="${DOMAIN:-goodfood.in.th}"
ADDR="${ADDR:-support@$DOMAIN}"

echo "▶ NS"; dig +short NS "$DOMAIN"
echo "▶ MX"; MX=$(dig +short MX "$DOMAIN"); echo "${MX:-(ไม่มี — ยังรับเมลไม่ได้)}"
echo "▶ SPF/TXT"; TXT=$(dig +short TXT "$DOMAIN"); echo "${TXT:-(ไม่มี)}"
echo "▶ DMARC"; dig +short TXT "_dmarc.$DOMAIN" | head -2

ok=0
echo "$MX" | grep -q "mx.cloudflare.net" && { echo "✅ MX ชี้ Cloudflare Email Routing แล้ว"; ok=1; }
echo "$MX" | grep -q "improvmx.com"      && { echo "✅ MX ชี้ ImprovMX แล้ว"; ok=1; }
[ "$ok" = 0 ] && echo "❌ ยังไม่มี MX ที่ใช้งานได้ — เมลถึง $ADDR จะเด้งกลับ"
echo "$TXT" | grep -q "v=spf1" || echo "⚠️  ยังไม่มี SPF (ผู้รับบางเจ้าจะตีเป็นสแปม)"

if [ "${SEND_TEST:-0}" = "1" ]; then
  # 📌 คีย์ที่ใช้ได้จริงอยู่ใน .env.production.local — ตัวใน .env เป็นค่าว่าง
  KEY=$(grep -h '^RESEND_API_KEY=' /root/projects/shark-in-th/.env.production.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
  if [ -z "$KEY" ]; then
    echo "⚠️  ไม่เจอ RESEND_API_KEY — ข้ามการส่งเมลทดสอบ"
    exit 0
  fi
  echo "▶ ส่งเมลทดสอบ → $ADDR"
  curl -sS -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"from\":\"SHARK <noreply@shark.in.th>\",\"to\":[\"$ADDR\"],\"subject\":\"ทดสอบระบบเมล $DOMAIN\",\"text\":\"ถ้าเห็นเมลฉบับนี้ในกล่องปลายทาง = การส่งต่อของ $ADDR ทำงานแล้ว\"}" \
    | head -c 300
  echo
  echo "📌 ไปดูที่กล่องปลายทางที่ตั้งไว้ (ถ้าไม่มา ลองดูใน Spam ก่อน)"
fi
