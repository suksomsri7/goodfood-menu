# 🥗 GOODFOOD — แผนงาน "AI นักโภชนาการ + ฟิตเนสเทรนเนอร์" (เฟส 0-5)

> **เขียน:** 2026-07-26 · **สถานะ:** รอเริ่มเฟส 0
> **บทบาท session ถัดไป:** Fable 5 = ผู้คุมงาน (architecture/QC gate/ตัดสินใจ) · Opus 5 = ผู้ลงมือทำ (implement ตาม WO)
> **ภาษา:** ทุกข้อความถึง user ต้องเป็นภาษาไทย (user อ่านอังกฤษไม่ได้)

---

## 0) สถานะปัจจุบัน (verify จริงแล้ว 2026-07-26)

### ระบบที่ LIVE
- https://goodfood.in.th — Docker บน VPS นี้ (`/root/projects/goodfood`), `goodfood-web` :3001, `goodfood-db` postgres :5437
- LINE OA **GOODFOOD** `@385xnbxz` (channel 2010189036) — token ใช้ได้, webhook `https://goodfood.in.th/api/line/webhook` active
- LIFF app เดียว: `2010189817-as2J0plj` (อยู่ใน LINE Login channel 2010189817) — `src/lib/liff.ts` มี fallback: goal/menu/orders ใช้ ID ของ cal ถ้าไม่ตั้งค่า
- **แพลน LINE = ฟรี 300 push/เดือน** (reply ไม่นับ — ฟรีไม่จำกัด)
- Git: `git@github.com:suksomsri7/goodfood-menu.git` push ตรง main · HEAD ล่าสุด `65cd47f`

### แก้เสร็จรอบล่าสุด (deploy + verify แล้ว)
- `db78c1a` — LIFF ID ว่างทำหน้า /goal หมุนค้าง → fallback + user ใหม่ (members/me 404) เห็น OnboardingModal เต็ม 8 ขั้นแทนหมุนค้าง
- `65cd47f` — sync งานเก่า 48 ไฟล์บน VPS ขึ้น GitHub (ตัดเมนูคลังอาหาร, โลโก้ใหม่, ลบ LINE secret hardcode)

### ของที่ "สร้างไว้แล้วแต่ยังไม่เปิดใช้" (สำคัญมาก — ห้ามสร้างซ้ำ!)
| ของ | ที่อยู่ | สถานะ |
|---|---|---|
| ระบบโค้ช 9 แบบ (morning/lunch/dinner/evening/weekly/photo/exercise/milestone/inactive) | `src/lib/coaching.ts` (~900 บรรทัด: gatherMemberContext, buildPrompt, generateCoachingMessage+fallback, createCoachingFlexMessage, sendCoachingMessage) | ✅ โค้ดครบ ❌ ไม่มี cron ยิง (เรียกจริงแค่ตอน log exercise) |
| Gate สิทธิ์รายคน `isAiCoachActive()` | `src/lib/coaching.ts:108` — ไม่มี type→ปิด / type ปิด→ปิด / courseDuration 0→เปิดตลอด / เลย aiCoachExpireDate→ปิด | ✅ พร้อมใช้ |
| MemberType (โควตา AI รายวัน 7 ชนิด + เวลาโค้ชต่อประเภท + courseDuration) | `prisma/schema.prisma` + UI `/backoffice/member-types` + API `/api/member-types` | ✅ โค้ดครบ ❌ **DB ว่าง 0 แถว** |
| ผูกประเภท+วันหมดอายุรายคน | UI `/backoffice/members` (editForm มี memberTypeId + aiCoachExpireDate) | ✅ มี UI ❌ ยังไม่เคยใช้ (member เดียว "Tu" ไม่มี type) |
| Log ครบ: MealLog / WeightLog / WaterLog / ExerciseLog / ProgressPhoto / AiUsageLog | schema + API | ✅ ใช้งานจริง |
| เป้าโภชนาการรายคน: dailyCalories/Protein/Carbs/Fat/Sodium/Sugar/Water + BMR/TDEE | Member model (คำนวณตอน onboarding) | ✅ มีข้อมูล ❌ UI โชว์แค่แคลอรี่เป็นหลัก |
| LINE webhook | `src/app/api/line/webhook/route.ts` (239 บรรทัด) | ✅ รับ+เก็บลง LineConversation/LineMessage ❌ **ไม่ตอบอะไรเลย** |
| Notification prefs รายคน 10 ตัว + notificationsPausedUntil | Member model | ✅ มี |
| Secrets ใน DB | `/backoffice/settings/api-keys` → `getSecret("KEY")` จาก `@/lib/secrets/store` (AES-256-GCM, cache 5 นาที) | ✅ ระบบพร้อม ❌ **ยังไม่ได้ใส่ OPENAI_API_KEY** |

