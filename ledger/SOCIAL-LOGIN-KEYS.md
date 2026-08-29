# Goodfood — Social Login: สถานะและสิ่งที่ยังขาด

📖 **คู่มือขั้นตอนขอกุญแจแบบละเอียด (Google/Apple/LINE/Facebook) อยู่ที่ `/root/docs/SOCIAL-LOGIN-KEYS.md`**
อ่านไฟล์นั้นก่อนลงมือ — มีกับดักที่เจอมาจริงทั้งหมด

บันทึก 28 ส.ค. 2026 จากงานที่ทำเสร็จบน siamdive-maps

---

## สถานะจริงของ Goodfood (ตรวจแล้ว ไม่ใช่เดา)

```
src/lib/socialAuth.ts   มีคำว่า "facebook" / "line"
src/lib/liffAuth.ts     LINE LIFF
.env                    ❌ ไม่มี GOOGLE_/APPLE_/LINE_/FACEBOOK_ CLIENT ID/SECRET เลย
```

⚠️ **ต้องแยกให้ออกก่อนเริ่มงาน:** `socialAuth.ts` ของ Goodfood น่าจะเป็นเรื่อง
**โพสต์ลงโซเชียล (publishing)** ไม่ใช่ **ล็อกอินด้วยโซเชียล (login)** — คนละเรื่องกันคนละกุญแจ

🔴 **เปิดโค้ดอ่านให้แน่ใจก่อน อย่าเชื่อชื่อไฟล์** (ดู memory `feedback_verify_web_source_before_porting`)
ถ้าเป็น publishing จริง = Goodfood **ยังไม่มีระบบ social login เลย** ต้องเริ่มจากศูนย์

---

## ถ้าจะทำ social login ให้ Goodfood

**ลำดับที่แนะนำ**

```
1. Google   ← ง่ายสุด ฟรี ใช้ได้ทันที
2. LINE     ← กลุ่มลูกค้าไทยใช้เยอะ · สิทธิ์อีเมลต้องยื่นขอและอาจไม่ผ่าน
3. Facebook ← ต้องผ่าน App Review 2-5 วัน ยื่นเร็วดีกว่า
4. Apple    ← $99/ปี · จำเป็นก็ต่อเมื่อจะขึ้น App Store
```

**Apple จำเป็นไหม** — ถ้า Goodfood เป็นเว็บอย่างเดียวไม่ขึ้น App Store **ยังไม่ต้องทำ**
แต่ถ้าวันหนึ่งทำแอปแล้วมีปุ่ม Google/Facebook อยู่ → Apple Guideline 4.8 บังคับให้ต้องมี Apple ด้วย

---

## ⚠️ ข้อควรระวังเฉพาะ Goodfood

**1. ห้ามใช้กุญแจร่วมกับโปรเจกต์อื่น**
Goodfood มีแอป Facebook ของตัวเองอยู่แล้ว (`reference_goodfood_fb_credentials` App `1377933440828067`)
**แอปนั้นใช้สำหรับโพสต์เพจ ไม่ควรเอามาทำ login** — สร้าง use case / ตรวจสิทธิ์แยกให้ชัด
ดู memory `feedback_no_shared_credentials_across_projects`

**2. Goodfood เคยมีช่องโหว่ API เปิดโล่ง 57 เส้น** (ปิดไปแล้ว 22 ส.ค.)
🔴 **ก่อนต่อ social login ให้กวาด auth ทุก route ก่อน** — ดู `feedback_audit_route_auth_in_legacy_backoffice`
และรัน `scripts/check-api-auth.ts` หลัง deploy

**3. Privacy / Terms ต้องมีจริงและตอบ 200**
Facebook และ Google บังคับกรอก URL สองอันนี้ และผู้ตรวจจะกดเข้าไปดูจริง

---

## ก่อนบอกว่าเสร็จ

ใช้เช็คลิสต์หัวข้อ 6 ในคู่มือหลัก — ข้อสำคัญที่สุดคือ
**ตรวจในฐานข้อมูลว่าอีเมลเดียวกันจากคนละ provider = บัญชีเดียวกัน**
ไม่ใช่แตกเป็นบัญชีใหม่แล้วข้อมูลเดิมหาย