### การตัดสินใจของ user (LOCKED — ห้าม re-open)
1. **ยกเลิกระบบร้านค้า/สั่งอาหารแล้ว** — แอปนี้ = โค้ชสุขภาพ. meal plan เป็นเมนูทำเอง/หาซื้อทั่วไป ห้ามผูกร้าน
2. โค้ชทัก **วันละ 1 ครั้งตอนเช้า** (ไม่เอา 4x/วัน): สรุปเมื่อวาน + แผนออกกำลังกายวันนี้ + แผนอาหารวันนี้ + การปรับแผนให้ตรงเป้า
3. ต้องมี **หน้าปฏิทิน** ให้ user กดดูแผนแต่ละวัน (ออกกำลังกาย + มื้ออาหาร)
4. Macro dashboard + เตือนโซเดียม/น้ำตาล = เอา
5. **ฟีเจอร์โค้ชทั้งหมดเปิดเฉพาะสมาชิกที่แอดมินเลือก** ผ่าน backoffice (ใช้ MemberType + aiCoachExpireDate ที่มีอยู่)

---

## 1) กฎเหล็กสำหรับทีมทำงาน

1. **ตอบ user เป็นภาษาไทยเสมอ** (รวม commit อธิบายให้ user, รายงาน, ปุ่ม UI)
2. **VPS 2 core / 3GB RAM** — ห้ามรัน agent ขนาน >2 พร้อม docker build = OOM. build ทีละอย่าง
3. **NEXT_PUBLIC_\* ถูก bake ตอน build** — แก้ .env.production แล้วต้อง `docker compose up -d --build web` เสมอ (ใช้เวลาหลายนาที รันเป็น background)
4. **Verify ใน prod ก่อนพูดว่าเสร็จ**: curl endpoint จริง + query DB จริง + grep bundle ใน container (`docker exec goodfood-web grep -roh "..." /app/.next/static`) — ห้ามอ้าง "น่าจะได้"
5. **ห้ามแต่งข้อมูล** — เมนูอาหาร/ท่าออกกำลังกาย/แคลอรี่ ต้องมาจาก AI ที่ระบุว่าเป็นคำแนะนำ หรือข้อมูลใน DB ห้าม hardcode มั่ว
6. UX **minimal สะอาด ไม่มี jargon** เหมาะคนไทยทั่วไป — validation แบบ inline ไม่ใช่ alert()
7. โควตา LINE: **push นับใน 300/เดือน, reply ฟรี** — cron ทุกตัวต้องนับ/log จำนวน push ที่ส่ง และส่งเฉพาะคนที่ `isAiCoachActive()`
8. AI calls ทุกจุดต้องผ่าน `getSecret("OPENAI_API_KEY")` (ห้าม process.env ตรง) + เช็คโควตารายวันจาก MemberType + log ลง AiUsageLog
9. cron ฝั่ง VPS ใช้ pattern เดิม: crontab เรียก `curl -H "X-Cron-Secret: <ARTICLE_CRON_SECRET ใน .env.production>" https://goodfood.in.th/api/cron/...` (เวลา crontab = UTC, BKK-7)
10. commit → push ตรง main, ลงท้าย Co-Authored-By ตาม harness
11. งานที่แตะ schema: โปรเจกต์นี้ใช้ **`prisma db push`** style (ไม่มี migrations folder) — หลัง push schema ต้อง restart/build ใหม่
12. ทุก WO จบด้วย **QC checklist ของ WO นั้น** ผ่านครบก่อนไป WO ถัดไป — Fable เป็นคน tick, Opus ห้าม tick เอง

---

## 2) สถาปัตยกรรม Gate (ใช้ทุกเฟส)

```
ทุกฟีเจอร์ใหม่ (ปฏิทิน / สร้างแผน / cron เช้า / AI แชท / macro insight)
   └─> เช็ค isAiCoachActive(member) ก่อนเสมอ (จุดเดียว src/lib/coaching.ts:108)
        ├─ true  → ใช้งานได้ + เช็คโควตา AI รายวันตาม MemberType
        └─ false → user side: หน้า/การ์ด "ฟีเจอร์สำหรับสมาชิกคอร์ส — ติดต่อแอดมิน" (soft upsell)
                   cron: ข้ามคนนี้ · LINE แชท: ตอบแนะนำคอร์ส 1 ครั้ง (reply ฟรี)
```
- สร้าง helper กลาง `requireAiCoach(lineUserId)` ใน `src/lib/coaching.ts` คืน `{member, active}` — API route ใหม่ทุกตัว import ตัวนี้ ห้าม copy-paste logic

---

## 3) เฟส 0 — QC ฐานราก + เปิดระบบสมาชิก (ทำก่อนทุกเฟส)

> เป้าหมาย: ระบบ gate ใช้ได้จริงจาก backoffice + ปุ่มทุกปุ่มที่มีอยู่ทำงาน + ใส่ key

### WO-0.1 ใส่ OPENAI_API_KEY
- user ต้องเตรียม key → ใส่ผ่าน `/backoffice/settings/api-keys` (ไม่แก้ .env)
- ตรวจ: โค้ด AI ตัวไหนยังอ่าน `process.env.OPENAI_API_KEY` ตรง → refactor เป็น `getSecret()` (ตอนนี้ยืนยันแล้วว่า FAL_KEY refactor แล้ว ตัวอื่นต้องไล่เช็ค: ai-analysis, analyze-food, analyze-food-text, analyze-exercise, ai-select-menu, recommendation, coaching.ts)
- **QC:** เรียก 1 AI endpoint จริงผ่าน curl → ได้ผลวิเคราะห์กลับ + มีแถวใหม่ใน AiUsageLog

### WO-0.2 สร้าง MemberType ชุดแรก (ผ่าน UI จริง — ถือเป็นการเทส UI ไปในตัว)
- สร้าง 3 ประเภท: `ทดลองใช้ 7 วัน` (courseDuration 7) / `คอร์สโค้ช 30 วัน` (30) / `VIP` (0 = ไม่จำกัด)
- ผูกสมาชิก Tu = VIP (จะได้ใช้เทสทุกเฟส)
- **QC ทดสอบครบทุกปุ่ม `/backoffice/member-types`:**
  - [ ] ปุ่มสร้างประเภท (ทั้ง 2 จุดที่มี openCreateModal) เปิด modal
  - [ ] กรอกชื่อ/คำอธิบาย/สี → บันทึก → แถวขึ้นในตาราง + อยู่ใน DB จริง
  - [ ] สลับ aiLimitMode `by_type` ⇄ `combined` — field เปลี่ยนชุดถูกต้อง + ค่าบันทึกจริง
  - [ ] แก้ไข limit ทั้ง 7 ช่อง (photo/analysis/text/recommend/exercise/menu/scan) + totalDailyAiLimit → save → reload ค่าคงอยู่
  - [ ] แก้เวลาโค้ช 4 ช่อง + waterReminderTimes + weeklyInsightsTime + inactiveReminderDays → save → คงอยู่
  - [ ] toggle เปิด/ปิดประเภท (toggleMemberTypeActive) → ค่าใน DB เปลี่ยน
  - [ ] ปุ่มแก้ไข (openEditModal) → ค่าเดิม prefill ครบทุก field
  - [ ] ปุ่มลบ → มี confirm → ลบจริง (เทสกับประเภทหลอกที่สร้างทิ้ง) · ลบประเภทที่มีสมาชิกผูกอยู่ → ต้องถูกกันหรือ set null ไม่ crash
  - [ ] ปิด modal (ทั้งปุ่มปิดและคลิกนอก) ไม่ทำ state ค้าง
- **QC ทดสอบครบทุกปุ่ม `/backoffice/members`:**
  - [ ] list โหลด + filter ตาม memberType ทำงาน
  - [ ] ปุ่ม "ดูรายละเอียด" เปิด modal + แท็บทั้ง 4 (ข้อมูลทั่วไป / AI Usage / Stock อาหาร / ประวัติออเดอร์) กดสลับได้ไม่ error
  - [ ] ปุ่มแก้ไข → เลือก memberType จาก dropdown + ตั้ง aiCoachExpireDate → บันทึก → DB อัปเดตจริง (`SELECT "memberTypeId","aiCoachExpireDate" FROM members`)
  - [ ] ปุ่มยกเลิกแก้ไข คืนค่าเดิม
  - [ ] ปุ่ม "ส่งข้อความ" — ส่งถึง LINE จริง (push 1 ข้อความ — นับโควตา, เทสครั้งเดียวพอ)
  - [ ] ปุ่มลบสมาชิก + confirm modal (เทสกับ member หลอกที่สร้างผ่าน API เอง แล้วลบ — **ห้ามลบ Tu**)
  - [ ] แท็บ "Stock อาหาร" / "ประวัติออเดอร์" — ร้านค้ายกเลิกแล้ว → เสนอ user ว่าจะซ่อนไหม (ตัดสินใจใน session หน้า อย่าซ่อนเองโดยพลการ)

### WO-0.3 QC ฝั่ง user LIFF ที่มีอยู่ (กันของเดิมพังก่อนต่อยอด)
- [ ] เปิดจาก LINE ด้วยบัญชี Tu: /cal โหลด, บันทึกอาหารด้วยปุ่มทั้ง 4 (ออกกำลังกาย/สแกนบาร์โค้ด/ถ่ายรูป/กรอกเอง) อย่างละ 1 ครั้ง
- [ ] /goal: กราฟน้ำหนัก + อัปเดตน้ำหนัก + ตั้งเป้าใหม่ (reset goal ผ่าน WelcomeBack/ปุ่มในหน้า)
- [ ] user ใหม่ (บัญชี LINE อื่นหรือเครื่องอื่น): เข้า /goal → เจอ Onboarding 8 ขั้น → กด ย้อนกลับ/ถัดไป ทุกขั้น → จบแล้วเข้าหน้าเป้าหมายได้ + แถวใหม่ใน members
- [ ] ปุ่มใน OnboardingModal: เลือกเพศ, activityLevel, goalType, dietType, custom macros slider, targetMonths — บันทึกลง DB ครบทุก field (SELECT ตรวจ)
- หมายเหตุ: ขั้นนี้บางข้อต้องให้ **user เทสบนมือถือจริง** — Opus เตรียม checklist ส่งให้ user ผ่านแชท แล้วรอผล ห้าม tick แทน

### Definition of Done เฟส 0
- key ใช้ได้จริง + MemberType 3 ประเภทใน DB + Tu ผูก VIP + checklist ด้านบนผ่านครบ (ข้อที่ต้อง user เทส = user ยืนยันแล้ว)

---

## 4) เฟส 1 — DailyPlan + ปฏิทิน

> เป้าหมาย: user (ที่มีสิทธิ์) เห็นแผนออกกำลังกาย+อาหารของตัวเองล่วงหน้าเป็นปฏิทิน

### WO-1.1 Schema
```prisma
model DailyPlan {
  id           String   @id @default(cuid())
  memberId     String
  date         DateTime // วันที่ของแผน (BKK date, เก็บ 00:00 UTC ของวันนั้น-7)
  exercisePlan Json     // {title, durationMin, items:[{name, sets?, reps?, minutes?, note}], caloriesTarget}
  mealPlan     Json     // {meals:[{slot:"เช้า|กลางวัน|เย็น|ว่าง", menu, ingredients?, kcal, protein, carbs, fat, sodium?, sugar?}], totalKcal}
  aiNote       String?  // เหตุผล/การปรับแผนของ AI
  status       String   @default("planned") // planned | done | partial | skipped
  exerciseDone Boolean  @default(false)
  mealsDone    Json?    // {"เช้า":true,...}
  generatedAt  DateTime @default(now())
  weekBatchId  String?  // ผูกชุดที่ gen พร้อมกัน ใช้ตอน regenerate
  member       Member   @relation(...)
  @@unique([memberId, date])
  @@index([memberId, date])
  @@map("daily_plans")
}
```
- `prisma db push` + regenerate — ระวัง: ต้อง build image ใหม่ให้ client ใหม่เข้า container

### WO-1.2 AI Weekly Plan Generator
- `src/lib/planGenerator.ts`: `generateWeekPlan(memberId, startDate)` → 1 OpenAI call ได้ 7 วัน (JSON mode, validate ด้วย zod ก่อนเซฟ)
- Input context: ใช้ `gatherMemberContext()` เดิม + เป้า macro + dietType + goalType + activityLevel + log 7 วันล่าสุด
- กติกาความปลอดภัย: แคลอรี่แผน ≥ BMR เสมอ, เมนูไทยหาได้ทั่วไป/ทำเอง (ร้านค้าไม่มีแล้ว), ท่าออกกำลังกายระดับเริ่มต้น-กลาง ไม่ต้องใช้อุปกรณ์ยิม ยกเว้น activityLevel สูง
- API: `POST /api/plan/generate` (gate + กันเรียกซ้ำถ้าสัปดาห์นี้มีแล้ว), `GET /api/plan?month=YYYY-MM` (คืนทั้งเดือน), `PATCH /api/plan/[id]` (tick done)
- fallback: AI ล่ม → template แผนกลางที่ปลอดภัย + aiNote บอกว่าเป็นแผนสำรอง

### WO-1.3 หน้าปฏิทิน `/plan` (LIFF)
- มุมมองเดือน: จุดสีใต้วันที่ — เขียว=done, เหลือง=partial, แดง=skipped(อดีต), เทา=planned(อนาคต), วงกลม=วันนี้
- กดวัน → bottom sheet: ส่วนออกกำลังกาย (รายการท่า + ปุ่มติ๊ก "ทำแล้ว") + มื้ออาหาร (การ์ดต่อมื้อ + kcal/macro + ติ๊กต่อมื้อ)
- ปุ่ม "สร้างแผนสัปดาห์หน้า" (โชว์เมื่อยังไม่มีแผน)
- เพิ่มเข้า BottomNavBar + ทางเข้าจาก /goal
- ไม่มีสิทธิ์ → หน้า lock สวยงาม "ฟีเจอร์สำหรับสมาชิกคอร์ส" + ปุ่มติดต่อแอดมิน (เปิดแชท OA)
- อย่าลืม: path `/plan` ต้องเพิ่มใน `getLiffIdForPath` (fallback ไป cal อยู่แล้วถ้าไม่เพิ่ม — เพิ่มให้ชัดดีกว่า) และ LiffProvider ไม่ skip

### QC เฟส 1 (ทดสอบครบทุกปุ่ม)
- [ ] `tsc --noEmit` ผ่าน + build ผ่าน + deploy แล้ว https://goodfood.in.th/plan ตอบ
- [ ] gen แผนให้ Tu → 7 แถวใน daily_plans, ทุกวันแคลอรี่ ≥ BMR ของ Tu, JSON structure ตรง schema (SELECT + validate)
- [ ] gen ซ้ำสัปดาห์เดิม → ถูกกัน ไม่สร้างซ้ำ (unique constraint + API 409)
- [ ] ปฏิทิน: เปลี่ยนเดือนไป-กลับ, กดวันมีแผน/ไม่มีแผน/วันอนาคต, ติ๊กออกกำลังกาย, ติ๊กครบทุกมื้อ → จุดเปลี่ยนเขียว + DB status เปลี่ยน
- [ ] ติ๊กแล้ว reload หน้า → ค่าคงอยู่ (ไม่ใช่ state ลอย)
- [ ] บัญชีไม่มีสิทธิ์ → เห็นหน้า lock, เรียก API ตรง (curl ไม่มีสิทธิ์) → 403
- [ ] AiUsageLog มีบันทึกการ gen + โควตาถูกหักตาม MemberType
- [ ] user เทสบนมือถือจริง: เปิดจาก LINE ลื่น ไม่หมุนค้าง (บทเรียนจากบั๊ก LIFF เดิม)

---

## 5) เฟส 2 — Cron โค้ชเช้า (push วันละ 1 ข้อความ)

### WO-2.1 `GET /api/cron/morning-coach` (X-Cron-Secret เดิม)
- ดึงสมาชิกที่ `isAiCoachActive()` && `notifyMorningCoach` && ไม่ pause (`notificationsPausedUntil`)
- ต่อคน: สรุปเมื่อวาน (MealLog รวม kcal+macro / WaterLog / ExerciseLog / WeightLog ล่าสุด) + แผนวันนี้จาก DailyPlan (ไม่มีแผน→gen หรือใช้ fallback) + คำแนะนำปรับ 1-2 ประโยค (ใช้ generateCoachingMessage type "morning" ที่มีอยู่ — ขยาย buildPrompt ให้รวมแผนวันนี้)
- ส่งเป็น **Flex Message 1 ใบ** (createCoachingFlexMessage มีอยู่แล้ว — เพิ่ม section แผนวันนี้ + ปุ่ม "ดูปฏิทิน" ลิงก์ LIFF /plan)
- เคารพ `morningCoachTime` ของ MemberType: cron ยิงทุก 30 นาทีช่วง 05:30-09:00 BKK แล้วในโค้ดกรองว่าถึงเวลาของ type นั้นหรือยัง + กันส่งซ้ำ (เช็ค log ว่าวันนี้ส่งแล้ว — เพิ่มตาราง `CoachDispatchLog(memberId, date, type)` unique กันซ้ำ)
- **นับ push:** log จำนวนส่งต่อวัน + ถ้าประมาณการเดือนนี้จะเกิน 280 → หยุดส่ง + แจ้งเตือนใน backoffice/log (กันโควตาเต็มเงียบๆ)

### WO-2.2 crontab VPS
```
# ทุก 30 นาที ช่วง UTC 22:30-02:00 (= BKK 05:30-09:00)
30 22,23 * * * curl -s -H "X-Cron-Secret: $SECRET" https://goodfood.in.th/api/cron/morning-coach >> /var/log/goodfood-cron.log 2>&1
0,30 0,1 * * * ...เดียวกัน...
0 2 * * * ...เดียวกัน...
```
(Opus เขียนบรรทัดจริงตอนทำ — ตรวจ timezone ให้ดี, ARTICLE_CRON_SECRET อยู่ใน .env.production)

### QC เฟส 2
- [ ] ยิง cron ด้วย curl มือ → Tu ได้ Flex ใน LINE จริง 1 ใบ ข้อมูลตรง DB (เทียบเลข kcal เมื่อวานกับ SELECT เอง)
- [ ] ยิงซ้ำทันที → ไม่ส่งซ้ำ (CoachDispatchLog กัน)
- [ ] คนไม่มีสิทธิ์/ปิด notify → ไม่ได้รับ
- [ ] ปุ่ม "ดูปฏิทิน" ใน Flex กดแล้วเปิด /plan ถูกวัน
- [ ] secret ผิด → 401
- [ ] ข้อความไม่มีข้อมูลแต่ง: วันที่ไม่มี log เมื่อวาน → ข้อความบอกตรงๆ ว่าไม่มีบันทึก ไม่ใช่ตัวเลขมั่ว
- [ ] crontab ติดตั้งแล้ว + `/var/log/goodfood-cron.log` มีผลรันจริงเช้าถัดไป (รอ 1 วันจริง)

---

## 6) เฟส 3 — AI ตอบแชทใน LINE (reply — ฟรี ไม่กินโควตา)

### WO-3.1 ขยาย webhook `src/app/api/line/webhook/route.ts`
- ข้อความ text จาก user → ตรวจสิทธิ์:
  - มีสิทธิ์: gatherMemberContext + แผนวันนี้ + ประวัติแชท 10 ข้อความล่าสุด (LineMessage มีอยู่แล้ว) → OpenAI → **reply ภายใน reply token** (~มีเวลาไม่ถึงนาที — ต้องตอบเร็ว: ใช้โมเดลเร็ว + timeout 8s + fallback ข้อความสุภาพ)
  - ไม่มีสิทธิ์: reply แนะนำคอร์ส (rate-limit: ตอบครั้งเดียวต่อวันต่อคน กันสแปมตัวเอง)
- system prompt: นักโภชนาการ+เทรนเนอร์ภาษาไทย สุภาพ ให้กำลังใจ, รู้เป้า/แผน/log ของ user, **ห้ามวินิจฉัยโรค/จ่ายยา** — เรื่องการแพทย์ให้แนะนำพบแพทย์, ห้ามสัญญาว่าจะติดต่อกลับ
- เก็บทั้งคำถาม-คำตอบลง LineMessage (มี model แล้ว)
- โควตา: หักตามชนิดใหม่ หรือรวมใน totalDailyAiLimit (Fable ตัดสิน: แนะนำเพิ่ม field `dailyChatLimit` ใน MemberType default 20)

### QC เฟส 3
- [ ] Tu พิมพ์ "เมื่อวานกินอะไรไปบ้าง" → AI ตอบตรงกับ MealLog จริง
- [ ] ถาม "เย็นนี้กินส้มตำได้ไหม" → คำตอบอ้างแคลอรี่คงเหลือวันนี้ถูกต้อง
- [ ] ถามเรื่องยา/โรค → ปฏิเสธสุภาพ + แนะนำพบแพทย์
- [ ] บัญชีไม่มีสิทธิ์ → ได้ข้อความแนะนำคอร์ส และครั้งที่ 2 ในวันเดียว → เงียบ
- [ ] สแปม 25 ข้อความ → โดน limit + ข้อความบอกโควตาหมดวันนี้
- [ ] ตรวจ `/v2/bot/message/quota/consumption` ก่อน-หลังแชท → **ยอด push ไม่ขยับ** (พิสูจน์ว่า reply ฟรี)
- [ ] webhook ยัง verify signature ถูกต้อง (ของเดิมมี crypto — ห้ามทำพัง)

---

## 7) เฟส 4 — Macro Dashboard + เตือนโซเดียม/น้ำตาล

### WO-4.1 หน้า /cal เพิ่มแถบ macro
- การ์ด "วันนี้": โปรตีน x/y g · คาร์บ · ไขมัน · โซเดียม · น้ำตาล (progress bar, MacroProgressBar component มีอยู่แล้ว — เช็คก่อนว่า reuse ได้ไหม)
- โซเดียม/น้ำตาล ≥80% เป้า → แถบเปลี่ยนส้ม, เกิน → แดง + ข้อความสั้น
- ฟรีทุกคน (เป็นของ log ที่ user บันทึกเอง ไม่ใช้ AI) — **ไม่ต้อง gate**

### WO-4.2 แจ้งเตือนแบบไม่เปลือง push
- ไม่ทำ push แยก (เปลืองโควตา) → ยัดคำเตือนโซเดียม/น้ำตาลเข้าไปในข้อความโค้ชเช้าวันถัดไป + แสดง realtime ในแอป

### QC เฟส 4
- [ ] บันทึกอาหารโซเดียมสูง (เช่น บะหมี่กึ่งสำเร็จรูป 2 ซอง) → แถบแดง + เตือนถูกต้องตามตัวเลข DB
- [ ] ครบทุก macro: ค่าตรงกับ SUM(MealLog ของวัน) — เขียน SQL เทียบเอง
- [ ] วันใหม่ (หลังเที่ยงคืน BKK) → reset เป็น 0 ถูกต้อง (timezone!)
- [ ] มือถือจอเล็ก: layout ไม่แตก (user เทส)

---

## 8) เฟส 5 — ปรับแผนอัตโนมัติรายสัปดาห์ (Adaptive)

### WO-5.1 `GET /api/cron/weekly-adjust` (อาทิตย์เย็นหรือจันทร์เช้าก่อน morning-coach)
- ต่อคน: เทรนด์น้ำหนัก 14 วัน + adherence (จาก DailyPlan.status + MealLog) → AI ตัดสิน: คงแผน / เพิ่ม-ลดแคลอรี่ (±10% max ต่อรอบ, ห้ามต่ำกว่า BMR) / เปลี่ยนความหนักออกกำลังกาย → เขียน dailyCalories/macro ใหม่ + gen สัปดาห์ใหม่ + aiNote อธิบาย
- plateau (น้ำหนักนิ่ง 2 สัปดาห์ทั้งที่ทำตามแผน >70%) → ปรับ + ข้อความให้กำลังใจใน morning coach จันทร์
- ทุกการปรับเก็บ history (ตาราง `PlanAdjustment` หรือใน aiNote + AiRecommendation เดิม — Fable ตัดสิน)

### QC เฟส 5
- [ ] จำลองข้อมูล: member ทดสอบที่น้ำหนักนิ่ง 14 วัน → cron รันแล้วเป้าถูกปรับ, ไม่ทะลุกรอบ ±10%, ไม่ต่ำกว่า BMR
- [ ] member ที่ลดตามเป้า → แผนคงเดิม + คำชม
- [ ] การปรับสะท้อนใน: /goal (เป้าใหม่), /plan (แผนใหม่), ข้อความเช้า (บอกว่าปรับเพราะอะไร) — ครบ 3 จุด
- [ ] ไม่มีข้อมูลพอ (member ใหม่ <7 วัน) → ข้าม ไม่ปรับมั่ว

---

## 9) QC Master Gate (ก่อนประกาศเสร็จทั้งโปรเจกต์)

1. รี-run checklist เฟส 0 (ปุ่ม backoffice ทั้งหมด) — กัน regression
2. Flow ครบวงจรด้วยบัญชี LINE ใหม่ถอดด้าม: add friend → onboarding → แอดมินให้สิทธิ์ทดลอง 7 วัน → gen แผน → เช้าถัดไปได้ Flex → ติ๊กตามแผน → แชทถาม AI → ครบ 7 วันสิทธิ์หมด → ฟีเจอร์ lock ถูกต้อง + แชทได้ข้อความแนะนำคอร์ส
3. โควตา: นับ push ที่ใช้จริงตลอดการเทส เทียบ `/v2/bot/message/quota/consumption`
4. Load เบาๆ: สร้าง member หลอก 20 คนใน DB → cron เช้ารันจบใน <2 นาที ไม่ OOM (แล้วลบทิ้ง)
5. `npx tsc --noEmit` + build สะอาด + ทุก commit push GitHub แล้ว
6. อัปเดต memory (`project_goodfood.md`) + ledger นี้เป็นสถานะจบ

---

## 10) การแบ่งงาน Fable 5 (คุม) / Opus 5 (ทำ)

- **Fable:** อ่านไฟล์นี้ก่อนเริ่มเสมอ → เลือก WO ถัดไป → ตัดสินใจจุดที่ marked "Fable ตัดสิน" → ตรวจ QC checklist ทีละข้อ (สั่ง Opus แสดงหลักฐาน: output curl / SQL / screenshot จาก user) → เป็นคนเดียวที่ tick ✅ → รายงาน user เป็นไทย
- **Opus:** ทำทีละ WO จบเป็นชิ้น → self-test ก่อนส่ง → ส่งหลักฐานให้ Fable → ห้ามข้าม QC ห้ามประเมินเกินจริง ("น่าจะได้" = ยังไม่เสร็จ)
- ทั้งคู่: งานที่ต้อง user เทสบนมือถือจริง (LIFF/LINE) → เตรียม checklist สั้นๆ ภาษาไทยส่ง user แล้ว**รอผลจริง** ก่อน tick
- ห้ามรัน build ขนานกับงานหนักอื่น (VPS 3GB)
- ทำตามลำดับเฟส 0→1→2→3→4→5 (เฟส 4 สลับขึ้นก่อน 3 ได้ถ้า user อยากเห็นของเร็ว — ถาม user ตอนจบเฟส 2)

## 11) คำสั่งที่ใช้บ่อย

```bash
cd /root/projects/goodfood
npx tsc --noEmit                                   # typecheck
docker compose up -d --build web                   # deploy (รัน background, หลายนาที)
docker compose logs --tail=50 web
docker exec goodfood-db psql -U goodfood -d goodfood_db -c "SQL"
# ตรวจ bundle ใน prod:
docker exec goodfood-web sh -c 'grep -roh "PATTERN" /app/.next/static | head'
# LINE API (token จาก .env.production):
curl -H "Authorization: Bearer $TOKEN" https://api.line.me/v2/bot/info
curl -H "Authorization: Bearer $TOKEN" https://api.line.me/v2/bot/message/quota/consumption
```

## 12) ความเสี่ยง/กับดักที่รู้แล้ว

- LIFF เปิดใน LINE เท่านั้น — เทสใน browser ใช้ `?dev=true` (mock profile dev-user-001) ได้ระดับหนึ่ง แต่ **ของจริงต้อง user เทสในแอป LINE**
- `.env.production` ถูก COPY เข้า image ตอน build — แก้แล้วต้อง build ใหม่ ไม่ใช่แค่ restart
- Next.js standalone ไม่ serve public/ runtime — ไฟล์อัปโหลดผ่าน nginx alias `/var/lib/goodfood/uploads`
- เวลา crontab = UTC (BKK-7) — ผิดบ่อย เช็คสองรอบ
- reply token ใช้ได้ครั้งเดียว + อายุสั้น — webhook ต้องตอบเร็ว (timeout AI 8s + fallback)
- member "Tu" = ข้อมูลจริงของ user **ห้ามลบ/ห้าม overwrite log**
- แพลนฟรี 300 push/เดือน — ทุกการเทส push ให้นับและรายงาน user
